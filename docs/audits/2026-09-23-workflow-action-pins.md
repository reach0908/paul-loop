# Workflow action pins — issue #100

Base: `3714090cddbc0a9b94ce664859709a665ef1912d` (PR #113 merged).
Scope: [#100](https://github.com/reach0908/paul-loop/issues/100), provider CI and release workflows.

## Acceptance criteria

1. Every external `uses` entry in `.github/workflows` resolves to a full commit SHA. Existing local reusable workflows remain local.
2. Keep the currently resolved v4 action implementations, recording their official release versions. No unrelated major upgrade.
3. Disable checkout credential persistence in read-only jobs. Preserve authenticated tag publication, validation dependencies, event SHA and token permissions.
4. Propose future GitHub Actions updates through weekly Dependabot PRs for review; no automatic merging.
5. Leave a runnable check that rejects a mutable action reference; preserve existing release behavior tests and pinned-baseline verification.

## Implementation and sources

Official repository commit and tag APIs were checked on 2026-09-23:

| Action | Release | Full commit |
| --- | --- | --- |
| [actions/checkout](https://github.com/actions/checkout/commit/11d5960a326750d5838078e36cf38b85af677262) | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` |
| [actions/setup-node](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020) | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| [actions/upload-artifact](https://github.com/actions/upload-artifact/commit/ea165f8d65b6e75b540449e92b4886f43607fa02) | v4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

The existing gitleaks action pin is unchanged. GitHub recommends [full commit pins](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions) and supports [Dependabot updates for Actions](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/auto-update-actions).
[Checkout's documented persistence option](https://github.com/actions/checkout/blob/11d5960a326750d5838078e36cf38b85af677262/README.md) allows all six read-only checkouts to opt out. The sole write-capable tag job retains persistence explicitly for its existing `git push`.

No plugin subtree or version changed; this is provider infrastructure. The npm `latest` schema canary remains the separate issue #101. Consumer setup references remain issue #99.

## Verification

- New `node --test scripts/workflow-actions.test.mjs`: RED before the workflow edits (`actions/checkout@v4`), GREEN after pinning.
- Existing tag publication sandbox: PASS, including publishing all manifest plugins, preserving existing tags, idempotence and missing-plugin failure.
- Existing workflow interpreter-injection check: PASS across all five workflows.
- Ruby's standard YAML parser: all five workflows and Dependabot config parse; parsed assertions confirm six persistence opt-outs and only the tag publisher retaining it.
- Runtime generation/check, skill lock and strict source/generated manifest validation: PASS.
- Full engine suite: 81/81 PASS, exit 0 (`.loop/action-pins/engine-full.log`). The optional BAC-580 memory probe reported SKIP because this checkout lacks tsx; it is not counted as live memory evidence.
- Pinned-baseline review against `3714090cddbc0a9b94ce664859709a665ef1912d`: PASS, exit 0 (`.loop/action-pins/pinned-full.log`). Existing test files are unchanged.
- Independent `code-review` on `3714090..794991a`: Standards 0 findings, Spec 0 findings. Both reviewers independently confirmed the official action refs and preserved release contracts.

The new check covers this repository's block-style `uses` entries, not every YAML spelling or malicious edits to CI itself (ADR-0002). GitHub-hosted action execution, authenticated tag publication with these pins, and actual Dependabot PR creation require their corresponding hosted runs; local checks do not prove them.

Authorization: continuing the user's provider improvement and publication request. Implementation classifier returned AUTO for these nine paths. Publication classifier returned REQUIRE because command dimensions have no matching rule; the existing user instruction to continue provider improvements and publish covers this branch/PR. Merge remains the user's per-PR decision. No consumer installation, memory infrastructure activation, branch-protection change or gate bypass is included.
