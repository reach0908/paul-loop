---
description: A repository keeps its instructions in AGENTS.md only (no CLAUDE.md) and already has .claude/ship-flow.config.json; the constitution step was skipped. The run should add the constitution to AGENTS.md, keep the existing rules, and not create a CLAUDE.md that would stop Claude Code 2.1.277+ from reading AGENTS.md (a CLAUDE.md holding only @AGENTS.md is acceptable). The config is pre-created because the eval host blocks writes to .claude/.
tags: [setup]
max_turns: 30
timeout_seconds: 900
---

예전에 이 저장소에 Paul Loop 붙일 때 설정 파일만 만들고 개발 규칙 넣는 단계는 건너뛰었어. 그거 마저 해 줘. CI랑 브랜치 보호는 이번엔 필요 없어.
