import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { appendRunEvent } from '../lib/run-ledger.mjs';
import { recordLiveness } from '../../loop-memory/hooks/lib/liveness.mjs';

const root = mkdtempSync(join(tmpdir(), 'private-run-artifacts-'));
const previousMask = process.umask(0); // Creation must be private even on a permissive host.
after(() => { process.umask(previousMask); rmSync(root, { recursive: true, force: true }); });
const mode = path => statSync(path).mode & 0o777;
const verdict = fileURLToPath(new URL('../bin/verdict-run.sh', import.meta.url));
const sanitizer = fileURLToPath(new URL('../lib/sanitize.mjs', import.meta.url));

test('both ledger producers create private directories/files and preserve legacy user modes', () => {
  for (const producer of ['engine', 'memory']) {
    const dir = join(root, producer);
    mkdirSync(dir);
    const append = () => producer === 'engine'
      ? appendRunEvent(dir, { type: 'run.started', sessionId: 'fixture', writeCurrentPointer: true })
      : recordLiveness(dir, { type: 'memory.recall', sessionId: 'fixture', payload: { outcome: 'skipped' } }, {});
    assert.ok(append());
    assert.equal(mode(join(dir, '.loop')), 0o700);
    assert.equal(mode(join(dir, '.loop/runs')), 0o700);
    const ledger = join(dir, '.loop/runs/fixture.jsonl');
    assert.equal(mode(ledger), 0o600);
    if (producer === 'engine') assert.equal(mode(join(dir, '.loop/runs/current')), 0o600);
    const first = readFileSync(ledger, 'utf8');
    const envFile = join(dir, '.loop/.env');
    writeFileSync(envFile, 'USER_OWNED=fixture\n', { mode: 0o640 });
    chmodSync(join(dir, '.loop'), 0o755);
    chmodSync(join(dir, '.loop/runs'), 0o750);
    chmodSync(ledger, 0o640);
    assert.ok(append());
    assert.ok(readFileSync(ledger, 'utf8').startsWith(first));
    assert.equal(readFileSync(ledger, 'utf8').trim().split('\n').length, 2);
    assert.equal(mode(ledger), 0o640);
    assert.equal(mode(join(dir, '.loop')), 0o755);
    assert.equal(mode(join(dir, '.loop/runs')), 0o750);
    assert.equal(mode(envFile), 0o640);
    assert.equal(readFileSync(envFile, 'utf8'), 'USER_OWNED=fixture\n');
  }
});

test('verifier logs are private before output and after redaction without changing child umask or exits', () => {
  for (const off of ['0', '1']) {
    const dir = join(root, `verifier-${off}`);
    mkdirSync(dir);
    const code = Number(off), log = join(dir, '.loop/last-run.log');
    const result = spawnSync('bash', [verdict, '--', process.execPath, '-e', `
      const fs = require('node:fs'), assert = require('node:assert/strict');
      assert.equal(fs.statSync(process.argv[1]).mode & 0o777, 0o600);
      assert.equal(process.umask(), 0);
      fs.writeFileSync('child-output', 'fixture');
      console.log('password=fixture-value');
      process.exit(Number(process.argv[2]));
    `, log, String(code)], { cwd: dir, encoding: 'utf8', env: { ...process.env, LOOP_DIR: '.loop', LOOP_SANITIZE_OFF: off } });
    assert.equal(result.status, code, result.stderr + result.stdout);
    assert.equal(mode(log), 0o600);
    assert.equal(mode(join(dir, 'child-output')), 0o666);
    assert.equal(readFileSync(log, 'utf8').includes('fixture-value'), off === '1');
    assert.equal(mode(join(dir, '.loop')), 0o700);
    assert.equal(mode(join(dir, '.loop/verdict-state.json')), 0o600);
    assert.equal(JSON.parse(readFileSync(join(dir, '.loop/verdict-state.json'))).exit, code);
    assert.equal(mode(join(dir, '.loop/evidence')), 0o700);
    for (const file of readdirSync(join(dir, '.loop/evidence')))
      assert.equal(mode(join(dir, '.loop/evidence', file)), 0o600);
  }
});

test('in-place redaction preserves restrictive input permissions', () => {
  for (const permissions of [0o600, 0o640]) {
    const file = join(root, `redacted-${permissions}.log`);
    writeFileSync(file, 'password=fixture-value\n', { mode: permissions });
    const result = spawnSync(process.execPath, [sanitizer, '--in-place', file], {
      encoding: 'utf8', env: { ...process.env, LOOP_SANITIZE_OFF: '0' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(mode(file), permissions);
    assert.equal(readFileSync(file, 'utf8'), 'password=[REDACTED]\n');
  }
});
