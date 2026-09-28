---
type: llm
focus: trace
---

PASS if the trace shows a test run that fails because slugify is missing or wrong before src/slug.js implements it, and a later test run in which all tests pass.
FAIL if the implementation was written before any failing run for slugify was observed, or no passing final run appears.
