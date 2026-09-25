#!/usr/bin/env node
// Runtime-neutral path contract. A resolvable artifact is NOT proof of activation or hook trust.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// BEGIN PLUGIN INTEGRITY — identical in both standalone entrypoints; tested for drift.
function pluginInventory(root, gitObjects = false) {
  const files = Object.create(null);
  function visit(dir = '') {
    for (const entry of readdirSync(join(root, dir))) {
      const path = dir ? dir + '/' + entry : entry, absolute = join(root, path), info = lstatSync(absolute);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()) || (info.mode & 0o7000)) throw new Error('plugin integrity: unsafe file type/mode: ' + path);
      if (info.isDirectory()) visit(path);
      else {
        const bytes = readFileSync(absolute);
        files[path] = gitObjects
          ? { oid: createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), mode: info.mode & 0o111 ? 0o755 : 0o644 }
          : { sha256: createHash('sha256').update(bytes).digest('hex'), mode: info.mode & 0o7777 };
      }
    }
  }
  visit();
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

function pluginManifest(artifact, runtime) {
  const dir = join(artifact, '.' + runtime + '-plugin'), file = join(dir, 'plugin.json');
  if (!lstatSync(dir).isDirectory() || !lstatSync(file).isFile()) throw new Error('plugin manifest must be a regular file in a real directory');
  try {
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error();
    return manifest;
  } catch { throw new Error('invalid plugin manifest JSON'); }
}

function approvalDescriptor(approval, name) {
  if (!approval || typeof approval !== 'object' || Array.isArray(approval)
      || Object.keys(approval).sort().join(',') !== 'repository,sha256,sourceCommit'
      || typeof approval.repository !== 'string' || !approval.repository.startsWith('https://')
      || typeof approval.sourceCommit !== 'string' || ![40, 64].includes(approval.sourceCommit.length) || !/^[a-f0-9]+$/.test(approval.sourceCommit)
      || typeof approval.sha256 !== 'string' || approval.sha256.length !== 64 || !/^[a-f0-9]+$/.test(approval.sha256)) throw new Error(name + ': independent integrity approval missing or invalid; review provider pins');
  const repository = new URL(approval.repository);
  if (repository.href !== approval.repository || repository.username || repository.password || repository.search || repository.hash || repository.pathname === '/') throw new Error(name + ': invalid approved repository identity');
  return approval;
}

export function verifyPluginIntegrity(artifact, runtime, name, version, approval) {
  const { repository, sourceCommit } = approvalDescriptor(approval, name);
  const manifest = pluginManifest(artifact, runtime);
  if (manifest.name !== name || manifest.version !== version || manifest.repository !== repository) throw new Error(name + ': approved repository/manifest identity drift');
  const files = pluginInventory(artifact);
  const digest = createHash('sha256').update(JSON.stringify({ runtime, name, version, repository, sourceCommit, files })).digest('hex');
  if (digest !== approval.sha256) throw new Error(name + ': plugin integrity mismatch; preserve reviewed pins and inspect the changed artifact');
  return { repository, sourceCommit, sha256: digest };
}
// END PLUGIN INTEGRITY

const PLUGINS = {
  'loop-engine': { env: 'LOOP_ENGINE_PATH', minimum: '0.15.0' },
  'ship-flow': { env: 'SHIP_FLOW_PATH', minimum: '0.11.0' },
  'loop-memory': { env: 'LOOP_MEMORY_PATH', minimum: '0.7.0' },
};
const canonical = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
}).trim();
const versionParts = (v) => {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(v ?? '');
  if (!m) throw new Error('expected a stable semantic version');
  return m.slice(1, 4).map(Number);
};
const older = (a, b) => { const x = versionParts(a), y = versionParts(b); return x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2]))); };

export function projectRoots(cwd) {
  let top = canonical(cwd);
  try { top = canonical(git(cwd, ['rev-parse', '--show-toplevel'])); } catch {}
  const roots = [top];
  try {
    const common = canonical(resolve(top, git(top, ['rev-parse', '--git-common-dir'])));
    // Only a main working tree with the same common git directory is eligible.
    const main = dirname(common);
    if (canonical(resolve(main, git(main, ['rev-parse', '--git-common-dir']))) === common &&
        canonical(git(main, ['rev-parse', '--show-toplevel'])) === main && !roots.includes(main)) roots.push(main);
  } catch {}
  return roots;
}

