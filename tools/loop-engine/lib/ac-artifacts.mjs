// AC artifact existence and content share one physical boundary: the invocation directory.
import { closeSync, constants, fstatSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const [directory, raw, expected] = process.argv.slice(2);
if (directory === undefined || raw === undefined || expected === undefined) {
  console.error('usage: ac-artifacts.mjs <invocation-directory> <comma-separated-paths> <expect-or-empty>');
  process.exit(2);
}
try {
  const root = resolve(directory), paths = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (realpathSync(root) !== root) throw new Error('artifact invocation directory was redirected');
  const errors = [], seen = new Set(), needle = Buffer.from(expected);
  let found = false;
  function inspect(path) {
    const physical = realpathSync(path), rel = relative(root, physical);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('artifact escapes invocation directory');
    if (seen.has(physical)) return;
    seen.add(physical);
    const fd = openSync(physical, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd);
      if (stat.isDirectory()) {
        if (expected) for (const name of readdirSync(physical)) inspect(join(physical, name));
      } else if (stat.isFile()) {
        // ponytail: buffer one artifact file; stream if large generated files cause memory pressure.
        if (expected && readFileSync(fd).includes(needle)) found = true;
      } else throw new Error('artifact must be a regular file or directory');
    } finally { closeSync(fd); }
  }
  if (!paths.length) errors.push('artifacts: requires at least one path');
  for (const path of paths) {
    if (isAbsolute(path) || path.split('/').includes('..')) {
      errors.push(`invalid artifact path: ${JSON.stringify(path)} (relative paths without .. required)`);
      continue;
    }
    try { inspect(resolve(root, path)); }
    catch (error) {
      errors.push(error.code === 'ENOENT' ? `missing artifact(s): ${path}` :
        `invalid artifact ${JSON.stringify(path)}: ${JSON.stringify(error.message)}`);
    }
  }
  if (expected && !found) errors.push(`expect substring not found: ${JSON.stringify(expected)}`);
  if (errors.length) { console.log(errors.join('; ')); process.exitCode = 1; }
} catch (error) { console.error(`artifacts: ${JSON.stringify(error.message)}`); process.exitCode = 2; }
