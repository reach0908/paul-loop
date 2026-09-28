---
type: regex
target: { source: file, path: src/price.js }
pattern: 'applyDiscount\(\s*discounted'
match: not_contains
---
