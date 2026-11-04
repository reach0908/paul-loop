# Dependabot updates: review and deployment

Current status (2026-09-23 07:53 UTC): the user merged all four PRs; GitHub confirms MERGED and no open PRs. The first publication run succeeded; final-main publication validation is QUEUED. The initial execution blocker below is historical, not the current merge state.

Authorization: the user explicitly requested merging all four reviewed update PRs and deploying on 2026-09-23. Scope is `reach0908/paul-loop` PRs #115–#118 into main and their dependent publication validation. Consumer installations, optional memory infrastructure, unrelated backlog changes and protection bypasses are excluded.

Initial base: `3cbbe01400ca8faf7503d3de48dc42ee3718b9d9`. Every external action remains pinned to a full commit. Plugin versions and payloads are unchanged.

| PR | Initial reviewed head | Change | Initial PR CI | Initial merge attempt |
| --- | --- | --- | --- | --- |
| [#115](https://github.com/reach0908/paul-loop/pull/115) | `821b77be76aba97f39ce622b15cbddfc47f3e796` | gitleaks action `ff98106e4c7b2bc287b24eaf42907196329070c7` | 10/10 SUCCESS | Merge blocked before execution; OPEN |
| [#116](https://github.com/reach0908/paul-loop/pull/116) | `473d16867eb58fdc726b24231533882d52284fd8` | upload-artifact 7.0.1 | 10/10 SUCCESS | Not attempted; OPEN |
| [#117](https://github.com/reach0908/paul-loop/pull/117) | `3dcf0f53bd5da35e542f4419410b5060550301b3` | setup-node 7.0.0 | 11/11 SUCCESS | Not attempted; OPEN |
| [#118](https://github.com/reach0908/paul-loop/pull/118) | `373a15d545c65ab807ecb0b8735b8c6307cd611d` | checkout 7.0.1 | 11/11 SUCCESS | Not attempted; OPEN |

## Compatibility review

- Official tag APIs match proposed checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node `820762786026740c76f36085b0efc47a31fe5020` and upload-artifact `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`.
- [Checkout](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/README.md) moves credential storage under runner temporary files while preserving ordinary shell Git authentication. Its new fork restrictions concern events this repository does not use. Six read-only opt-outs and the tag publisher's persistence remain explicit.
- [Setup-node](https://github.com/actions/setup-node/blob/820762786026740c76f36085b0efc47a31fe5020/src/main.ts) uses a newer action runtime while preserving the requested Node 22/24 test matrix. Its automatic npm cache reads the workspace root package.json, which this repository does not have.
- [Upload-artifact](https://github.com/actions/upload-artifact/blob/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/action.yml) retains archive=true, compatible with the existing directory, hidden-file and retention inputs.
- The [proposed gitleaks source](https://github.com/gitleaks/gitleaks-action/blob/ff98106e4c7b2bc287b24eaf42907196329070c7/src/index.js) handles the relevant push/PR/manual events and preserves nonzero leak/error results. **The old pin is not available from the official commit API (422), and compare returns 404. An old-to-new upstream diff was not verified.** Proposed source/API identity and successful hosted scan are the available evidence.

Independent `code-review`: Standards 0 actionable findings; Spec 0 actionable findings, all four PRs reviewed against the listed heads. Existing verifier definitions, permissions, event SHA and release dependencies are unchanged. No duplicate local full suites were run for these already tested, unchanged PR heads. Each future merged combination still needs the repository's hosted release validation.

Risk classification for merging #115 is REQUIRE due to unresolved command dimensions; the user's explicit merge/deploy authorization supplies the required approval. Each subsequent command and current PR head will be checked before execution. No execution denial may be bypassed.

## Execution blocker

The approved command `gh pr merge 115 --repo reach0908/paul-loop --squash --match-head-commit 821b77be76aba97f39ce622b15cbddfc47f3e796` was rejected before execution by PreToolUse:

> [gate-risky-commands] classify-risk failed to produce a verdict (status=2) — the surface is already confirmed, so this fails closed.

The installed source is `~/.codex/plugins/cache/zine-codex/loop-engine/0.15.0+zine.1/`. Read-only diagnosis found that its hook always supplies the absent `risk-rules.json` to `--rules`; directly invoking only the classifier reproduced exit 2 and the missing-file message. No merge was performed by that diagnostic command.

There is also a separate host limitation: installed `runtime/hook-adapter.mjs:32-35` changes hook `ask` to `deny` and records no approval. The provider fix already documented in `2026-09-23-risk-gate-defaults.md` preserves this boundary. Updating the install alone therefore does not establish a supported automatic merge route. The enabled installation is from the local Zine marketplace; replacing it would also affect a separate consumer configuration.

Read-only GitHub verification after rejection found all four PRs OPEN, #115 mergeCommit null and mergedAt null. No alternate tool, configuration edit, guard disablement or retry was used to bypass the rejection. A human merge through the normal GitHub UI is the remaining execution step; then check each actual merge SHA's publication workflow. No new deployment was started by this task.

Machine-readable receipts and official source excerpts are kept locally under `.loop/dependabot-release/`. At this initial observation merge/deployment were blocked; review and PR CI success were not release completion.

## User merges and Actions audit

GitHub confirmed the following subsequent merges on 2026-09-23:

| PR | Merge SHA | Merged at UTC |
| --- | --- | --- |
| #115 | `300f4aaf395dc32cff04b516af48019fde5f28ad` | 07:47:20 |
| #116 | `71d84a08d31aa1492dd096667858ab944355eeac` | 07:47:32 |
| #117 | `d64c9c10685d3cf6875e1e520650fe19388efbed` | 07:47:43 |
| #118 | `c38b5754bbb376ef329456ca83514b65006761e1` | 07:47:52 |

These four merges in 32 seconds triggered 18 top-level workflow runs (4, 4, 5, 5). This count excludes reusable jobs expanded inside a workflow and preceding PR runs. The engine, runtime, memory and gitleaks validators each have both a standalone main-push trigger and a workflow_call entry; tag-on-publish calls all four again for the same SHA.

For a main push matching the memory path filter, the declared jobs expand to 9 standalone validations plus 9 identical release validations and 1 tagging job: 19 executable jobs, excluding PR-only skipped checks. Keeping the release invocation and removing standalone main-push triggers would retain all validation types with 10 jobs, about 47% fewer jobs. This is a configuration count, not a measured wall-time or billing saving. Linux/macOS and Node 22/24 coverage should remain.

Publication has `concurrency.group: publish-main`, `cancel-in-progress: false`. Intermediate runs [35833583067](https://github.com/reach0908/paul-loop/actions/runs/35833583067) and [35833599173](https://github.com/reach0908/paul-loop/actions/runs/35833599173) were cancelled while pending. The initial run [35833567450](https://github.com/reach0908/paul-loop/actions/runs/35833567450) subsequently succeeded; final-main run [35833614190](https://github.com/reach0908/paul-loop/actions/runs/35833614190) advanced from pending to queued at the latest observation. This matches GitHub's [default single-pending concurrency behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency); cancellation is not a successful validation or evidence of a test failure. The saved 18-run snapshot contains 13 successes, 2 in-progress runs, 1 queued run and 2 cancellations; no failure was observed in that snapshot.

Remote tags were checked again and are unchanged: engine 0.15.7 → `3714090cddbc0a9b94ce664859709a665ef1912d`, ship-flow 0.11.3 → `16e2e90eec550f680fb88d5585050cf48f698b45`, memory 0.7.0 → `d2d78c6ac91b9dc76fc5c387d01cc4fdea15847b`. These PRs changed only action pins in five workflow files. A successful tagging job is therefore expected to skip existing tags; no new plugin version or tag movement is warranted. Final-main validation completion has not yet been observed.

Recommended next slice: remove duplicate main-push validation, preserve PR and same-SHA release checks, and handle [#101](https://github.com/reach0908/paul-loop/issues/101) by separating moving Claude compatibility checks from pinned release validation. PR concurrency may cancel superseded PR runs but must not collide with reusable release jobs. Investigate filtering title/body-only `edited` events without losing base-retarget verification. Dependabot currently has only a weekly schedule; native [update groups](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups--) can reduce compatible update PRs, while major updates still need explicit compatibility review.

After CI simplification, prioritize [#96](https://github.com/reach0908/paul-loop/issues/96) (protected secret-scan policy), then the original effectiveness questions: matched native workflow comparisons and actual memory recall/use evidence under [#35](https://github.com/reach0908/paul-loop/issues/35). Ten open issues are not ten missing implementations: #85's dist rebuild comparison already exists. This turn audits and records status only; no workflow changes, run cancellations, consumer installation changes or memory activation were performed.
