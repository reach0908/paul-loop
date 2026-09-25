// Shared credential loader and user-owned DB authorization for memory hooks/CLI and heartbeat.
// Credential precedence: explicit session value (including empty) > plugin option > dotenv.
// Missing worktree files may use the main checkout; unsafe existing paths never trigger fallback.
// Dotenv never enables/disables behavior. Its legacy DB field is parsed for compatibility only:
// actual DB consumers use trustedDatabaseConfig, which ignores all project/env DB settings.
// No same-user arbitrary-code-execution protection is claimed by these filesystem checks.
import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { userInfo } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

/** Repo-relative default. `.loop/` is loop-engine's own convention directory (it already holds
 * `.loop/lessons`) and is conventionally gitignored, so `.loop/.env` is the one path that is a
 * sensible guess for *any* consuming repo. Repos that keep the file elsewhere point the
 * `loop_dotenv_path` plugin option (env `LOOP_DOTENV_PATH`) at it. */
export const DEFAULT_DOTENV_PATH = '.loop/.env';

/** The only keys a dotenv file may set. See the threat model in this file's header for why this is an
 * allowlist. Adding to it means answering one question: *would I let an untrusted repository set this
 * for a process running on my machine?* Credentials and connection/tuning settings pass that; anything
 * that switches behaviour off does not. */
export const ALLOWED_KEYS = Object.freeze([
  // credentials — the reason this loader exists at all
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'LOOP_MEMORY_SIGNING_KEY',
  // Legacy parsing compatibility only: DB consumers must use trustedDatabaseConfig, never this value.
  'LOOP_DATABASE_URL',
  'LOOP_EMBED_PROVIDER',
  'LOOP_EMBED_MODEL',
  // recall tuning — numeric thresholds, no behaviour switch
  'LOOP_RECALL_MAX_DISTANCE',
  'LOOP_KNOWLEDGE_MAX_DISTANCE',
]);
const ALLOWED = new Set(ALLOWED_KEYS);

/** Resolve the main checkout only for a registered worktree containing cwd.
 * A repository-supplied .git file alone must not inherit another checkout's authority. */
function mainWorktreeRoot(cwd) {
  try {
    const options = {
      cwd,
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { PATH: process.env.PATH },
    };
    const [top, common] = execFileSync('git', ['rev-parse', '--show-toplevel', '--git-common-dir'], options).trim().split('\n');
    if (!top || !common) return null;
    const root = realpathSync(top);
    if (!contained(root, realpathSync(cwd))) return null;
    const registered = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], options).split('\0');
    if (!registered.some(field => {
      try { return field.startsWith('worktree ') && realpathSync(field.slice(9)) === root; } catch { return false; }
    })) return null;
    const commonDir = realpathSync(resolve(cwd, common));
    return basename(commonDir) === '.git' ? dirname(commonDir) : null;
  } catch {
    return null;
  }
}

/** Resolves the dotenv file to read, applying the worktree fallback (property 2 above).
 * Returns null when nothing readable exists. An absolute `configured` path is used as-is (a path
 * outside the project has no "main worktree" counterpart to fall back to). */
export function resolveDotenvPath(projectDir, configured) {
  const rel = configured || DEFAULT_DOTENV_PATH;
  if (isAbsolute(rel)) return lstatSync(rel, { throwIfNoEntry: false })?.isFile() ? rel : null;
  // Relative credential paths stay within their physical project root.
  const root = realpathSync(projectDir);
  const local = contained(root, rel);
  if (!local || !withoutSymlinks(root, local)) return null;
  const localStat = lstatSync(local, { throwIfNoEntry: false });
  if (localStat) return localStat.isFile() ? local : null;
  const mainRoot = mainWorktreeRoot(projectDir);
  if (!mainRoot) return null;
  const canonical = realpathSync(mainRoot);
  const fallback = contained(canonical, rel);
  return fallback && withoutSymlinks(canonical, fallback) && lstatSync(fallback, { throwIfNoEntry: false })?.isFile() ? fallback : null;
}

function withoutSymlinks(root, file) {
  let cursor = file;
  while (cursor !== root) {
    if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) return false;
    cursor = dirname(cursor);
  }
  return true;
}

/** `resolve(root, rel)` if the result is still under `root`, else null. Compares via `relative()`
 * rather than `startsWith` — `/repo-evil` must not count as inside `/repo`. */
function contained(root, rel) {
  const abs = resolve(root, rel);
  const r = relative(resolve(root), abs);
  return r === '' || (!r.startsWith('..') && !isAbsolute(r)) ? abs : null;
}

/** Fills `target` with the `KEY=VALUE` lines of the resolved dotenv file, skipping keys already set.
 * Returns the path actually read, or null if nothing was loaded (so callers can log which it was —
 * "silently loaded nothing" and "silently found nothing" must be distinguishable in the debug log). */
