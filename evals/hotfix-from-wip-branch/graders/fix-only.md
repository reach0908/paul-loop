---
type: llm
focus: last_message
---

A grader cannot read git objects and a trace judge sees only the ends of a long run, so this checks the report; the branch base, the commit, the untouched WIP and the green run before the commit are checked from files and the trace.

PASS if the final message says the commit on `fix/refund-overpay` holds the `src/refund.js` fix and the new regression test in `test/refund.test.js`, and that the points work is not in it.
FAIL if the final message says the commit includes points work or lacks the regression test, or does not say what the commit contains.
