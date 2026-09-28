---
description: A failing total whose visible symptom is in the cart but whose cause is price parsing in the catalog; the fix belongs at the cause.
tags: [diagnosing-bugs, hard]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

장바구니 합계가 가끔 틀리게 나와. `npm test`도 실패하고 있어. 원인을 찾아서 고쳐 줘. 테스트 파일은 건드리지 마.
