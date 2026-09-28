import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPackages, writePackages } from './generate-runtime-packages.mjs';
import { resolvePluginInstallation } from '../tools/loop-engine/bin/plugin-path.mjs';
import { approvePluginFixture } from '../tools/loop-engine/test/helpers/plugin-approval.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = buildPackages(root);
const temp = t => { const p = realpathSync(mkdtempSync(join(tmpdir(), 'paul-loop unified 한글 '))); t.after(() => rmSync(p, { recursive: true, force: true })); return p; };
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const run = (file, args, cwd, env = {}, input = '') => spawnSync(process.execPath, [file, ...args], {
  cwd, input, encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, HOME: cwd, ...env },
});

test('one installed identity exposes the Paul Loop entry and all modules in both runtimes', t => {
  const dir = join(temp(t), 'build'); writePackages(files, dir);
  for (const runtime of ['claude', 'codex']) {
    const catalog = read(join(dir, runtime, runtime === 'claude' ? '.claude-plugin/marketplace.json' : '.agents/plugins/marketplace.json'));
    assert.deepEqual(catalog.plugins.map(p => p.name), ['paul-loop']);
    const plugin = join(dir, runtime, 'plugins/paul-loop'), manifest = read(join(plugin, `.${runtime}-plugin/plugin.json`));
    assert.equal(manifest.name, 'paul-loop'); assert.equal(manifest.dependencies, undefined);
    assert(existsSync(join(plugin, manifest.skills, 'paul-loop/SKILL.md')));
    if (runtime === 'codex') {
      assert.match(readFileSync(join(plugin, 'skills/publisher/agents/openai.yaml'), 'utf8'), /allow_implicit_invocation: false/);
      assert.match(readFileSync(join(plugin, 'tools/ship-flow/agent-templates/publisher.toml'), 'utf8'), /sandbox_mode = "workspace-write"/);
    }
    const routing = readFileSync(join(plugin, manifest.skills, 'ask-paul/SKILL.md'), 'utf8');
    assert.match(routing, /paul-loop:ship-feature/); assert.doesNotMatch(routing, /ship-flow:/);
    for (const path of ['tools/loop-engine/bin/verdict-run.sh', 'tools/loop-memory/dist/cli.js', 'hooks/run.mjs']) assert(existsSync(join(plugin, path)), path);
  }
});

