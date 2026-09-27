# Run-ledger and verifier artifact permissions — 2026-09-27

## Scope and decision

Follow-up to [#86](https://github.com/reach0908/paul-loop/issues/86), based on
`ac6a27bf9d23cc4b9052fa2c29fe314032b23763`. Proposed source versions: loop-engine **0.15.16**
and loop-memory **0.8.1**. Source inspection found that verdict-state and evidence files were
already 0600, but ledger writers and verifier logs used the host umask. The sanitizer's atomic
replacement also widened an existing 0600 log under a permissive umask.

Restrict new artifacts at their producers, using existing filesystem mode arguments and scoped
shell umasks. Do not change process-wide permissions inherited by the user's verified command.
Both ledger writers need the same policy because either engine or memory can create a session's
shared JSONL first. No dependency or new filesystem abstraction is required.

| Producer | Creation policy |
|---|---|
| Engine `appendRunEvent` | New `.loop/runs` parents 0700; JSONL/current pointer 0600 |
| Memory `recordLiveness` | New ledger parents 0700 and JSONL 0600, retaining its fail-open contract |
| `verdict-run.sh` | New log parent directories 0700 and raw log 0600; wrapped command's umask unchanged |
| In-place sanitizer | Exclusive temporary file with the input's permission bits, further limited by host umask |
| Verdict-state/evidence writers | New parent directories 0700; existing 0600 file behavior retained |

These are creation defaults, not recursive migration: existing directories, append targets and
user-owned `.loop/.env` keep their modes and contents. A legacy broad log is not automatically
made private by redaction. Filesystem ACLs, hostile concurrent path replacement, same-UID writers
and privileged users are not isolated by these mode bits. Ledger telemetry remains forgeable.

**#86 remains open.** This slice covers the shared run ledger and verifier output path. Separate
loop-fix handoff/history/protected-backup files, ancillary hook logs and other `.loop` producers
still need their own scoped policy and checks. Provider tests do not migrate existing consumer data.

## Verification

The initial regression retained three failures under umask 000: ledger directory 0777 instead of
0700, a verifier log exposed before capture, and redaction widening 0600 to 0666. All three cases
pass after the fix. The same fixture covers both ledger writers, append preservation, existing
directory/file modes, untouched `.env`, raw and redacted logs, the OFF switch, real PASS/FAIL
exit propagation, state/evidence files and a child-created file retaining the caller's umask.

Existing run-ledger, sanitization, verdict-state and verdict-contract focused suites passed without
changing their assertions. Memory `npm ci`, typecheck, tests and build succeeded: **175 tests passed,
2 live embedding-provider tests skipped**; rebuilt `dist/cli.js` is byte-identical. No DB integration
or live embedding test was enabled.

Private evidence is retained under `.loop/private-run-artifacts/`. Complete engine, package and
independent review results will be recorded after execution; local tests, hosted CI, merge and
release remain separate claims. No real memory DB, provider API or consumer installation is used.

## Risk and previous release

The initial classifier returned **DENY_AND_LOG**, high blast/full reversibility/low cost, because
the planned change spans 15 paths (the generic threshold is 10). This classification is retained;
it is not converted to AUTO. Under the existing user-authorized provider work and shared
authorization contract, continue reversible implementation and independent review toward a PR.
No command-execution denial is bypassed and no merge approval is inferred.

PR #132 merged at the base above. Its tree matches reviewed head
`3d08a447096f970b985ab2c61d149206ede6e647`; remote `loop-engine--v0.15.15` matches that merge.
[Post-merge validation](https://github.com/reach0908/paul-loop/actions/runs/36297360198) succeeded.
The working checkout was synchronized; canonical main and installed consumer artifacts were unchanged.
