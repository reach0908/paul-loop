#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# Inline assertions are included in the runner's frozen shell snapshot.
node --input-type=module - "$HERE" <<'JS'
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
const here = process.argv[2], bin = join(here, '../bin');
const root = mkdtempSync(join(tmpdir(), 'private-metadata-artifacts-'));
const originalMask = process.umask(0);
after(() => { process.umask(originalMask); rmSync(root, { recursive: true, force: true }); });
const mode = path => statSync(path).mode & 0o777;
const fixture = name => { const dir = join(root, name); mkdirSync(dir); return dir; };
const home = fixture('home'), fakeBin = fixture('bin');
writeFileSync(join(fakeBin, 'gh'), '#!/bin/sh\n[ "$TEST_GH_FAIL" = 1 ] && exit 1\nprintf "upstream\\n"\n', { mode: 0o755 });
// Child-only fixture HOME and PATH: no real credentials, settings, cache or network access.
const envFor = dir => ({ PATH: `${fakeBin}:${process.env.PATH}`, HOME: home, CLAUDE_PROJECT_DIR: dir });
const run = (file, dir, args = [], extra = {}, input = '') => spawnSync(process.execPath, [file, ...args], {
  cwd: dir, input, encoding: 'utf8', timeout: 10000, env: { ...envFor(dir), ...extra },
});
const status = (r, code = 0) => assert.equal(r.status, code, r.stderr + r.stdout);
const entry = { skill: 'fixture', key: 'one', insight: 'Preserve checked behavior', source: 'observed', trusted: false };
const id = e => createHash('sha256').update(`${e.skill}:${e.key}`).digest('hex').slice(0, 16);

test('gstack import creates private lessons and preserves input, duplicate and existing-directory behavior', () => {
  const dir = fixture('gstack'), input = join(dir, 'learnings.jsonl'), lessons = join(dir, '.loop/lessons');
  const bytes = JSON.stringify(entry) + '\n'; writeFileSync(input, bytes, { mode: 0o640 });
  const args = ['--gstack-file', input];
  status(run(join(bin, 'gstack-scan.mjs'), dir, args));
  const file = join(lessons, `${id(entry)}.json`);
  assert.equal(mode(join(dir, '.loop')), 0o700); assert.equal(mode(lessons), 0o700); assert.equal(mode(file), 0o600);
  assert.equal(JSON.parse(readFileSync(file)).verified, false);
  const saved = readFileSync(file, 'utf8'); chmodSync(lessons, 0o750); chmodSync(file, 0o640);
  status(run(join(bin, 'gstack-scan.mjs'), dir, args));
  assert.equal(readFileSync(file, 'utf8'), saved); assert.equal(mode(file), 0o640); assert.equal(mode(lessons), 0o750);
  assert.equal(readFileSync(input, 'utf8'), bytes); assert.equal(mode(input), 0o640);
  const custom = join(dir, 'custom/lessons');
  status(run(join(bin, 'gstack-scan.mjs'), dir, [...args, '--lessons', custom]));
  assert.equal(mode(custom), 0o700); assert.equal(mode(join(custom, `${id(entry)}.json`)), 0o600);
  assert.ok(readdirSync(custom).every(name => name.endsWith('.json')));
});

