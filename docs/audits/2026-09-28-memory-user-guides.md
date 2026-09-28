# Paul Loop user and memory activation guides

Request: explain how to activate memory and provide a complete README/user guide after unification.
Base: `865e2ac626a69b99bf4226eb3ce826b0abe7a5de`, existing draft PR #140.

## Scope

- README starts with the installation/use/memory path and links to Korean guides.
- General guide covers host choice, project verifier/lock, ordinary requests, updates and migration.
- Memory guide distinguishes file lessons from semantic memory and documents the actual sequence:
  dedicated DB, migrations, OS-user authorization, credentials/signing, canonical sync, opt-in,
  liveness/manual checks, disabling and error diagnosis.
- Commands distinguish provider bootstrap checkout from verified installed runtime and consumer
  canonical checkout. They preserve existing config/data and keep desktop process inheritance,
  optional knowledge-source support, worktree receipt limits and external embedding effects explicit.

No installed cache, host setting, credential, DB authorization, service or consumer repository is
changed by preparing these guides. No real embedding calls or database provisioning is part of this
verification. PR #140 remains subject to its documented pinned-base contract review.

## Verification

- 58 local Markdown references resolve; 12 shell/JSON/dotenv examples pass syntax checks.
- The bundled CLI was exercised in a disposable directory with no credentials: empty liveness is
  valid JSON, its assertion fails without recall events, memory-off rejects graduate/recall/stats,
  learning-off rejects graduation, and missing embedding credentials fail before DB access.
- `node scripts/refresh-skill-lock.mjs --check` passes.
- `node scripts/generate-runtime-packages.mjs` and its `--check` pass. All 14 new guide links in the
  generated Claude/Codex README and HARDENING files use canonical repository URLs whose source
  documents exist; public `main` links require this PR to merge before publication.
- `git diff --check` passes. No runtime logic changed and no new test framework was added.

The offline checks validate documented inputs and failure boundaries, not database provisioning,
external API success, desktop activation, retrieval quality or measured usefulness. Existing PR #140
runtime evidence and its unresolved pinned-base contract gate remain in the preceding audit; this
addendum does not relabel that gate as passing.

## Standards

Independent read-only `code-review` review: no actionable findings. The documented sequence preserves
opt-in, DB authorization, credential precedence, canonical-write boundaries and disable semantics.

## Spec

Independent read-only review found one P2: generated packages omit root documentation, so the new
relative guide links would be broken in installed README/HARDENING files. Changed these to canonical
repository URLs and regenerated both packages. Focused re-review: zero remaining findings.
