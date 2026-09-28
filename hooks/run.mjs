#!/usr/bin/env node
// One installed plugin, unchanged module hooks. Memory is explicitly opt-in.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const codex = process.argv[2] === '--codex';
const [component, hook, ...args] = process.argv.slice(codex ? 3 : 2);
if (!['loop-engine', 'loop-memory'].includes(component) || !/^[a-z0-9-]+\.mjs$/.test(hook || '')) {
  console.error('[paul-loop] invalid hook target');
  process.exit(2);
}
const env = process.env;
const memory = (env.PAUL_LOOP_MEMORY ?? env.CLAUDE_PLUGIN_OPTION_MEMORY_ENABLED) === 'true'
  || env.PAUL_LOOP_MEMORY === '1';
if (!memory || env.LOOP_MEMORY_OFF === '1') {
  if (component === 'loop-memory') process.exit(0);
  env.LOOP_MEMORY_OFF = '1';
  env.LOOP_RECALL_OFF = '1';
}
if (codex) {
  // Gate memory before the adapter consumes stdin; the adapter still owns all host semantics.
  const adapter = join(root, 'runtime/hook-adapter.mjs');
  process.argv = [process.execPath, adapter, 'hooks/run.mjs', component, hook, ...args];
  await import(pathToFileURL(adapter).href);
} else {
  env.PAUL_LOOP_PATH = root;
  env.CLAUDE_PLUGIN_ROOT = join(root, 'tools', component);
  env.LOOP_ENGINE_PATH = join(root, 'tools/loop-engine');
  env.SHIP_FLOW_PATH = join(root, 'tools/ship-flow');
  env.LOOP_MEMORY_PATH = join(root, 'tools/loop-memory');
  const target = join(env.CLAUDE_PLUGIN_ROOT, 'hooks', hook);
  process.argv = [process.execPath, target, ...args];
  await import(pathToFileURL(target).href);
}