test('gstack refuses an existing temporary file instead of publishing its inherited permissions', async () => {
  const dir = fixture('gstack-collision'), input = join(dir, 'learnings.jsonl'), lessons = join(dir, 'lessons');
  mkdirSync(lessons); writeFileSync(input, JSON.stringify(entry) + '\n');
  const cli = join(bin, 'gstack-scan.mjs');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { pathToFileURL } from 'node:url';
    await new Promise(resolve => process.stdin.once('data', resolve));
    process.argv = ${JSON.stringify([process.execPath, cli, '--gstack-file', input, '--lessons', lessons])};
    await import(pathToFileURL(process.argv[1]));
  `], { cwd: dir, env: envFor(dir), stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
  const closed = once(child, 'close'); let stderr = ''; child.stderr.on('data', b => { stderr += b; });
  try {
    const temp = join(lessons, `${id(entry)}.json.${child.pid}.tmp`);
    writeFileSync(temp, 'existing temporary data', { mode: 0o640 }); child.stdin.end('go\n');
    const [code] = await closed; assert.equal(code, 1, stderr); assert.match(stderr, /EEXIST/);
    assert.equal(readFileSync(temp, 'utf8'), 'existing temporary data'); assert.equal(mode(temp), 0o640);
    assert.equal(existsSync(join(lessons, `${id(entry)}.json`)), false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill(); await closed; }
  }
});

test('vendor stamps are private; read-only checks, unknown results and existing state are preserved', () => {
  const dir = fixture('sync'), file = join(dir, '.loop/mattpocock-skills-sync.json'), cli = join(bin, 'mattpocock-skills-sync-check.mjs');
  let r = run(cli, dir); status(r); assert.match(r.stdout, /FIRST_RUN upstream/); assert.equal(existsSync(file), false);
  r = run(cli, dir, ['--stamp', 'upstream']); status(r); assert.match(r.stdout, /STAMPED upstream/);
  assert.equal(mode(join(dir, '.loop')), 0o700); assert.equal(mode(file), 0o600);
  chmodSync(join(dir, '.loop'), 0o755); chmodSync(file, 0o640);
  writeFileSync(file, JSON.stringify({ lastSeenSha: 'upstream', kept: 'fixture' }));
  status(run(cli, dir, ['--stamp', 'next']));
  assert.equal(JSON.parse(readFileSync(file)).kept, 'fixture'); assert.equal(mode(file), 0o640);
  assert.equal(mode(join(dir, '.loop')), 0o755);
  const saved = readFileSync(file, 'utf8'); r = run(cli, dir, [], { TEST_GH_FAIL: '1' }); status(r, 2);
  assert.match(r.stdout, /UNKNOWN/); assert.equal(readFileSync(file, 'utf8'), saved);
});

test('dependency audit stamps are private and keep missing usage and write failures honest', () => {
  const dir = fixture('deps'), file = join(dir, '.loop/deps-audit.last'), cli = join(bin, 'deps-audit.mjs');
  let r = run(cli, dir, ['--json']); status(r); assert.equal(JSON.parse(r.stdout).usageAvailable, false);
  assert.equal(mode(join(dir, '.loop')), 0o700); assert.equal(mode(file), 0o600);
  assert.ok(Number(readFileSync(file, 'utf8')) > 0);
  chmodSync(join(dir, '.loop'), 0o755); chmodSync(file, 0o640);
  writeFileSync(join(dir, '.loop/.env'), 'USER_OWNED=fixture\n', { mode: 0o640 });
  status(run(cli, dir, ['--json'])); assert.equal(mode(file), 0o640); assert.equal(mode(join(dir, '.loop')), 0o755);
  assert.equal(readFileSync(join(dir, '.loop/.env'), 'utf8'), 'USER_OWNED=fixture\n'); assert.equal(mode(join(dir, '.loop/.env')), 0o640);
  const blocked = fixture('deps-blocked'); writeFileSync(join(blocked, '.loop'), 'occupied');
  r = run(cli, blocked, ['--json']); status(r); assert.equal(JSON.parse(r.stdout).usageAvailable, false);
  assert.equal(readFileSync(join(blocked, '.loop'), 'utf8'), 'occupied');
});

for (const name of ['recall', 'graduate']) test(`${name} debug logs are private, opt-in and fail-open`, () => {
  const dir = fixture(name), plugin = join(dir, 'plugin'), data = join(dir, 'data');
  mkdirSync(join(plugin, 'dist'), { recursive: true }); mkdirSync(data, { mode: 0o755 });
  writeFileSync(join(plugin, 'dist/cli.js'), "console.error('fixture stderr must not reach debug log');process.exit(3);\n");
  const file = join(data, `${name}-debug.log`), hook = join(here, `../../loop-memory/hooks/${name}-lessons.mjs`);
  const env = { CLAUDE_PLUGIN_ROOT: plugin, CLAUDE_PLUGIN_DATA: data, OPENAI_API_KEY: name === 'graduate' ? 'fixture-embedding-key' : '',
    GEMINI_API_KEY: '', LOOP_RECALL_DEBUG: '1', LOOP_GRADUATE_DEBUG: '1', LOOP_DIR: '.loop' };
  let r = run(hook, dir, [], env, '{}'); status(r); assert.equal(r.stdout, '');
  assert.equal(mode(file), 0o600); assert.equal(mode(data), 0o755);
  const first = readFileSync(file, 'utf8'); assert.doesNotMatch(first, /fixture stderr/);
  chmodSync(file, 0o640); status(run(hook, dir, [], env, '{}'));
  const saved = readFileSync(file, 'utf8'); assert.ok(saved.startsWith(first) && saved.length > first.length); assert.equal(mode(file), 0o640);
  status(run(hook, dir, [], { ...env, LOOP_RECALL_DEBUG: '0', LOOP_GRADUATE_DEBUG: '0' }, '{}'));
  status(run(hook, dir, [], { ...env, LOOP_MEMORY_OFF: '1' }, '{}'));
  assert.equal(readFileSync(file, 'utf8'), saved);
  status(run(hook, dir, [], { ...env, CLAUDE_PLUGIN_DATA: join(dir, 'missing') }, '{}'));
  assert.equal(existsSync(join(dir, 'missing')), false);
  status(run(hook, dir, [], { ...env, CLAUDE_PLUGIN_DATA: '' }, '{}'));
  assert.equal(mode(join(plugin, `${name}-debug.log`)), 0o600);
});
JS
