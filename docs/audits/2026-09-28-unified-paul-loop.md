# Single-install Paul Loop candidate

User request: replace the three marketplace installations and separate ship-flow invocation with
one Paul Loop installation and entry. Base: `faaed5711f864555a32181011840dea244c9e964` (#139).
See [ADR-0009](../adr/0009-single-paul-loop-installation.md) and the
[migration instructions](../unified-installation.md).

## Acceptance criteria

1. Both runtime marketplaces expose one `paul-loop` plugin containing the existing modules.
   Claude public namespaces are `paul-loop:`; Codex discovers the `$paul-loop` entry skill.
2. The entry selects the smallest appropriate procedure. Existing required verification, explicit
   publication authority, manual-only skills and native publisher isolation remain intact.
3. Bundling optional memory does not activate it, read prompts/credentials or write memory telemetry.
   Explicit opt-in is still subordinate to `LOOP_MEMORY_OFF=1` and existing database authorization.
4. One independently reviewed bundle pin covers all nested modules. Tampering fails closed.
   Existing split installations remain resolvable; mixed bundle/module approvals are rejected.
5. Installation refuses active/unknown legacy Codex modules before changing the host. Migration
   preserves `.loop/`, existing config paths, explicit hook trust and old ownership receipts.
6. Provider implementation does not mutate consumer caches, enable services or change old tags.

## Implementation and compatibility

Reuse all three module trees, hook programs, project launcher and existing runtime conversion.
A small root hook dispatcher sets module paths and gates optional memory. Generated Codex entry
skills link to the existing module resources. Internal module versions remain compatibility
identities; the new public package versions the whole release. Source-root changes after publication
require a public version bump. Copied legacy CI actions keep their previously approved module tags.

[Claude's official plugin reference](https://code.claude.com/docs/en/plugins-reference) documents
custom skill directories and explicit agent file paths, used by the source-root package. Codex
uses root `skills/` discovery and the native manifest validator. Existing source `CLAUDE.md` moves
to `.claude/CLAUDE.md` with the same project instructions so it is not an ignored root plugin file.

## Verification record

Work in progress; results below are bounded local evidence, not merge, deployment or consumer use.

- Initial complete installer/runtime test run: 94 passed, 4 failed, 1 intentionally skipped.
  Failures were stale split-package fixture paths and the last-observation location after reducing
  three installs to one. Corrected fixtures retain mode/hash/activation and rollback assertions.
- Repeated complete installer/runtime run: 98 passed, 0 failed, 1 intentionally skipped native test.
- Initial unified behavior regression: 2 passed, 1 failed. The guard fixture incorrectly used
  `git reset`; changed to the actual protected `gh pr merge` operation, preserving guard behavior.
  Repeated unified behavior regression: 3 passed.
- Existing project launcher, native evaluation helpers and path resolver: 62 passed.
- Codex native manifest validator and source Claude strict manifest validator: passed.
- Source integrity regression now exports the complete tracked root and checks it against the
  independent source pin, including rejection of root-hook tampering. The previous subtree-only
  positive assertion no longer represents the public source artifact.
- Publish-freshness normalizes source `./` to Git pathspec `.`; no released files are excluded.
- Complete engine and memory suites, integrated tests, native ingestion and independent review:
  pending at the time of this entry; append their actual results before publication.

Initial/repeated logs remain under the ignored `.loop/unified-*.log` in the implementation worktree.
No claimed memory efficacy, model-quality or native publisher Git qualification. Issues #35 and #87
retain their separate completion criteria. Consumer migration and final release are pending.

## Integrated verification and review follow-up

- First complete engine run: **84/86**, with real failures in custom resource discovery and the
  new router's output-language anchor. The missing-anchor prose and scanner are fixed; the
  complete run is repeated without narrowing the suite. The fixture-internal mktemp failure is
  an expected negative control, not a third failing suite.
- Scanner now follows manifest-declared skill directories and individual agent files. Existing
  missing-reference, empty-scan and isolated real-source red/green assertions remain.
- Standards review: four findings (tag root path, scope precedence, lost adapter diagnostic,
  memory-off dotenv read), all implementation fixes accepted on recheck. A subsequent test-spy
  gap was corrected by observing `openSync`, including an enabled positive control.
- Spec review: four findings (tag root path, memory reads, Claude native evaluation paths,
  scope precedence), all resolved on independent recheck. Reviews inspected source; they do not
  attest native sandbox restrictions.
- Actual tag-producer regression first failed on `/.claude-plugin/plugin.json`, then passed
  after root normalization. Existing idempotence, missing-plugin and immutable-tag checks remain.
- Integrated resolver/unified/native-evaluation tests: **42 passed**. Earlier launcher/runtime
  integration: **54 passed**. Workflow action checks: **5 passed**.
- Memory: `npm ci`, typecheck, **175 passed / 2 skipped**, and build passed; `dist/cli.js` unchanged.
- Official Codex CLI **0.146.0** in disposable HOME/CODEX_HOME: single installation, update with
  backup and idempotent replay passed; actual list contains only `paul-loop@paul-loop-codex`.
- Official Claude CLI **2.1.282** in disposable HOME/CLAUDE_CONFIG_DIR: single native installation
  passed and actual installed file bytes/modes match the independently generated source pin.
  An initial comparison used a build predating local edits and failed; regenerating the complete
  build before exporting the same snapshot restored exact parity. No pin was derived from cache.
- Native ingestion exercises installation only; no model turns, hook-trust approval or consumer
  profile changes. Direct hook tests verify the generated command's behavior separately.

The existing pinned-base gate still compares old test expectations with this deliberate public
package/namespace change. Preserve its actual outcome; never suppress failures or make old-shape
checks pass by shipping duplicate install units. Document any incompatible expectations in the PR
for human review, as the unchanged verifier-pinned-review contract requires.

## Final local outcome

- Complete engine suite: **86/86 passed** after the two fixes. The initial **84/86** result is retained.
- Complete installation/project/native-helper/unified set: **137 passed, 1 skipped**. The skipped
  official Codex ingestion test was separately opted into and passed with the real CLI.
- Complete portability command (resolver, apply-patch adapter, package contracts): **37 passed**.
- Runtime regeneration/check, skill lock, native plugin/marketplace schema validation and skill
  validation passed. Final wording-only edits replace the remaining active split-install names;
  their vendor hashes and generated packages are refreshed.
- Credential-open regression: observing `openSync()` passes with memory off on this candidate;
  replacing only the disposable fixture heartbeat with its prior ungated implementation produces
  the forbidden credential-open event. The enabled positive control also observes that event.

### Standards

0 remaining actionable findings after the implementation and regression-test rechecks.

### Spec

0 remaining actionable findings after recheck. Independent reviews did not execute native model
sessions or attest host sandbox enforcement.

### Pinned-base contract change: FAIL retained

`verifier-pinned-review.sh --base faaed5711f864555a32181011840dea244c9e964` finished **83/86**, exit 1.
Three shell suites retain incompatible pre-unification expectations:

| Frozen suite | Old expectation | Candidate behavior / preserved coverage |
|---|---|---|
| `check-skill-refs.test.sh` | Fixture copies only default `skills/`, `agents/`, `workflows/` | Manifest-declared resource paths; real-source copied closure still fails on a missing handoff and recovers without touching source |
| `runtime-packages.test.sh` | Split plugin output paths and `sourceVersions` for modules | One public package/version plus internal component versions; full package/source pin, mode, hook deny, role isolation and embedded-contract assertions remain |
| `ship-flow-executable-contract.test.sh` | Public review agents must use `ship-flow:` | User-requested `paul-loop:` namespace; shipped/invoked roles and all remaining executable/language/publication assertions retained |

The unchanged gate says: “If this failure is an intended behaviour change, say so explicitly in the
PR description — a human must sign off on it.” These are deliberate public installation/namespace
contract changes. They are documented in **PR #140**, which remains Draft for that review. The gate
is not weakened, rerouted or relabeled PASS. No merge, new release tag or consumer migration occurred.

Hosted CI at implementation commit `8be3b6043ba6a075971f6b3e31b044af20fbd343` confirmed all four
Linux/macOS Node 22/24 portability jobs, Claude 2.1.261 schema, memory, gitleaks and GitGuardian.
Engine/pinned-base hosted jobs were still running at this snapshot; their eventual result is not
inferred from local evidence. Final documentation commit CI must be checked separately.