export function loadDotenv(projectDir, configured, target = process.env) {
  let fd;
  try {
    const file = resolveDotenvPath(projectDir, configured);
    if (!file) return null;
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) return null;
    for (const raw of readFileSync(fd, 'utf8').split('\n')) {
      const line = raw.trim(); // also drops CRLF's \r
      if (!line || line.startsWith('#')) continue; // blank / comment line
      const eq = line.indexOf('='); // split on the FIRST '=' only — values may contain '='
      if (eq < 1) continue;
      const key = line
        .slice(0, eq)
        .replace(/^export\s+/, '')
        .trim(); // tolerate `export KEY=...`
      // Shape check, then the allowlist (property 4 — see the header's threat model), then
      // precedence. An ignored key is not an error: a repo's `.env` legitimately holds its own
      // application config next to the one key this plugin wants, and refusing to start over that
      // would be worse than ignoring it.
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || !ALLOWED.has(key) || key in target) continue;
      let val = line.slice(eq + 1).trim();
      const q = val[0];
      if (q === '"' || q === "'") {
        const end = val.indexOf(q, 1); // value ends at the closing quote (trailing inline comment ignored)
        val = end === -1 ? val.slice(1) : val.slice(1, end);
      } else {
        const c = val.search(/\s#/); // unquoted `val # comment` — strip the comment
        if (c !== -1) val = val.slice(0, c).trim();
      }
      target[key] = val;
    }
    return file;
  } catch {
    return null; // best-effort: the caller's own key gate handles "still no key"
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Automatic DB access is authorized by an OS-user-owned file, never repository/session env.
 * Each canonical repository has its own entry. HOME/XDG/plugin options cannot redirect this file. */
export function trustedDatabaseConfig(projectDir) {
  let fd;
  try {
    const user = userInfo();
    const home = realpathSync(user.homedir);
    const homeStat = lstatSync(home);
    if (homeStat.uid !== user.uid || (homeStat.mode & 0o022)) throw Error('database_config_untrusted');
    const canonical = realpathSync(mainWorktreeRoot(projectDir) || projectDir);
    const file = resolve(home, '.config/paul-loop/memory-databases.json');
    if (contained(canonical, file)) throw Error('database_config_untrusted');
    let cursor = file;
    while (cursor !== home) {
      const st = lstatSync(cursor);
      if (st.isSymbolicLink() || st.uid !== user.uid || (st.mode & 0o022)) throw Error('database_config_untrusted');
      cursor = dirname(cursor);
    }
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = fstatSync(fd);
    if (!st.isFile() || st.uid !== user.uid || st.nlink !== 1 || (st.mode & 0o077)) throw Error('database_config_untrusted');
    const entry = JSON.parse(readFileSync(fd, 'utf8'))[canonical];
    if (!entry) throw Error('database_config_missing');
    if (typeof entry.url !== 'string' || /[\s\u0000-\u001f]/.test(entry.url)) throw Error('database_config_invalid');
    const url = new URL(entry.url);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash || !url.hostname || !url.username || url.pathname.length < 2) throw Error('database_config_invalid');
    for (const key of url.searchParams.keys()) {
      if (!['host', 'options', 'sslmode'].includes(key) || url.searchParams.getAll(key).length !== 1) throw Error('database_config_invalid');
    }
    // A host query is supported only for an explicitly selected Unix socket, never a TCP override.
    const socket = url.searchParams.get('host');
    if (socket !== null && !isAbsolute(socket)) throw Error('database_config_invalid');
    const host = socket || url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const local = socket || ['localhost', '127.0.0.1', '::1'].includes(host);
    const mode = url.searchParams.get('sslmode');
    if (mode !== null && !['disable', 'require', 'verify-full'].includes(mode)) throw Error('database_config_invalid');
    if (!local && (entry.allowRemote !== true || !['require', 'verify-full'].includes(mode))) throw Error('database_remote_not_approved');
    const port = Number(url.port || 5432);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('database_config_invalid');
    const userName = decodeURIComponent(url.username), password = decodeURIComponent(url.password), database = decodeURIComponent(url.pathname.slice(1));
    if ([host, userName, password, database].some(v => /[\u0000-\u001f]/.test(v))) throw Error('database_config_invalid');
    return { host: host === 'localhost' ? '127.0.0.1' : host, port, user: userName, password, database,
      ssl: mode === 'require' || mode === 'verify-full', options: url.searchParams.get('options') || ' ' };
  } catch (e) {
    const code = e?.code === 'ENOENT' ? 'database_config_missing' : e?.message;
    throw Error(['database_config_missing', 'database_config_untrusted', 'database_config_invalid', 'database_remote_not_approved'].includes(code) ? code : 'database_config_invalid');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
