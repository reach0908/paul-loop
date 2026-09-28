# One Paul Loop installation

`paul-loop` 0.1.0 replaces the three public install units. Engine, delivery and memory stay under
`tools/` as implementation modules. The marketplace offers one plugin and one release version.

| Runtime | Install | Main entry |
|---|---|---|
| Claude Code | `claude plugin install paul-loop@paul-loop` after adding `reach0908/paul-loop` | `/paul-loop:paul-loop` or “폴루프로 이 작업 진행해줘” |
| Codex | [Generated local marketplace installer](codex-installation.md), which adds only `paul-loop@paul-loop-codex` | `$paul-loop` or the same natural-language request |

Claude skill and agent names now use `paul-loop:`. The main entry chooses the smallest appropriate
procedure; it does not load every skill, demand setup for a local edit or automatically start a loop.
The established `.claude/ship-flow.config.json` remains a compatibility path. Keep its verifier,
tracker, branch and language values; a branding change does not require moving user data.

## Existing installations

This provider change does not modify installed caches, project settings, agent roles or hook trust.
Plan a migration in the intended project and host scope:

1. Inspect the host's installed-plugin list, enabled scopes, project lock and any manually configured
   hooks. Preserve the existing configuration and `.loop/` artifacts for rollback.
2. Explicitly disable the old `loop-engine`, `ship-flow` and `loop-memory` installations that apply
   to that session, including project derivatives such as `zine-codex`. Review manually configured
   hooks too. Never leave old and unified hook sets enabled together. Do not delete caches by hand.
3. Refresh the intended marketplace and install the one `paul-loop` plugin. For an old generated
   Codex marketplace, preserve its owned directory/receipt and explicitly resolve the old LOCAL
   registration before choosing a fresh destination; the installer does not silently adopt or
   convert the old three-plugin ownership record. It refuses enabled/unknown legacy modules.
4. Review/copy the new `scripts/project-plugin.mjs` launcher and replace the project lock with
   **one** `paul-loop` entry, using the exact version and complete independently reviewed bundle pin.
   Back up or explicitly replace the old generated registry; `sync` is not a lock migration.
   Mixed bundle/module locks are rejected. See [the lock format](project-installations.md).
5. Keep the project's configured launcher prefix, such as `node tools/paul-loop.mjs exec bin/`.
   The engine's nested `bin/` is not automatically on PATH. Run `doctor`, the real project verifier
   and a fresh host session to check actual loading and hooks. Role-template registration and
   permissions still need the existing separate review.

Existing split installations and copied CI actions continue using their previously pinned releases
until explicitly migrated. Old tags remain unchanged. `update --approved-lock` intentionally keeps
plugin identities stable, so it cannot perform the three-to-one identity migration for you.

## Optional memory

Follow the [memory activation and operations guide](memory-guide.md) for the ordered DB/schema,
authorization, key, synchronization, host opt-in and verification steps. For general use, start with
[the user guide](getting-started.md).

File lessons need no service. For semantic memory, deliberately configure the user-owned database
authorization, embedding provider and signing key, then enable `memory_enabled` in the Claude plugin
configuration or supply `PAUL_LOOP_MEMORY=1` in a Codex session's environment. Merely having an API key
does not opt in. `LOOP_MEMORY_OFF=1` always disables it. The installer never starts a service or changes
the existing memory store. Prior `loop-memory` plugin options are not automatically copied to the new ID.

Installing one package is not proof of memory usefulness or native publisher isolation. Those
remaining evaluations retain their own completion criteria.
