# Context measurement capabilities — 2026-09-27

## Scope and staged decision

Follow-up provider work for [#84](https://github.com/reach0908/paul-loop/issues/84), based on
`834a517a533dfcaadd5dd416419baafb3f833fcc`. Source candidate:
`01f89eb4130f9be1d41f6935860c8df0cc8021d2`, loop-engine **0.15.14**.

The existing CLI reads personal instruction/memory/plugin inputs, counts selected text through
an API when a key exists, and invokes a recall hook automatically. The initial synthetic fixture
confirmed that an unflagged invocation made HTTP requests. The intended destination is a local
default with explicit selection of other capabilities.

This is **phase 1**, introducing those choices while retaining unflagged behavior. The pinned
base tests currently require automatic API counting, personal collection and hook measurement.
Changing the defaults and those assertions together would fail the independent baseline check.
Rather than bypass that check, migrate the existing positive/failure cases to explicit flags first;
after this change is reviewed and merged, change the unflagged default in a separate PR. #84 remains
open. No verifier, CODEOWNERS or workflow rule was changed.

## Contract

| Invocation | Direct counting API | Known personal inputs | Recall execution |
|---|---|---|---|
| `--local` | Disabled, including when a key exists | Excluded | Disabled |
| `--api` | Allowed for selected inputs; existing key/error fallback retained | Excluded | Disabled |
| `--include-personal` | Disabled | Included | Disabled |
| `--run-hook` | Disabled | Excluded | Allowed; the hook may perform its own external I/O |
| Any combination of the three capability flags | Only selected capabilities | Only selected capabilities | Only selected capabilities |
| No capability flag and no `--local` | Previous behavior | Previous behavior | Previous behavior, with migration notice |

`--local` combined with any capability flag is a usage error before measurement. Path, model and
prompt arguments configure inputs; in an explicit mode they do not enable another capability.
`--api` sends selected text to the configured counting endpoint. Personal inputs include global
CLAUDE.md, the project's MEMORY.md and installed plugin frontmatter. These options are CLI behavior,
not filesystem isolation or a guarantee about the contents of repository files or custom hooks.

Reports retain their existing buckets, add selected `capabilities` and `legacy_defaults`, mark
personal inclusion explicitly, and use `NOT_REQUESTED` with null recall tokens when execution is
disabled. An excluded axis is not a measured zero or a productivity saving. Old baselines without
capability metadata should be re-recorded before comparison; keep inputs, capability selection,
model, method, turns and recall status comparable.

## Verification

- Existing API counting, failure fallback, personal/plugin discovery, absent/corrupt input,
  recall/silent-hook, count formula, baseline persistence and text-output assertions are retained.
  Their invocations now select all three capabilities explicitly.
- New tests use a synthetic HOME, loopback HTTP server, read observer and hook marker. They check
  actual requests/reads/executions, each capability independently, full opt-in and conflicts.
  Full opt-in sends six fixture buckets; API-only sends the two repo buckets. Local and personal-only
  modes send no requests despite a configured synthetic key.
- Focused suite: **18 PASS messages, exit 0**. The initial HTTP failure is retained. Later fixture
  failures exposed a double-slash path mismatch in the read observer and an omitted explicit
  project identity in the synthetic memory lookup; both were corrected before accepting the result.
  A positive read observation prevents an inactive observer from falsely passing the local case.
  The initial failure tested the future unflagged default; the passing local check explicitly adds
  `--local`. It is not a red-to-green fix of that original default-mode requirement, which remains
  pending in phase 1.
- The byte-identical base `context-budget.test.sh` also passed against a copy of the candidate CLI.
  Test and CLI SHA-256 values were compared before/after; no base assertion was edited for that run.
- Complete engine suite: **81/81 PASS, exit 0**; host completion is retained in
  `engine-command-result.json`. Source files were unchanged from the reviewed candidate.
- Generated runtime packages and `--check`, vendor lock and strict marketplace/engine manifest
  validation passed. Documentation hygiene reported zero failures with existing skill-size warnings.
  No dependency or consumer installation changed; no real memory service or
  provider API was used. No native-agent productivity benchmark was run.
- `code-review` skill at `834a517...01f89eb`: **Standards 0 / Spec 0 actionable findings**.
  Both reviewers explicitly assessed the staged scope. This is general code review, not an
  independent security assessment or proof that the final default has changed.

Private evidence is retained under `.loop/context-budget-opt-in/`: `regression-red.log`,
`regression-green.log`, `regression-final.log`, `regression-final-fixed.log`,
`regression-green-complete.log`, `frozen-inputs.json`, `frozen-base-focused.log` and `engine-full.log`.
Exit codes come from host command-completion results; the plain logs do not contain exit-code
footers. The complete suite and hosted PR CI remain separate from these focused checks.

## Previous release and next step

PR #130 was merged as `834a517a533dfcaadd5dd416419baafb3f833fcc`; its tree matches reviewed head
`b3999f10ccb51b296ea9814f8ec134ebf5a2410a`. Remote `ship-flow--v0.11.7` points to that merge.
[Post-merge validation](https://github.com/reach0908/paul-loop/actions/runs/36291353512) succeeded
with nine successful jobs and the intentional main-push skip of `verifier-pinned-review`.
The dedicated working checkout was synchronized. Canonical main and consumer installations were
not changed; the previous canonical synchronization denial was not bypassed.

After this compatibility PR is merged, make unflagged measurement local, retain the explicit
measurement cases, and add a default-mode no-effects regression. That follow-up completes the
default-behavior part of #84; this phase does not claim that completion.
