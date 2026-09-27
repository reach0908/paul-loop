# Publisher availability lookup — 2026-09-27

Bounded follow-up to [issue #87](https://github.com/reach0908/paul-loop/issues/87) and the
[publisher context observation](2026-09-27-native-git-routing.md). The requested improvement is to
stop searching other worktrees and installed caches when the publisher role is not registered.
This does not close the issue's outstanding real Git execution qualification.

## Change

Source candidate: `a3e10820558aea0109bf13b818a56fa76036da08`, based on released
`c7dbdd269a0d29e270d155022e8fd8234d662544` (ship-flow 0.11.6). Proposed version: **0.11.7**;
loop-engine remains 0.15.13 and loop-memory remains 0.8.0.

The existing publisher instructions and ship-feature caller now resolve availability from exposed
host roles or the active registry, with at most one scoped host-native lookup when needed and
available. Missing or unknown availability is BLOCK. Filesystem hunts, speculative spawns and
installation/configuration changes are not recovery paths. A template file is not registration.
The existing context, role, permission and authorization checks still apply to available roles.
No new runtime helper, discovery service or consumer installation change was introduced.

## Native observations

App Codex CLI **0.155.0-alpha.16.4**, model **gpt-6-luna**, effort **xhigh** were configured and
observed in native contexts. Each run used the existing native adapter, a disposable fixture and
temporary CODEX_HOME. Only the registered-role cases copied the generated publisher template
into that temporary profile. The payload was one literal stdout command, not real publication.
The shared native case budget used **486,194 / 600,000 ms**, including the timed-out attempt.

| Case | Observed result | Wall time |
|---|---|---:|
| Released 0.11.6, role missing | BLOCK, no spawn or inline marker; searched the user Codex tree/config and provider files | 87.080 s |
| Candidate, role missing | BLOCK, no spawn or inline marker; no other-worktree/cache hunt, but local file discovery was bundled with the initial skill read | 81.095 s |
| Candidate, role registered | Dedicated publisher, `fork_turns="none"`, child marker exit 0; parent exceeded deadline, so overall **INCOMPLETE** | 179.810 s |
| Candidate, ordered instruction loading, role missing | BLOCK; only the requested files were read, then exposed tool metadata and one live-agent listing were inspected; no filesystem discovery or spawn | 41.309 s |
| Candidate, ordered instruction loading, role registered | Dedicated publisher, `fork_turns="none"`, child marker exit 0 and parent completion | 96.900 s |

The first missing-role candidate did not fully follow the no-repository-discovery instruction:
it scheduled a local file search before seeing the skill's contents, and later enumerated the
whole tool inventory. Preserve this as partial compliance, not proof of the entire lookup policy.
The ordered follow-ups explicitly required the initial handoff/skill reads to finish before deciding
discovery or execution steps; they did not add the new availability/search policy to the prompt.
The registered-role follow-up also corrected the fixture's gate description to acknowledge its
untracked `handoff.json`; the earlier fixture incorrectly described the worktree as clean.

The ordered missing-role run's `list_agents` result describes live agents, not an authoritative
registration registry. It did not establish role availability, and the caller correctly remained
blocked. The successful registered-role trace binds the spawn to `agent_type=publisher`, its
`fork_turns=none` argument, the publisher child session, actual `workspace-write` context and
the command/output pair. The marker was exactly `PUBLISHER_FIXTURE_OK` followed by a newline.
Fixture HEADs and handoff bytes were preserved; registered-role temporary profiles were removed.

These are individual routing observations, **not a speed benchmark or enforced security boundary**.
The ordered prompts differ from the initial runs. Parent catalogs contained 32 skills; publisher
children contained 143, so child catalog isolation remains incomplete. Parent stdout token counts
exclude child usage and are not total cost. There was no real push, PR, merge, deployment or send in
these fixtures. Claude-native behavior was not measured. Existing Git-write denials were not retried.

## Verification and review

- Publisher packaging regression: initial missing-contract failure retained. The first post-edit
  run exposed a newline-sensitive assertion; using whitespace-tolerant matching retained the
  requirement and passed. Existing history, permission and discovery assertions remain intact.
- Installer suite: **87 PASS, 1 opt-in CLI-ingestion SKIP**. The initial command also named two
  nonexistent test paths that Node did not execute; that result only covers the installer suite.
- Native adapter suite: **23/23 PASS** using `scripts/native-eval/native.test.mjs` explicitly.
- Complete engine suite: **81/81 PASS**, including runtime-package and release-version checks.
- Generated candidate packages and `--check`, vendor lock check and strict Claude marketplace/
  ship-flow manifest validation passed. No loop-memory source or built distribution changed.
- Code-review skill, fixed diff `c7dbdd2...a3e1082`: **Standards: 0 findings; Spec: 0 findings**.
  Separate reviewers checked the bounded issue requirements and repository contracts; this was
  general code review, not an independent security assessment.

[Structured evidence](2026-09-27-publisher-capability-evidence.json) records source/template hashes,
actual contexts, call IDs, process outcomes, usage and raw-artifact SHA-256 values. Raw transcripts
and test logs remain private under `.loop/native-eval/publisher-capability-2026-09-27/`; baseline
filesystem/config output is deliberately not copied into this audit. Evidence extraction checked
parseability, model, fixture preservation, missing-role non-execution and child command bindings.
Local verification, hosted CI, merge, release and consumer activation are separate states.
