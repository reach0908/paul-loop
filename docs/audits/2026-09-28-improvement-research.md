# improvement-research skill과 workflow

기준: **2026-09-28 KST**, base `51731b7`(#140). 요청: 기존 harvest 절차의 이름을 바꿔 이 저장소 개선용 리서치로 만들고, 함께 쓰는 스크립트를 개선한다. 근거: [09-28 harvest](2026-09-28-harvest.md)의 `trends-research` 점검.

## 수용 기준

1. 절차가 skill로 존재한다: brief → 수집 → 원시 자료 로컬 보존(SHA-256, 커밋 금지) → 수집기와 다른 도구로 원문 재확인 → 날짜가 붙은 보고서. 보고서에서 멈춘다.
2. Aside는 사용자가 지정한 계정으로 CLI에서만 쓰고 기본 프로필을 바꾸지 않는다. Claude Code와 Codex 모두에서 따를 수 있다.
3. workflow는 출처 URL이 없는 claim을 버린다. 원문을 열지 않은 판정과 correction 없는 corrected는 inconclusive로 둔다. unreachable은 refuted가 아니다. 결과가 없는 도메인은 incomplete이다. 호출 상한과 검증 상한을 넘은 claim은 기록한다.
4. `paul-loop:` 라우터에서 찾을 수 있다.

## 변경

- `trends-research.js` → `improvement-research.js`: 수집 모드(`domains`)와 기존 보고서 검증 모드(`reportPath`). Workflow 런타임은 시계를 쓸 수 없으므로 예산은 agent 호출 수로만 제한한다.
- 새 `improvement-research` skill과 `ask-paul` 항목. `paul-loop` 0.1.0 → 0.2.0(새 skill은 minor라는 기존 선례).

## 검증

- `workflow-coverage.test.sh`에 인자 검증, null 수집, 출처 없는 claim, 열지 않은 판정, correction 누락, 상한 정렬, 호출 예산, 빈 합성 사례를 추가했다. 의도적 변이 3개(열지 않은 confirm 허용, 출처 없는 claim 허용, null 도메인 complete 처리)가 모두 실패로 잡혔고 원본 복원 후 통과했다.
- 전체 engine suite: Node 22.14에서 **86/86**. 로컬 기본 Node 26.8.1에서는 82/86이며, 수정하지 않은 `51731b7`도 같은 4개가 실패한다(`module.register()` DEP0205 경고가 stderr·JSON 단언에 섞임). 이 변경과 무관한 실행 환경 차이다.
- `refresh-skill-lock --check`, runtime package 생성·`--check`(Claude·Codex 패키지 모두 새 skill 포함), `check-skill-refs`, `check-docs-hygiene` 통과.
- pinned-base review는 커밋된 HEAD만 비교하므로 커밋 전에는 실행되지 않았다. 대신 `51731b7`의 `workflow-coverage.test.sh`를 새 코드에 실행해 통과했다. 실제 gate 결과는 PR CI에서 확인한다.

## 한계

실제 Workflow 런타임에서 이 workflow를 실행하지 않았다. 테스트는 agent를 흉내 낸 결정적 실행이다. skill 절차의 실사용은 09-28 두 차례 수동 조사뿐이다.
