#!/usr/bin/env node
// PreToolUse guardrail — detects a direct local merge/pull into a protected branch and redirects to
// the PR flow. This hook is not a boundary. It's best-effort, local, bypassable, fail-fast guidance
// (the filename "gate" is a historical artifact — not renamed). The real boundary is server-side
// branch protection. Finding a bypass for this hook isn't a bug (parser hardening is a won't-fix).
//
// Detects `git merge`/`git pull` targeting a protected branch (see loadProtectedBranches below —
// direction inference is cwd-based: effective branch is computed from the actual exec cwd, checkout
// targets are tracked, and chaining/subshells/redirection keep the same structural-trust gate) and
// denies direct landing, pointing at the PR flow. A narrow exception permits local ff-only sync
// from the fetched origin ref of the current branch; it grants no remote merge or publication authority.
//
// Command parsing is two layers: the shared tokenizer (command-tokenizer.mjs — segment splitting,
// heredoc stripping, env/word-prefix traversal) handles env prefixes (FOO=bar); this file's
// parseGit/checkoutTarget handles git global options (-C/-c/...) and checkout create/value flags ->
// together they resist `FOO=bar git merge` / `git -C . merge` / `git checkout -q/-B main`-style
// evasion or mis-parsing. `git pull` targeting a protected branch is blocked too. Shell quoting isn't
// fully parseable (coarse-net), so *detection* fails open (a non-merge command passes); once a merge
// is confirmed, this fails closed.
//
// Heredoc bodies (a commit message via `-F -`, a PR body via `$(cat <<'EOF' ... EOF)`) are stripped
// *before* segment splitting — otherwise splitting on newlines would misread a body's individual lines
// as commands. Example: a doc's example code block happens to token-match `git merge --ff-only <ref>`,
// and `<ref>` isn't a real rev -> the outer catch fails closed and denies an unrelated commit outright.
//
// Note: start-marker detection has no quote context — a match inside a quoted string, a grep pattern,
// or a here-string (`<<<word`) can false-positive as a heredoc start. Such false positives almost
// always fail to find a closing marker (because it isn't really a heredoc) -> in that case the
// original text is restored rather than dropped (command-tokenizer.mjs's stripHeredocs). Dropping it
// would also erase a *real* `git merge` line that follows, silently reopening detection (measured in
// review) — a much larger blast radius than the "when in doubt, pass" philosophy this coarse-net
// otherwise follows, so this specific case is guarded against.
//
// Scope: `git branch -f main` / `reset --hard` on a protected branch / `push (.|origin) HEAD:main` are
// not merges and are out of scope — a local hook can't cover directly moving a protected branch;
// server-side branch protection is the backstop there (this hook only watches merge/pull).
//
// Second job: the main checkout stays on its protected branch. A `git checkout|switch` that moves the
// project's main worktree (git-dir == git-common-dir; this repository or one nested under the project
// root) to another branch or commit, or a `gh pr checkout` there, leaves every later session starting
// from that branch, so it gets an "ask" pointing at a linked worktree. Returning home (HEAD, the
// current branch, a protected branch, origin/HEAD's branch), file restores, linked worktrees and
// repositories outside the project pass, and so does anything this coarse parse can't place
// (fail-open). The ask is judged before the merge path and only emitted from allow(), so a merge deny
// still wins. Known gaps: a target-less `--detach`, combined short flags (`-qb x`, `-bx`),
// `gh -R <repo> pr checkout`, eval/`bash -c`/aliases.
//
// Sync uses two separate calls: `git fetch origin`, then `git merge --ff-only origin/<branch>`.
// The exception checks the local remote-tracking ref, not live server state or PR approval. It is
// still a local guardrail: same-UID ref/config mutation and concurrent changes are not a trust boundary.

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
// The tokenizer is a shared lib (shared with gate-risky-commands.mjs — same implementation, one home).
import { gitSegmentDir, literal, splitSegments, stripHeredocs, stripPrefix, tokenize } from './command-tokenizer.mjs';
import { logRedEvent } from './red-events-log.mjs';

