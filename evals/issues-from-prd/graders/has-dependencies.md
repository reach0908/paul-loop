---
type: regex
target: { source: file, path: docs/backlog.md }
pattern: '\n## #\d+[^\n]*\n(?:(?!\n## #\d)[\s\S])*?#\d'
---
