---
type: regex
target: { source: file, path: docs/backlog.md }
pattern: '\n## #\d'
match: not_contains
arm: both
---
