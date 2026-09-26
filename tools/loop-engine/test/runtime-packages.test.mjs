import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildPackages, writePackages } from '../../../scripts/generate-runtime-packages.mjs';
import { adaptOutput } from '../runtime/hook-adapter.mjs';
import { verifyPluginIntegrity } from '../bin/plugin-path.mjs';
import { embedRoleResources, localMarkdownLinks, rebaseDocLinks, validateGeneratedDocRefs } from '../../../scripts/runtime-docs.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const source = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, body) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); };
const temp = (t) => { const p = realpathSync(mkdtempSync(join(tmpdir(), 'runtime 한글 '))); t.after(() => rmSync(p, { recursive: true, force: true })); return p; };
const clean = { PATH: process.env.PATH };
const run = (file, args = [], options = {}) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', env: clean, timeout: 30000, ...options });

test('external trust paths trigger the unchanged pinned runner from base CODEOWNERS', (t) => {
  const owners = source('CODEOWNERS');
  const entries = owners.split('\n').filter(line => line.startsWith('/')).map(line => line.trim().split(/\s+/));
  const covers = path => entries.some(([prefix, owner]) => owner === '@paulkim-lansik' && (prefix.endsWith('/') ? ('/' + path).startsWith(prefix) : '/' + path === prefix));
  for (const path of ['tools/loop-engine/runtime/new-adapter.mjs', 'tools/loop-engine/eval/new-grader.mjs',
    'scripts/generate-runtime-packages.mjs', 'scripts/runtime-docs.mjs', 'scripts/refresh-skill-lock.mjs',
    'tools/ship-flow/workflows/harness-audit.js', 'tools/ship-flow/templates/branch-protect.sh',
    'tools/ship-flow/templates/branch-protect.mjs', 'tools/ship-flow/templates/setup-loop-engine.action.yml.template',
    ...['provenance.ts', 'store.ts', 'lessons.ts', 'knowledge.ts', 'ops.ts', 'cli.ts', 'schema/memory.ts'].map(p => 'tools/loop-memory/src/' + p),
    'tools/loop-memory/hooks/graduate-lessons.mjs', 'tools/loop-memory/dist/cli.js', 'tools/loop-memory/test/hardening.test.ts']) assert.ok(covers(path), path);
  // Actual base-test execution, not a second copy of the runner's prefix matcher.
  for (const path of ['scripts/runtime-docs.mjs', 'tools/ship-flow/workflows/harness-audit.js',
    'tools/ship-flow/templates/branch-protect.mjs', 'tools/loop-memory/src/provenance.ts']) {
    const dir = temp(t);
    const git = args => execFileSync('git', ['-C', dir, ...args], { env: { ...clean, HOME: dir }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git(['init', '-qb', 'main']);
    write(join(dir, 'CODEOWNERS'), owners);
    write(join(dir, path), 'trusted\n');
    write(join(dir, 'tools/loop-engine/test/run.sh'), 'set -eu\nbash tools/loop-engine/test/trust.test.sh\n');
    write(join(dir, 'tools/loop-engine/test/trust.test.sh'), `set -eu\n[ "$(cat '${path}')" = trusted ]\n`);
    const commit = message => { git(['add', '.']); git(['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', message]); };
    commit('base'); const base = git(['rev-parse', 'HEAD']);
    write(join(dir, path), 'weakened\n'); commit('change only external trust implementation');
    const result = spawnSync('bash', [join(root, 'tools/loop-engine/bin/verifier-pinned-review.sh'), '--base', base, '--repo-root', dir], { encoding: 'utf8', env: { ...clean, HOME: dir }, timeout: 30000 });
    assert.equal(result.status, 1, `${path}: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /base .* suite broke against this PR/);
    assert.doesNotMatch(result.stdout, /skipping pinned-baseline check/);
  }
});

test('both generated runtimes are deterministic, internally versioned and packaged without installed caches', (t) => {
  const dir = temp(t), files = buildPackages(root), again = buildPackages(root);
  assert.deepEqual(files, again);
  writePackages(files, join(dir, 'one')); writePackages(again, join(dir, 'two'));
  writePackages(files, join(dir, 'one'), true);
  const provenance = json(join(dir, 'one/provenance.json'));
  assert.equal(provenance.sourceVersions['loop-engine'], json(join(root, 'tools/loop-engine/.claude-plugin/plugin.json')).version);
  assert.ok(provenance.sourceHashes['skills-lock.json']);
  assert.equal(provenance.limitations.liveEndToEnd, 'not-verified');
  for (const runtime of ['claude', 'codex']) {
    for (const [name, version] of Object.entries(provenance.sourceVersions)) {
      const plugin = join(dir, 'one', runtime, 'plugins', name);
      const manifest = json(join(plugin, `.${runtime}-plugin/plugin.json`));
      assert.equal(manifest.name, name); assert.equal(manifest.version, version);
      const approval = json(join(dir, 'one', runtime, 'plugin-integrity.json')).plugins[name];
      assert.equal(approval.version, version);
      assert.deepEqual(verifyPluginIntegrity(plugin, runtime, name, version, approval.integrity), approval.integrity);
      if (runtime === 'codex') assert.equal(existsSync(join(plugin, '.claude-plugin/plugin.json')), false);
    }
  }
  const catalog = json(join(dir, 'one/codex/.agents/plugins/marketplace.json'));
  const sourceApproval = json(join(dir, 'one/claude/source-integrity.json')).plugins['loop-engine'];
  assert.deepEqual(verifyPluginIntegrity(join(root, 'tools/loop-engine'), 'claude', 'loop-engine', sourceApproval.version, sourceApproval.integrity), sourceApproval.integrity);
  assert.equal(catalog.name, 'paul-loop-codex');
  assert.equal(catalog.plugins.length, 3);
  for (const plugin of catalog.plugins) {
    assert.ok(existsSync(join(dir, 'one/codex', plugin.source.path, '.codex-plugin/plugin.json')));
    assert.equal(plugin.policy.installation, 'AVAILABLE'); // never auto-enables optional memory
  }
  const hooks = json(join(dir, 'one/codex/plugins/loop-engine/hooks/hooks.json')).hooks;
  for (const event of ['PermissionDenied', 'InstructionsLoaded', 'PostToolUseFailure']) assert.equal(hooks[event], undefined);
  for (const groups of Object.values(hooks)) for (const group of groups) for (const hook of group.hooks) {
    assert.match(hook.command, /\$\{PLUGIN_ROOT\}\/runtime\/hook-adapter\.mjs/);
    assert.equal(hook.command.includes('CLAUDE_PLUGIN_ROOT'), false);
    const target = / (hooks\/[^ ]+)/.exec(hook.command)[1];
    assert.ok(existsSync(join(dir, 'one/codex/plugins/loop-engine', target)));
  }
  const role = source('tools/ship-flow/agents/code-reviewer.md');
  const skill = readFileSync(join(dir, 'one/codex/plugins/ship-flow/skills/code-reviewer/SKILL.md'), 'utf8');
  assert.match(skill, /fresh subagent/); assert.match(skill, /does not constrain tools/);
  const template = readFileSync(join(dir, 'one/codex/plugins/ship-flow/agent-templates/code-reviewer.toml'), 'utf8');
  assert.match(template, /sandbox_mode = "read-only"/); assert.ok(role.length > 100);
  assert.equal(existsSync(join(dir, 'one/codex/plugins/ship-flow/.codex/agents')), false);
  assert.match(readFileSync(join(dir, 'one/codex/plugins/ship-flow/skills/ship-feature/SKILL.md'), 'utf8'), /Native Claude Workflow JS is unsupported/);
});

test('generated inventory detects missing, altered, extra files and executable mode drift', (t) => {
  const dir = join(temp(t), 'out');
  const files = new Map([['.paul-loop-generated.json', { content: Buffer.from('{}'), mode: 0o644 }], ['bin/probe.mjs', { content: Buffer.from('original'), mode: 0o755 }]]);
  writePackages(files, dir);
  write(join(dir, 'extra'), 'stray'); assert.throws(() => writePackages(files, dir, true), /inventory drift/);
  writePackages(files, dir); write(join(dir, 'bin/probe.mjs'), 'modified'); assert.throws(() => writePackages(files, dir, true), /artifact drift/);
  writePackages(files, dir); chmodSync(join(dir, 'bin/probe.mjs'), 0o644); assert.throws(() => writePackages(files, dir, true), /artifact drift/);
  writePackages(files, dir); rmSync(join(dir, 'bin/probe.mjs')); assert.throws(() => writePackages(files, dir, true), /inventory drift/);
  const other = join(dirname(dir), 'unowned'); mkdirSync(other); write(join(other, 'keep'), 'owned elsewhere');
  assert.throws(() => writePackages(files, other), /unowned/); assert.equal(readFileSync(join(other, 'keep'), 'utf8'), 'owned elsewhere');
  const link = join(dirname(dir), 'alias'); symlinkSync(other, link); assert.throws(() => writePackages(files, link), /symlink/);
  const outside = run(join(root, 'scripts/generate-runtime-packages.mjs'), ['--out', other]);
  assert.notEqual(outside.status, 0); assert.match(outside.stderr, /output must be under/);
});

test('hook adapter maps ask to deny, preserves denies, fails closed on crashes and leaves trust explicit', (t) => {
  const ask = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'risky operation' } };
  const adapted = JSON.parse(adaptOutput('PreToolUse', JSON.stringify(ask)));
  assert.equal(adapted.hookSpecificOutput.permissionDecision, 'deny'); assert.match(adapted.hookSpecificOutput.permissionDecisionReason, /Human review required/);
  assert.equal(JSON.parse(adaptOutput('PreToolUse', JSON.stringify(adapted))).hookSpecificOutput.permissionDecision, 'deny');
  const dir = temp(t);
  cpSync(join(root, 'tools/loop-engine/runtime'), join(dir, 'runtime'), { recursive: true });
  write(join(dir, 'hooks/ask.mjs'), `console.log(${JSON.stringify(JSON.stringify(ask))});`);
  write(join(dir, 'hooks/crash.mjs'), 'process.exit(1)');
  write(join(dir, 'hooks/env.mjs'), 'console.log(JSON.stringify({root:process.env.CLAUDE_PLUGIN_ROOT,cwd:process.env.CLAUDE_PROJECT_DIR,session:process.env.CLAUDE_CODE_SESSION_ID}));');
  const invoke = (target, event = 'PreToolUse') => run(join(dir, 'runtime/hook-adapter.mjs'), [target], { cwd: dir, input: JSON.stringify({hook_event_name:event,cwd:dir,session_id:'fixture'}) });
  for (const target of ['hooks/ask.mjs', 'hooks/crash.mjs', 'hooks/missing.mjs', 'hooks/../runtime/capabilities.json']) {
    const res = invoke(target); assert.equal(res.status, 0, res.stderr); assert.equal(JSON.parse(res.stdout).hookSpecificOutput.permissionDecision, 'deny');
  }
  const env = JSON.parse(invoke('hooks/env.mjs', 'SessionStart').stdout);
  assert.deepEqual(env, {root:dir,cwd:dir,session:'fixture'});
  write(join(dir, 'hooks/loop-doctor-heartbeat.mjs'), '');
  assert.match(invoke('hooks/loop-doctor-heartbeat.mjs', 'SessionStart').stdout, /installation alone never proves all hooks are trusted/);
  assert.notEqual(invoke('hooks/env.mjs', 'InstructionsLoaded').status, 0);
  const bad = run(join(dir, 'runtime/hook-adapter.mjs'), ['hooks/ask.mjs'], {input:'invalid'}); assert.equal(bad.status, 2);
});

test('native direct mjs launch no longer returns EACCES, and doctor never attests hook trust', (t) => {
  const dir = temp(t);
  write(join(dir, 'bin/gh'), '#!/bin/sh\nexit 1\n'); chmodSync(join(dir, 'bin/gh'), 0o755);
  const env = {...clean, HOME:dir, CLAUDE_CONFIG_DIR:join(dir,'empty-config'), PATH:join(dir,'bin')+':'+process.env.PATH};
  for (const name of readdirSync(join(root, 'tools/loop-engine/bin')).filter(n => n.endsWith('.mjs'))) {
    assert.equal(lstatSync(join(root, 'tools/loop-engine/bin', name)).mode & 0o111, 0o111, `${name} must be executable`);
  }
  for (const name of ['deps-audit.mjs', 'mattpocock-skills-sync-check.mjs', 'plugin-path.mjs', 'runtime-doctor.mjs', 'agent-eval.mjs', 'evidence.mjs']) {
    const path = join(root, 'tools/loop-engine/bin', name);
    assert.equal(lstatSync(path).mode & 0o111, 0o111, name);
    // Use the real entrypoint with empty HOME and offline gh. The sync checker has no --help.
    const args = name === 'mattpocock-skills-sync-check.mjs' ? ['--stamp'] : ['--help'];
    const res = spawnSync(path, args, {cwd:dir,env,encoding:'utf8',timeout:5000});
    assert.equal(res.error, undefined, `${name}: ${res.error}`); assert.equal(res.signal, null);
    if (name === 'agent-eval.mjs' || name === 'evidence.mjs') {
      assert.equal(res.status, name === 'agent-eval.mjs' ? 2 : 1); assert.match(res.stderr, /Usage:/); // each CLI's usage status; no target/grader or evidence write
    }
  }
  const res = run(join(root, 'tools/loop-engine/bin/runtime-doctor.mjs'), ['--require', 'hooks'], {cwd:dir,env:{...clean,LOOP_RUNTIME:'claude',LOOP_ENGINE_PATH:join(root,'tools/loop-engine')}});
  assert.equal(res.status, 1); const report = JSON.parse(res.stdout);
  assert.equal(report.hookTrust, 'unknown'); assert.equal(report.liveEndToEnd, 'not-verified');
  assert.ok(report.problems.some(p => p.includes('host verification')));
});

test('setup action executes twice with independent temporary dirs, preserves spaces and validates pins', (t) => {
  const dir = temp(t), provider = join(dir, 'provider repo'), runner = join(dir, 'runner space'); mkdirSync(runner);
  const executed = join(dir, 'resolver-executed'), checkedOut = join(dir, 'smudge-executed');
  // Redirect only the canonical network URL. Real Git creates and verifies the fetched objects.
  const env = { ...clean, HOME: dir, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_ALLOW_PROTOCOL: 'file', GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: `url.${pathToFileURL(provider).href}.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/reach0908/paul-loop.git', RUNNER_TEMP: runner,
    GIT_CONFIG_KEY_1: 'filter.fixture.smudge', GIT_CONFIG_VALUE_1: 'echo smudge >> "$SETUP_CHECKOUT_SENTINEL"; cat',
    SETUP_EXECUTION_SENTINEL: executed, SETUP_CHECKOUT_SENTINEL: checkedOut };
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(dir, 'init', '-q', '--initial-branch=main', provider);
  git(provider, 'config', 'user.name', 'Fixture'); git(provider, 'config', 'user.email', 'fixture@example.invalid');
  const commit = () => { git(provider, 'add', '-A'); git(provider, 'commit', '-qm', 'fixture'); return git(provider, 'rev-parse', 'HEAD'); };
  const pins = {};
  for (const [plugin, key] of [['loop-engine', 'LOOP_ENGINE'], ['ship-flow', 'SHIP_FLOW']]) {
    cpSync(join(root, 'tools', plugin), join(provider, 'tools', plugin), { recursive: true, filter: path => !path.split(/[\\/]/).includes('node_modules') });
    if (key === 'LOOP_ENGINE') {
      const resolver = join(provider, 'tools/loop-engine/bin/plugin-path.mjs');
      write(resolver, readFileSync(resolver, 'utf8').replace('\n', '\nimport { appendFileSync as recordExecution } from "node:fs"; recordExecution(process.env.SETUP_EXECUTION_SENTINEL, "resolver\\n");\n'));
    }
    pins[`${key}_TAG`] = 'v' + json(join(provider, 'tools', plugin, '.claude-plugin/plugin.json')).version;
    pins[`${key}_COMMIT`] = commit();
    git(provider, 'tag', `${plugin}--${pins[`${key}_TAG`]}`);
  }
  const execute = (overrides = {}) => {
    rmSync(executed, { force: true }); rmSync(checkedOut, { force: true });
    const values = { ...pins, ...overrides };
    const rendered = source('tools/ship-flow/templates/setup-loop-engine.action.yml.template').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
      assert.ok(Object.hasOwn(values, key), `unknown setup placeholder: ${key}`); return values[key];
    });
    const [metadata, script] = rendered.split('      run: |\n');
    assert.ok(script, 'setup shell is missing');
    // This template's step env supports literal single-quoted values, never evaluated shell text.
    const stepEnv = Object.fromEntries([...metadata.matchAll(/^        ([A-Z_]+): '([^'\n]*)'$/gm)].map(([, key, value]) => [key, value]));
    const out = join(dir, 'github-env'); write(out, '');
    const result = spawnSync('/bin/bash', ['-c', script.split('\n').map(line => line.slice(8)).join('\n')],
      { cwd: dir, encoding: 'utf8', env: { ...env, ...stepEnv, GITHUB_ENV: out }, timeout: 30000 });
    assert.equal(result.error, undefined);
    return { ...result, exported: readFileSync(out, 'utf8'), executed: existsSync(executed), checkedOut: existsSync(checkedOut) };
  };
  const outputs=[];
  for (let i=0;i<2;i++) {
    const result = execute();
    assert.equal(result.status,0,result.stderr); const entries=Object.fromEntries(result.exported.trim().split('\n').map(l=>l.split('=')));
    assert.equal(result.executed, true, 'positive control must reach the downloaded resolver');
    assert.equal(entries.LOOP_RUNTIME,'shell');
    for (const key of ['LOOP_ENGINE', 'SHIP_FLOW']) {
      assert.ok(entries[`${key}_PATH`].startsWith(runner+'/paul-loop.'));
      assert.equal(git(entries[`${key}_PATH`], 'rev-parse', 'HEAD'), pins[`${key}_COMMIT`]);
      assert.equal(entries[`${key}_COMMIT`], pins[`${key}_COMMIT`]);
    }
    outputs.push(entries.LOOP_ENGINE_PATH);
  }
  assert.notEqual(outputs[0],outputs[1]); assert.ok(existsSync(outputs[0]));
  const successfulDirs = readdirSync(runner).sort();
  const reject = (result, allowExecution = false) => {
    assert.notEqual(result.status, 0, result.stderr); assert.equal(result.exported, '');
    assert.equal(result.executed, allowExecution, 'identity failure must precede downloaded code');
    assert.equal(result.checkedOut, false, 'untrusted Git attributes must not trigger a checkout filter');
    assert.deepEqual(readdirSync(runner).sort(), successfulDirs, 'failure cleans only its own installation');
    assert.ok(existsSync(outputs[0])); assert.ok(existsSync(outputs[1]));
  };
  reject(execute({ SHIP_FLOW_TAG: 'v0.0.0', SHIP_FLOW_COMMIT: '0'.repeat(40) }));
  // Transport success is insufficient: retain the downloaded artifact validation failure path.
  const manifest = join(provider, 'tools/ship-flow/.claude-plugin/plugin.json');
  write(manifest, JSON.stringify({ ...json(manifest), name: 'wrong-plugin' }));
  const invalid = commit(); git(provider, 'tag', 'ship-flow--v0.0.1');
  const rejected = execute({ SHIP_FLOW_TAG: 'v0.0.1', SHIP_FLOW_COMMIT: invalid });
  reject(rejected, true); assert.match(rejected.stderr, /manifest name mismatch/);

  // Retarget each release independently. Both identities must pass before either checkout or resolver.
  write(manifest, JSON.stringify({ ...json(manifest), name: 'ship-flow' }));
  write(join(provider, '.gitattributes'), 'unreviewed.txt filter=fixture\n');
  write(join(provider, 'unreviewed.txt'), 'not reviewed\n');
  const changed = commit();
  for (const [plugin, key] of [['loop-engine', 'LOOP_ENGINE'], ['ship-flow', 'SHIP_FLOW']]) {
    const tag = `${plugin}--${pins[`${key}_TAG`]}`;
    git(provider, 'tag', '-f', tag, changed);
    reject(execute());
    git(provider, 'tag', '-f', tag, pins[`${key}_COMMIT`]);
    git(provider, 'branch', tag, changed); // --branch can choose a same-named branch over a tag.
    reject(execute()); git(provider, 'branch', '-D', tag);
    git(provider, 'tag', '-d', tag); git(provider, 'branch', tag, pins[`${key}_COMMIT`]);
    reject(execute()); // A branch-only alias is not the reviewed release tag, even at the same commit.
    git(provider, 'branch', '-D', tag); git(provider, 'tag', tag, pins[`${key}_COMMIT`]);
    for (const value of ['', 'abc123', '0'.repeat(40), 'A'.repeat(40), pins[`${key}_COMMIT`] + '\n', '$(touch "$SETUP_EXECUTION_SENTINEL")']) {
      reject(execute({ [`${key}_COMMIT`]: value }));
    }
    for (const value of ['main', 'v01.2.3', 'v1.2.3; true', '$(touch "$SETUP_EXECUTION_SENTINEL")']) {
      reject(execute({ [`${key}_TAG`]: value }));
    }
    // An annotated tag is pinned by its peeled commit, not by the tag object's own hash.
    git(provider, 'tag', '-f', '-a', tag, '-m', 'reviewed release', pins[`${key}_COMMIT`]);
  }
  const annotated = execute(); assert.equal(annotated.status, 0, annotated.stderr);
  for (const [plugin, key] of [['loop-engine', 'LOOP_ENGINE'], ['ship-flow', 'SHIP_FLOW']]) {
    git(provider, 'tag', '-f', `${plugin}--${pins[`${key}_TAG`]}`, changed);
  }
  const repinned = execute({ LOOP_ENGINE_COMMIT: changed, SHIP_FLOW_COMMIT: changed });
  assert.equal(repinned.status, 0, repinned.stderr); assert.equal(repinned.executed, true);
  assert.equal(repinned.checkedOut, true, 'explicitly reviewed update must exercise the checkout-filter control');
});

test('release tags depend on validation at the event SHA and CI compares committed runtime bundle', () => {
  const release=source('.github/workflows/tag-on-publish.yml');
  assert.match(release, /needs: \[engine, memory, runtime, secrets-scan\]/);
  for (const workflow of ['loop-engine-test','loop-memory-test','runtime-packages','gitleaks']) {
    assert.ok(release.includes(`uses: ./.github/workflows/${workflow}.yml`));
    assert.match(source(`.github/workflows/${workflow}.yml`), /workflow_call:/);
  }
  assert.match(release,/if: github.ref == 'refs\/heads\/main'/);
  assert.match(release,/SHA: \$\{\{ github.sha \}\}/);
  assert.match(release,/git push origin "\$\{new_refs\[@\]\}"/);
  assert.match(source('.github/workflows/loop-memory-test.yml'), /git diff --exit-code -- dist\/cli\.js/);
});

test('moved role references rebase from agents to skills and generated doc validation rejects regression', () => {
  const input = '[authorization](../skills/AUTHORIZATION.md) and [handoff](../skills/ship-feature/PUBLISH-HANDOFF.md#safe-pattern)';
  const moved = rebaseDocLinks(input, 'agents/publisher.md', 'skills/publisher/SKILL.md');
  assert.equal(moved, '[authorization](../AUTHORIZATION.md) and [handoff](../ship-feature/PUBLISH-HANDOFF.md#safe-pattern)');
  const file = content => ({content:Buffer.from(content),mode:0o644});
  const prefix = 'codex/plugins/ship-flow/';
  const files = new Map([[prefix+'skills/publisher/SKILL.md', file(moved)], [prefix+'skills/AUTHORIZATION.md',file('contract')], [prefix+'skills/ship-feature/PUBLISH-HANDOFF.md',file('handoff')]]);
  assert.equal(validateGeneratedDocRefs(files).references, 2);
  files.set(prefix+'skills/publisher/SKILL.md',file(input));
  assert.throws(() => validateGeneratedDocRefs(files), /dangling generated documentation reference/);
  files.set(prefix+'skills/publisher/SKILL.md',file(moved)); files.delete(prefix+'skills/AUTHORIZATION.md');
  assert.throws(() => validateGeneratedDocRefs(files), /AUTHORIZATION.md/);
  assert.deepEqual(localMarkdownLinks('`[example](missing.md)`\n```md\n[example](missing.md)\n```\n[web](https://example.invalid)\n[anchor](#example)'), []);
});

test('relocated native role templates embed required contracts and keep scratch access conditional', (t) => {
  const files = buildPackages(root), dir = temp(t), prefix = 'codex/plugins/ship-flow/';
  const contract = source('tools/ship-flow/skills/AUTHORIZATION.md').replaceAll('CLAUDE.md','AGENTS.md');
  const handoff = source('tools/ship-flow/skills/ship-feature/PUBLISH-HANDOFF.md').replaceAll('CLAUDE.md','AGENTS.md');
  for (const role of ['planner','code-reviewer','test-hunter','verifier-integrity-hunter','publisher']) {
    const toml = files.get(prefix+`agent-templates/${role}.toml`).content.toString();
    const relocated = join(dir, 'consumer/.codex/agents',role+'.toml'); write(relocated,toml);
    const instructions = JSON.parse(/^developer_instructions = (.*)$/m.exec(readFileSync(relocated,'utf8'))[1]);
    assert.match(instructions, new RegExp(`You are the ${role} role executor`));
    assert.doesNotMatch(instructions, /Run this role in a fresh subagent/);
    assert.match(instructions, /Do not delegate this same role again/);
    assert.ok(instructions.includes(`Required sandbox: ${role==='publisher'?'workspace-write':'read-only'}.`));
    assert.match(instructions, /If that evidence is missing or different, return BLOCK before role work/);
    assert.ok(instructions.includes(contract), role+' must carry full shared contract');
    if (role === 'publisher') assert.ok(instructions.includes(handoff));
    assert.deepEqual(localMarkdownLinks(instructions), [], role+' cannot require relative plugin resource files in a consumer');
    assert.match(instructions,/host-permitted temporary directory/); assert.match(instructions,/does not itself guarantee temporary-directory writes/);
    assert.match(instructions,/continue independent authorized checks/);
    assert.match(toml,role==='publisher'?/sandbox_mode = "workspace-write"/:/sandbox_mode = "read-only"/);
    const skill = files.get(prefix+`skills/${role}/SKILL.md`).content.toString();
    assert.match(skill, /Caller: launch a fresh subagent/);
    assert.match(skill, /verify its role identity and required tool\/sandbox restrictions/);
    assert.match(skill, /already the assigned executor/);
    assert.ok(skill.includes(`Required executor sandbox: ${role==='publisher'?'workspace-write':'read-only'}.`));
    assert.ok(localMarkdownLinks(skill).some(link=>link.target==='../AUTHORIZATION.md'));
  }
  // Embedded dependency closure is portable even when a required resource links to another one.
  const embedded=embedRoleResources('[auth](../skills/AUTH.md)','agents/reviewer.md',p=>({'skills/AUTH.md':'[detail](detail.md)','skills/detail.md':'keep the gate'})[p]);
  assert.deepEqual(localMarkdownLinks(embedded), []); assert.match(embedded,/keep the gate/);
  assert.throws(()=>embedRoleResources('[auth](../skills/missing.md)','agents/reviewer.md',()=>undefined),/resource missing/);
});

test('Codex harness audit retains its authorized direct-lane fallback without blanket task stopping', () => {
  const files=buildPackages(root), text=files.get('codex/plugins/ship-flow/skills/harness-maturity-audit/SKILL.md').content.toString();
  assert.match(text,/skill-documented direct-lane or equivalent fallback/);
  assert.match(text,/preserves required independence, gates and current authorization/);
  assert.match(text,/report that blocked step and continue independent authorized work/);
  assert.match(text,/perform the\s+same bounded lanes directly/);
  assert.match(text,/recording which checks could not be performed/);
  assert.doesNotMatch(text,/unsupported; stop and report the missing capability when a step requires Workflow/);
});

test('actual PreToolUse subprocess invalid stdout cannot be laundered into defer or approval', (t) => {
  const dir=temp(t); cpSync(join(root,'tools/loop-engine/runtime'),join(dir,'runtime'),{recursive:true});
  const invoke=output=>{
    write(join(dir,'hooks/output.mjs'),`process.stdout.write(${JSON.stringify(output)});`);
    return run(join(dir,'runtime/hook-adapter.mjs'),['hooks/output.mjs'],{cwd:dir,input:JSON.stringify({hook_event_name:'PreToolUse',cwd:dir})});
  };
  const specific = decision => JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:decision}});
  for (const output of ['not json','{}','null','[]','"allow"','{',specific('approved'),JSON.stringify({hookSpecificOutput:{hookEventName:'Stop',permissionDecision:'allow'}}),JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',permissionDecisionReason:{}}}),JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',updatedInput:[]}}),JSON.stringify({decision:'allow'}),specific('allow')+'\ntrailing',JSON.stringify({extra:true,hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow'}})]) {
    const result=invoke(output); assert.equal(result.status,0,result.stderr);
    const value=JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(value.permissionDecision,'deny'); assert.match(value.permissionDecisionReason,/Invalid PreToolUse hook output/);
  }
  for (const output of ['', ' \n']) {const result=invoke(output);assert.equal(result.status,0);assert.equal(result.stdout,'');}
  for (const decision of ['allow','deny']) assert.equal(JSON.parse(invoke(specific(decision)).stdout).hookSpecificOutput.permissionDecision,decision);
  const valid={hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',permissionDecisionReason:'fixture',updatedInput:{command:'echo ok'},additionalContext:'context'},suppressOutput:true};
  assert.deepEqual(JSON.parse(invoke(JSON.stringify(valid)).stdout),valid);
  for (let attempt=0;attempt<2;attempt++) {
    const value=JSON.parse(invoke(specific('ask')).stdout).hookSpecificOutput;
    assert.equal(value.permissionDecision,'deny');assert.match(value.permissionDecisionReason,/identical retry/);assert.match(value.permissionDecisionReason,/adapter records no approval/);
  }
  assert.equal(adaptOutput('SessionStart','plain context'),'plain context');
});
