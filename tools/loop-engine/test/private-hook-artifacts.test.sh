#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Inline assertions remain in the runner's frozen shell snapshot.
node --input-type=module - "$HERE" <<'JS'
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
const here = process.argv[2];
const { logRedEvent } = await import(pathToFileURL(join(here, '../hooks/red-events-log.mjs')));
const root = mkdtempSync(join(tmpdir(), 'private-hook-artifacts-'));
const previousMask = process.umask(0);
after(() => { process.umask(previousMask); rmSync(root, { recursive: true, force: true }); });
const mode = path => statSync(path).mode & 0o777;
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function repo(name) {
  const dir = join(root, name); mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@local', 'commit', '--allow-empty', '-qm', 'fixture');
  return dir;
}
function hook(name, dir, payload) {
  return spawnSync(process.execPath, [join(here, '../hooks', name)], {
    cwd: dir, input: JSON.stringify(payload), encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, LOOP_STOP_GATE_OFF: '0', LOOP_WORKTREE_SESSION_GATE_OFF: '0' },
  });
}
function userFile(dir) {
  const file = join(dir, '.loop/.env');
  writeFileSync(file, 'USER_OWNED=fixture\n', { mode: 0o640 });
  return () => { assert.equal(mode(file), 0o640); assert.equal(readFileSync(file, 'utf8'), 'USER_OWNED=fixture\n'); };
}

test('worktree hook creates private state before any ledger and retains existing directories', () => {
  const dir = repo('worktree'), loop = join(dir, '.loop'), file = join(loop, 'worktree-gate.fixture.json');
  const payload = { tool_name: 'Bash', session_id: 'fixture', cwd: dir, tool_input: { command: 'git status --short' } };
  const first = hook('gate-worktree-create.mjs', dir, payload);
  assert.equal(first.status, 0, first.stderr); assert.equal(first.stdout, '');
  assert.equal(mode(loop), 0o700); assert.equal(mode(file), 0o600);
  const state = JSON.parse(readFileSync(file));
  assert.deepEqual(state, { schema_version: 2, confirmed: [], pending: [], branches: [] });
  chmodSync(loop, 0o755); const checkUserFile = userFile(dir);
  const second = hook('gate-worktree-create.mjs', dir, payload);
  assert.equal(second.status, 0, second.stderr); assert.equal(second.stdout, '');
  assert.equal(mode(loop), 0o755); assert.equal(mode(file), 0o600);
  assert.deepEqual(JSON.parse(readFileSync(file)), state); checkUserFile();
});

test('stop counter is private at creation without changing denial, escape or user-owned modes', () => {
  const dir = repo('stop'), loop = join(dir, '.loop'); mkdirSync(loop, { mode: 0o755 });
  const sentinel = join(loop, 'looping'); writeFileSync(sentinel, 'manual\n', { mode: 0o640 });
  const file = join(loop, 'stop-gate.fixture.json'), checkUserFile = userFile(dir);
  for (let denies = 1; denies <= 4; denies++) {
    const result = hook('gate-stop-verdict.mjs', dir, { session_id: 'fixture', stop_hook_active: denies > 1 });
    assert.equal(result.status, denies <= 3 ? 2 : 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(file)).denies, denies);
    assert.equal(mode(file), denies === 1 ? 0o600 : 0o640);
    if (denies === 1) chmodSync(file, 0o640); // Existing in-place counters are not migrated.
  }
  assert.equal(existsSync(join(loop, 'verdict-state.json')), false); // Escape must not manufacture PASS.
  assert.equal(mode(loop), 0o755); assert.equal(mode(sentinel), 0o640);
  assert.equal(readFileSync(sentinel, 'utf8'), 'manual\n'); checkUserFile();
});

test('shared red-event logger creates private artifacts and preserves append/failure behavior', () => {
  const dir = repo('logger'), worktree = join(root, 'linked');
  git(dir, 'worktree', 'add', '-q', '-b', 'fixture-linked', worktree);
  const marker = join(dir, '.git/loop-markers'), file = join(marker, 'red-events.log');
  const gitMode = mode(join(dir, '.git'));
  logRedEvent(worktree, { kind: 'fixture', code: 'first' });
  assert.equal(mode(marker), 0o700); assert.equal(mode(file), 0o600);
  const first = readFileSync(file, 'utf8'); assert.equal(JSON.parse(first).branch, 'fixture-linked');
  chmodSync(marker, 0o750); chmodSync(file, 0o640);
  logRedEvent(dir, { kind: 'fixture', code: 'second' });
  const lines = readFileSync(file, 'utf8'); assert.ok(lines.startsWith(first));
  assert.deepEqual(lines.trim().split('\n').map(line => JSON.parse(line).code), ['first', 'second']);
  assert.equal(mode(marker), 0o750); assert.equal(mode(file), 0o640); assert.equal(mode(join(dir, '.git')), gitMode);
  const blocked = repo('logger-blocked'), blocker = join(blocked, '.git/loop-markers');
  writeFileSync(blocker, 'occupied', { mode: 0o640 });
  assert.doesNotThrow(() => logRedEvent(blocked, { kind: 'fixture' }));
  assert.equal(readFileSync(blocker, 'utf8'), 'occupied'); assert.equal(mode(blocker), 0o640);
});
JS
