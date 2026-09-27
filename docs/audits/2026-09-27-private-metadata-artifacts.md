# Persistent metadata creation permissions

Date: 2026-09-27. Base: `a002dd07a157d8f84d3cb1e5a0d44f5c42c5dde5` (#136).
Scope: remaining observed persistent metadata writers for
[#86](https://github.com/reach0908/paul-loop/issues/86).
Candidates: loop-engine **0.15.20**, loop-memory **0.8.2**; ship-flow **0.11.7** unchanged.

#136's reviewed/published head `e01f78bb9eca2679848f0122080ccb3bb956ffc9` has the same tree
as this base. The working checkout is synchronized. The remote `loop-engine--v0.15.19` tag
matches the merge, and [post-merge validation 36325669972](https://github.com/reach0908/paul-loop/actions/runs/36325669972)
completed successfully. This confirms source publication, not consumer installation.

## Problem and acceptance contract

Under umask 000, these remaining writers create metadata files with 0666 and new state/import
directories with 0777. Optional memory debug logs have the same file-creation issue. A stale
gstack import temporary file is also overwritten and renamed with its old permissions.

| Writer | Required change | Preserved behavior |
|---|---|---|
| `gstack-scan.mjs` | New lesson directories 0700; exclusive temporary files 0600 before rename; refuse an existing temporary file | Input bytes/modes, imported trust mapping, duplicate lesson bytes/modes, explicit output paths |
| `mattpocock-skills-sync-check.mjs` | New stamp file 0600 and parents 0700 | Check-only mode does not write; UNKNOWN remains exit 2; stamp preserves other state fields and existing modes |
| `deps-audit.mjs` | New project `.loop/deps-audit.last` 0600 and parent 0700 | Missing usage stays unavailable; a failed timestamp write remains best-effort; global cache/install behavior unchanged |
| Memory recall/graduation hooks | New opt-in debug append logs 0600 | Existing append modes, disabled/debug-off behavior, fail-open hooks and existing directory requirements |

Use stdlib creation modes at the existing writers. No new helper, dependency, service or filesystem
migration. Do not rewrite `.loop/.env`, modify consumer installs, activate a memory DB or change
verifier outcomes. Memory hooks still do not create a missing debug directory. Creation modes
are upper limits under the caller's umask, not ACL repair or protection against a hostile same-user
process. Existing directories and in-place/append files are not migrated.

## Persistent-writer inventory and issue closeout

The bounded #86 acceptance is private creation of provider-owned operational data, not a blanket
chmod of a project. Source inspection across engine `bin/lib/hooks` and memory `src/hooks`, together
with the prior regression slices, accounts for the following persistent writers:

| Producer family | Coverage |
|---|---|
| Run/liveness ledgers, verifier raw/redacted logs, state/evidence | [#133 audit](2026-09-27-private-run-artifacts.md); existing state writers retain explicit private modes |
| Loop-fix handoffs, history/errors, sentinels, leases and protected backups | [#134 audit](2026-09-27-private-loop-fix-artifacts.md); backups use 0400 |
| Stop counters, worktree-session state, shared red-event logs | [#135 audit](2026-09-27-private-hook-artifacts.md) |
| AC logs, eval/context baselines, OTel records, agent-eval reports | [#136 audit](2026-09-27-private-cli-artifacts.md) |
| File lessons and shared lesson history | Existing `lessons.mjs` / `lesson-history.mjs`: private directories and exclusive 0600 temporary writes |
| Imported lessons, sync/audit stamps, optional memory debug logs | This change and its six-case regression |

Explicit exclusions, rather than unspecified further work:

- User-owned input/configuration and restored project files retain the user's bytes/modes.
- Empty transient lesson-lock directories contain no payload; disposable agent-eval fixture trees
  live below a private `mkdtemp` root and are cleaned up. They are not persistent output writers.
- Global dependency caches, managed skill-install provenance and developer build/test artifacts
  are outside the project operational-data contract. User shell redirection is also user-owned.
- Existing files/directories, ACLs, hostile path races, same-user isolation and memory-database
  storage are outside this creation-mode guarantee. They are not silently reported as secured.

This inventory supports closing #86 when this change is reviewed and merged. It does not close
other security issues or prove consumer activation, recall usefulness or native sandboxing.

## Verification record

- Same regression assertions in `tools/loop-engine/test/private-metadata-artifacts.test.sh`:
  **0/6 before the source change → 6/6 after**. Fixtures exercise umask 000, existing permissions,
  import collisions, read-only/unknown paths, failed timestamp writes and debug opt-out/fail-open.
- Fixture-only HOME, fake `gh` and fake memory CLI prevent real credential/cache/service access.
  No live model, database, consumer installation or settings were used.
- All **98 existing engine test files** remain byte-identical to base (private SHA-256 receipt).
- Memory `npm ci`, typecheck, tests and build pass: **175 passed, 2 skipped** across 17 test files;
  rebuilt `dist/cli.js` is byte-identical. The two opt-in live embedding API checks are skipped,
  not counted as passed.
- Complete engine verification (`/bin/bash tools/loop-engine/test/run.sh`, Node 22.19.0,
  Bash 3.2.57, Python 3.13.12) passes **86/86**, exit 0. Vendor lock, generated Claude/Codex
  package reproducibility and strict generated marketplace/plugin validation pass.
- Private evidence is retained under `.loop/private-metadata-artifacts/`, including the original
  red log. Existing tests, verifiers, thresholds and risk rules are unchanged.
- Implementation and publication verdict gates returned **DENY_AND_LOG (11)** for 13 paths/high blast radius,
  with full reversibility and low cost. The unchanged result is retained; existing authorization
  permits reversible provider work toward review. No command-execution denial was bypassed.

## Standards

Independent `code-review` skill review of `a002dd07...02351d940d9306e46a88f10ee10b656f04d22939`:
**0 findings**. The writers preserve behavior while adding explicit creation modes; the exclusive
import temporary deliberately fails on collision. Existing tests/verifiers remain unchanged, and
the documentation does not overclaim existing permission repair or broader security.

## Spec

Independent review of the same commit: **0 findings**. No overlooked persistent writer was found
within the declared scope. The consolidated inventory supports bounded #86 closeout after checks
and merge; creation modes, existing-file preservation, trust mapping, read-only checks and fail-open
behavior match the contract. This is static review, not consumer or native security qualification.

Review totals: Standards 0; Spec 0. No worst finding in either axis.

Local verification and review are complete. Hosted CI, human merge and candidate release tags
remain separate; the verified 0.15.19 tag belongs to the previous release.
