---
description: A project gets a verification skill that drives its CLI, with a feature map, proven once end to end with evidence that survives cleanup.
tags: [verification]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

이 todo CLI를 고칠 때마다 손으로 명령을 돌려 보는 게 번거로워. 다음 에이전트가 이 저장소만 보고도 CLI를 실제로 실행해서 동작을 확인하고 증거를 남길 수 있게, 저장소의 `skills/` 폴더에 스킬로 만들어 줘. 만든 뒤 한 번은 직접 따라 해서 되는지 보여 줘.
