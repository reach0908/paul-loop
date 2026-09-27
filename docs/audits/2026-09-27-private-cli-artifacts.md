# Persistent CLI artifact creation permissions

Date: 2026-09-27. Base: `7020cdc8aa551161bdede7f4f0a2d6dd6da0407c` (#135).
Scope: another bounded part of [#86](https://github.com/reach0908/paul-loop/issues/86).
Candidate: loop-engine **0.15.19**; ship-flow **0.11.7** and loop-memory **0.8.1** unchanged.

#135's reviewed head `4ff56515e3fe239c8e6e670ece1d232533dbd594` has the same tree as this base.
The working checkout is synchronized. Its 0.15.18 post-merge release check is initially pending;
source merge alone is not tag publication or consumer installation evidence.

## Problem and contract

These CLI writers still create persistent artifacts using the host's umask. Under umask 000,
report directories are 0777 and most report/log files are 0666. They may run before another
producer creates a private `.loop/` directory, and explicit output paths have the same problem.

| Writer | New creation modes | Preserved behavior |
|---|---|---|
| `ac-verify.sh` | Aggregate and artifact-only logs 0600; log directories 0700 | Verify commands retain caller umask; PASS/FAIL/usage errors and aggregate-state sync remain unchanged |
| `eval-gate.mjs` | Log/baseline files 0600; parents 0700 | RECORD remains exit 1; compatible comparison gates normally; failures remain failures |
| `context-budget.mjs` | Baseline file 0600; parents 0700 | Default/explicit baseline paths work; local mode does not acquire external capabilities |
| `otel-receiver.mjs` | Metrics/logs/traces JSONL 0600; parents 0700 | Append history, malformed-body records, loopback binding and HTTP behavior remain unchanged |
| `agent-eval.mjs` | Report parents 0700; existing exclusive 0600 report write retained | Failed/incomplete targets remain FAIL; existing report refusal remains intact |

Existing directories and in-place files/append targets keep their modes. User-owned `.env` files
and input artifacts are not migrated. Modes are creation limits, not a promise to repair ACLs or
hostile paths. Shell umask changes use the existing `verdict-run.sh` subshell pattern and do not
affect the verified command. Node writers use explicit filesystem mode options, with no new
abstraction or dependency. No target/grader, contract validation or gate rule is relaxed.

`eval-gate` includes its entire source in `grader_hash`. This source change therefore makes an
older baseline incompatible by the existing identity contract. Do not edit the saved hash or
silently rebaseline: explicitly record the new baseline (still not PASS), then verify separately.

## Verification record

- Regression: `tools/loop-engine/test/private-cli-artifacts.test.sh`; same five cases **0/5 before
  the implementation → 5/5 after**. Tests use disposable directories and a local ephemeral-port
  receiver, with no installed consumer state, live model calls or persistent service.
- AC creation is checked before the verification command emits output; umask 000 and 027,
  artifact-only logs, failure exit 7, aggregate FAIL and existing user modes are exercised.
- Other cases cover RECORD/comparison separation, default/explicit local context paths,
  failed agent reports and exclusive-write refusal, all three telemetry kinds and append history.
- Complete engine verification, independent review and packaging are pending at this initial record.
- Private evidence is under `.loop/private-cli-artifacts/`. Preserve the original red log and the
  existing engine tests; this is additional failure coverage, not changed verifier expectations.
- The implementation gate returned REQUIRE (12 paths, high blast radius, other dimensions
  unresolved by the structural rule). It is retained unchanged; the existing user authorization
  for provider implementation/review/PR work is reused. No execution denial or bypass occurred.

## Remaining scope

#86 stays open. Other observed producers outside this slice include `gstack-scan.mjs` lesson
imports, `mattpocock-skills-sync-check.mjs` state and `deps-audit.mjs` timestamps. Optional memory
plugin-data debug logs, existing artifacts and user-owned inputs are unchanged. This inventory
is a follow-up aid, not a complete permission/security audit or consumer-efficacy claim.

Hosted CI, human merge and the candidate's release tag are separate from local verification.
