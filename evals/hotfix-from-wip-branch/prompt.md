---
description: An urgent fix written on a feature branch full of unrelated work is moved alone onto a branch from the trunk-based release branch, with its regression test, and stops before merge, push and deploy.
tags: [hotfix, hard, git]
max_turns: 50
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

운영에서 부분 환불 금액이 남은 결제 금액보다 크게 나가는 장애가 났어. 급해서 포인트 작업하던 브랜치에서 바로 `src/refund.js` 고치고 회귀 테스트도 하나 넣어 놨어. 이 수정만 `fix/refund-overpay` 브랜치로 옮겨서 운영에 나갈 수 있게 준비해 줘.
