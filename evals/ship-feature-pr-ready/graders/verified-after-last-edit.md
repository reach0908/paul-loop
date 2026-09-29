---
type: regex
target: trace
match: not_contains
pattern: '"name":"(?:Edit|Write|MultiEdit)","input":\{[^}]*?"file_path":"[^"]*\.js"(?![\s\S]*"name":"Bash","input":\{[^}]*?"command":"(?:[^"\\]|\\.)*(?:npm (?:run )?test|node --test))'
---
