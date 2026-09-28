---
type: llm
focus: trace
---

Judge from the commit command on `fix/refund-overpay` and its output, or later `git show`/`git log` output.

PASS if the commit on `fix/refund-overpay` carries the `src/refund.js` change and the new regression test in `test/refund.test.js`, and nothing from `src/points.js`.
FAIL if the commit includes points work, lacks the regression test, or no commit on `fix/refund-overpay` is shown.