// biome-ignore lint/suspicious/noUndeclaredEnvVars: Claude Code injects this at hook runtime.
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// The protected branch set is repo-specific — read from the consuming repo's ship-flow.config.json
// (releaseBranch / integrationBranch) if present. Absent that config (or a repo not using ship-flow's
// setup skill), fall back to a conservative default that covers the two most common trunk names.
function loadProtectedBranches(projectRoot) {
  try {
    const cfg = JSON.parse(
      readFileSync(join(projectRoot, '.claude', 'ship-flow.config.json'), 'utf8'),
    );
    const branches = [cfg.releaseBranch, cfg.integrationBranch].filter(
      (b) => typeof b === 'string' && b,
    );
    if (branches.length) return new Set(branches);
  } catch {
    /* missing/unreadable config -> fall through to the default */
  }
  return new Set(['main', 'master']);
}
const PROTECTED_BRANCHES = loadProtectedBranches(root);

const EXEC = {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 16 * 1024 * 1024,
};

// Set before the merge path runs; allow() turns it into an ask, deny() never consults it.
let mainSwitch = null;
function allow() {
  if (mainSwitch) {
    decide(
      'ask',
      `This moves the main checkout (${mainSwitch.dir}) off its protected branch to ${mainSwitch.target}, ` +
        'and every later session starts from that checkout. Do new work in a linked worktree instead: ' +
        '`git fetch origin && git worktree add -b <branch> <sibling-path> origin/<base>`, then work there ' +
        '(Claude Code: EnterWorktree). Approve only if a human wants this checkout moved (e.g. for QA).',
      'switch',
      'main-checkout',
    );
  }
  process.exit(0);
}
function decide(decision, reason, code, kind = 'gate') {
  // Best-effort record (reason code included so a false positive, e.g. a direction mis-detection, can
  // later be filtered out when measuring a real deny rate). Keyed to root (the worktree this hook runs
  // in) — logRedEvent itself is fail-open, so a failure here never affects the verdict below. Merge
  // denies are kind 'gate'; main-checkout asks are their own kind so they don't inflate deny counts.
  logRedEvent(root, { kind, code });
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}
const deny = (reason, code) => decide('deny', reason, code);
function git(args, cwd = root) {
  return execFileSync('git', args, { ...EXEC, cwd }).trim();
}
// `git rev-parse <flag>` as a real path, or null (missing dir, not a repo). Normalized via realpath — a
// main vs. linked worktree can print these relative or absolute depending on git version/location, and
// on macOS /var is a symlink to /private/var, so the same path can appear in two forms (measured: a
// linked worktree case fell through to the fallback and broke a regression test).
function gitPath(dir, flag) {
  try {
    return realpathSync(resolve(dir, git(['rev-parse', flag], dir)));
  } catch {
    return null;
  }
}
const isMainWorktree = (dir) => {
  const own = gitPath(dir, '--git-dir');
  return own !== null && own === gitPath(dir, '--git-common-dir');
};

// Flags that take a following value token — skipped along with their value.
const VALUE_GLOBAL = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--super-prefix',
]);
// checkout/switch's branch-creating flags — the token right after is the *new branch name* (the
// checkout target). Must not be skipped as a value.
const CREATE_CHECKOUT = new Set(['-b', '-B', '-c', '-C', '--orphan']);
// checkout/switch value-taking flags — skipped along with their value when searching for the target.
const VALUE_CHECKOUT = new Set(['--conflict', '--pathspec-from-file', '--start-point']);

