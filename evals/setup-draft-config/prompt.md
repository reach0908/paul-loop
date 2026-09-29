---
description: A first Paul Loop adoption asked as a preview. The skill writes .claude/ship-flow.config.json, which the eval host blocks, and supports a setup review or draft that returns the proposed files without installing them, so the case asks for the draft and grades the proposed config in the reply. It must detect `npm run verify` (not `npm test`) as the verify command and infer `ko` as the output language, and must not install anything globally, run plugin install/enable commands, enable memory, or write CLAUDE.md, CI or .claude files.
tags: [setup]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

이 저장소에 Paul Loop를 붙여 보려고 해. 바로 설치하지는 말고, 이 저장소 기준으로 어떤 설정이 들어가게 될지 먼저 보여 줘. 저장소 파일은 아직 건드리지 마.
