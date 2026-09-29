---
type: regex
target: { source: file, path: src/price.js }
pattern: '^(<{7}|={7}|>{7})'
flags: m
match: not_contains
---