// Parses a git segment -> { sub, args }. After stripping prefixes, skips git global options (with
// their values) and returns the first non-flag token as the subcommand.
function parseGit(rawToks) {
  const toks = stripPrefix(rawToks);
  if (toks[0] !== 'git') return null;
  let i = 1;
  while (i < toks.length) {
    const t = toks[i];
    if (t.startsWith('-')) {
      i += VALUE_GLOBAL.has(t) && !t.includes('=') ? 2 : 1;
      continue;
    }
    return { sub: t, args: toks.slice(i + 1) };
  }
  return null;
}
// checkout/switch's target branch. A create flag (-b/-B/-c/-C/--orphan) means the token right after it
// is the target. A file-restore form is not a branch switch, so returns null (no switch -> effective
// branch stays as-is, the fail-closed direction):
//   - `checkout <tree> -- <paths>` / `checkout -- <paths>`: `--` always means a file restore.
//   - `checkout .` / `checkout *`: a pathspec, not a valid branch ref name (git refname rules).
function checkoutTarget(args) {
  if (args.includes('--')) return null;
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (CREATE_CHECKOUT.has(t)) return args[i + 1] ?? null;
    if (t.startsWith('-')) {
      if (VALUE_CHECKOUT.has(t) && !t.includes('=')) i += 1;
      continue;
    }
    return t === '.' || t === '*' ? null : t;
  }
  return null;
}
const tryGit = (args, dir) => {
  try {
    return git(args, dir);
  } catch {
    return null;
  }
};
// Where `git checkout|switch` moves HEAD in `dir`, or null when it restores files instead. A checkout
// moves only with a create flag or one positional that names a commit or an origin branch (DWIM);
// `--`, --ours/--theirs, -p/--patch, a pathspec file and tree-ish + pathspec are restores.
const RESTORE_CHECKOUT = new Set(['--', '--ours', '--theirs', '-p', '--patch']);
function branchMove(sub, args, dir) {
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (CREATE_CHECKOUT.has(t)) return args[i + 1] ?? null;
    if (sub === 'checkout' && RESTORE_CHECKOUT.has(t)) return null;
    if (t !== '-' && t.startsWith('-')) {
      if (VALUE_CHECKOUT.has(t) && !t.includes('=')) i += 1;
      continue;
    }
    positional.push(t);
  }
  const [target] = positional;
  if (!target || (sub === 'checkout' && positional.length !== 1)) return null;
  if (target === '-') return tryGit(['rev-parse', '--abbrev-ref', '@{-1}'], dir);
  if (sub === 'switch') return target;
  return [`${target}^{commit}`, `refs/remotes/origin/${target}`]
    .some((ref) => tryGit(['rev-parse', '--verify', '-q', ref], dir) !== null) ? target : null;
}
// A move that keeps the checkout home: HEAD, the current branch, a protected branch or origin/HEAD's.
function staysHome(target, dir) {
  if (target === 'HEAD' || PROTECTED_BRANCHES.has(target)) return true;
  return target === tryGit(['branch', '--show-current'], dir) ||
    `origin/${target}` === tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], dir);
}
// The main worktree of this project's repository, or of a repository nested under the project root.
// Scratch and fixture repositories elsewhere (tmp) are not the checkout later sessions start from.
function isProjectMainCheckout(dir) {
  if (!isMainWorktree(dir)) return false;
  const common = gitPath(dir, '--git-common-dir');
  if (common === gitPath(root, '--git-common-dir')) return true;
  const top = realpathSync(root);
  return realpathSync(dir).startsWith(`${top}/`);
}
// -- Merge detection (fails open up to here: an uncertain parse or a non-merge command passes) -------
let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  allow();
}
if (payload?.tool_name !== 'Bash') allow();
const cmd = payload?.tool_input?.command;
if (typeof cmd !== 'string' || !cmd) allow();

const strippedCmd = stripHeredocs(cmd);
let gitSegs;
try {
  gitSegs = splitSegments(strippedCmd).map(tokenize).map(parseGit).filter(Boolean);
} catch {
  allow(); // a detection-stage error -> pass (a bug in this hook must not block arbitrary Bash)
}

// The session's Bash cwd right before the command runs (see the trust-boundary note further down).
const execCwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : root;

// -- Main checkout stays on its protected branch (ask; any doubt passes) ----------------------------
// Judged per segment against the directory it runs in: payload.cwd, then `cd <dir>` and `git -C`.
mainSwitch = (() => {
  try {
    let cwd = execCwd;
    for (const seg of splitSegments(strippedCmd)) {
      const raw = tokenize(seg).map(literal), toks = stripPrefix(raw);
      if (toks[0] === 'cd' && toks.length === 2) {
        cwd = resolve(cwd, toks[1]);
        continue;
      }
      if (toks[0] === 'gh' && toks[1] === 'pr' && toks[2] === 'checkout' && isProjectMainCheckout(cwd)) {
        return { target: `PR ${toks[3] ?? ''}`.trim(), dir: cwd };
      }
      const g = parseGit(raw);
      if (!g || (g.sub !== 'checkout' && g.sub !== 'switch')) continue;
      if (raw.some((t) => /^(GIT_DIR|GIT_WORK_TREE)=/.test(t))) continue; // not modelled
      const dir = gitSegmentDir(raw, cwd);
      if (!dir || !isProjectMainCheckout(dir)) continue;
      const target = branchMove(g.sub, g.args, dir);
      if (target && !staysHome(target, dir)) return { target, dir };
    }
  } catch {
    // Detection fails open (no ask), but leaves a trace so a broken guard is visible.
    logRedEvent(root, { kind: 'main-checkout', code: 'detect-error' });
  }
  return null;
})();

