---
type: regex
target: trace
match: not_contains
pattern: '"name":"Write","input":\{"file_path":"[^"]*/CLAUDE\.md","content":"(?![^"]*@AGENTS\.md)'
arm: both
---
