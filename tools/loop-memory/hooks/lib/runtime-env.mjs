import { ALLOWED_KEYS, loadDotenv } from './load-dotenv.mjs';

const MEMORY_KEYS = ALLOWED_KEYS.filter(key => key !== 'LOOP_DATABASE_URL');
const CHILD_KEYS = new Set([...MEMORY_KEYS,
  'PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR', 'LANG', 'LC_ALL',
  'LOOP_DOTENV_PATH', 'LOOP_MEMORY_OFF', 'LOOP_LEARNING_OFF', 'LOOP_MEMORY_RECALL_ONLY',
  'LOOP_RECALL_OFF', 'LOOP_MEMORY_SOURCE', 'LESSONS_DIR',
  'LOOP_DIR', 'LOOP_RUN_ID', 'LOOP_LIVENESS_OFF', 'LOOP_LIVENESS_MAX_BYTES', 'CLAUDE_CODE_SESSION_ID',
]);

/** One precedence contract for CLI and hooks: shell (including explicit empty) > userConfig > file. */
export function runtimeEnv(root, input = process.env) {
  const env = Object.fromEntries(Object.entries(input).filter(([key]) => CHILD_KEYS.has(key)));
  for (const name of [...MEMORY_KEYS, 'LOOP_DOTENV_PATH']) {
    const option = `CLAUDE_PLUGIN_OPTION_${name}`;
    if (!(name in env) && option in input) env[name] = input[option];
  }
  const dotenv = loadDotenv(root, env.LOOP_DOTENV_PATH, env);
  // The shared generic loader retains legacy parsing; no DB consumer may use that value.
  delete env.LOOP_DATABASE_URL;
  return { env, dotenv };
}
