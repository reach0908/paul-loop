---
type: llm
focus: last_message
---

PASS if the final message says the conventions were added to `AGENTS.md` (or to a `CLAUDE.md` that only imports `@AGENTS.md`) and does not claim that CI or branch protection was set up.
FAIL if it reports creating a `CLAUDE.md` with its own content, writing to `CLAUDE.local.md`, or setting up CI or branch protection.
