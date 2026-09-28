---
description: Mid-task state (uncommitted toCSV without escaping, one failing test, a plan doc and scratch notes holding a staging DB password) becomes a resumable handoff. The request names docs/next-session.md because the skill's default OS temp directory lies outside the run sandbox and cannot be read by a file check. The skill is user-invocable only (disable-model-invocation), so an organic request cannot load it and the Skill indicator reads 0 by design; the case records what a handoff looks like without the skill's instructions.
tags: [handoff]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

오늘은 여기서 끊어야겠어. 내일 다른 에이전트가 이어받아서 바로 작업할 수 있게 지금까지 상황을 `docs/next-session.md`에 정리해 줘.
