# Local context measurement by default — 2026-09-27

## Change and migration

Phase 2 of the [accepted context measurement rollout](2026-09-27-context-budget-opt-in.md),
after PR #131 merged at `10516c77ea9e40c92285bc309f184be307044104`.
The remote `loop-engine--v0.15.14` tag matches that merge, whose tree matches reviewed head
`4296f6087d451e3a382cfb6c6677a531394ee916`.
[Post-merge validation](https://github.com/reach0908/paul-loop/actions/runs/36295729670) succeeded
with nine successful jobs and the intentional main-push skip of `verifier-pinned-review`.
The dedicated working checkout was synchronized; canonical main and consumer installs were not changed.
The reviewed phase-2 source is `6dd81f5166b04cba0d47ecdf23da583ae02a1bb5`, proposed
loop-engine **0.15.15**. GitHub issue #84 was already closed when this work resumed;
that tracker state did not establish that the default had changed.

An ordinary `context-budget.mjs --root <project>` invocation now uses the existing local
measurement path. Remove the temporary block that automatically enabled all capabilities;
keep the existing guards and report shape. `--local` remains an explicit equivalent.
API keys and path/model/prompt options do not authorize additional capabilities.

For the previous full measurement, pass `--api --include-personal --run-hook` explicitly.
Each flag remains independent. The hook can perform its own external I/O; `--api` permits
selected text to be sent to the counting endpoint. Missing keys and API failures retain the
existing approximation fallback. Excluded personal buckets stay null, recall stays
`NOT_REQUESTED`, and `legacy_defaults` remains present with value false. Compare baselines
only with matching capabilities, model, method, turns and recall status.

These choices govern known input collection and execution, not filesystem isolation or the
contents of selected repository files. This is not a productivity or memory-efficacy benchmark.
No consumer installation, cache, configuration, database, verifier rule or workflow changed.

## Verification

- Focused suite: **20 PASS, exit 0**. The existing synthetic HOME, read observer, loopback
  server and hook marker now check default, explicit-local and configured-input calls.
  Existing opt-in, fallback, missing/corrupt-input and hook cases remain intact.
- Retained initial fixture failure: Bash 3.2 with `set -u` rejects expansion of an empty array.
  Keeping the common `--json --root` arguments in the array fixed that test invocation.
- The corrected test then failed against unchanged 0.15.14: an unflagged call made API requests
  despite the local-default requirement. The same test passed after the source fix, including
  checks for no personal reads, no hook execution and no legacy migration notice.
- Byte-identical base context-budget test: **18 PASS, exit 0** against a candidate CLI copy.
  Test and CLI hashes matched the recorded values after execution; no base assertion changed.
- Generated runtime packages and reproducibility check, vendor lock, strict marketplace and
  engine manifests passed. Complete engine suite: **81/81 PASS, exit 0**. Host completion
  results are retained in `command-results.json`; reviewed source bytes were unchanged.
- `code-review` skill: **Standards 0 / Spec 0 actionable findings** for
  `10516c77...6dd81f5`. Both independent reviews were static and did not repeat the tests.
  This is general code review, not an independent security assessment.

Private logs and hash records are under `.loop/context-budget-local-default/`:
`regression-red.log` (fixture failure), `regression-behavior-red.log` (behavior failure),
`regression-green.log`, `frozen-base-focused.log`, `frozen-inputs.json` and `engine-full.log`.
Exit codes come from host command results; plain logs alone do not establish those exit codes.
Local verification, hosted CI, merge, release and consumer activation remain separate evidence.
