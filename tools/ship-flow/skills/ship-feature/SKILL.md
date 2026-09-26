---
name: ship-feature
description: End-to-end feature delivery when the user asks to take a feature, bug or tracked issue from plan to an open PR, or to ship/deliver/land a feature. Isolate, plan, build, verify, review and open the PR; stop for human merge. Research, local edits and routine Git synchronization use their own bounded procedure. Post-merge improvements require authorized scope.
---

Follow the [shared authorization and completion contract](../AUTHORIZATION.md) before this procedure.

# ship-feature — delivery from plan to PR

> **Output language.** Read `outputLanguage` (a BCP-47 tag, e.g. `ko`) from
> `.claude/ship-flow.config.json` and write **every human-facing prose artifact** — reports, summaries,
> questions, PR and tracked-issue bodies, your final message — in that language. **Code, commands, flags,
> identifiers, file paths, branch names, and quoted tool output stay verbatim; never translate them.** Key
> absent or unreadable → fall back to the language the user is writing in; never error on this.

Takes one unit of work (a feature, a bug, a tracked issue) from **plan to an open PR, and from a
merged PR to a harness-improvement PR** only within the caller's requested scope, running autonomously
between genuine approval boundaries. Each
step's *content* belongs to the skill/agent it delegates to — this skill fixes only the **order, the
gates, and where a human steps in**.

Use this sequence for delegated delivery through PR creation. Questions, research, a bounded local
fix, or routine commit/push/main synchronization do not need this sequence or its publisher. Use the
host's repository procedure and the checks required by that change. Explicit invocation still ends
at the user's requested artifact or verified local patch when that is the authorized endpoint.

Bundled references (read at the point each is needed): [RISK-GATE.md](RISK-GATE.md) ·
[AC-CONTRACTS.md](AC-CONTRACTS.md) · [PUBLISH-HANDOFF.md](PUBLISH-HANDOFF.md).

> **Git procedure (branch model, worktrees, merge, rebase) lives in this repo's own CLAUDE.md (or
> equivalent constitution doc), not here.** If this repo was set up via this plugin's `setup` skill,
> that doc came from `templates/CLAUDE.md.template` and already covers it. Duplicating it here would
> drift the moment the branch model changes.

## Config

Reads `.claude/ship-flow.config.json` at the consuming repo's root (`hotfix` has the field list).
If missing or incomplete, resolve branch names/model and `verifyCommand` from the request and repo
evidence first. Ask only for a value that blocks the next action; do not bootstrap unrelated config.
`trackerName` names this repo's issue tracker; Linear is the worked example below, so substitute this
repo's actual tracker and its equivalents (create/update issue, assignee, blocking links, status).

### `pluginBinPrefix` — how the commands below become runnable

Every loop-engine bin command below is **one substitutable literal** starting with
`{{pluginBinPrefix}}`. Before running one, read `pluginBinPrefix` from the config and **replace the
token with its value, concatenated onto the script name with no separator** (a value needing a trailing
space or slash carries its own), then run the result verbatim. Never type a `{{…}}` token into a shell,
and never substitute a description of a command for the command.

| `pluginBinPrefix` | Resulting command | When |
|---|---|---|
| `""` (absent → default) | `classify-risk.sh --from-git …` | Only after required commands are verified on this runtime's PATH |
| `node tools/plugin-path.mjs exec bin/` | …prefixed with that, same flags | If this repo ships its own resolver wrapper |
| `node "$LOOP_ENGINE_PATH/bin/plugin-path.mjs" exec bin/` | …same shape, loop-engine's bundled resolver | CI / headless, nothing on PATH (BAC-753) |

**Argument form is not re-derivable — use exactly what's written.** Only `verdict-run.sh` takes a `--`
separator (it needs one, to fence off the command it wraps). `classify-risk.sh`, `ac-verify.sh`, and
`lessons.sh` take **no `--`**; passing one is an unknown-arg usage error, not a harmless no-op.
`classify-risk.sh --path` is repeated once per path, not given a space-separated list.

If a substituted command fails to resolve, stop the dependent step and diagnose the invocation
within scope. Report any remaining blocker. Never substitute raw verification: a resolution/usage
error is not a code failure or a valid gate verdict.

## Execution mode — autonomous by default

Record the requested endpoint and allowed actions using [AUTHORIZATION.md](../AUTHORIZATION.md).
For delivery through PR creation, continue through steps 0–5. Read/draft requests end at their
artifact; local implementation requests end at the verified patch. Stop for the human merge
decision, a REQUIRE action lacking matching approval, or a blocking decision/environment problem
that cannot be resolved within scope. Release/deploy is a separate request.

