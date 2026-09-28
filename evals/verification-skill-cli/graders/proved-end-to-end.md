---
type: llm
focus: trace
---

PASS if, after writing the skill, the trace shows its own steps being followed against the real CLI: the CLI is run through the skill's documented command with isolated data (for example a separate TODO_FILE), at least one feature is driven with its output or resulting data captured to a named location, cleanup runs, and a later command shows that captured evidence still exists.
FAIL if the skill is written but never executed, the CLI is only read and not run, cleanup deletes the evidence, or the final message claims a proof the trace does not show.
