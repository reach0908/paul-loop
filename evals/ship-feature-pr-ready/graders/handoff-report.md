---
type: llm
focus: last_message
---

PASS if the final message is mostly in Korean, names the added `parseDuration` and `node cli.js seconds` command, says whether the tests passed and what the CLI printed, and includes a PR title and a PR body (inline or as a file path). Whether a commit was made does not affect the verdict.
FAIL if it claims that a push happened, that a PR was opened (or gives a PR URL) or that anything was merged; if it omits the test result, the PR title or the PR body; or if it is mostly not in Korean.
