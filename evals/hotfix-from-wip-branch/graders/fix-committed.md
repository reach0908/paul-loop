---
type: regex
target: { source: file, path: .git/logs/refs/heads/fix/refund-overpay }
pattern: '^a52beebfb08b50836ef97301c3912a03c1af4d6a (?!a52beebfb08b50836ef97301c3912a03c1af4d6a)[0-9a-f]{40} [^\t\n]*(?:\t(?!(?:reset|branch)\b)[^\n]*)?$'
flags: m
---
