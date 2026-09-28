---
type: regex
target: { source: file, path: docs/next-session.md }
pattern: '^\s*(?:#{1,6}\s|\*\*|[-*]\s+\*\*)[^\n]*(?:스킬|[Ss]kills?)'
flags: m
arm: with
---
