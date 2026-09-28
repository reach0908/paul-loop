---
description: A tidy-up branch hides one real defect (an async callback inside forEach, so saves are not awaited) among harmless renames; the review finds it without editing code.
tags: [code-review, hard, git]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

동료가 주문 저장 코드를 정리한 브랜치야. 머지해도 괜찮을지 main 대비로 봐 줘.
