# PR #137 release and remaining issue verification

Observed: 2026-09-28 KST. Source: `ec54a02254b8aa4c580f81b48f9161aa0bf6039a`.

## Release

- [PR #137](https://github.com/reach0908/paul-loop/pull/137) merged at `2026-09-27T16:02:21Z`.
  Its tree matches reviewed/published head `61f2e1c66cda09bf4cc09e6da9122b005b7fe8c5`.
- Working checkout `/Users/jinhokim/.codex/worktrees/paul-loop-lesson-id/paul-loop` is detached
  at the merge. The canonical main checkout was not modified; prior untracked audits remain intact.
- Remote tags `loop-engine--v0.15.20` and `loop-memory--v0.8.2` both match the merge exactly.
  Ship-flow remains 0.11.7. No consumer installation or memory configuration was changed.
- [Post-merge workflow](https://github.com/reach0908/paul-loop/actions/runs/36331740093)
  succeeded: 9 successful jobs; the PR-only pinned review was intentionally skipped on main.
- [#86](https://github.com/reach0908/paul-loop/issues/86) closed on merge. Its creation-mode scope
  and exclusions remain those in the [metadata audit](2026-09-27-private-metadata-artifacts.md).

## Existing #85 gate

[#85](https://github.com/reach0908/paul-loop/issues/85) describes a missing comparison between
the committed memory bundle and rebuilt source. The current workflow already runs `npm run build`
then `git diff --exit-code -- dist/cli.js` at `.github/workflows/loop-memory-test.yml:44–47`.
Both steps succeeded in [the merged commit's memory job](https://github.com/reach0908/paul-loop/actions/runs/36331740093/job/108654867582).

A disposable Git repository used this exact source's memory package and engine library dependencies,
Node 22, fixture-only HOME and `npm ci`. It ran the workflow's real build and diff commands:

| Case | Observed gate exit |
|---|---:|
| Unmodified committed bundle, rebuilt from source | 0 |
| Dist-only comment added and committed, then rebuilt from unchanged source | 1 |
| Source-derived bundle committed as repair, rebuilt again | 0 |

The initial fixture omitted the imported engine library and failed before the gate. Its logs are
retained as a preparation failure; the corrected fixture reran all three cases. The source-derived
bundle was byte-identical, and temporary repositories were removed. No product source, verifier,
workflow or dependency was edited. No new code or release is needed to satisfy #85.
The existing issue was closed as completed at `2026-09-27T16:19:11Z`; the remaining open issues
at read-back were #35 and #87. No issue comment was sent.

Private evidence: `.loop/release-closeout-2026-09-28/` contains the release receipt, runnable fixture
check, original preparation-failure logs, build/diff logs and `bundle-drift-receipt.json`.
This checks bundle drift with an unchanged trusted workflow; it is not a claim that arbitrary
workflow/build-script modifications or all supply-chain threats are prevented.

## Remaining work

1. **#35: actual memory hook activity and usefulness.** Provider tests and fail-open liveness are
   already covered. Qualify a real native session's hook events, then measure useful recall on
   real repeated failures. Keep file lessons as the small default; DB activation and consumer
   configuration changes require their own scoped work.
2. **#87: publisher execution qualification.** Routing/context/availability changes are shipped,
   but prior native observations did not prove Git publication under the required role and
   permission boundary. Continue only when the host exposes the necessary capabilities; a stdout
   marker or ordinary parent Git push cannot substitute for this evidence.

Prefer those bounded observations over additional speculative harness code. This local closeout
record does not itself create another PR or trigger another release.
