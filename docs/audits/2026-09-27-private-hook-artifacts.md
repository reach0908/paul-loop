# Hook state and shared-log creation permissions

Date: 2026-09-27. Base: `d86f020a045c611e8b4933dd774774d9864bb379` (#134).
Scope: the next bounded part of [#86](https://github.com/reach0908/paul-loop/issues/86).
Source candidate: loop-engine **0.15.18**; ship-flow **0.11.7** and loop-memory **0.8.1** unchanged.

## Problem and contract

The registered engine hooks have independent writers that can run before a ledger creates a
private directory. With umask 000, worktree-session state creates `.loop/` as 0777; the Stop gate
creates its counter as 0666. The shared red-event logger similarly creates
`<git-common-dir>/loop-markers/` as 0777 and `red-events.log` as 0666. That log is outside `.loop/`,
but belongs to the same gate telemetry path and contains branch names, commit IDs and event data.

1. New worktree-session state directories use 0700; existing atomic state files remain 0600.
2. New Stop counters use 0600; their newly created parent directories use 0700.
3. New shared red-event directories use 0700 and logs 0600, including writes from linked worktrees.
4. Preserve hook decisions, counter increments, the fourth-attempt escape without a PASS,
   append history, and best-effort logging failure behavior.
5. Preserve modes on existing directories, append logs and in-place Stop counters. Existing
   worktree state keeps its previous atomic replacement behavior (a new 0600 file). Do not change
   user-owned `.loop/.env`, manual sentinels, consumer installations, or process umasks.

The change adds explicit modes to the existing Node filesystem calls; no new helper, dependency,
recursive chmod or runtime gate is introduced. All logger callers share the same fix.

## Evidence

- New runnable regression: `tools/loop-engine/test/private-hook-artifacts.test.sh`. Real hooks,
  temporary repositories and one linked worktree exercise creation under umask 000, existing
  user-file modes, counter/escape behavior, shared append and logger failure behavior.
- Before implementation: **0/3 PASS**, all three fail on the actual permissive creation modes.
  After implementation: **3/3 PASS**, with the same assertions.
- Existing test files and gate decisions are unchanged. Complete engine verification, packaging
  and independent review are pending at the time of this initial record.
- Private raw evidence: `.loop/private-hook-artifacts/`; no consumer credentials or logs are
  included in this document.

## Remaining scope

This is creation-mode hardening, not a sandbox against same-UID processes, hostile concurrent
paths, or inherited ACLs. It does not migrate existing artifacts. #86 remains open: examples of
other producers still outside these guarantees include `ac-verify.sh` logs, `eval-gate.mjs`
reports/baselines and `otel-receiver.mjs` output. Memory's optional plugin-data debug logs are
also unchanged. These are follow-up candidates, not evidence of a complete permissions audit.

Provider unit/CI success does not establish consumer activation, memory usefulness or native-host
isolation. Publication, merge and the release tag must be verified separately.
