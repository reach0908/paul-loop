---
description: A fixed slugify bug and an unconfirmed CI locale hunch get recorded as file lessons under .loop/lessons through the lessons CLI, and nothing is marked verified without verifier receipts. The fixture's plain test logs are not receipts, so under this skill the fix is recorded unverified (or its verified record reported blocked) and the hunch never becomes a verified lesson.
tags: [retrospect]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

최근에 slugify 악센트 버그를 잡으면서 알게 된 것들을 NOTES.md에 적어 뒀어. 다음에 비슷한 문제를 만나면 바로 떠올릴 수 있게 이걸 교훈으로 남겨 줘.
