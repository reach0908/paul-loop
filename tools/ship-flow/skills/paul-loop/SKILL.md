---
name: paul-loop
description: Use Paul Loop (폴루프) to develop, fix, verify, review or deliver changes. Choose the smallest procedure that completes the user's request; a local edit does not start a full delivery loop.
---

# Paul Loop

Follow the [shared authorization contract](../AUTHORIZATION.md).

**Output language:** use `outputLanguage` from `.claude/ship-flow.config.json` for human-facing prose,
falling back to the user's language. Keep code, commands, paths and quoted output verbatim.

Resolve `SHIP_FLOW_PATH` from the linked authorization contract's location, as it describes.
In the unified installation, `PAUL_LOOP_PATH` is two levels above that module; its engine and memory
live at `tools/loop-engine` and `tools/loop-memory`. Use absolute paths in shell commands.
Installation does not prove configured verifier commands, hook trust or role isolation.

Use existing conversation and repository evidence to choose the endpoint:

| Request | Next action |
|---|---|
| Question or a small local change | Answer or implement directly; run the checks appropriate to the change. |
| Diagnose a failure | Read [diagnosing-bugs](../diagnosing-bugs/SKILL.md) when a tight reproduction is needed. |
| Review changes | Read [code-review](../code-review/SKILL.md). |
| Deliver a feature or issue through an open PR | Read [ship-feature](../ship-feature/SKILL.md). Preserve independent reviews and human merge approval. |
| Commit, push or synchronize existing work | Use the host's normal authorized Git procedure; publisher is only an explicit delivery handoff. |
| Configure Paul Loop for this project | Read [setup](../setup/SKILL.md). |
| Give the project a scripted way to drive and prove the running app | Read [create-verification-skill](../create-verification-skill/SKILL.md). |
| Recall or retain a verified fix | Use existing file lessons first. Semantic memory requires explicit opt-in and configured infrastructure. |

For other procedures, consult [the routing map](../ask-paul/SKILL.md) only when needed.
Do not load every skill, start a loop or provision a database merely because Paul Loop was invoked.
