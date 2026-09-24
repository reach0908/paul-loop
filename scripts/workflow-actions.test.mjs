import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const directory = new URL('../.github/workflows/', import.meta.url);
const workflow = name => readFileSync(new URL(`${name}.yml`, directory), 'utf8');

test('workflow actions use full commit SHAs; local reusable workflows stay local', () => {
  const files = readdirSync(directory).filter(name => /\.ya?ml$/.test(name));
  assert.ok(files.length, 'no workflow files checked');
  for (const file of files) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    // ponytail: checks this repo's block-style uses entries; adopt a YAML parser if flow mappings are introduced.
    const entries = [...source.matchAll(/^[ \t]*(?:- +)?uses: +["']?([^\s"'#]+)["']?[ \t]*(?:#.*)?$/gm)];
    assert.ok(entries.length, `${file}: no uses entries checked`);
    for (const [, reference] of entries) {
      if (reference.startsWith('./')) continue;
      assert.match(reference, /^[^@]+@[0-9a-f]{40}$/, `${file}: mutable action ${reference}`);
    }
  }
});

test('main validates only through publication; PR supersession cannot cancel release validators', () => {
  const release = workflow('tag-on-publish');
  assert.match(release, /needs: \[engine, memory, runtime, secrets-scan\]/);
  assert.match(release, /cancel-in-progress: false/);
  const groups = new Set(['publish-main']);
  for (const name of ['loop-engine-test', 'loop-memory-test', 'runtime-packages', 'gitleaks']) {
    const source = workflow(name);
    assert.doesNotMatch(source, /^  push:/m, `${name}: duplicate main validation`);
    assert.match(source, /^  workflow_call:/m);
    assert.match(source, /^  pull_request:/m);
    assert.ok(release.includes(`uses: ./.github/workflows/${name}.yml`));
    const group = source.match(/^  group: ([a-z-]+)-\$\{\{ github.event_name == 'pull_request' && github.event.pull_request.number \|\| github.run_id \}\}$/m)?.[1];
    assert.ok(group, `${name}: PR number for supersession, run ID for isolated release calls`);
    assert.ok(!groups.has(group), `${name}: concurrency group collides with another validator`);
    groups.add(group);
    assert.match(source, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/);
  }
  // Retargeting must still trigger base-pinned review; a skipped edited run could mask a failure.
  assert.match(workflow('loop-engine-test'), /types: \[opened, synchronize, reopened, edited\]/);
  assert.match(workflow('loop-engine-test'), /BASE_SHA: \$\{\{ github.event.pull_request.base.sha \}\}/);
  assert.match(workflow('runtime-packages'), /os: \[ubuntu-latest, macos-latest\]/);
  assert.match(workflow('runtime-packages'), /node: \[22, 24\]/);
});

test('moving Claude compatibility is isolated from required validation and artifact publication', () => {
  const canary = workflow('claude-compatibility');
  assert.match(canary, /^  schedule:/m);
  assert.match(canary, /^  workflow_dispatch:/m);
  assert.match(canary, /@anthropic-ai\/claude-code@latest/);
  assert.match(canary, /persist-credentials: false/);
  assert.match(canary, /contents: read/);
  assert.doesNotMatch(canary, /^  (?:pull_request|push|workflow_call):|upload-artifact|contents: write|secrets\./m);
  assert.doesNotMatch(workflow('tag-on-publish'), /claude-compatibility/);
  for (const name of ['loop-engine-test', 'loop-memory-test', 'runtime-packages']) {
    const source = workflow(name);
    assert.doesNotMatch(source, /@latest|['"]latest['"]/);
    const install = source.indexOf('npm ci --prefix .github/claude-code --ignore-scripts');
    const verify = source.indexOf('npm audit signatures --prefix .github/claude-code');
    const execute = source.indexOf('node .github/claude-code/node_modules/@anthropic-ai/claude-code/install.cjs');
    assert.ok(install >= 0 && verify > install && execute > verify, `${name}: verify locked packages before running their installer`);
    assert.doesNotMatch(source, /continue-on-error: true|\|\| true/);
  }
});

test('required Claude and its native binaries have exact versions, registry origins and integrity', () => {
  const manifest = JSON.parse(readFileSync(new URL('../.github/claude-code/package.json', import.meta.url)));
  const lock = JSON.parse(readFileSync(new URL('../.github/claude-code/package-lock.json', import.meta.url)));
  const version = manifest.dependencies['@anthropic-ai/claude-code'];
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  assert.ok(workflow('runtime-packages').includes(`claude: ['${version}']`), 'preserve the pinned schema check identity');
  const wrapper = lock.packages['node_modules/@anthropic-ai/claude-code'];
  for (const [name, pinned] of Object.entries(wrapper.optionalDependencies)) {
    assert.equal(pinned, version);
    assert.ok(lock.packages[`node_modules/${name}`], `${name}: native binary missing from lock`);
  }
  for (const [name, pkg] of Object.entries(lock.packages)) {
    if (!name) continue;
    assert.equal(pkg.version, version, name);
    assert.match(pkg.resolved, /^https:\/\/registry\.npmjs\.org\/@anthropic-ai\/claude-code(?:-[a-z0-9-]+)?\/-\//);
    assert.match(pkg.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  }
});
