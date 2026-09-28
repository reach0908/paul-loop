# Plugin integrity: host `.in_use` marker

Observed: 2026-09-28–29 KST, while setting up a consumer repository (`paul-stack`) with
`/paul-loop:setup`. Source base: `56d19e9` (paul-loop 0.3.0).

## Symptom

In a live Claude Code session, the unified launcher's `doctor` and `exec` fail with
`plugin integrity mismatch` for an untouched marketplace installation. The consumer therefore could
not set `pluginBinPrefix` to `node tools/paul-loop.mjs exec bin/`.

## Cause

Claude Code writes `<cache>/.in_use/<pid>` into the installed plugin cache while a session uses the
plugin. `pluginInventory` (identical block in `scripts/project-plugin.mjs` and
`tools/loop-engine/bin/plugin-path.mjs`) hashes every file below the artifact root, including that
marker, so no reviewed pin can match a cache that is in use.

## Change

`pluginInventory` skips the `.in_use` entry at the artifact root only. The skip happens before
`lstatSync`, so the marker's type or mode cannot throw either.

- A nested `.in_use` (for example `bin/.in_use/<pid>`) is still inventoried, so it still fails integrity.
- `exec` stays confined to the engine's `bin/` directory (`tools/loop-engine/bin/` in the unified
  plugin): `scripts/project-plugin.mjs` checks this with `inside(bin, executable)` after
  `realpathSync`, and `plugin-path.mjs` rejects targets outside `bin/`. So a file placed under the
  skipped root marker cannot be executed through the launcher.
- Skill, agent and hook files remain covered.

## Evidence

| Check | Result |
|---|---|
| New test `the host in-use marker at the plugin root is outside approved contents; nested markers are not`, before the change | fails: `loop-engine: plugin integrity mismatch` |
| Same test after the change | passes |
| Read-only check of the real installed cache `~/.claude/plugins/cache/paul-loop/paul-loop/0.1.0` (with `.in_use/41485`, `.in_use/582` present) against the pin reviewed from a clean checkout of `51731b70d6a6241e971d90f232ea78d997da2647` (`sha256 84daf7f1…e920`) | base launcher: `plugin integrity mismatch`; changed launcher: match |
| Node 22.14 (`cbc68c9` tree) | `plugin-path`/`apply-patch-runtime`/`runtime-packages` 38/38; `project-plugin`/`install-codex`/`unified-plugin`/`native` 138 pass, 1 skipped, 0 fail; skill lock and runtime package generate/check pass; `claude plugin validate --strict .` passes; engine suite 86/86 |

## Not done

- No consumer installation, lock or `pluginBinPrefix` was changed.
- A consumer can adopt the fix only after this change is merged and its launcher is copied from the
  merged commit. A released and updated plugin needs pins regenerated from that release's clean
  checkout.