// Trusting payload.cwd for direction inference kept producing new evasions across review rounds — -C /
// cd / GIT_DIR= first, then a subshell `(cd ... && merge)`, brace groups, and backslash escapes next
// (all reproduced). Blacklisting tokens one at a time keeps breaking the moment a structural character
// glues itself onto `cd`/`git`/`-C` in a way the whitespace-only tokenizer can't see (`(git`, `\git`
// aren't recognized as `git`). Flip it to a whitelist instead: cwd-based direction inference is only
// trusted when the command is "structurally a single simple git merge/pull" — (1) exactly one segment
// (no &&/;/|/newline/bare &) (2) no structural characters `(){}\\` at all (3) no -C/--git-dir/
// --work-tree/GIT_DIR=/GIT_WORK_TREE= redirection signal. If any of the three trips,
// direction-untrusted -> if merge/pull appears anywhere in the command (a loose scan too, spreading
// structural characters into spaces so it also catches what the strict parser misses, like `(git` /
// `\git`), deny regardless of reason. This is effectively reverting to the original default (treat
// direction as always-protected-branch) — the only thing newly allowed is "a simple single command"
// (exactly the scenario this cwd-based trust was meant to fix), so there's no new attack surface. The
// strict tokenize/parseGit path itself is untouched — this check sits as a separate safety net on top
// of it.
const hasStructuralChars = (s) => /[(){}\\]/.test(s);
const stripStructuralChars = (s) => s.replace(/[(){}\\]/g, ' ');
const rawSegs = splitSegments(strippedCmd);
const DIR_REDIRECT_GLOBAL = new Set(['-C', '--git-dir', '--work-tree']);
const hasDirRedirectSignal = (rawToks) => {
  // A GIT_DIR=/GIT_WORK_TREE= env prefix has the same redirection effect as -C/--git-dir — checked on
  // the *raw* tokens before stripPrefix removes that evidence.
  if (rawToks.some((t) => /^(GIT_DIR|GIT_WORK_TREE)=/.test(t))) return true;
  const toks = stripPrefix(rawToks);
  if (['cd', 'pushd', 'popd'].includes(toks[0])) return true;
  return (
    toks[0] === 'git' &&
    toks.some(
      (t) =>
        DIR_REDIRECT_GLOBAL.has(t) || t.startsWith('--git-dir=') || t.startsWith('--work-tree='),
    )
  );
};
const isSimpleSingleGitCmd =
  rawSegs.length === 1 &&
  gitSegs.length === 1 &&
  !hasStructuralChars(rawSegs[0]) &&
  (gitSegs[0].sub === 'merge' || gitSegs[0].sub === 'pull') &&
  !hasDirRedirectSignal(tokenize(rawSegs[0]));
let looseHasMergeOrPull = false;
try {
  looseHasMergeOrPull = splitSegments(stripStructuralChars(strippedCmd))
    .map(tokenize)
    .map(parseGit)
    .filter(Boolean)
    .some((g) => g.sub === 'merge' || g.sub === 'pull');
} catch {
  looseHasMergeOrPull = false; // a scan failure is itself detection-stage -> fail-open (same philosophy)
}
// A non-merge/pull command (neither the strict nor the loose check found one) passes quickly.
if (!gitSegs.some((g) => g.sub === 'merge' || g.sub === 'pull') && !looseHasMergeOrPull) allow();

