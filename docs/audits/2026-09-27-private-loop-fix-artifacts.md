# Loop-fix artifact creation permissions — 2026-09-27

## Scope

Follow-up to [#86](https://github.com/reach0908/paul-loop/issues/86) and merged
[#133](https://github.com/reach0908/paul-loop/pull/133), based on
`1ce83f65853edd5929952fe3fb17032f4e6095f0`. Proposed source version: loop-engine **0.15.17**;
ship-flow **0.11.7** and loop-memory **0.8.1** are unchanged.

The run-ledger/verdict-log fix did not cover loop-fix's separate handoffs, history, backups or
supervisor-created directories and markers. Either the Bash worker or the Node supervisor can
create these files, including when cancellation happens before an ordinary worker closeout.

| Producer | Creation policy |
|---|---|
| Bash worker | Private umask for handoff/history/error/marker output; original caller umask for verifier and fixer commands |
| Worker protected backup | New directory tree 0700; copy inside that private tree, then restrict completed snapshots to 0400 |
| Node lifecycle/state | New handoff, lifecycle, lease/recovery and snapshot directories 0700; new sentinels/history/compromise markers 0600 |
| Protected-file restoration | Keep original bytes/modes and caller umask for restored project directories |

Existing atomic lifecycle files and supervisor backup files were already 0600 and 0400 respectively.
Their content, receipt, lease, cancellation and fail-closed contracts are unchanged. No dependency,
shared filesystem abstraction, command gate, workflow or verifier rule is added or relaxed.

Existing directories and append targets are not recursively chmodded. Manual sentinels and
user-owned `.loop/.env` are preserved. Run-owned backup directories continue to be recreated as
before. POSIX mode bits do not provide same-UID isolation, ACL/ownership migration or protection
against every hostile concurrent path replacement. **#86 remains open** for ancillary hook logs
and other producers outside these loop-fix paths; no consumer install or live memory infrastructure
is changed, and provider fixtures do not demonstrate consumer usage or memory efficacy.

## Verification

The new frozen-shell regression first failed **3/3** against the merged base. After the producer
changes, the same test file passes **3/3**. It runs the real supervisor and worker under umask 000
and 027, covers default/custom/legacy handoff directories, checks privacy before user commands
write output, preserves existing append data and `.env`/sentinel modes, restores protected bytes
and mode 0751 after a mutation, and checks cancellation-created history/compromise markers with
subsequent fail-closed refusal. It uses only local disposable fixtures and no model/API/DB calls.

Initial failure and focused green logs are retained in `.loop/private-loop-fix-artifacts/`.
The complete engine suite, baseline-file hashes, independent Standards/Spec review and final
package checks will be recorded after execution. Local verification, hosted CI, merge and release
are separate claims.

## Authorization and prior release

The implementation classifier returned **DENY_AND_LOG**, high/full/low, for 11 planned paths.
Keep that verdict unchanged and continue the user's authorized reversible provider work toward
review, as specified by the shared authorization contract. No command-execution denial is
bypassed; CI or this classification does not authorize a merge.

The #133 merge tree equals reviewed head `ca59241d3ba8f413b4f333eaeba2a6913bdba4b9`.
Its post-merge workflow was initially in progress; exact workflow/tag evidence is being retained
privately and will be confirmed before claiming the previous release complete.