Reuse implementation approval across source, plan and test edits. Refresh affected evidence;
artifact binding applies to reviewed merge/publish/deploy/send actions, not every reversible edit.
For an authorized reversible choice with a defensible recommendation, decide and record one line
(choice, alternative, reason) under `Decisions taken` in the PR body. Ask only for missing information
or authority that changes the next action. Check failures loop back; missing or contradictory evidence
is never PASS.

## Invariants (skipping these breaks the contract — non-negotiable)

- **Worktree isolation first:** use step 0; never change the main checkout's HEAD.
- **Reward-hack guard:** keep branch-armed protection. For a legitimate protected-file edit, open
  a reasoned window by the guard's convention, close it afterward, and record why. Never own its sentinel.
- **Required gates:** run the repo's verify command and affected deep/harness-consumer gates even
  when integration PRs skip CI. Runtime observation in step 3 is separate from repeating the suite.
- **Human merge:** CI/AFK/reviews cannot authorize merge, release or deploy. No direct shared-branch
  commits/pushes or local merge/pull toward it. Harness improvements use a separate authorized PR.
- **Deterministic risk:** the classifier routes work; agent input may only raise its result.
- **Tracker:** use the configured tracker; do not invent a second issue system.
- **Evidence:** retain actual verdict/review output or LOG artifacts, redact secrets without changing
  outcomes, and quote the canonical gate block in the PR. A prose summary cannot replace evidence.

## Risk gate — the rules classify, not the agent

Before each action, classify its planned paths, command, and stage; refresh after changes. A planning
`--no-gate` track lookup is not authorization. Classification uses the change itself, and agent input is folded in
as `final = max(rule, agent)` — **only allowed to raise** it, never lower it.

```bash
{{pluginBinPrefix}}classify-risk.sh --from-git --stage <plan|implement|pr|improve> \
  --action "<what is about to happen>" \
  [--agent-blast-radius low|medium|high --agent-reversibility full|partial|none --agent-cost low|medium|high]
# exit 0  = AUTO         → proceed within existing authorization
# exit 10 = REQUIRE      → verify matching human approval before the action; ask only if missing
# exit 11 = DENY_AND_LOG → verdict channel: log evidence; continue only authorized reversible work
```

**Merge, deploy, release, and send are always REQUIRE**, regardless of any other input. Anything
unmatched — an unmatched *command*, or 11+ files with no classification — is **fail-closed REQUIRE**;
silence is not AUTO.

**The track is a classification output**, not a separate axis. Whatever `TRACK:` line the classifier
prints is the routing decision:

| TRACK | Meaning | Steps |
|---|---|---|
| `risky` | Matched a rule | Full sequence + whatever `DEEP_GATES:` the output names |
| `standard` | No rule match | Full sequence, deep gates only if this repo's own verify table says they're affected |
| `docs-only` | No runtime surface touched | Implementation/TDD and app-driving can be skipped; required repository/document gates still run |

Skipping a step always leaves a one-line reason in the PR body, so it's auditable after the fact.

See [RISK-GATE.md](RISK-GATE.md) for what the rule set covers, why the agent may only raise a
classification, the two channels of `DENY_AND_LOG`, and layering this repo's own `risk-rules.json`.

## Sequence (0 → PR is autonomous, merge is human, post-merge is `improve`)

### 0. Worktree isolation — `git worktree`
Check the authorization record before any writes or external action. For a delivery request that
includes tracker updates, claim the issue first — before
creating the worktree — by assigning it and moving it into an in-progress state. Where concurrent
sessions are common, claiming first is what stops two sessions picking up the same issue (worktree
isolation alone prevents git conflicts, not duplicate starts).

**Assign it to the verified human driving this session.** An authenticated shared/service account is
not proof of that identity. Preserve existing ownership unless reassignment is authorized. If the
owner is unresolved, report it and continue independent local work; do not invent an assignee. An empty
assignee here is the common failure and stays invisible for a long time: merge automation closes the
issue without ever setting one, so it lands in Done owned by nobody.

