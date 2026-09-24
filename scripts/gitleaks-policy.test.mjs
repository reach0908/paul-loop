import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/gitleaks.yml'), 'utf8');
// Execute the actual workflow body; do not duplicate its policy or range logic here.
const body = workflow.match(/- name: scan with trusted policy[\s\S]*?        run: \|\n((?:          .*\n)+)/)?.[1];
assert.ok(body, 'trusted scan step is missing');
const script = body.replace(/^          /gm, '');
const trusted = readFileSync(join(root, '.gitleaks.toml'), 'utf8');
const permissive = "[extend]\nuseDefault=true\n[allowlist]\nregexes=['.*']\n";
// Assembled only in disposable histories; no credential-shaped literal in the repository.
const synthetic = 'gh' + 'p_' + '1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R';

test('the real scanner ignores submitted suppression policy and preserves trusted controls', t => {
  assert.equal(execFileSync('gitleaks', ['version'], { encoding: 'utf8' }).trim(), '8.24.3');
  const temp = mkdtempSync(join(tmpdir(), 'gitleaks policy '));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const fixture = name => {
    const dir = join(temp, name); mkdirSync(dir);
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (path, content) => writeFileSync(join(dir, path), content);
    const commit = () => { git('add', '-A'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid');
    write('.gitleaks.toml', trusted); write('README.md', 'fixture\n');
    return { dir, git, write, commit, base: commit() };
  };
  const scan = (f, { policy = f.base, head = f.git('rev-parse', 'HEAD'), base = f.base, env = {} } = {}) => {
    const runner = mkdtempSync(join(temp, 'runner '));
    const before = f.git('status', '--porcelain');
    const result = spawnSync('bash', ['-c', script], {
      cwd: f.dir, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, ...env, RUNNER_TEMP: runner, POLICY_SHA: policy, SCAN_HEAD: head, SCAN_BASE: base },
    });
    assert.equal(result.error, undefined);
    assert.equal(f.git('status', '--porcelain'), before, 'scan must not modify the submitted checkout');
    return { ...result, report: join(runner, 'gitleaks.sarif') };
  };
  const findings = result => JSON.parse(readFileSync(result.report, 'utf8')).runs[0].results;

  for (const mode of ['config', 'config-symlink', 'environment', 'ignore', 'inline', 'removed', 'merge']) {
    const f = fixture(mode);
    if (mode === 'inline') {
      f.write('leak.txt', '// gitleaks:allow\n'); f.base = f.commit();
    }
    const marked = mode === 'inline' || mode === 'removed';
    f.write('leak.txt', `token=${synthetic}${marked ? ' // gitleaks:allow' : ''}\n`);
    const env = {};
    if (mode === 'config') f.write('.gitleaks.toml', permissive);
    if (mode === 'config-symlink') {
      f.write('submitted.toml', permissive); rmSync(join(f.dir, '.gitleaks.toml'));
      symlinkSync('submitted.toml', join(f.dir, '.gitleaks.toml'));
    }
    if (mode === 'environment') {
      f.write('submitted.toml', permissive);
      env.GITLEAKS_CONFIG = join(f.dir, 'submitted.toml'); env.GITLEAKS_CONFIG_TOML = permissive;
    }
    let leaked;
    if (mode === 'merge') {
      const cleanTree = f.git('rev-parse', f.base + '^{tree}');
      const left = f.git('commit-tree', cleanTree, '-p', f.base, '-m', 'left');
      const right = f.git('commit-tree', cleanTree, '-p', f.base, '-m', 'right');
      f.git('add', '-A');
      leaked = f.git('commit-tree', f.git('write-tree'), '-p', left, '-p', right, '-m', 'merge-only secret');
      f.git('update-ref', 'refs/heads/main', leaked);
    } else leaked = f.commit();
    if (mode === 'ignore') {
      f.write('.gitleaksignore', `${leaked}:leak.txt:github-pat:1\n`); f.commit();
    }
    if (mode === 'removed') { rmSync(join(f.dir, 'leak.txt')); f.commit(); }
    const legacy = spawnSync('gitleaks', ['git', '.', '--redact', '--log-opts=' + f.base + '..HEAD'], {
      cwd: f.dir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(legacy.status, 0, `${mode}: reproduce the suppression before testing the fix\n${legacy.stderr}`);
    const result = scan(f, { env });
    assert.equal(result.status, 1, `${mode}: ${result.stderr}`);
    assert.ok(findings(result).some(finding => finding.ruleId === 'github-pat'), mode);
  }

  const clean = fixture('legitimate');
  for (const file of ['helpers/postgres-fixture.ts', 'cli.integration.test.ts', 'consolidate.integration.test.ts', 'lessons.integration.test.ts']) {
    const dest = join(clean.dir, file); mkdirSync(join(dest, '..'), { recursive: true });
    cpSync(join(root, 'tools/loop-memory/test', file), dest);
  }
  clean.commit();
  for (const base of [clean.base, '', '0'.repeat(40)]) {
    const result = scan(clean, { policy: base === clean.base ? clean.base : clean.git('rev-parse', 'HEAD'), base });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(findings(result), []);
  }
  const push = scan(clean, { policy: clean.git('rev-parse', 'HEAD') });
  assert.equal(push.status, 0, push.stderr);
  assert.deepEqual(findings(push), []);

  const ignored = fixture('trusted-ignore');
  ignored.write('leak.txt', `token=${synthetic}\n`); const old = ignored.commit();
  const beforeIgnore = scan(ignored, { base: '' });
  assert.equal(beforeIgnore.status, 1, beforeIgnore.stderr);
  ignored.write('.gitleaksignore', `${old}:leak.txt:github-pat:1\n`); const approved = ignored.commit();
  ignored.write('.gitleaksignore', 'submitted replacement\n'); ignored.commit();
  const withIgnore = scan(ignored, { policy: approved, base: '' });
  assert.equal(withIgnore.status, 0, withIgnore.stderr);
  assert.deepEqual(findings(withIgnore), []);

  for (const options of [{ policy: 'missing-ref' }, { head: 'missing-ref' }, { base: 'missing-ref' }]) {
    const result = scan(clean, options);
    assert.notEqual(result.status, 0, 'unresolvable refs must not fall back');
    assert.throws(() => readFileSync(result.report), { code: 'ENOENT' });
  }
  const missing = fixture('missing-policy');
  rmSync(join(missing.dir, '.gitleaks.toml')); missing.base = missing.commit();
  missing.write('.gitleaks.toml', permissive); missing.commit();
  const result = scan(missing);
  assert.notEqual(result.status, 0, 'missing base policy must not use submitted policy');
  assert.throws(() => readFileSync(result.report), { code: 'ENOENT' });
  const malformed = fixture('malformed-policy');
  malformed.write('.gitleaks.toml', 'not valid TOML = ['); malformed.base = malformed.commit();
  assert.notEqual(scan(malformed).status, 0, 'scanner configuration errors must fail the job');
});
