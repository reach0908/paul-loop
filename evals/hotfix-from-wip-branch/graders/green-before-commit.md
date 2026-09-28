---
type: regex
target: trace
pattern: '"command":"(?:[^"\\]|\\.)*fix/refund-overpay[\s\S]*?[#ℹ] fail 0\b[\s\S]*?"command":"(?:[^"\\]|\\.)*(?:\bgit|\\ngit)\s+(?:-C\s+\S+\s+)?commit\b|"command":"(?:[^"\\]|\\.)*(?:npm test|node --test)(?:[^"\\]|\\.)*(?:\bgit|\\ngit)\s+(?:-C\s+\S+\s+)?commit\b(?:[^"\\]|\\.)*"(?:(?!"command":")[\s\S])*?[#ℹ] fail 0\b'
---
