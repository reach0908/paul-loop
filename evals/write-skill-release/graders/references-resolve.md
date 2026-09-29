---
type: llm
focus: trace
---

The run creates `skills/release/SKILL.md` for this repository's release procedure.

PASS if every file path, relative link or script the final `skills/release/SKILL.md` tells the agent to open or run exists: either it was already in the repository (`README.md`, `CHANGELOG.md`, `package.json`, `scripts/release.sh`, `src/`, `test/`) or the run created it. Plain commands such as `npm test` or `git push --follow-tags` count as commands, not files.
FAIL if the SKILL.md links or points to a file that neither exists in the repository nor was created in the run (for example a REFERENCE.md, EXAMPLES.md or helper script copied from a template), or if no SKILL.md content is visible in the trace.
