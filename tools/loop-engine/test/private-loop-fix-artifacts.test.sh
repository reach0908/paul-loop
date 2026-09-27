#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node --input-type=module - "$HERE/../bin/loop-fix.sh" <<'JS'
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
const root = mkdtempSync(join(tmpdir(), 'private-loop-fix-'));
after(() => rmSync(root, { recursive: true, force: true }));
const mode = path => statSync(path).mode & 0o777;
const fixture = name => { const dir = join(root, name); mkdirSync(join(dir, 'checks'), { recursive: true }); return dir; };
function run(dir, args, mask = 0, legacy = false) {
  const result = spawnSync('/bin/bash', ['-c', 'umask "$1"; shift; exec bash "$@"', 'fixture', mask.toString(8), process.argv[2], ...args], {
    cwd: dir, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, LOOP_PROTECT_GRACE_SEC: '0', EXPECTED_UMASK: String(mask), LEGACY: String(legacy) },
  });
  assert.ifError(result.error);
  return result;
}
const client = `
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const mode = file => fs.statSync(file).mode & 0o777;
const loop = process.env.LOOP_DIR, mask = Number(process.env.EXPECTED_UMASK), legacy = process.env.LEGACY === 'true';
assert.equal(process.umask(), mask, 'user command retains caller umask');
fs.writeFileSync(path.basename(__filename) + '.output', 'user output');
assert.equal(mode(path.basename(__filename) + '.output'), 0o666 & ~mask);
`;

test('loop handoffs, leases and both backups are private while user commands retain their umask', () => {
  for (const [name, mask, custom, legacy] of [['default', 0, false, false], ['custom', 0o027, true, false], ['legacy', 0, true, true]]) {
    const dir = fixture(name), handoff = custom ? 'handoff space/nested' : '.loop', loop = join(dir, handoff);
    if (legacy) {
      mkdirSync(loop, { recursive: true }); chmodSync(loop, 0o755);
      for (const file of ['history.log', 'looping', '.env']) {
        writeFileSync(join(loop, file), 'USER_OWNED\n'); chmodSync(join(loop, file), 0o640);
      }
    }
    writeFileSync(join(dir, 'implementation'), 'broken');
    writeFileSync(join(dir, 'checks/verify.cjs'), client + `
      for (const file of ['history.log', 'last-verdict.txt', 'verdict-run.err', 'last-run.log', 'looping'])
        assert.equal(mode(path.join(loop, file)), legacy && ['history.log', 'looping'].includes(file) ? 0o640 : 0o600, file);
      for (const sub of ['.execution-lease', 'protected-backup', 'protected-backup/checks']) assert.equal(mode(path.join(loop, sub)), 0o700, sub);
      assert.equal(mode(loop), legacy ? 0o755 : 0o700);
      assert.equal(mode('.loop'), 0o700);
      assert.equal(mode('.loop/lifecycle'), 0o700);
      assert.equal(mode('.loop/lifecycle/lease'), 0o700);
      assert.equal(mode('.loop/lifecycle/lease/owner.json'), 0o600);
      const state = JSON.parse(fs.readFileSync(process.env.LOOP_LIFECYCLE_STATE));
      for (const entry of state.protected) {
        assert.equal(mode(path.dirname(entry.backup)), 0o700);
        assert.equal(mode(entry.backup), 0o400);
        assert.equal(mode(path.join(loop, 'protected-backup', entry.file)), 0o400);
      }
      if (fs.readFileSync('implementation', 'utf8') !== 'fixed') { console.error('FAIL implementation'); process.exit(1); }
    `);
    writeFileSync(join(dir, 'checks/fix.cjs'), client + `
      for (const file of ['fix-prompt.txt', 'first-verdict.txt', 'first-verdict.receipt']) assert.equal(mode(path.join(loop, file)), 0o600, file);
      fs.writeFileSync('implementation', 'fixed');
    `);
    const result = run(dir, ['--verify', 'node checks/verify.cjs', '--fix', 'node checks/fix.cjs', '--max-iter', '2', '--protect', 'checks/*.cjs', '--loop-dir', handoff, '--lessons', 'lessons'], mask, legacy);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(readFileSync(join(loop, 'history.log'), 'utf8'), /SUCCESS in 2 iteration/);
    for (const file of ['last-verdict.txt', 'verdict-run.err', 'fix-prompt.txt', 'first-verdict.txt', 'first-verdict.receipt', 'lessons.err']) assert.equal(mode(join(loop, file)), 0o600, file);
    assert.equal(existsSync(join(loop, '.execution-lease')), false);
    assert.equal(existsSync(join(dir, '.loop/lifecycle/lease')), false);
    assert.equal(existsSync(join(loop, 'looping')), legacy);
    if (legacy) {
      assert.equal(mode(loop), 0o755);
      assert.ok(readFileSync(join(loop, 'history.log'), 'utf8').startsWith('USER_OWNED\n'));
      for (const file of ['looping', '.env']) {
        assert.equal(mode(join(loop, file)), 0o640);
        assert.equal(readFileSync(join(loop, file), 'utf8'), 'USER_OWNED\n');
      }
    }
  }
});

