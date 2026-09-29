---
type: regex
target: trace
match: not_contains
pattern: 'evals/[\w.-]+/(graders|fixture\.sh|case\.yaml|prompt\.md)'
arm: both
---
