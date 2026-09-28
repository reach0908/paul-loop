---
description: Meeting notes plus a small order-admin repo become a PRD in the requested file, with the template's sections, grounded in the existing filter and admin check, and nothing filed, published or implemented.
tags: [to-prd]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Edit, Write, Bash]
---

운영팀이랑 회의한 내용이야.

- 운영팀이 매주 주문 내역을 뽑아 달라고 하는데, 그때마다 개발자가 DB에서 직접 뽑아 주고 있음
- 관리자 주문 목록에서 쓰는 기간·상태 필터를 그대로 걸고, 그 결과를 CSV 파일로 받을 수 있게 하자
- 운영팀은 받자마자 엑셀로 여니까 한글이 깨지면 안 됨
- 고객 전화번호는 가운데 네 자리를 가려서 (010-****-5678)
- 관리자만 받을 수 있어야 함
- 한 번에 몇만 건씩 뽑는 건 이번엔 안 함. 필요해지면 나중에 백그라운드 작업으로

이거 PRD로 `docs/prd/order-csv-export.md`에 정리해 줘.
