import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, realpathSync, chmodSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolvePluginInstallation, resolvePluginPath, validatePluginPath } from '../bin/plugin-path.mjs';
import { approvePluginFixture } from './helpers/plugin-approval.mjs';
const cli = fileURLToPath(new URL('../bin/plugin-path.mjs', import.meta.url));
const versions = { 'loop-engine': '0.15.0', 'ship-flow': '0.11.0', 'loop-memory': '0.7.0' };
function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'plugin paths 한글 ')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, data) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data)); };
  const plugin = (id = 'loop-engine', runtime = 'claude', suffix = '', version = versions[id]) => {
    const path = join(root, `${runtime}-${id}${suffix}`); write(join(path, `.${runtime}-plugin/plugin.json`), { name: id, version, repository: 'https://github.com/reach0908/paul-loop' }); return path;
  };
  const registry = join(root, 'claude/plugins/installed_plugins.json');
  const opts = { root, pluginsFile: registry, runtime: 'claude', env: {} };
  return { root, write, plugin, registry, opts, set: (entries, id = 'loop-engine') => write(registry, { plugins: { [`${id}@paul-loop`]: entries } }) };
}
test('fixture approval pins bytes and modes outside the artifact; symlinks cannot refresh it', (t) => {
  const f = fixture(t), path = f.plugin(), payload = join(path, 'bin/probe.mjs');
  f.write(payload, 'process.exit(0);');
  chmodSync(join(path, '.claude-plugin/plugin.json'), 0o644); chmodSync(payload, 0o644);
  const approved = approvePluginFixture(f.root, path);
  assert.equal(approved.sha256, '9c2d8a9c98da256a5755b97c61953e3c32e8bea323417faedefd93782b8041d7');
  const lock = join(f.root, '.claude/paul-loop.lock.json'), bytes = readFileSync(lock, 'utf8');
  f.write(payload, 'process.exit(1);');
  assert.equal(readFileSync(lock, 'utf8'), bytes);
  const changed = approvePluginFixture(f.root, path); assert.notEqual(changed.sha256, approved.sha256);
  chmodSync(payload, 0o755);
  const executable = approvePluginFixture(f.root, path); assert.notEqual(executable.sha256, changed.sha256);
  const lastApproval = readFileSync(lock, 'utf8');
  symlinkSync(payload, join(path, 'bin/alias.mjs'));
  assert.throws(() => approvePluginFixture(f.root, path), /rejects symlinks/);
  assert.equal(readFileSync(lock, 'utf8'), lastApproval);
});
test('missing/malformed/empty registry and unknown plugins fail without guessing', (t) => {
  const f = fixture(t);
  assert.equal(resolvePluginPath(f.opts), null);
  f.write(f.registry, '{invalid'); assert.equal(resolvePluginPath(f.opts), null);
  for (const data of [{}, { plugins: {} }, { plugins: { 'loop-engine@paul-loop': [] } }]) {
    f.write(f.registry, data); assert.equal(resolvePluginPath(f.opts), null);
  }
  assert.throws(() => resolvePluginPath({ ...f.opts, plugin: 'unknown' }), /unknown/);
  for (const plugin of ['constructor', '__proto__']) assert.throws(() => resolvePluginPath({ ...f.opts, plugin }), /unknown/);
});
test('exact project, local override, user fallback, no unrelated-project fallback', (t) => {
  const f = fixture(t), a = f.plugin(), b = f.plugin('loop-engine', 'claude', '-other'), u = f.plugin('loop-engine', 'claude', '-user');
  approvePluginFixture(f.root, a); // The three locations contain identical approved bytes.
  const entries = [{ scope: 'project', projectPath: join(f.root, 'other'), installPath: b }, { scope: 'project', projectPath: f.root, installPath: a }];
  f.set([entries[1]]); assert.equal(resolvePluginPath(f.opts), a);
  f.set(entries); assert.equal(resolvePluginPath(f.opts), a);
  f.set([...entries, { scope: 'local', projectPath: f.root, installPath: b }]); assert.equal(resolvePluginPath(f.opts), b);
  f.set([entries[0], { scope: 'user', installPath: u }]); assert.equal(resolvePluginPath(f.opts), u);
  f.set([entries[0]]); assert.equal(resolvePluginPath(f.opts), null);
});
test('validated overrides have priority; names, stable versions, floors and stale paths are enforced', (t) => {
  const f = fixture(t), path = f.plugin();
  approvePluginFixture(f.root, path);
  f.set([{scope:'project', projectPath:f.root, installPath:f.plugin('loop-engine', 'claude', '-ignored')}]);
  assert.equal(resolvePluginPath({ ...f.opts, env: { LOOP_ENGINE_PATH: path } }), path);
  for (const invalid of ['relative', join(f.root, 'absent'), f.plugin('ship-flow'), f.plugin('loop-engine', 'claude', '-old', '0.12.1'), f.plugin('loop-engine', 'claude', '-pre', '0.15.0-rc.1')]) {
    assert.throws(() => resolvePluginPath({ ...f.opts, env: { LOOP_ENGINE_PATH: invalid } }));
  }
  f.set([{ scope: 'user', installPath: path, version: '0.14.1' }]);
  assert.throws(() => resolvePluginPath(f.opts), /drift/);
});
test('each sibling key and override is independent, and inspection does not claim trust', (t) => {
  const f = fixture(t);
  for (const [id, envName] of [['loop-engine', 'LOOP_ENGINE_PATH'], ['ship-flow', 'SHIP_FLOW_PATH'], ['loop-memory', 'LOOP_MEMORY_PATH']]) {
    const path = f.plugin(id);
    approvePluginFixture(f.root, path);
    const found = resolvePluginInstallation({ ...f.opts, plugin: id, env: { [envName]: path } });
    assert.equal(found.path, path); assert.equal(found.hookTrust, 'unknown'); assert.equal(found.activation, 'unknown');
    f.set([{ scope: 'project', projectPath: f.root, installPath: path }], id);
    assert.equal(resolvePluginPath({ ...f.opts, plugin: id }), path);
  }
  const ship = f.plugin('ship-flow');
  f.set([{scope:'project', projectPath:f.root, installPath:ship}], 'ship-flow');
  assert.equal(resolvePluginPath({...f.opts, plugin:'ship-flow', env:{LOOP_ENGINE_PATH:'/wrong-engine-ignored'}}), ship);
  f.set([{ scope: 'user', installPath: f.plugin() }]);
  assert.equal(resolvePluginPath({ ...f.opts, plugin: 'ship-flow', env: { LOOP_ENGINE_PATH: '/not-for-ship-flow' } }), null);
});
test('CLAUDE_CONFIG_DIR and canonical linked-worktree identity resolve the main project registration', (t) => {
  const f = fixture(t), repo = join(f.root, 'main'), worktree = join(f.root, 'feature');
  mkdirSync(repo); execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  execFileSync('git', ['-C', repo, 'worktree', 'add', '-qb', 'feature', worktree]);
  const path = f.plugin(); f.set([{ scope: 'project', projectPath: repo, installPath: path }]);
  approvePluginFixture(repo, path);
  assert.equal(resolvePluginPath({ root: worktree, env: { CLAUDE_CONFIG_DIR: join(f.root, 'claude') }, runtime: 'claude' }), path);
  const alias = join(f.root, 'alias'); symlinkSync(repo, alias);
  assert.equal(resolvePluginPath({ ...f.opts, root: alias }), path);
});
test('Codex uses explicit artifact registration, rejects Claude-only overrides, and reports unknown activation', (t) => {
  const f = fixture(t), path = f.plugin('loop-engine', 'codex');
  approvePluginFixture(f.root, path, 'codex');
  const registry = join(f.root, 'artifacts.json');
  f.write(registry, { schemaVersion: 1, runtime: 'codex', plugins: { 'loop-engine': { path, version: '0.15.0' } } });
  const opts = { root: f.root, runtime: 'codex', env: { PAUL_LOOP_INSTALLATIONS: registry } };
  assert.equal(resolvePluginPath(opts), path);
  assert.equal(resolvePluginPath({ ...opts, env: {} }), null);
  assert.throws(() => resolvePluginPath({ ...opts, env: { LOOP_ENGINE_PATH: f.plugin() } }), /manifest missing/);
  f.write(registry, { schemaVersion: 1, runtime: 'claude' });
  assert.throws(() => resolvePluginPath(opts), /runtime mismatch/);
});
test('CLI dispatch preserves cwd, spaced argv and exit codes; rejects escapes and missing installs', (t) => {
  const f = fixture(t), path = f.plugin();
  const env = { PATH: process.env.PATH, HOME: join(f.root, 'empty-home'), LOOP_ENGINE_PATH: path, LOOP_RUNTIME: 'claude' };
  f.write(join(path, 'bin/args.mjs'), 'console.log(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd()}));process.exitCode=7;');
  const run = (args, overrides = {}) => spawnSync(process.execPath, [cli, ...args], { cwd: f.root, encoding: 'utf8', env: { ...env, ...overrides } });
  approvePluginFixture(f.root, path);
  assert.equal(run(['resolve']).stdout.trim(), path);
  const ship = f.plugin('ship-flow');
  approvePluginFixture(f.root, ship);
  assert.equal(run(['resolve', 'ship-flow'], {SHIP_FLOW_PATH:ship}).stdout.trim(), ship);
  const result = run(['exec', 'bin/args.mjs', 'a b', '한글', '']);
  assert.equal(result.status, 7); assert.deepEqual(JSON.parse(result.stdout), { argv: ['a b', '한글', ''], cwd: f.root });
  f.write(join(path, 'bin/hello.sh'), '[[ -n \"$1\" ]] || exit 9; printf "sh:%s" "$1"');
  approvePluginFixture(f.root, path);
  assert.equal(run(['exec', 'bin/hello.sh', 'two words']).stdout, 'sh:two words');
  f.write(join(path, 'bin/hello.bin'), '#!/bin/sh\nprintf \"bin:%s\" \"$1\"');
  chmodSync(join(path, 'bin/hello.bin'), 0o755);
  approvePluginFixture(f.root, path);
  assert.equal(run(['exec', 'bin/hello.bin', 'two words']).stdout, 'bin:two words');
  f.write(join(path, 'outside.mjs'), 'process.exit(0)');
  symlinkSync(join(path, 'outside.mjs'), join(path, 'bin/escape.mjs'));
  assert.equal(run(['exec', 'bin/escape.mjs']).status, 1);
  assert.equal(run(['exec', 'bin/../outside.mjs']).status, 1);
  assert.equal(run(['exec']).status, 2); assert.equal(run(['resolve', 'unknown']).status, 2);
  const missing = run(['resolve'], { LOOP_ENGINE_PATH: '' });
  assert.equal(missing.status, 1); assert.match(missing.stderr, /loop-engine@paul-loop/);
  const noMemory = run(['resolve', 'loop-memory'], { LOOP_ENGINE_PATH: '' });
  assert.equal(noMemory.status, 1); assert.match(noMemory.stderr, /loop-memory@paul-loop/);
  f.write(join(f.root, 'module space/plugin-path.mjs'), readFileSync(cli).toString());
  const moduleDir = join(f.root, 'module space');
  execFileSync('git', ['init', '-q', moduleDir]);
  execFileSync('git', ['-C', moduleDir, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture']);
  const copied = spawnSync(process.execPath, ['./plugin-path.mjs', 'resolve'], { cwd: moduleDir, encoding: 'utf8', env: { ...env, LOOP_ENGINE_PATH: '' } });
  assert.equal(copied.status, 1); assert.match(copied.stderr, /loop-engine@paul-loop/);
});

test('symlink CLI runs with default and preserved main URLs; imports never run the CLI', (t) => {
  const f = fixture(t), path = f.plugin(), alias = join(f.root, 'resolver alias 한글.mjs');
  approvePluginFixture(f.root, path);
  symlinkSync(cli, alias);
  const env = { PATH: process.env.PATH, HOME: f.root, CLAUDE_CONFIG_DIR: join(f.root, 'absent-config'), LOOP_RUNTIME: 'claude', LOOP_ENGINE_PATH: path };
  for (const flags of [[], ['--preserve-symlinks-main']]) {
    const result = spawnSync(process.execPath, [...flags, alias, 'resolve'], { cwd: f.root, encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), path);
    const missing = spawnSync(process.execPath, [...flags, alias, 'resolve'], { cwd: f.root, encoding: 'utf8', env: { ...env, LOOP_ENGINE_PATH: '' } });
    assert.equal(missing.status, 1); assert.match(missing.stderr, /loop-engine@paul-loop/);
  }
  const direct = spawnSync(alias, ['resolve'], { cwd: f.root, encoding: 'utf8', env });
  assert.equal(direct.error, undefined); assert.equal(direct.status, 0); assert.equal(direct.stdout.trim(), path);
  for (const argv of [[], [join(f.root, 'nonexistent-entry.mjs')], [process.execPath]]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(cli).href)}); console.log('import-only');`, ...argv], { cwd: f.root, encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, 'import-only\n'); assert.equal(result.stderr, '');
  }
});

test('standalone integrity implementations stay identical and direct validation cannot skip approval', t => {
  const f = fixture(t), path = f.plugin();
  assert.throws(() => validatePluginPath(path, { roots: [f.root] }), /approval missing/);
  const block = source => source.match(/\/\/ BEGIN PLUGIN INTEGRITY[\s\S]*?\/\/ END PLUGIN INTEGRITY/)[0];
  assert.equal(block(readFileSync(cli, 'utf8')), block(readFileSync(new URL('../../../scripts/project-plugin.mjs', import.meta.url), 'utf8')));
  approvePluginFixture(f.root, path);
  const copied = join(f.root, 'copied-resolver.mjs'); writeFileSync(copied, readFileSync(cli));
  const result = spawnSync(process.execPath, [copied, 'resolve'], { cwd: f.root, encoding: 'utf8', env: { PATH: process.env.PATH, LOOP_ENGINE_PATH: path, LOOP_RUNTIME: 'claude' } });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), path);
});

for (const route of ['environment', 'registry', 'claude']) {
  test(route + ' cannot execute missing approvals or substituted plugin contents', t => {
    for (const attack of ['missing-approval', 'malformed-approval', 'commit', 'repository', 'bytes', 'mode', 'extra', 'missing-file', 'sidecar', '__proto__', 'symlink', 'manifest-symlink', 'directory-symlink']) {
      const f = fixture(t), path = f.plugin(), marker = join(f.root, 'executed'), payload = join(path, 'bin/probe.mjs');
      f.write(payload, 'import {writeFileSync} from "node:fs";writeFileSync(' + JSON.stringify(marker) + ', "ran");');
      approvePluginFixture(f.root, path);
      const lockFile = join(f.root, '.claude/paul-loop.lock.json'), lock = JSON.parse(readFileSync(lockFile));
      const env = { PATH: process.env.PATH, HOME: join(f.root, 'empty'), LOOP_RUNTIME: 'claude', CLAUDE_CONFIG_DIR: join(f.root, 'claude') };
      if (route === 'environment') env.LOOP_ENGINE_PATH = path;
      else if (route === 'registry') {
        env.PAUL_LOOP_INSTALLATIONS = join(f.root, 'registry.json');
        f.write(env.PAUL_LOOP_INSTALLATIONS, { schemaVersion: 1, runtime: 'claude', plugins: { 'loop-engine': { path, version: '0.15.0' } } });
      } else f.set([{ scope: 'project', projectPath: f.root, installPath: path, version: '0.15.0' }]);
      const run = () => spawnSync(process.execPath, [cli, 'exec', 'bin/probe.mjs'], { cwd: f.root, encoding: 'utf8', env });
      if (attack === 'missing-approval') {
        const good = run(); assert.equal(good.status, 0, good.stderr); assert.equal(existsSync(marker), true); rmSync(marker);
        rmSync(lockFile);
      } else if (attack === 'malformed-approval') f.write(lockFile, '{bad');
      else if (attack === 'commit' || attack === 'repository') {
        lock.plugins['loop-engine'].integrity[attack === 'commit' ? 'sourceCommit' : 'repository'] = attack === 'commit' ? '2'.repeat(40) : 'https://github.com/other/provider';
        f.write(lockFile, lock);
      } else if (attack === 'bytes') f.write(payload, readFileSync(payload, 'utf8') + '\n// substituted');
      else if (attack === 'mode') chmodSync(payload, 0o755);
      else if (attack === 'missing-file') rmSync(payload);
      else if (attack === 'symlink' || attack === 'manifest-symlink') {
        const file = attack === 'symlink' ? payload : join(path, '.claude-plugin/plugin.json'), outside = join(f.root, 'outside');
        cpSync(file, outside); rmSync(file); symlinkSync(outside, file);
      } else if (attack === 'directory-symlink') {
        const outside = join(f.root, 'outside-bin'); cpSync(join(path, 'bin'), outside, { recursive: true });
        rmSync(join(path, 'bin'), { recursive: true }); symlinkSync(outside, join(path, 'bin'));
      } else f.write(join(path, attack === 'sidecar' ? 'provenance.json' : attack), JSON.stringify(lock));
      const approvalBytes = existsSync(lockFile) ? readFileSync(lockFile) : null;
      const rejected = run();
      assert.equal(rejected.error, undefined); assert.equal(rejected.status, 1, route + '/' + attack + ': ' + rejected.stderr);
      assert.equal(existsSync(marker), false, route + '/' + attack + ' executed');
      if (approvalBytes) assert.deepEqual(readFileSync(lockFile), approvalBytes);
      else assert.equal(existsSync(lockFile), false);
    }
  });
}

test('an independently approved fork repository and build-metadata version remain supported', t => {
  const f = fixture(t), version = '0.15.0+fork.1', path = f.plugin('loop-engine', 'codex', '', version);
  const repository = 'https://git.example.test/team/reviewed-fork', name = 'loop-engine', runtime = 'codex', sourceCommit = 'a'.repeat(40);
  const file = join(path, '.codex-plugin/plugin.json');
  f.write(file, { name, version, repository }); chmodSync(file, 0o644);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const files = { '.codex-plugin/plugin.json': { sha256: sha(readFileSync(file)), mode: 0o644 } };
  const integrity = { repository, sourceCommit, sha256: sha(JSON.stringify({ runtime, name, version, repository, sourceCommit, files })) };
  f.write(join(f.root, '.codex/paul-loop.lock.json'), { schemaVersion: 1, runtime, plugins: { [name]: { id: 'loop-engine@reviewed-fork', version, integrity } } });
  const found = resolvePluginInstallation({ root: f.root, runtime, env: { LOOP_ENGINE_PATH: path } });
  assert.equal(found.path, path); assert.deepEqual(found.integrity, integrity);
});

test('shell CI pin verifies actual Git subtree bytes and modes, including ignored/index-hidden files', t => {
  const f = fixture(t), repo = join(f.root, 'provider'), path = join(repo, 'tools/loop-engine'), marker = join(f.root, 'executed');
  cpSync(f.plugin(), path, { recursive: true });
  const payload = join(path, 'bin/probe.mjs');
  f.write(payload, 'import {writeFileSync} from "node:fs";writeFileSync(' + JSON.stringify(marker) + ', "ran");');
  const git = args => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-q']); git(['remote', 'add', 'origin', 'https://github.com/reach0908/paul-loop.git']); git(['add', '.']);
  git(['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'reviewed']);
  const commit = git(['rev-parse', 'HEAD']), original = readFileSync(payload);
  const env = { PATH: process.env.PATH, HOME: f.root, LOOP_RUNTIME: 'shell', LOOP_ENGINE_PATH: path, LOOP_ENGINE_COMMIT: commit };
  const run = extra => spawnSync(process.execPath, [cli, 'exec', 'bin/probe.mjs'], { cwd: f.root, encoding: 'utf8', env: { ...env, ...extra } });
  const good = run(); assert.equal(good.status, 0, good.stderr); assert.equal(existsSync(marker), true); rmSync(marker);
  for (const attack of ['bytes', 'mode', 'ignored', 'missing', 'symlink']) {
    if (attack === 'bytes') { git(['update-index', '--assume-unchanged', 'tools/loop-engine/bin/probe.mjs']); f.write(payload, original.toString() + '\n// replaced'); }
    if (attack === 'mode') chmodSync(payload, 0o755);
    if (attack === 'ignored') { f.write(join(repo, '.git/info/exclude'), 'hidden.mjs\n'); f.write(join(path, 'hidden.mjs'), 'process.exit(0)'); }
    if (attack === 'missing') rmSync(payload);
    if (attack === 'symlink') { f.write(join(f.root, 'outside.mjs'), original.toString()); rmSync(payload); symlinkSync(join(f.root, 'outside.mjs'), payload); }
    const result = run(); assert.equal(result.status, 1, attack + ': ' + result.stderr); assert.match(result.stderr, /integrity/); assert.equal(existsSync(marker), false);
    rmSync(payload, { force: true }); f.write(payload, original.toString()); chmodSync(payload, 0o644);
    rmSync(join(path, 'hidden.mjs'), { force: true });
  }
  for (const pin of ['', '1'.repeat(40), commit + '\n']) {
    const result = run({ LOOP_ENGINE_COMMIT: pin }); assert.equal(result.status, 1, result.stderr); assert.equal(existsSync(marker), false);
  }
});