Unless the user assigned an existing isolated worktree:
`git fetch origin && git worktree add -b <type>/<slug> <sibling-path-outside-repo> origin/<base>`. Check
`git worktree list` first if concurrent work is common here. A fresh worktree has no installed
dependencies — inspect prerequisites and install what is needed within scope. Every following step
happens inside this worktree. (macOS: if a later
`git worktree remove` fails with a permission-denied ACL error, `chmod -R -N <path>` first — see
hotfix's cleanup step for the full note.)

### 1. Implementation plan — `Plan` agent / `grill-with-docs` if there's a design decision
Plan what to build and how to slice it. Resolve routine reversible choices from requirements and
code. For a material open decision, call `ship-flow:grill-with-docs` in **caller mode** with that
bounded question and allowed documentation. Return to this flow when it resolves; no implementation
before the finished plan is checked. Use an available planning agent or plan here.

Keep the plan proportional: reuse the issue's settled requirements, name the affected seam and
checks, and avoid a new PRD/ADR/interview for an already clear change. Do not add speculative
configurability or a second implementation of an existing helper. A compact plan still gets the
planner and AC checks below.

**Scope guard.** Grilling routinely surfaces adjacent work that *should* happen. That is not licence to
grow this run: record adjacent work as a follow-up proposal; file a separate tracked issue only when
that publication is authorized (blocked-by links where applicable). **This run continues on the original issue at
its original scope**. A run that grills its way into a bigger problem and never implements the issue it
was given has failed, however good the new plan is.

Once the plan is set, **derive the track from the paths it touches** — there's no diff yet, so pass the
planned paths directly: `{{pluginBinPrefix}}classify-risk.sh --no-gate --path <path> [--path <path>]...`
(one `--path` per path, no `--` separator) → the resulting `TRACK:`/`DEEP_GATES:` scope the remaining
steps.
→ **Gate:** success criteria (what "done" verifiably means) has to be written down before moving on.

**Express acceptance criteria as one-line AC contracts** — this is what makes step 3's gate
machine-checkable instead of self-reported (ADR-0104):

```
AC: login rejects a wrong password | verify: pnpm --filter api test -- auth.spec.ts | expect: 401
```

Full syntax, field semantics, and more examples: [AC-CONTRACTS.md](AC-CONTRACTS.md). For a `standard`
or `risky` track (`docs-only` is exempt — step 3 is already skipped for it), **the plan as a whole must
express at least one AC with a machine-checkable contract**; zero across the whole plan means step 3
fails closed.

**Validate the finished plan before any code exists** — hand it to this plugin's `ship-flow:planner`
agent (namespaced, same reason as step 4). It fail-closed-checks what goes wrong *before* TDD rather
than during it: acceptance criteria that are vibes rather than checks, criteria with no test seam, and
**zero AC contracts on a `standard`/`risky` plan** — the one that makes step 3's `ac-verify.sh` gate
vacuous. A BLOCK loops back here; ask a human only for a missing reserved decision. Reuse planner
proof only for the same plan digest, relevant code revision, track, and completed per-criterion
checklist. Recheck affected proof after changes. An interview or ADR is not planner proof;
`grill-with-docs` never automatically exempts this gate. Record proof reuse in the PR body.

**If the plan itself exceeds one session's budget** (too large to pin down a single verifiable "done"),
don't jump to implementation — propose decision tickets first; publish only if authorized. Use one
ticket per open question, dependencies first, sharpest one worked first.
Each resolved ticket re-enters this skill from step 0 — splitting the plan doesn't bypass the gate.

### 2. Implementation — invoke the `ship-flow:tdd` skill (red → green)
Implement the plan red→green by **invoking this plugin's `ship-flow:tdd` skill by that exact
namespaced name** — not by writing tests in this session's own style and calling it TDD. Security/
invariant paths (RLS, authorization, or whatever this repo's equivalent is) need **behavior-proof
tests**, not just coverage. This repo's verify command is this loop's convergence criterion — run it
wrapped, always, never raw: `{{pluginBinPrefix}}verdict-run.sh -- <verifyCommand>` (BAC-745 — `--` is
required here, and only here). This holds even if `verifyCommand` is itself already a verdict-contract
script (e.g. a repo's own `verdict` wrapper) — `verdict-run.sh` detects an already-emitted
`=== VERDICT ===` block according to its contract rather than creating competing verdicts. Read the
single canonical gate off the printed `VERDICT:`/`EXIT:` lines and command status. Missing, conflicting,
or inconsistent evidence stays unresolved; do not pick whichever result is green. A bare exit code
does not replace the block, state file, and ledger event.
→ **Gate:** `VERDICT: PASS` + whatever `DEEP_GATES:` step 1 identified (re-checked against the actual
diff with `--from-git`). `VERDICT: FAIL` loops back autonomously.
Use the shared contract's failure recovery: resolve the failing check and affected evidence inputs
before another full run; a focused PASS never clears this gate.

> If any `DEEP_GATES:` run against a shared local resource (e.g. a per-worktree docker database), don't
> run more than one deep gate in this worktree at the same time — a second one recreating the same
> container mid-run causes an unrelated-looking failure, not a clear error.

### 3. Runtime verify
Build and run the app, drive the changed surface (CLI/API/GUI — whatever applies) through it, and
confirm **what was intended actually works**. This produces runtime evidence, not a re-run of the test
suite. Check each AC command's effects against the authorized environment before execution.
When step 1's plan has any AC contracts, this is formalized via
`{{pluginBinPrefix}}ac-verify.sh <plan-file>` (ADR-0104 — positional plan file, no `--`) — deterministic
subprocess judgment per contracted AC, composing with (not replacing) the observe-the-running-app check.
→ **Gate:** PASS. FAIL → **loop back to step 2**. SKIP (no runtime surface exists) passes with a
one-line reason.

> If a GUI surface needs driving and a browser-automation MCP is unavailable (or its profile is
> contended by a concurrent session), fall back to a standalone script that imports this repo's own
> test framework's browser driver (e.g. Playwright) and launches a fresh headless browser, independent
> of any shared MCP profile. Run it from inside the package that has that dependency installed — a
> script outside it won't resolve the same `node_modules`.

> When a browser is involved, prefer an accessibility-tree snapshot (+ diff against the prior state)
> over a screenshot as the observation evidence — most repos already have a tool for this (e.g. a
> `take_snapshot`-style MCP call); reach for a screenshot only when something genuinely needs visual
> confirmation. Never attach a browser-automation MCP that drives the user's own logged-in browser
> (their cookies, their accounts) to this autonomous step — a prompt injection on the page under test
> would then reach the user's real accounts, not a sandboxed session.

### 4. Review and fix
Run this plugin's review agents — **by their namespaced names, `ship-flow:code-reviewer`,
`ship-flow:test-hunter`, `ship-flow:verifier-integrity-hunter`** — against the diff. The namespace is
load-bearing: a bare `code-reviewer` collides with `pr-review-toolkit:code-reviewer`, a different agent
with a different checklist that many repos also have installed, and the wrong one resolving looks
identical from the outside. If this repo also runs a separate general-purpose PR-review tool, run
both — these agents are complementary, not a replacement. Fix what they flag autonomously.

**A review agent that ends in a watchdog timeout, a stall, or any other non-completion is a BLOCK, not
"no findings".** A subagent that never produced a verdict has reviewed nothing; treating its silence as
a clean pass is how a run reports itself as reviewed when it wasn't. Re-summon it (one at a time if a
shared local resource caused the stall) and get a real verdict before step 5.
→ **Gate:** every summoned review agent returned a completed verdict, and Critical/Important findings
resolved. Re-run the step-2 gate after fixing, then re-review.

### 5. Open the PR → `integrationBranch` (or `releaseBranch` if trunk-based) and **stop** — hand off to a human
Right before opening the PR, get the final verdict against the real diff:
`{{pluginBinPrefix}}classify-risk.sh --from-git --stage pr --action "PR→<base>" --render-md` — paste the
output markdown block (verdict table + its audit marker, if the classifier emits one) **verbatim into
the PR body** rather than transcribing it. Apply the result to this PR-open action before execution:
REQUIRE needs matching approval, DENY_AND_LOG follows its channel, and errors are unresolved. Put
any REQUIRE reason at the top of the body, but that warning does not authorize publishing. Compose
the PR body (summary, verification evidence, gate verdict, any SKIP reasons, and the `Decisions taken`
section from [Execution mode](#execution-mode--autonomous-by-default)) and the tracked-issue comment.
**Write both in `outputLanguage`** (the banner at the top of this file) — this is the measured drift
point: by now the context is dominated by this English skill body, and runs that worked in the user's
language through step 4 report the PR in English here. Pasted evidence (verdict block, gate output,
command names, branch name) stays verbatim — only your own prose is translated.

**This session does not run push, PR-open or tracker-comment commands itself** (ADR-0003). Read
[PUBLISH-HANDOFF.md](PUBLISH-HANDOFF.md) now and hand the completed material to
`ship-flow:publisher`: fresh `mktemp -d`, literal files written with the Write tool for title/body/
comment and identifiers, authorization record, exact repository/worktree/head/base/destination,
gate evidence, ordered commands and their dependencies. Use `--body-file`; never compose payloads
with a Bash heredoc. The publisher executes only the supplied authorized actions and returns the
PR URL plus each command's exit code; it does not fetch context or compose content.
Start it without Builder history: explicitly use `fork_turns="none"` on hosts with that option,
pass a self-contained handoff, and verify the dispatch/context evidence. A fresh agent ID is not
enough. If the host cannot exclude inherited history, that publication step is BLOCK.

Inspect each required action's result. Repair failures within scope without repeating successful
posts; a PR URL with a failed required comment is partial. **Hard termination:** report actual outcomes in
`outputLanguage` and end the run at the requested endpoint. No next issue, worktree, PR or post-merge
improvement without that scope. Per-PR merge approval and uncertain-outcome recovery follow
[AUTHORIZATION.md](../AUTHORIZATION.md); changed reviewed content/head/base needs matching approval
for that merge, while ongoing implementation remains authorized.

→ **After an approved merge, if closeout was authorized:** preserve any evidence needed for authorized
lesson capture before deleting its producer worktree. Verified lesson receipts are bound to that
checkout; copying them to the canonical checkout does not preserve verification. If capture or
reverification is still needed, defer that worktree's removal and report it. Then clean up the worktree/branch (remove any dedicated deep-gate resources
first, confirm no stash leftovers) + update the tracked issue (status, merge SHA) → **step 6**.
Release (`integrationBranch → releaseBranch`) is a separate decision — `hotfix`, or this repo's own
release procedure.

### 6. `improve` — lessons → skeptical review → harness-improvement PR (post-merge, also stops at a PR)
Record what the verifier actually confirmed as fixed as a lesson (this plugin's `retrospect` skill, if
ported into this repo), and only promote **recurring** ones as codification candidates. The core
safeguard is **the proposer isn't the approver** — if the same judgment that nominated a candidate also
accepts it, that's a rubber stamp. A separate skeptical pass tries to *refute* each candidate; when
uncertain, the default is reject.

```bash
L() { {{pluginBinPrefix}}lessons.sh "$@"; }; D='.loop/lessons'
L promote --min-count 3 --lessons $D                                   # candidates + id (verified+recurring floor)
L challenge --id <id> --verdict accept|reject --reason "…" --lessons $D # ← the separate skeptical pass records this
L promote --codify --lessons $D                                        # only accepted ones come out
L retire --id <id> --ref "<where it landed>" --lessons $D              # retire from the pool after codifying
```

With follow-up authorization, prepare an accepted lesson in an isolated worktree. Classify planned
paths **before editing**, apply the gate, then edit and verify. Refresh against the actual diff with
`{{pluginBinPrefix}}classify-risk.sh --from-git --stage improve`. High blast alone is not always
REQUIRE; use the actual verdict and its channel. Classify publication separately, honor its approval,
and open the authorized PR. Human merge approval remains separate.
→ **Gate:** zero codifications without an independent accept verdict · zero direct commits to a
shared branch · all required verification and action approvals intact.

## Token efficiency
- **Delegate exploration when available and authorized.** If understanding the codebase needs 3+ rounds of grep/read, hand it to an
  Explore-type agent — keep raw file dumps and grep output out of the main context. Same for review
  agents: pull in their findings summary, not their internal deliberation.
- **Delegate mechanical, judgment-free work** (lint/type-error fix loops, straightforward renames) to a
  cheaper model.
- **Check context size at step boundaries.** Crossing the step 2→3 or 3→4 gate after accumulating long
  test or review output is a good point to consider delegating or compacting — worktree isolation makes
  single sessions run long.

## Failures and conflicts (handled autonomously)
- Gate red → loop back on that step autonomously. Only call a human if the agent can't resolve it itself.
- Human-side merge reports out-of-date/CONFLICTING → in the worktree, **standalone** `git fetch origin
  <base>` → **standalone** `git rebase origin/<base>` → re-verify. Then hand the retry push to
  `ship-flow:publisher` the same way step 5 does (ADR-0003) — still the Builder session, still holding
  untrusted-input history from steps 0-4, so it must not run the push itself. Give it the branch name
  as a data file and the exact command: `git push --force-with-lease origin "$BRANCH"`, `$BRANCH`
  read from that file in the same Bash call (never pasted into shell source), never a Bash heredoc.
  Use this only on a branch covered by the caller's rewrite/publication scope. A changed head needs
  fresh merge approval; do not re-use the approval of the old diff. `<base>` is
  **that PR's base**. **Run each git operation as its own independent call** — chaining `git merge`/`git pull`
  with anything else is liable to trip a merge guardrail hook regardless of direction.
- **Stacked PR (this branch is itself another open PR's base) + squash-merge**: once this PR merges,
  the branch it was on is gone as a target — the stacked PR's base doesn't auto-retarget, so its commits
  can land in a dead branch instead of the integration branch even though GitHub shows it as merged. If
  a stacked PR exists, prepare the retarget/rebase and apply only within its authorization **before** it merges, not
  after. Don't trust a `MERGED` badge alone — confirm with `git show origin/<base>:<file> | grep
  <symbol>` that the actual content landed.
