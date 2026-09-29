---
description: A small CLI feature is taken to PR-ready while the user keeps push and PR creation; the run should plan (planner), write tests before the implementation, run the verify command after its last edit, drive the new CLI command and run the review agents, then stop with a PR title and body but without push, PR, merge or a publisher handoff. Publication is reserved in the request instead of requested because the fixture has no remote, GitHub auth or tracker, so a requested publication could only end blocked and would measure the environment; the authorization contract separates implementation from publication, which gives the skill a defined endpoint. The branch is pre-created because the worktree hook needs an origin/* base and the run cannot write outside its workspace.
tags: [ship-feature]
max_turns: 60
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash, Agent]
---

작업 시간 기록 CLI에 기능 하나 추가해 줘. `src/duration.js`에 `parseDuration(text)`를 넣어서 `1h30m` → 5400, `45s` → 45, `2h5s` → 7205, `90m` → 5400처럼 시간 문자열을 초로 바꾸고, `node cli.js seconds 1h30m`을 실행하면 `5400`이 출력되게 해 줘. 단위는 h, m, s만 받아. 빈 문자열이나 모르는 단위(`3d`)는 에러로 처리하고, CLI에서는 에러 메시지를 내고 0이 아닌 코드로 끝나야 해.

브랜치는 `feat/parse-duration`로 따서 체크아웃해 뒀으니 여기서 작업해 줘. PR 올릴 수 있게 준비해 주고 PR 제목이랑 설명도 써 줘. push와 PR 생성은 내가 직접 보고 할게.
