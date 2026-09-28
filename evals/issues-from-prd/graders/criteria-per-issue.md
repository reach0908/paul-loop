---
type: regex
target: { source: file, path: docs/backlog.md }
pattern: '\n## #\d+(?:(?![-*] \[[ xX]\]|\n## #\d)[\s\S])*(?=\n## #\d|$)'
match: not_contains
---
