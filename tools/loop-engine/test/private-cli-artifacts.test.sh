#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Keep this regression in the runner's frozen shell snapshot.
node --input-type=module - "$HERE" <<'JS'
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
const bin = join(process.argv[2], '../bin');
const root = mkdtempSync(join(tmpdir(), 'private-cli-artifacts-'));
const originalMask = process.umask(0);
after(() => { process.umask(originalMask); rmSync(root, { recursive: true, force: true }); });
const mode = path => statSync(path).mode & 0o777;
const fixture = name => { const dir = join(root, name); mkdirSync(dir); return dir; };
const run = (name, dir, args, env = {}) => spawnSync(name.endsWith('.sh') ? '/bin/bash' : process.execPath,
  [join(bin, name), ...args], { cwd: dir, encoding: 'utf8', timeout: 15000, env: { ...process.env, LOOP_DIR: '.loop', ...env } });
const status = (r, expected) => assert.equal(r.status, expected, r.stderr + r.stdout);

test('AC logs are private before verification; child umask, exits and existing modes survive', () => {
  for (const mask of [0, 0o027]) {
    process.umask(mask);
    const dir = fixture(`ac-${mask}`), logs = join(dir, 'custom'), perAC = join(logs, 'ac-verify');
    writeFileSync(join(dir, 'verify.cjs'), `const fs=require('node:fs'),assert=require('node:assert/strict');
      assert.equal(process.umask(), Number(process.env.EXPECT_MASK));
      assert.equal(fs.statSync('custom/ac-verify.log').mode & 511, 384);
      fs.writeFileSync('child.txt','owned by verifier'); console.log('checked');`);
    writeFileSync(join(dir, 'plan.md'), '- AC: command | verify: node verify.cjs | expect: checked\n- AC: artifact | artifacts: child.txt\n');
    let r = run('ac-verify.sh', dir, ['plan.md', '--log-dir', 'custom'], { EXPECT_MASK: String(mask) });
    status(r, 0); assert.match(r.stdout, /VERDICT: PASS/);
    for (const path of [logs, perAC]) assert.equal(mode(path), 0o700);
    for (const path of ['ac-verify.log', 'ac-verify/ac-1.log', 'ac-verify/ac-2.log', 'ac-verify/aggregate-sync.log'])
      assert.equal(mode(join(logs, path)), 0o600);
    assert.equal(mode(join(dir, 'child.txt')), 0o666 & ~mask);
    chmodSync(logs, 0o755); chmodSync(perAC, 0o750);
    for (const file of ['ac-verify.log', 'ac-verify/ac-2.log']) chmodSync(join(logs, file), 0o640);
    writeFileSync(join(logs, '.env'), 'USER_OWNED=fixture\n', { mode: 0o640 });
    writeFileSync(join(dir, 'plan.md'), '- AC: artifact | artifacts: child.txt\n- AC: artifact | artifacts: child.txt\n- AC: failure | verify: exit 7\n');
    r = run('ac-verify.sh', dir, ['plan.md', '--log-dir', 'custom']); status(r, 1);
    assert.match(r.stdout, /verify exited 7/);
    assert.equal(JSON.parse(readFileSync(join(logs, 'verdict-state.json'))).verdict, 'FAIL');
    assert.equal(mode(logs), 0o755); assert.equal(mode(perAC), 0o750);
    for (const file of ['ac-verify.log', 'ac-verify/ac-2.log', '.env']) assert.equal(mode(join(logs, file)), 0o640);
    assert.equal(readFileSync(join(logs, '.env'), 'utf8'), 'USER_OWNED=fixture\n');
  }
  process.umask(0);
});

test('eval logs/baselines are private while RECORD, comparison and failure remain distinct', () => {
  const dir = fixture('eval'), log = join(dir, '.loop/eval-last.log'), baseline = join(dir, 'baselines/result.json');
  writeFileSync(join(dir, 'cases.jsonl'), JSON.stringify({ id: 'one', input: 'hello', assert: { equals: 'hello' } }) + '\n');
  const args = ['--dataset', 'cases.jsonl', '--target', 'cat', '--baseline', baseline, '--target-id', 'fixture'];
  let r = run('eval-gate.mjs', dir, [...args, '--update-baseline']); status(r, 1);
  assert.match(r.stdout, /RECORD is not verification/);
  assert.equal(JSON.parse(readFileSync(baseline)).operation_status, 'recorded');
  for (const path of [join(dir, '.loop'), join(dir, 'baselines')]) assert.equal(mode(path), 0o700);
  for (const path of [log, baseline]) assert.equal(mode(path), 0o600);
  status(run('eval-gate.mjs', dir, args), 0);
  const baselineBytes = readFileSync(baseline, 'utf8');
  r = run('eval-gate.mjs', dir, [...args, '--target-id', 'other']); status(r, 1);
  assert.equal(readFileSync(baseline, 'utf8'), baselineBytes);
  chmodSync(join(dir, '.loop'), 0o755); chmodSync(join(dir, 'baselines'), 0o750);
  for (const path of [log, baseline]) chmodSync(path, 0o640);
  r = run('eval-gate.mjs', dir, [...args, '--update-baseline']); status(r, 1);
  for (const path of [log, baseline]) assert.equal(mode(path), 0o640);
  assert.equal(mode(join(dir, '.loop')), 0o755); assert.equal(mode(join(dir, 'baselines')), 0o750);
});

