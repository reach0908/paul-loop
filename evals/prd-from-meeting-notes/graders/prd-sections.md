---
type: regex
target: { source: file, path: docs/prd/order-csv-export.md }
pattern: '^(?=[\s\S]*^#{1,4} [^\n]*(?:Problem|문제))(?=[\s\S]*^#{1,4} [^\n]*(?:Solution|해결|솔루션|해법))(?=[\s\S]*^#{1,4} [^\n]*(?:User Stor|사용자 스토리|유저 스토리))(?=[\s\S]*^#{1,4} [^\n]*(?:Implementation|구현))(?=[\s\S]*^#{1,4} [^\n]*(?:Test|테스트))(?=[\s\S]*^#{1,4} [^\n]*(?:Out of Scope|범위|제외))'
flags: m
---
