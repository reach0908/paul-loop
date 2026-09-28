---
description: A failing suite is reproduced before the fix, the tests stay unchanged, and the fix is verified by a rerun.
tags: [diagnosing-bugs, verification]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

`npm test`가 실패해. 원인을 찾아서 고쳐줘. 테스트 파일은 수정하지 마.
