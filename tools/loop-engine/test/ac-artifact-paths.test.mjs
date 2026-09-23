import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/ac-verify.sh');
const temp = realpathSync(mkdtempSync(join(tmpdir(), 'ac-artifact-paths-')));
const root = join(temp, 'worktree'), outside = join(temp, 'worktree-sibling');
mkdirSync(root); mkdirSync(outside);
writeFileSync(join(outside, 'secret.txt'), 'outside-only-marker');
writeFileSync(join(root, 'inside.txt'), 'inside-only-marker');
mkdirSync(join(root, 'docs'));
writeFileSync(join(root, 'docs', '한 글.txt'), 'literal [needle].*');
symlinkSync(outside, join(root, 'escape'));
symlinkSync(join(outside, 'secret.txt'), join(root, 'escape.txt'));
symlinkSync('inside.txt', join(root, 'internal.txt'));
symlinkSync('docs', join(root, 'internal-dir'));
let serial = 0;
function run(contract, code, reason, env = {}) {
  const plan = join(temp, 'plan.md'), logs = `.loop/run-${++serial}`;
  writeFileSync(plan, `AC: artifact boundary | ${contract}\n`);
  const r = spawnSync('bash', [script, plan, '--log-dir', logs], {
    cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, ...env },
  });
  assert.equal(r.status, code, `${contract}: ${r.error || ''}\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.stdout + r.stderr, /OUTSIDE_ARTIFACT_READ/);
  assert.match(r.stdout, new RegExp(`^VERDICT: ${code ? 'FAIL' : 'PASS'}$`, 'm'));
  assert.equal((r.stdout.match(/^=== VERDICT ===$/gm) || []).length, 1);
  const state = JSON.parse(readFileSync(join(root, logs, 'verdict-state.json'), 'utf8'));
  assert.equal(state.verdict, code ? 'FAIL' : 'PASS');
  if (reason) assert.match(r.stdout, reason);
  assert.equal(readFileSync(join(outside, 'secret.txt'), 'utf8'), 'outside-only-marker');
}
try {
  // These used to certify a foreign file through both existence and content checks.
  for (const path of [join(outside, 'secret.txt'), '../worktree-sibling/secret.txt',
    'docs/../../worktree-sibling/secret.txt', 'escape.txt', 'escape/secret.txt']) {
    run(`artifacts: ${path}`, 1, /artifact/);
    run(`artifacts: ${path} | expect: outside-only-marker`, 1, /artifact/);
    run(`verify: echo outside-only-marker | artifacts: ${path} | expect: outside-only-marker`, 1, /artifact/);
  }
  run(`artifacts: ${join(root, 'inside.txt')}`, 1, /artifact/);
  run('artifacts: docs/../inside.txt', 1, /artifact/);
  run('artifacts: inside.txt, escape.txt | expect: inside-only-marker', 1, /artifact/);
  run('artifacts: inside.txt, missing.txt | expect: inside-only-marker', 1, /missing artifact/);
  run('artifacts: , , | verify: true', 1, /artifact/);
  run('artifacts: docs/한 글.txt | expect: literal [needle].*', 0);
  run('artifacts: docs | expect: literal [needle].*', 0);
  run('artifacts: ./inside.txt, docs | expect: inside-only-marker', 0);
  run('artifacts: internal.txt | expect: inside-only-marker', 0);
  run('artifacts: internal-dir | expect: literal [needle].*', 0);
  symlinkSync('.', join(root, 'docs', 'cycle'));
  run('artifacts: docs | expect: literal [needle].*', 0);
  symlinkSync(join(outside, 'secret.txt'), join(root, 'docs', 'external'));
  run('artifacts: docs | expect: outside-only-marker', 1, /artifact/);
  run('artifacts: docs | expect: literal [needle].*', 1, /artifact/);
  rmSync(join(root, 'docs', 'external'));
  run('verify: echo log-only-marker | artifacts: inside.txt | expect: inside-only-marker', 1, /expect substring not found/);
  run('verify: echo log-only-marker | artifacts: inside.txt | expect: log-only-marker', 0);
  run('verify: ln -s ../worktree-sibling/secret.txt made-by-verify | artifacts: made-by-verify', 1, /artifact/);
  run('verify: echo generated > new.txt | artifacts: new.txt | expect: generated', 1, /expect substring not found/);
  run('artifacts: new.txt | expect: generated', 0);

  const preload = join(temp, 'swap-before-open.mjs');
  writeFileSync(preload, `import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
    const open = fs.openSync, read = fs.readFileSync; let targetFd;
    fs.openSync = (path, ...args) => {
      if (path === ${JSON.stringify(join(root, 'inside.txt'))}) {
        fs.unlinkSync(path); fs.symlinkSync(${JSON.stringify(join(outside, 'secret.txt'))}, path);
        return targetFd = open(path, ...args);
      }
      return open(path, ...args);
    };
    fs.readFileSync = (path, ...args) => {
      const data = read(path, ...args);
      if (path === targetFd) process.stderr.write('OUTSIDE_ARTIFACT_READ');
      return data;
    }; syncBuiltinESMExports();`);
  run('artifacts: inside.txt | expect: inside-only-marker', 1, /artifact/, {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preload).href}`].filter(Boolean).join(' '),
  });
  const rootAlias = join(temp, 'redirected-root'); symlinkSync(root, rootAlias);
  const redirected = spawnSync(process.execPath, [resolve(dirname(script), '../lib/ac-artifacts.mjs'),
    rootAlias, 'new.txt', 'generated'], { encoding: 'utf8' });
  assert.equal(redirected.status, 2);
  assert.match(redirected.stderr, /invocation directory was redirected/);
  console.log('PASS: AC artifacts stay inside the invocation directory; recursive search, internal links and verdict state agree');
} finally { rmSync(temp, { recursive: true, force: true }); }
