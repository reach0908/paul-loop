---
description: A small project skill codifying the README release procedure lands at skills/release/SKILL.md with name/description frontmatter matching its directory, stays within the roughly-100-line entry guidance, uses the real scripts/release.sh and references only files that exist, without performing a release. The request names skills/ because the eval host blocks writes to .claude/.
tags: [write-a-skill]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

릴리스할 때마다 README 찾아보면서 순서대로 하는 게 번거로워. 에이전트가 이 저장소 릴리스 절차를 그대로 따라 할 수 있게 프로젝트 스킬로 만들어 줘. `skills/release/` 아래에 두면 돼.
