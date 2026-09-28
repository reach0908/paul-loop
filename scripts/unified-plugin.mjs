// Compose the existing modules into one installable plugin without copying source code.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const components = ['loop-engine', 'ship-flow', 'loop-memory'];
export function unifiedHooks(read, runtime) {
  const hooks = {};
  for (const component of ['loop-engine', 'loop-memory']) {
    const source = JSON.parse(read(`tools/${component}/hooks/hooks.json`)).hooks;
    for (const [event, groups] of Object.entries(source)) {
      if (runtime === 'codex' && ['PermissionDenied', 'InstructionsLoaded', 'PostToolUseFailure'].includes(event)) continue;
      (hooks[event] ||= []).push(...groups.map(group => ({ ...group, hooks: group.hooks.map(hook => {
        const match = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([a-z0-9-]+\.mjs)"(.*)$/.exec(hook.command);
        if (hook.type !== 'command' || !match) throw new Error(`unmapped unified hook: ${component}/${event}`);
        const prefix = runtime === 'codex' ? 'node "${PLUGIN_ROOT}/hooks/run.mjs" --codex'
          : 'node "${CLAUDE_PLUGIN_ROOT}/hooks/run.mjs"';
        return { ...hook, command: `${prefix} ${component} ${match[1]}${match[2]}` };
      }) })));
    }
  }
  return { hooks };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join(' ') !== '--write-hooks') throw new Error('Usage: unified-plugin.mjs --write-hooks');
  const root = fileURLToPath(new URL('../', import.meta.url));
  writeFileSync(join(root, 'hooks/hooks.json'), JSON.stringify(unifiedHooks(p => readFileSync(join(root, p), 'utf8'), 'claude'), null, 2) + '\n');
}
