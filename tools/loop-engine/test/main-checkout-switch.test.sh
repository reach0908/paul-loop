#!/usr/bin/env bash
# gate-before-merge's second job: the main checkout stays on its protected branch. Real local git
# repositories only. Inline (not a top-level .mjs) to keep run.sh's frozen-entry preload small.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node --input-type=module - "$HERE" <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const hook = resolve(process.argv[2], '../hooks/gate-before-merge.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|CLAUDE_|LOOP_)/.test(key)));
Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@local', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function fixture(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'loop-main-switch-')));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const remote = join(base, 'remote'), root = join(base, 'local'); mkdirSync(remote);
  git(remote, 'init', '-qb', 'main'); git(remote, 'commit', '--allow-empty', '-qm', 'initial');
  const initial = git(remote, 'rev-parse', 'HEAD');
  git(base, 'clone', '-q', remote, root);
  git(remote, 'commit', '--allow-empty', '-qm', 'published'); git(remote, 'branch', 'release');
  git(root, 'fetch', '-q', 'origin');
  return { base, root, initial };
}
function expect(root, command, value, cwd = root) {
  const r = spawnSync(process.execPath, [hook], { cwd: root, env: { ...env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({ tool_name: 'Bash', cwd, tool_input: { command } }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const result = r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : { permissionDecision: 'allow' };
  assert.equal(result.permissionDecision, value, `${command}: ${JSON.stringify(result)}`); return result;
}

test('the main checkout asks before leaving its protected branch; restores and linked worktrees pass', (t) => {
  const { root, base, initial } = fixture(t), linked = join(base, 'linked');
  const asked = expect(root, 'git switch -c feature/x', 'ask');
  assert.match(asked.permissionDecisionReason, /worktree/);
  git(root, 'switch', '-qc', 'feature/old'); git(root, 'switch', '-q', 'main');
  for (const move of ['git checkout -b feature/x', 'git checkout release', `git checkout ${initial}`,
    'git switch -', 'git switch feature/old', 'gh pr checkout 12']) expect(root, move, 'ask');
  for (const home of ['git checkout main', 'git switch main']) expect(root, home, 'allow');
  git(root, 'switch', '-q', 'feature/old');
  expect(root, 'git switch -', 'allow'); // back to main
  git(root, 'switch', '-q', 'main');
  mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/a.ts'), 'a');
  writeFileSync(join(root, 'release'), 'a file named like the origin branch');
  git(root, 'add', 'src/a.ts', 'release'); git(root, 'commit', '-qm', 'file');
  for (const restore of ['git checkout src/a.ts', 'git checkout --ours src/a.ts', 'git checkout HEAD src/a.ts',
    'git checkout HEAD~1 src/a.ts', 'git checkout -- src/a.ts', 'git checkout --pathspec-from-file=list.txt',
    'git checkout HEAD', 'git checkout -- release', 'git checkout --ours release', 'git checkout -p release',
  ]) expect(root, restore, 'allow');

  git(root, 'worktree', 'add', '-qb', 'feature/wt', linked, 'origin/main');
  expect(root, 'git switch -c other', 'allow', linked);
  expect(root, 'gh pr checkout 12', 'allow', linked);
  expect(root, `git -C ${linked} switch -c z`, 'allow', root);
  expect(root, `cd "${root}" && git checkout -b y`, 'ask', linked);
  expect(root, `git -C ${root} switch -c q`, 'ask', linked);
  // A session rooted in the linked worktree still guards the shared main checkout (same common dir).
  expect(linked, `cd ${root} && git switch -c y2`, 'ask', linked);
  expect(root, 'git checkout release', 'allow', join(base, 'missing'));
  expect(root, 'GIT_DIR=.git git switch -c g', 'allow');
  expect(root, 'git switch -c x', 'allow', fixture(t).root); // a repository outside the project
  const nested = join(root, 'nested'); mkdirSync(nested); git(nested, 'init', '-qb', 'main');
  expect(root, 'git switch -c n', 'ask', nested); // a repository under the project root

  // Both commands also switch the main checkout; the merge deny must still win over that ask.
  for (const merge of ['git checkout -b feat && git merge origin/main', 'git switch -c x; git pull']) expect(root, merge, 'deny');

  git(root, 'remote', 'set-head', 'origin', 'release');
  expect(root, 'git switch release', 'allow');
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude/ship-flow.config.json'), JSON.stringify({ releaseBranch: 'main', integrationBranch: 'develop' }));
  expect(root, 'git switch develop', 'allow');
});
JS