// Direct landing on a protected branch is denied; only the exact confirmed local sync form may pass.
// An unexpected error in direction inference itself fails closed (deny in the catch below).
try {
  if (!isSimpleSingleGitCmd) {
    deny(
      'This command is not a simple single `git merge`/`git pull` call (chaining, a subshell, braces, ' +
        'backslashes, -C/cd/GIT_DIR=, etc.), so merge direction cannot be trusted. Run a single ' +
        '`git merge`/`git pull` line directly in the target directory instead of changing directory.',
      'not-simple-command',
    );
  }
  // From here on isSimpleSingleGitCmd holds — gitSegs contains exactly that one merge/pull, so the
  // loop below evaluates only that single op. Direction inference is based on the *actual Bash exec
  // cwd* (payload.cwd — a field the hook receives on every call, the session cwd right before the
  // command runs). `root` (CLAUDE_PROJECT_DIR) stays fixed at the main worktree's path, and its HEAD is
  // typically pinned to a specific branch by convention — so measuring HEAD via `root` alone would
  // misjudge a perfectly normal sync command run from a different worktree as targeting the protected
  // branch.
  //
  // Trust boundary: payload.cwd is external input and fails far more often than root does — (a) an
  // already-removed/nonexistent worktree (this genuinely happens when cleanup overlaps a merge), (b) a
  // different repo than root (the session cd'd outside the repo). This hook's philosophy is
  // "unconfirmed -> fail closed", but an early implementation let both of these cases fall through to
  // effective=null and skip the gate for that op entirely — a real protected-branch-targeting merge
  // could silently (with no log) pass. Falling back to `root` in both cases below restores the
  // originally-intended safe default.
  const gitCommonDir = (dir) => gitPath(dir, '--git-common-dir');
  const sameRepo =
    execCwd === root ||
    (() => {
      const a = gitCommonDir(execCwd);
      return a !== null && a === gitCommonDir(root);
    })();
  const headAt = (dir) => {
    try {
      return git(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
    } catch {
      return null;
    }
  };
  const execBranch = sameRepo ? headAt(execCwd) : null;
  let effective = execBranch;
  if (effective === null) effective = headAt(root); // execCwd undecidable / a different repo -> fall back to root (the fail-closed default)

  for (const seg of gitSegs) {
    if (seg.sub === 'checkout' || seg.sub === 'switch') {
      const t = checkoutTarget(seg.args);
      if (t) effective = t;
      continue;
    }
    if (seg.sub !== 'merge' && seg.sub !== 'pull') continue;
    if (!PROTECTED_BRANCHES.has(effective)) continue; // this op doesn't target a protected branch -> pass

    // A merge-state subcommand (--abort/--continue/--quit) isn't a landing attempt -> skip this op
    // (subsequent ops keep being evaluated).
    if (
      seg.sub === 'merge' &&
      seg.args.some((a) => ['--abort', '--continue', '--quit'].includes(a))
    )
      continue;

    const source = `origin/${effective}`, remoteRef = `refs/remotes/${source}`;
    if (typeof payload.cwd === 'string' && payload.cwd && execBranch === effective &&
        !/[`$"'<>|;&(){}\\\r\n]/.test(cmd) &&
        tokenize(cmd).join(' ') === `git merge --ff-only ${source}`) {
      try {
        // Reject missing refs and local branches/tags shadowing origin/<branch>. No local-only
        // commits may be carried along: HEAD must be an ancestor of the fetched remote-tracking ref.
        if (git(['rev-parse', '--symbolic-full-name', source], execCwd) === remoteRef) {
          git(['merge-base', '--is-ancestor', 'HEAD', remoteRef], execCwd);
          allow();
        }
      } catch { /* an unconfirmed fast-forward remains a denied landing */ }
    }

    // Remote merge approval and server-side protections remain separate from this local sync.
    deny(
      `Can't land directly on ${effective} via local git ${seg.sub} — use the PR flow: push the branch ` +
        `and merge with \`gh pr merge\` (or the GitHub UI). If you only want your local ${effective} to ` +
        `match origin/${effective}, run \`git fetch origin\` and then \`git merge --ff-only origin/${effective}\` ` +
        `as separate tool calls in this directory. This requires an unambiguous origin ref and no local-only commits.`,
      `${effective}-direct-landing`,
    );
  }

  allow(); // no merge/pull targeted a protected branch, or every op passed the check above -> allow
} catch (e) {
  // An unexpected error after a protected-branch merge is confirmed fails closed.
  deny(
    `merge gate internal error (fail-closed): ${String(e?.message ?? e).split('\n')[0]}`,
    'internal-error',
  );
}
