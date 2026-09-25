import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Test-only OS identity injection. Production has no env/path override for DB authorization.
export function userDatabaseProfile(home: string, entries: Record<string, unknown>) {
  mkdirSync(join(home, '.config/paul-loop'), { recursive: true, mode: 0o700 });
  writeFileSync(join(home, '.config/paul-loop/memory-databases.json'), JSON.stringify(entries), { mode: 0o600 });
  const preload = join(home, 'user-home.mjs');
  writeFileSync(preload, `import os from 'node:os'; import { syncBuiltinESMExports } from 'node:module';
const original = os.userInfo; os.userInfo = () => ({ ...original(), homedir: ${JSON.stringify(home)} });
syncBuiltinESMExports();\n`);
  return preload;
}