test('context baselines stay local and private for default and explicit output paths', () => {
  for (const custom of [false, true]) {
    const dir = fixture(`context-${custom}`), parent = join(dir, custom ? 'custom/deep' : '.loop/context-budget');
    const file = join(parent, 'baseline.json');
    const args = ['--root', dir, '--local', '--json', '--write-baseline', ...(custom ? [file] : [])];
    status(run('context-budget.mjs', dir, args), 0);
    assert.equal(mode(parent), 0o700); assert.equal(mode(join(parent, '..')), 0o700); assert.equal(mode(file), 0o600);
    assert.deepEqual(JSON.parse(readFileSync(file)).capabilities, { api: false, personal: false, hook: false });
    chmodSync(parent, 0o750); chmodSync(file, 0o640);
    status(run('context-budget.mjs', dir, args), 0);
    assert.equal(mode(parent), 0o750); assert.equal(mode(file), 0o640);
  }
});

test('agent-eval report parents are private without promoting failures or overwriting reports', () => {
  const dir = fixture('agent'), parent = join(dir, 'reports/nested'), report = join(parent, 'result.json');
  writeFileSync(join(dir, 'cases.jsonl'), JSON.stringify({ id: 'one', prompt: 'Fail in the fixture', criteria: {} }) + '\n');
  const args = ['--dataset', 'cases.jsonl', '--target', 'exit 1', '--grader', 'true', '--runtime-id', 'fixture', '--model-id', 'no-model', '--report', report];
  status(run('agent-eval.mjs', dir, args), 1);
  assert.equal(mode(parent), 0o700); assert.equal(mode(join(parent, '..')), 0o700); assert.equal(mode(report), 0o600);
  assert.equal(JSON.parse(readFileSync(report)).status, 'FAIL');
  const bytes = readFileSync(report, 'utf8'); chmodSync(parent, 0o750); chmodSync(report, 0o640);
  status(run('agent-eval.mjs', dir, args), 2);
  assert.equal(readFileSync(report, 'utf8'), bytes); assert.equal(mode(report), 0o640);
  status(run('agent-eval.mjs', dir, [...args, '--report', join(parent, 'second.json')]), 1);
  assert.equal(mode(parent), 0o750); assert.equal(mode(join(parent, 'second.json')), 0o600);
});

test('OTel creates private files for all kinds and retains existing append modes', async () => {
  const dir = fixture('otel'), output = join(dir, '.loop/otel');
  const child = spawn(process.execPath, [join(bin, 'otel-receiver.mjs')], {
    cwd: dir, env: { ...process.env, LOOP_OTEL_DIR: output, LOOP_OTEL_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('receiver startup timed out')), 5000);
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.once('exit', code => { clearTimeout(timer); reject(Error(`receiver exited: ${code}`)); });
      let text = ''; child.stdout.on('data', b => {
        text += b; const match = /listening on 127\.0\.0\.1:(\d+)/.exec(text);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const post = async (kind, body) => {
      const res = await fetch(`http://127.0.0.1:${port}/v1/${kind}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(5000),
      });
      assert.equal(res.status, 200); await res.text();
    };
    for (const kind of ['metrics', 'logs', 'traces']) {
      await post(kind, '{}');
      const file = join(output, readdirSync(output).find(name => name.endsWith(`.${kind}.jsonl`)));
      assert.equal(mode(file), 0o600); const first = readFileSync(file, 'utf8');
      chmodSync(file, 0o640); await post(kind, 'invalid JSON');
      const bytes = readFileSync(file, 'utf8'); assert.ok(bytes.startsWith(first));
      assert.equal(JSON.parse(bytes.trim().split('\n')[1]).reason, 'bad-json'); assert.equal(mode(file), 0o640);
    }
    assert.equal(mode(output), 0o700); assert.equal(mode(join(dir, '.loop')), 0o700);
    chmodSync(output, 0o750); await post('metrics', '{}'); assert.equal(mode(output), 0o750);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { const closed = once(child, 'close'); child.kill(); await closed; }
  }
});
JS
