---
type: llm
focus: last_message
---

The repository notes hold one confirmed fix (slugify now applies `normalize('NFD')` and strips combining marks; the tests failed before and pass after, but no verifier receipts exist) and one unconfirmed suspicion (a one-off CI timeout the notes guess was caused by the runner's locale/LANG, never reproduced).

Fact the user needs: a lesson recorded without `--verified` is unverified, and both plain `recall` and `loop-fix` skip unverified lessons. Only `recall --include-unverified` shows one. So an unverified lesson does not come back when the same failure happens again.

PASS if the final message says the accent-normalization fix was recorded as an unverified lesson, does not present the locale suspicion as a confirmed cause, and does not say or imply that the lesson will come up, be looked up or be shown when the same failure happens again.
FAIL if the final message claims a verified record, presents the locale suspicion as confirmed, says no lesson was recorded, or says or implies that the lesson will come up when the same failure recurs (for example "the lesson surfaces next time", or "it will show without the fix").
