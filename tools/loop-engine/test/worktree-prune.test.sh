#!/usr/bin/env bash
# Real local git repositories and a fake gh on PATH; no network or consumer state.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Inline assertions remain in the runner's frozen shell snapshot.
node --input-type=module - "$HERE" <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const prune = resolve(process.argv[2], '../bin/worktree-prune.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|CLAUDE_|LOOP_)/.test(key)));
Object.assign(env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@local', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
// A repository with a fake `gh` on PATH. merged(branch, oid) makes `gh pr list --head <branch>` report
// one merged PR at that head; FAKE_GH_EXIT/FAKE_GH_BODY override every answer.
function fixture(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'loop-worktree-prune-')));
  t.after(() => { spawnSync('chmod', ['-R', 'u+w', base]); rmSync(base, { recursive: true, force: true }); });
  const root = join(base, 'main'), bin = join(base, 'bin'), prs = join(base, 'prs');
  mkdirSync(root); mkdirSync(bin); mkdirSync(prs);
  git(root, 'init', '-qb', 'main'); git(root, 'commit', '--allow-empty', '-qm', 'initial');
  writeFileSync(join(bin, 'gh'), [
    '#!/bin/sh',
    '[ -n "$FAKE_GH_EXIT" ] && exit "$FAKE_GH_EXIT"',
    '[ -n "$FAKE_GH_BODY" ] && { printf "%s" "$FAKE_GH_BODY"; exit 0; }',
    `f="${prs}/$(printf %s "$4" | tr / _)"`,
    'if [ -f "$f" ]; then cat "$f"; else printf "[]"; fi',
  ].join('\n'));
  chmodSync(join(bin, 'gh'), 0o755);
  const worktree = (name, ...extra) => {
    const path = join(base, name);
    git(root, 'worktree', 'add', '-q', ...extra, path); return path;
  };
  const merged = (branch, oid) => writeFileSync(join(prs, branch.replace(/\//g, '_')), JSON.stringify([{ headRefOid: oid }]));
  const run = (args = [], { cwd = root, ghEnv = {} } = {}) =>
    spawnSync(process.execPath, [prune, ...args], { cwd, env: { ...env, ...ghEnv, PATH: `${bin}:${env.PATH}` }, encoding: 'utf8' });
  return { base, root, worktree, merged, run };
}
const head = (dir) => git(dir, 'rev-parse', 'HEAD');
const listed = (root) => git(root, 'worktree', 'list', '--porcelain');

test('dry run reports what --apply would do and changes nothing', (t) => {
  const { base, root, worktree, merged, run } = fixture(t);
  const done = worktree('done', '-b', 'feature/done');
  merged('feature/done', head(done));
  const gone = worktree('gone', '-b', 'feature/gone');
  rmSync(gone, { recursive: true, force: true });
  const res = run();
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /would remove.*done/);
  assert.match(res.stdout, /would prune.*gone/);
  assert.ok(existsSync(done), 'dry run must not remove a worktree');
  assert.match(listed(root), new RegExp(`worktree ${join(base, 'gone')}`), 'dry run must not prune metadata');
});

test('--apply removes only clean, unlocked worktrees at a merged PR head and prunes gone ones', (t) => {
  const { base, root, worktree, merged, run } = fixture(t);
  const done = worktree('done', '-b', 'feature/done');
  merged('feature/done', head(done));
  const fresh = worktree('fresh', '-b', 'feature/fresh'); // a new worktree with no PR yet
  const ahead = worktree('ahead', '-b', 'feature/ahead');
  merged('feature/ahead', head(ahead));
  git(ahead, 'commit', '--allow-empty', '-qm', 'after the merge');
  const other = worktree('other', '-b', 'feature/other');
  merged('feature/other', '0'.repeat(40)); // same branch name, a different PR head
  const tracked = worktree('tracked', '-b', 'feature/tracked');
  writeFileSync(join(tracked, 'a.txt'), 'a'); git(tracked, 'add', 'a.txt'); git(tracked, 'commit', '-qm', 'a');
  merged('feature/tracked', head(tracked)); writeFileSync(join(tracked, 'a.txt'), 'changed');
  const untracked = worktree('untracked', '-b', 'feature/untracked');
  merged('feature/untracked', head(untracked)); writeFileSync(join(untracked, 'new.txt'), 'new');
  const locked = worktree('locked', '-b', 'feature/locked');
  merged('feature/locked', head(locked)); git(root, 'worktree', 'lock', '--reason', 'lesson capture', locked);
  const detached = worktree('detached', '--detach');
  const gone = worktree('gone', '-b', 'feature/gone');
  rmSync(gone, { recursive: true, force: true });

  const res = run(['--apply']);
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!existsSync(done), 'a clean worktree at its merged PR head is removed');
  for (const kept of [fresh, ahead, other, tracked, untracked, locked, detached]) assert.ok(existsSync(kept), `${kept} must be kept`);
  assert.ok(existsSync(join(untracked, 'new.txt')) && existsSync(root), 'the main checkout is never a candidate');
  assert.doesNotMatch(listed(root), /feature\/gone/, 'a registration without its directory is pruned');
  assert.doesNotMatch(res.stdout, new RegExp(`\\t${root}\\t`), 'the main worktree is not listed');

  const current = worktree('current', '-b', 'feature/current');
  merged('feature/current', head(current));
  assert.equal(run(['--apply'], { cwd: current }).status, 0);
  assert.ok(existsSync(current), 'the worktree the command runs in is kept');
  assert.ok(existsSync(base));
});

test('when gh fails or answers garbage, nothing is removed', (t) => {
  const { worktree, merged, run } = fixture(t);
  const done = worktree('done', '-b', 'feature/done');
  merged('feature/done', head(done));
  for (const ghEnv of [{ FAKE_GH_EXIT: '1' }, { FAKE_GH_BODY: 'not json' }, { FAKE_GH_BODY: '{"headRefOid":1}' }]) {
    const res = run(['--apply'], { ghEnv });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(existsSync(done), `kept under ${JSON.stringify(ghEnv)}`);
    assert.match(res.stdout, /keep\t.*done/);
  }
});

test('a removal git refuses is reported, the rest continue, and the exit code is 1', (t) => {
  const { base, worktree, merged, run } = fixture(t);
  mkdirSync(join(base, 'readonly'));
  const stuck = worktree('readonly/stuck', '-b', 'feature/stuck');
  merged('feature/stuck', head(stuck));
  chmodSync(join(base, 'readonly'), 0o555); // the directory entry cannot be deleted
  const done = worktree('done', '-b', 'feature/done');
  merged('feature/done', head(done));
  const res = run(['--apply']);
  assert.equal(res.status, 1, res.stdout);
  assert.match(res.stdout, /failed\t.*stuck/);
  assert.ok(!existsSync(done), 'the other merged worktree is still removed');
});

test('outside a git repository it reports skipped and exits 0', (t) => {
  const { base, run } = fixture(t);
  mkdirSync(join(base, 'plain'));
  const res = run(['--apply'], { cwd: join(base, 'plain') });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /^worktree-prune: skipped \(.+\)$/m);
});
JS