function projectApproval(roots, artifact, runtime, plugin, version) {
  for (const project of roots) {
    const dir = join(project, '.' + runtime), file = join(dir, 'paul-loop.lock.json');
    let info;
    try { info = lstatSync(dir); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe integrity approval directory');
    try { info = lstatSync(file); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('unsafe integrity approval file');
    const rel = relative(artifact, realpathSync(file));
    if (rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel)) throw new Error('integrity approval must be outside the plugin artifact');
    const lock = JSON.parse(readFileSync(file, 'utf8')), entry = lock.plugins?.[plugin];
    if (lock.schemaVersion !== 1 || lock.runtime !== runtime || !entry || entry.version !== version) throw new Error(plugin + ': integrity approval schema/runtime/version drift');
    return verifyPluginIntegrity(artifact, runtime, plugin, version, entry.integrity);
  }
  throw new Error(plugin + ': independent integrity approval missing; review provider pins in the project lock');
}

// The copied CI action supplies these pins independently before any downloaded code runs.
// Compare real bytes to Git objects too: HEAD/status alone cannot attest a mutable checkout.
function verifiedSource(artifact, plugin, commit) {
  if (typeof commit !== 'string' || commit.length !== 40 || !/^[a-f0-9]+$/.test(commit)) throw new Error('expected an independently reviewed full source commit');
  const repo = realpathSync(resolve(artifact, '../..')), prefix = 'tools/' + plugin + '/';
  if (artifact !== join(repo, 'tools', plugin)) throw new Error('pinned source must use the provider plugin subtree');
  const run = args => execFileSync('git', ['--no-replace-objects', '-C', repo, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, maxBuffer: 8 * 1024 * 1024,
    env: { PATH: process.env.PATH, HOME: repo, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' },
  }).trimEnd();
  if (run(['rev-parse', '--verify', 'HEAD^{commit}']) !== commit) throw new Error('approved source commit drift');
  if (run(['config', '--get', 'remote.origin.url']) !== 'https://github.com/reach0908/paul-loop.git') throw new Error('approved source repository drift');
  const files = Object.create(null);
  for (const record of run(['ls-tree', '-rz', '--full-tree', commit, '--', 'tools/' + plugin]).split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]+)$/.exec(record);
    if (!match || !match[3].startsWith(prefix)) throw new Error('unsafe entry in approved source tree');
    files[match[3].slice(prefix.length)] = { oid: match[2], mode: match[1] === '100755' ? 0o755 : 0o644 };
  }
  const expected = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  if (!Object.keys(expected).length || JSON.stringify(pluginInventory(artifact, true)) !== JSON.stringify(expected)) throw new Error(plugin + ': source integrity mismatch');
  return { repository: 'https://github.com/reach0908/paul-loop', sourceCommit: commit, content: 'verified-git-tree' };
}

export function validatePluginPath(path, { plugin = 'loop-engine', runtime = 'claude', version, minimum = PLUGINS[plugin]?.minimum, roots = projectRoots(process.cwd()), sourceCommit } = {}) {
  if (!Object.hasOwn(PLUGINS, plugin)) throw new Error(`unknown plugin: ${plugin}`);
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(`${plugin}: plugin path must be absolute`);
  const root = realpathSync(path);
  if (!statSync(root).isDirectory()) throw new Error(`${plugin}: plugin path is not a directory`);
  const kinds = runtime === 'shell' ? ['claude', 'codex'] : [runtime];
  const file = kinds.map((k) => join(root, `.${k}-plugin`, 'plugin.json')).find(existsSync);
  if (!file) throw new Error(`${plugin}: ${runtime} manifest missing`);
  const kind = kinds.find(k => file === join(root, '.' + k + '-plugin', 'plugin.json'));
  const manifest = pluginManifest(root, kind);
  if (manifest.name !== plugin) throw new Error(`${plugin}: manifest name mismatch`);
  versionParts(manifest.version);
  if (version && version !== manifest.version) throw new Error(`${plugin}: registry/manifest version drift`);
  if (minimum && older(manifest.version, minimum)) throw new Error(`${plugin}: requires >=${minimum}; found ${manifest.version}`);
  const integrity = runtime === 'shell' && sourceCommit !== undefined
    ? verifiedSource(root, plugin, sourceCommit)
    : projectApproval(roots, root, kind, plugin, manifest.version);
  return { path: root, version: manifest.version, runtime, integrity, activation: 'unknown', hookTrust: 'unknown' };
}

