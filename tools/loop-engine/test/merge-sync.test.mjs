import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const hook = resolve(import.meta.dirname, '../hooks/gate-before-merge.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|CLAUDE_|LOOP_)/.test(key)));
Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@local', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function fixture(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'loop-merge-sync-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const remote = join(base, 'remote'), root = join(base, 'local'); mkdirSync(remote);
  git(remote, 'init', '-qb', 'main'); git(remote, 'commit', '--allow-empty', '-qm', 'initial');
  const initial = git(remote, 'rev-parse', 'HEAD');
  git(base, 'clone', '-q', remote, root);
  git(remote, 'commit', '--allow-empty', '-qm', 'published'); git(remote, 'branch', 'release');
  git(root, 'fetch', '-q', 'origin');
  return { base, remote, root, initial };
}
function decision(root, command, cwd = root) {
  const r = spawnSync(process.execPath, [hook], { cwd: root, env: { ...env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : { permissionDecision: 'allow' };
}
function expect(root, command, value, cwd = root) {
  const result = decision(root, command, cwd);
  assert.equal(result.permissionDecision, value, `${command}: ${JSON.stringify(result)}`); return result;
}

test('fetched same-branch fast-forward is read-only at the gate and executable without losing local files', (t) => {
  const { root, initial } = fixture(t);
  writeFileSync(join(root, 'local-notes.md'), 'keep me');
  expect(root, 'git merge --ff-only origin/main', 'allow');
  assert.equal(git(root, 'rev-parse', 'HEAD'), initial, 'the hook must not execute the merge');
  git(root, 'merge', '--ff-only', 'origin/main');
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'refs/remotes/origin/main'));
  assert.equal(readFileSync(join(root, 'local-notes.md'), 'utf8'), 'keep me');
  expect(root, 'git merge --ff-only origin/main', 'allow');
});

test('direct landing and commands outside the narrow sync form remain denied', (t) => {
  const { root } = fixture(t);
  for (const command of [
    'git merge origin/main', 'git merge --ff-only origin/release', 'git merge --ff-only feature/new',
    'git merge --ff-only --no-ff origin/main', 'git merge --squash origin/main',
    'git pull --ff-only origin main', 'git fetch origin && git merge --ff-only origin/main',
    'FOO=bar git merge --ff-only origin/main', 'git -c merge.ff=true merge --ff-only origin/main',
    'git -C . merge --ff-only origin/main', '(git merge --ff-only origin/main)',
  ]) expect(root, command, 'deny');
  const denied = expect(root, 'git merge feature/new', 'deny');
  assert.doesNotMatch(denied.permissionDecisionReason, /git fetch origin &&/);
  assert.match(denied.permissionDecisionReason, /separate/);
  expect(root, 'git merge --abort', 'allow');
  git(root, 'switch', '-qc', 'feature/local');
  expect(root, 'git merge origin/main', 'allow', root);
});

test('absent, divergent, ahead-only and shadowed remote refs cannot qualify as sync', (t) => {
  for (const kind of ['missing', 'diverged', 'ahead', 'branch-shadow', 'tag-shadow']) {
    const { root, initial } = fixture(t);
    if (kind === 'missing') git(root, 'update-ref', '-d', 'refs/remotes/origin/main');
    if (kind === 'diverged' || kind === 'ahead') {
      if (kind === 'ahead') git(root, 'merge', '--ff-only', 'origin/main');
      git(root, 'commit', '--allow-empty', '-qm', 'unpublished local work');
    }
    if (kind === 'branch-shadow') git(root, 'branch', 'origin/main', initial);
    if (kind === 'tag-shadow') git(root, 'tag', 'origin/main', initial);
    expect(root, 'git merge --ff-only origin/main', 'deny');
  }
});

test('configured protected branch uses the actual linked worktree and confirmed repository', (t) => {
  const { root, base, initial } = fixture(t), linked = join(base, 'linked');
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude/ship-flow.config.json'), JSON.stringify({ releaseBranch: 'main', integrationBranch: 'release' }));
  git(root, 'worktree', 'add', '-qb', 'release', linked, initial);
  mkdirSync(join(linked, 'subdir'));
  expect(root, 'git merge --ff-only origin/release', 'allow', join(linked, 'subdir'));
  expect(root, 'git merge --ff-only origin/main', 'deny', linked);
  const foreign = fixture(t).root;
  expect(root, 'git merge --ff-only origin/main', 'deny', foreign);
  expect(root, 'git merge --ff-only origin/main', 'deny', join(base, 'missing'));
  expect(root, 'git merge --ff-only origin/main', 'deny', null);
});

test('shell-active branch names cannot widen the literal sync exception', (t) => {
  const { root, remote, initial } = fixture(t); mkdirSync(join(root, '.claude'));
  for (const name of ['release$HOME', 'release`date`', "release'quoted", 'release>out', 'release&']) {
    git(remote, 'branch', name); git(root, 'fetch', '-q', 'origin');
    git(root, 'switch', '-qc', name, initial);
    writeFileSync(join(root, '.claude/ship-flow.config.json'), JSON.stringify({ releaseBranch: name }));
    expect(root, `git merge --ff-only origin/${name}`, 'deny');
  }
});