test('private worker backups still restore protected bytes and original executable mode', () => {
  const dir = fixture('restore'), file = join(dir, 'checks/protected.txt');
  writeFileSync(file, 'ORIGINAL'); chmodSync(file, 0o751);
  writeFileSync(join(dir, 'fix.cjs'), client + `
    assert.equal(mode(path.join(loop, 'protected-backup/checks/protected.txt')), 0o400);
    fs.writeFileSync('checks/protected.txt', 'MUTATED');
  `);
  const result = run(dir, ['--verify', 'echo FAIL fixture; exit 1', '--fix', 'node fix.cjs', '--protect', 'checks/*.txt', '--max-iter', '2']);
  assert.equal(result.status, 3, result.stderr + result.stdout);
  assert.equal(readFileSync(file, 'utf8'), 'ORIGINAL');
  assert.equal(mode(file), 0o751);
  assert.match(readFileSync(join(dir, '.loop/history.log'), 'utf8'), /restored/);
});

test('supervisor cancellation creates private history and compromised marker without claiming success', () => {
  const dir = fixture('cancel');
  writeFileSync(join(dir, 'checks/protected.txt'), 'ORIGINAL');
  writeFileSync(join(dir, 'verify.cjs'), client + `
    const state = JSON.parse(fs.readFileSync(process.env.LOOP_LIFECYCLE_STATE));
    fs.writeFileSync('checks/protected.txt', 'MUTATED');
    fs.unlinkSync(state.protected[0].backup);
    fs.unlinkSync(path.join(loop, 'history.log'));
    fs.writeFileSync('cancel-ready', 'ready');
    process.kill(state.owner.pid, 'SIGTERM');
    setInterval(() => {}, 1000);
  `);
  const result = run(dir, ['--verify', 'node verify.cjs', '--protect', 'checks/*.txt']);
  assert.equal(result.status, 130, result.stderr + result.stdout);
  assert.equal(readFileSync(join(dir, 'cancel-ready'), 'utf8'), 'ready');
  for (const file of ['history.log', 'protect-compromised']) assert.equal(mode(join(dir, '.loop', file)), 0o600, file);
  const lifecycle = join(dir, '.loop/lifecycle');
  const state = JSON.parse(readFileSync(join(lifecycle, readdirSync(lifecycle).find(file => file.endsWith('.json')))));
  assert.equal(state.status, 'cancelled');
  assert.equal(JSON.parse(readFileSync(join(dir, '.loop/verdict-state.json'))).verdict, 'FAIL');
  assert.equal(run(dir, ['--verify', 'exit 0']).status, 4, 'compromised marker must still block later runs');
});
JS