export function resolvePluginInstallation({ pluginsFile, root = process.cwd(), plugin = 'loop-engine', env = process.env, runtime = env.LOOP_RUNTIME || 'claude' } = {}) {
  const cfg = PLUGINS[plugin];
  if (!Object.hasOwn(PLUGINS, plugin)) throw new Error(`unknown plugin: ${plugin}`);
  if (!['claude', 'codex', 'shell'].includes(runtime)) throw new Error(`unsupported runtime: ${runtime}`);
  const roots = projectRoots(root);
  const checked = (p, source, version) => ({ ...validatePluginPath(p, { plugin, runtime, version, roots, sourceCommit: env[cfg.env.replace('_PATH', '_COMMIT')] }), source });
  if (env[cfg.env]) return checked(env[cfg.env], 'explicit-environment');
  // This is our documented, explicit artifact registry, not a guessed Codex cache layout.
  // Never scan global Codex settings, credentials, or another marketplace's derivatives.
  const registry = env.PAUL_LOOP_INSTALLATIONS || roots.map((r) => join(r, '.loop', 'plugins.json')).find(existsSync);
  if (registry) {
    const record = JSON.parse(readFileSync(registry, 'utf8'));
    if (record.schemaVersion !== 1 || record.runtime !== runtime) throw new Error('runtime registry schema/runtime mismatch');
    const entry = record.plugins?.[plugin];
    if (entry) return checked(resolve(dirname(registry), entry.path), 'explicit-registry', entry.version);
  }
  if (runtime !== 'claude') return null;
  const file = pluginsFile || join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'plugins', 'installed_plugins.json');
  if (!existsSync(file)) return null;
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  const entries = parsed?.plugins?.[`${plugin}@paul-loop`];
  if (!Array.isArray(entries)) return null;
  let match;
  for (const r of roots) {
    // Local wins over project at the same root. Main-root fallback never selects another project.
    match = entries.find((e) => e.scope === 'local' && e.projectPath && canonical(e.projectPath) === r) ||
      entries.find((e) => e.scope === 'project' && e.projectPath && canonical(e.projectPath) === r);
    if (match) break;
  }
  match ||= entries.find((e) => e.scope === 'user');
  return match ? checked(match.installPath, 'claude-registry', match.version) : null;
}

export function resolvePluginPath(options = {}) { return resolvePluginInstallation(options)?.path ?? null; }

// Node normally resolves the entrypoint symlink, but --preserve-symlinks-main keeps its URL.
// Accept either identity without changing argv or running the CLI during a plain import.
if (process.argv[1] && (import.meta.url === pathToFileURL(process.argv[1]).href || import.meta.url === pathToFileURL(canonical(process.argv[1])).href)) {
  const [command, ...args] = process.argv.slice(2);
  const usage = () => { console.error('Usage: plugin-path.mjs resolve [plugin] | inspect [plugin] | exec bin/<file> [args...]'); process.exit(2); };
  if (!['resolve', 'inspect', 'exec'].includes(command) || (command === 'exec' && !args[0])) usage();
  const plugin = command === 'exec' ? 'loop-engine' : (args[0] || 'loop-engine');
  if (!Object.hasOwn(PLUGINS, plugin)) usage();
  try {
    const found = resolvePluginInstallation({ plugin });
    if (!found) throw new Error(`${plugin}@paul-loop not resolved; configure ${PLUGINS[plugin].env} or PAUL_LOOP_INSTALLATIONS. Installation, activation and hook trust require separate review.`);
    if (command === 'inspect') console.log(JSON.stringify(found));
    else if (command === 'resolve') console.log(found.path);
    else {
      if (!args[0].startsWith('bin/') || args[0].split(/[\\/]/).includes('..')) throw new Error('exec target must remain inside plugin bin/');
      const target = realpathSync(join(found.path, args[0]));
      const rel = relative(join(found.path, 'bin'), target);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('exec target escapes plugin bin/');
      const interpreter = target.endsWith('.mjs') ? process.execPath : target.endsWith('.sh') ? 'bash' : null;
      const result = interpreter ? spawnSync(interpreter, [target, ...args.slice(1)], { stdio: 'inherit' }) : spawnSync(target, args.slice(1), { stdio: 'inherit' });
      if (result.error) console.error(`[plugin-path] ${result.error.code || 'spawn failed'}`);
      process.exit(result.status ?? 1);
    }
  } catch (error) { console.error(`[plugin-path] ${error.message}`); process.exit(1); }
}
