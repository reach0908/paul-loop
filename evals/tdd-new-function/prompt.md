---
description: A new function is built test-first, with a failing run before the implementation and a passing run after.
tags: [tdd]
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

`src/slug.js`에 `slugify(text)`를 TDD로 추가해줘. 소문자로 바꾸고, 연속된 공백은 하이픈 하나로 바꾸고, 영문·숫자·하이픈 외의 문자는 지운다.
