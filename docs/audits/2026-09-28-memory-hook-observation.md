# Native memory hook observation and next evaluation

Date: 2026-09-28 KST. Related: [#35](https://github.com/reach0908/paul-loop/issues/35).
Provider source: `ec54a02254b8aa4c580f81b48f9161aa0bf6039a`.
Versions: engine **0.15.20**, memory **0.8.2**, ship-flow **0.11.7**, unchanged by this work.
Machine-readable counts and private trace hashes: [evidence](2026-09-28-memory-hook-evidence.json).

## Question and acceptance

Distinguish native hook execution, a self-gated hook, actual retrieval, and useful reuse. Confirm
execution with native events and local records rather than calling the hook directly or trusting
a successful model response. Preserve absent/incomplete evidence, disabled behavior and consumer
configuration. No DB activation or forced install is part of this provider investigation.

## Native observations

Claude Code **2.1.212** authenticated through its normal first-party route. Each case used a fresh
disposable Git root, no target tools, no session persistence, no user/project settings sources,
no MCP servers and disabled native auto memory. Generated provider packages were passed with
`--plugin-dir`; no plugin install/enable command changed consumer settings. Embedding keys were
explicitly empty and the dotenv path pointed to a nonexistent fixture file.

Existing `safeEnv`, `bounded`, JSONL parsing and hashing helpers were reused. The generic adapter
keeps memory/learning/recall-only switches off and therefore cannot observe memory bookkeeping.
Only the active fixture invocations removed those three switches. A shared **180,000 ms** ledger
covered all six model invocations and their bounded wrapper setup, with **21,189 ms** consumed.
Preliminary read-only CLI inspection was outside this model-execution allowance. Every model
invocation had a 60-second deadline and a $1 command cap. Raw model labels were `claude-opus-4-8[1m]` in initialization and
`claude-opus-4-8` in assistant events; the evidence retains both, rather than inventing one exact ID.

| Fixture setup | Native result | Interpretation |
|---|---|---|
| Memory directory alone, default activation, active/off variants | Both turns completed; plugins empty; no hook events or memory ledger | Incomplete hook qualification; turn success is insufficient |
| Explicit `loop-memory@inline` enabled, dependency absent, active/off variants | Plugins empty; native debug reports missing `loop-engine` dependency | Correct the fixture loading conditions, not the hook implementation |
| Explicit memory enabled, both engine and memory directories, no keys | Both plugins loaded; SessionStart and UserPromptSubmit hook responses exit 0; SessionEnd debug completion exit 0 | Native hooks executed in a controlled real CLI session |
| Same two plugins, memory/learning/recall-only off switches restored | Native hooks execute; engine start/end records remain; zero memory records | Bookkeeping suppression, not proof that hooks never fired |

The active two-plugin session produced exactly **three memory records**: graduation at SessionStart,
recall at UserPromptSubmit, and graduation at SessionEnd. All were `skipped/no_embedding_key`;
recall injected zero characters. SessionEnd was not in the streamed hook events, so its evidence is
the native debug completion plus the matching session ledger. Trace IDs, event types, source paths,
exit codes and file hashes are retained privately. All six sessions completed without parse errors,
timeouts or surviving process groups; temporary workspace directories were removed.

The [official manifest reference](https://code.claude.com/docs/en/plugins-reference#defaultenabled)
documents default activation and the dependency requirement. The installed CLI loader and the
observed native error established the session-only `@inline` identity and dependency behavior.
No source manifest, hook, gate or permission boundary was weakened to obtain these observations.

## Existing project evidence

A read-only refresh used the released provider's filesystem-only liveness reader, inspecting at
most 100 newest default run files per existing registered worktree. It counted file lessons and
shared Git lesson history without reading note content. No consumer project scripts or installed
plugin binaries were executed, and no project settings were modified; no database or embedding API
was contacted.

| Project | Registered worktrees | Existing/read | Missing | Run files read | Memory events | File lessons / shared history |
|---|---:|---:|---:|---:|---:|---:|
| Rabbit Hole | 2 | 1 | 1 | 36 | 0 | 0 / 0 |
| Digging | 45 | 12 | 33 | 51 | 0 | 0 / 0 |
| Signal Feed | 8 | 8 | 0 | 73 | 0 | 0 / 0 |
| paul-loop | 11 | 11 | 0 | 26 | 0 | 0 / 0 |

No existing worktree was unreadable and no inspected JSONL line was malformed. The 34 missing
worktrees are absent samples, not zero-use observations. These default-path snapshots exclude
custom `LOOP_DIR`/lesson paths, removed checkouts, DB state and native memory. Ledger absence is
also compatible with explicitly suppressed bookkeeping. This does not establish universal non-use.

## Decision and smallest next step

#35 remains open: the hook-execution part has fresh native evidence; actual graduation, semantic
retrieval, injection and useful reuse remain unqualified. These six short fixed-response probes
are not a development-task comparison, a speed benchmark or a security qualification.

Use the existing file-lesson path for the next real repeated failure. Retain actual FAIL/fix/PASS
receipts, query for that failure before the next fix, and record whether the returned lesson changed
the action and survived independent verification. A first case proves only that case; collect the
previously proposed 6–10 real cases before making a broader usefulness claim. Compare against the
project's current native memory and documentation, not an artificially empty baseline.

Only if file/native recall demonstrably misses useful lessons should a separately scoped project
pilot add semantic memory with its user-owned DB authorization and embedding/signing configuration.
Do not activate that infrastructure just to close the issue or fabricate activity for the provider.

README now states the dependency/loading requirement, corrects the unconditional liveness wording,
and makes the default-path and `--assert` limitations explicit. Runtime source, tests, versions and
consumer installs are unchanged. Validation checks the retained native event/ledger pairs, source
hashes, aggregate counts, documentation links and unchanged runtime trees; no redundant full unit
suite is needed for these documentation-only edits. Generated runtime package consistency and vendor
lock checks passed. Independent filesystem reads also confirmed all 186 run files were accessible;
this supplements the liveness reader's fail-open handling of I/O errors.

## Standards

Independent review of `ec54a022..088c602` found **0 actionable findings**. Provider observations remain
separate from real-use efficacy; retained hashes, event outcomes and README qualifications match the
source. No verifier weakening or actionable heuristic smell was found.

## Spec

Independent review of the same diff found **0 findings**. Native execution, skipped retrieval and
useful reuse remain distinct; inventory aggregates and release receipts match the retained evidence.
#35 remains open. Neither review reran native sessions or established efficacy/security.

The final documentation delta clarifies the budget and consumer-execution wording above and records
these reviews. Hosted CI, merge and any later release remain separate publication states.
