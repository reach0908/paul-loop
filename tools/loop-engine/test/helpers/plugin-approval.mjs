import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repository = 'https://github.com/reach0908/paul-loop';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Test-author approval only. Never call this from a resolver or after an attack mutation.
export function approvePluginFixture(project, artifact, runtime = 'claude') {
  const { name, version } = JSON.parse(readFileSync(join(artifact, '.' + runtime + '-plugin/plugin.json')));
  const files = {};
  function visit(dir = '') {
    for (const entry of readdirSync(join(artifact, dir)).sort()) {
      const path = dir ? dir + '/' + entry : entry, absolute = join(artifact, path), stat = lstatSync(absolute);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files[path] = { sha256: sha256(readFileSync(absolute)), mode: stat.mode & 0o7777 };
      else throw new Error('fixture approval rejects symlinks/special files: ' + path);
    }
  }
  visit();
  // Synthetic provenance for authored fixtures; this is not an upstream Git attestation.
  const sourceCommit = '1'.repeat(40);
  const inventory = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const integrity = { repository, sourceCommit, sha256: sha256(JSON.stringify({ runtime, name, version, repository, sourceCommit, files: inventory })) };
  const path = join(project, '.' + runtime, 'paul-loop.lock.json');
  const lock = existsSync(path) ? JSON.parse(readFileSync(path)) : { schemaVersion: 1, runtime, plugins: {} };
  lock.plugins[name] = { id: name + '@' + (runtime === 'codex' ? 'paul-loop-codex' : 'paul-loop'), version, integrity };
  mkdirSync(join(project, '.' + runtime), { recursive: true });
  writeFileSync(path, JSON.stringify(lock, null, 2) + '\n');
  return integrity;
}
