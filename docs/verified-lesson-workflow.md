# Reuse a verified fix with file lessons

Start with the next real recurring failure, using the project's approved engine installation and
existing verifier. File lessons need neither an embedding key nor a database. Runtime paths below
are relative to that engine's `bin/`; use the project's configured launcher where required.

## Existing automatic path

When a bounded fix loop is already appropriate and authorized, add `--lessons .loop/lessons` to
its `loop-fix.sh` invocation. Keep the real verifier, applicable protected paths, mutation guard
and stopping limits. The loop owns the run ID, retains its first completed FAIL and final PASS
receipts, queries before fixing and records after success. Check `lessons.err` if recording fails:
a successful fix does not guarantee that a lesson was saved.

Do not introduce a fix loop solely to populate memory. A normal manual fix can use the same
verifier evidence when captured as follows.

## Manual capture contract

`verdict-run.sh` emits a compact verdict on stdout and saves raw command output in its `LOG:` file.
They are different artifacts. Before a new repair episode, choose a fresh `LOOP_RUN_ID` (for example,
`node -p 'require("node:crypto").randomUUID()'`) and export it for that episode's verifier runs.
Keep their working directory and configured `LOOP_DIR` consistent.

| Retain | Requirement |
|---|---|
| First completed FAIL | Save the wrapper's stdout byte-for-byte as `first-verdict.txt`; keep the raw log separately. The wrapper must actually run the verifier and exit with FAIL. |
| FAIL receipt | Immediately read `receipt_id` from `$LOOP_DIR/verdict-state.json` (default `.loop/verdict-state.json`) and retain its file under the same directory's `evidence/`. The next verification replaces the state pointer. |
| Repair | Change the implementation; keep the verifier's criteria intact. Both individual checks must observe a stable Git-visible target, with a changed target between FAIL and PASS. |
| PASS receipt | Run the identical command/arguments with the same run ID after the fix and capture its new receipt. A command change, missing receipt or wrapper setup failure does not qualify. |

Keep these local artifacts private and outside tracked source. Receipt identity/checksums are local
guardrails, not proof against an unrestricted filesystem writer or proof that the lesson's prose
explains the cause. Review the proposed explanation against the actual repair.

```bash
node <engine-bin>/lessons.mjs record --verified --signature-file <first-verdict.txt> \
  --failure-receipt <fail-receipt.json> --receipt <pass-receipt.json> \
  --fix "<what changed and why>" --title "<failure>" --gate "<same verifier command>" \
  --lessons .loop/lessons
node <engine-bin>/lessons.mjs recall --signature-file <next-failure-verdict.txt> --lessons .loop/lessons
```

An old raw log, hosted CI success or a hand-written receipt cannot backfill this local pair. Keep
such evidence in a normal audit/note; capture genuine receipts during a future authorized repair.
Do not manufacture another failure to increase a lesson's recurrence count. End the episode's run
ID scope before starting an unrelated repair.

## Judge reuse, not record count

At the next naturally occurring failure, query with the new verdict before editing. Record whether
the suggested action was relevant, changed the plan and passed current independent verification.
The current FAIL remains FAIL after recall. Exact-signature recall does not answer paraphrased
questions; an empty stdout with exit 0 is a miss, so inspect stderr too.

Keep later failures under fresh run IDs; repeated recording of one receipt pair is deduplicated.
Before removing a worktree, use `lessons preserve` if its valid lesson is worth retaining. Another
worktree's `lessons history` returns historical hints, not currently verified lessons; rerun the
current verifier. See [the lifecycle reference](../tools/loop-engine/docs/lessons.md).

The [historical replay](audits/2026-09-28-file-lesson-replay.md) checks this wiring with a real past
defect and a known repair. It supplies zero prospective usefulness samples. Compare real reuse
against the project's current native memory and documentation before adding semantic infrastructure.