test('memory hooks remain inert with ambient keys until explicitly enabled; Codex guards still deny', t => {
  const dir = temp(t), generated = join(dir, 'build'), project = join(dir, 'project');
  mkdirSync(project); writePackages(files, generated);
  const bundle = join(generated, 'codex/plugins/paul-loop'), dispatch = join(bundle, 'hooks/run.mjs');
  for (const env of [{ OPENAI_API_KEY: 'fixture-not-a-key' }, { PAUL_LOOP_MEMORY: 'false', CLAUDE_PLUGIN_OPTION_MEMORY_ENABLED: 'true' },
    { PAUL_LOOP_MEMORY: '1', LOOP_MEMORY_OFF: '1' }]) {
    const result = run(dispatch, ['--codex', 'loop-memory', 'recall-lessons.mjs'], project, env, 'not JSON; disabled hook must not read stdin');
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout + result.stderr, '');
    assert.equal(existsSync(join(project, '.loop')), false, 'off must not read a prompt, write telemetry or contact a provider');
  }
  mkdirSync(join(project, '.loop'));
  writeFileSync(join(project, '.loop/.env'), 'OPENAI_API_KEY=fixture-not-a-key');
  const preload = join(dir, 'observe-reads.mjs');
  writeFileSync(preload, `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
const open = fs.openSync; fs.openSync = function(path,...args) { if(String(path).endsWith('/.env')) process.stderr.write('OBSERVED_CREDENTIAL_OPEN'); return open.call(this,path,...args); }; syncBuiltinESMExports();`);
  const heartbeat = run(dispatch, ['--codex', 'loop-engine', 'loop-doctor-heartbeat.mjs'], project,
    { NODE_OPTIONS: '--import=' + new URL('file://' + preload).href }, JSON.stringify({hook_event_name:'SessionStart',cwd:project}));
  assert.equal(heartbeat.status, 0, heartbeat.stderr);
  assert.doesNotMatch(heartbeat.stderr, /OBSERVED_CREDENTIAL_OPEN/);
  assert.match(heartbeat.stdout, /installation alone never proves all hooks are trusted/);
  const optedIn = run(dispatch, ['--codex', 'loop-engine', 'loop-doctor-heartbeat.mjs'], project,
    { PAUL_LOOP_MEMORY: '1', NODE_OPTIONS: '--import=' + new URL('file://' + preload).href }, JSON.stringify({hook_event_name:'SessionStart',cwd:project}));
  assert.match(optedIn.stderr, /OBSERVED_CREDENTIAL_OPEN/, 'positive control observes the actual dotenv open before fd reads');
  rmSync(join(project, '.loop'), {recursive:true});
  const enabled = run(dispatch, ['loop-memory', 'recall-lessons.mjs'], project, { PAUL_LOOP_MEMORY: '1' });
  assert.equal(enabled.status, 0, enabled.stderr);
  const ledger = readFileSync(join(project, '.loop/runs/unknown.jsonl'), 'utf8');
  assert.match(ledger, /no_embedding_key/);
  const guard = run(dispatch, ['--codex', 'loop-engine', 'gate-risky-commands.mjs'], project, {},
    JSON.stringify({ hook_event_name: 'PreToolUse', cwd: project, tool_name: 'Bash', tool_input: { command: 'gh pr merge 123 --squash' } }));
  assert.equal(guard.status, 0, guard.stderr);
  assert.equal(JSON.parse(guard.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('one external bundle approval resolves every module and rejects a tampered nested file', t => {
  const project = temp(t), artifact = join(project, 'vendor/paul-loop');
  for (const [path, data] of files) {
    const prefix = 'codex/plugins/paul-loop/'; if (!path.startsWith(prefix)) continue;
    const dest = join(artifact, path.slice(prefix.length)); mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data.content); chmodSync(dest, data.mode);
  }
  approvePluginFixture(project, artifact, 'codex');
  const lockPath = join(project, '.codex/paul-loop.lock.json'), lock = read(lockPath);
  delete lock.plugins['paul-loop'].id; lock.plugins['paul-loop'].path = '../vendor/paul-loop';
  writeFileSync(lockPath, JSON.stringify(lock));
  for (const plugin of ['loop-engine', 'ship-flow', 'loop-memory']) {
    const found = resolvePluginInstallation({ root: project, runtime: 'codex', plugin, env: { PAUL_LOOP_PATH: artifact } });
    assert.equal(found.path, join(artifact, 'tools', plugin));
  }
  lock.plugins['loop-engine'] = { version: '0.15.20' };
  writeFileSync(lockPath, JSON.stringify(lock));
  assert.throws(() => resolvePluginInstallation({ root: project, runtime: 'codex', plugin: 'loop-engine', env: { PAUL_LOOP_PATH: artifact } }), /mixed unified and legacy/);
  delete lock.plugins['loop-engine']; writeFileSync(lockPath, JSON.stringify(lock));
  execFileSync('git', ['init', '-q', project]);
  const execute = () => run(join(root, 'scripts/project-plugin.mjs'), ['--project', project, 'exec', 'bin/verdict-run.sh', '--', process.execPath, '-e', 'process.exit(0)'], project);
  const pass = execute(); assert.equal(pass.status, 0, pass.stdout + pass.stderr); assert.match(pass.stdout, /VERDICT: PASS/);
  writeFileSync(join(artifact, 'tools/loop-memory/dist/cli.js'), 'tampered');
  assert.throws(() => resolvePluginInstallation({ root: project, runtime: 'codex', plugin: 'loop-engine', env: { PAUL_LOOP_PATH: artifact } }), /integrity mismatch/);
  const denied = execute(); assert.notEqual(denied.status, 0); assert.match(denied.stderr, /integrity mismatch/);
});
