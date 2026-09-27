# File-lesson capture and historical defect replay

Date: 2026-09-28 KST. Related: [#35](https://github.com/reach0908/paul-loop/issues/35).
Base: `e37a1fa92e51dcf02397ce52c6b5be5a1e2445ab` (merged #138).
Versions remain engine **0.15.20**, memory **0.8.2**, ship-flow **0.11.7**.

## Purpose and finding

The previous native observation qualified hook execution, not useful reuse. Existing provider
development logs contain real failures and fixes but no admissible local verification receipt pairs
were found in the inspected provider worktree. The current contract does not permit retroactively
turning those logs into verified lessons. Consumer installations and memory configuration remain
outside this work; provider replay evidence does not establish consumer adoption (ADR-0004).

README's `--signature-file <failure.log>` example was ambiguous: the producer hashes the exact
failed verdict stdout, not the raw test log. The manual entry point also omitted the shared run ID
needed by the FAIL/PASS pair. README now links a [short capture workflow](../verified-lesson-workflow.md)
describing the existing automatic path and manual evidence requirements. No new runtime mechanism,
dependency, relaxed evidence rule or infrastructure is needed.

## Actual historical input

[#134](https://github.com/reach0908/paul-loop/pull/134) initially failed on Linux when a BSD-style
`stat -f` probe emitted GNU filesystem information before failing. That output contaminated the GNU
fallback's saved mode, leaving a protected file at 0400 instead of 0751 after restoration.
The [original audit](2026-09-27-private-loop-fix-artifacts.md) retains its local and hosted failures.

The isolated replay used the real broken implementation from `1572d06570af065086b9e8893c1c64150c044f4e`
and the repair from `5fdd0d15a7287fa9f5faaecfcb343ee437647b31`. The three-case regression file is
byte-identical at both historical commits and at the current base. Only the implementation file
changes between attempts; its repaired bytes also match the current base. GNU `stat` runs on
macOS/Node 22. This is not a full Linux runtime or a blind fixer comparison.

## Observed results

| Step | Result |
|---|---|
| Broken implementation, full frozen three-case regression | FAIL; 2 pass, 1 fail, original `256 !== 489` permission assertion |
| Known source repair, same verifier and run ID | PASS; 3/3; real producer receipts for stable changed targets |
| Record with the raw test log and those valid receipts | Rejected, exit 2; no lesson created |
| Record with exact failed verdict stdout | One verified lesson; recording the same pair again is ignored |
| Deliberately replay the original defect under a fresh run ID | FAIL; querying the new verdict returns that lesson before repair; current verdict stays FAIL |
| Synthetic unrelated-signature control | No match; stdout empty, exit 0, diagnostic on stderr |
| Reapply known repair, unchanged three-case regression | PASS; 3/3; stored count remains one and replay is not recorded as another natural recurrence |

The initial preparation placed child test temporary directories inside the fixture Git repository.
The lifecycle correctly resolved that containing repository, violating the original test's temporary
root assumptions and causing extra failures even after repair. Those failed logs are retained.
Moving only the test temporary parent outside Git restored the original conditions; the complete
three-case command was rerun on both implementations, without narrowing or editing its assertions.

[Machine-readable evidence](2026-09-28-file-lesson-evidence.json) binds outcomes to source and private
trace hashes. The private lane `.loop/file-lesson-replay-2026-09-28/` retains the preparation failure,
runnable replay, real receipts and isolated lesson store. Test-created temporary directories were
removed; the isolated source/evidence workspace remains for review. Nothing was copied into a
consumer store or the provider's default `.loop/lessons`.

## Decision and remaining evidence

This establishes one known-defect capture/recall path and reproduces a documentation trap. It adds
**zero prospective usefulness samples**: the repair was already known, no independent agent used
the memory to solve an unknown problem, and no comparison with current native memory/docs occurred.
No speed improvement, semantic retrieval, real graduation or general memory benefit is claimed.

#35 stays open. The next genuine development failure is the opportunity to capture a receipt-backed
lesson and later observe whether recall changes a repair decision. Do not generate activity just
to close the issue; the proposed 6–10 real cases remain uncollected. #87's native publisher execution
qualification is separate and remains open.

#138's merge tree equals the reviewed PR head. Its post-merge validation completed successfully;
existing release tags remain unchanged because the merged change only updates documentation.
Current edits are also limited to README and root `docs/`; runtime source/tests/manifests are
unchanged. Independent review and the new PR's hosted CI are separate pending checks.
