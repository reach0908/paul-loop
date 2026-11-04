# paul-loop 제공자 vendor-sync 점검

점검일: 2026-09-22 KST. 상태: **점검 완료, 반영 전 제안**.

`paul-loop`가 배포하는 스킬을 개선하기 위한 비교다. 소비 프로젝트의 설치·활성화 점검이 아니다. 기존 vendored 스킬 24개 중 **2개는 부분 반영 권장, 15개는 현행 유지, 7개는 명시적 fork 유지**로 분류했다. 적용 0개, 분류 미해결 0개다. 별도 신규 upstream 후보는 14개이며 **도입 권장 0개, 보류 4개, 현재 불필요 10개**다.

## 범위와 근거

| 항목 | 확인 결과 |
|---|---|
| 로컬 기준 | `main`, `791d43b`; `skills-lock.json` 24개 모두 `mattpocock/skills` 출처 |
| upstream 기준 | [`c55ee46073ed923f86ce59a5eb3b6d895095d1b7`](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7), 커밋 날짜 2026-09-18 |
| 선행 체크 | `FIRST_RUN c55ee46073ed923f86ce59a5eb3b6d895095d1b7` |
| lock 정합성 | `bash tools/loop-engine/test/vendor-lock-consistency.test.sh` 종료 0, 24개 등록·경로·내용 해시 일치 |
| 별도 해시 확인 | `node scripts/refresh-skill-lock.mjs --check` 종료 0, `Skill lock matches source` |
| upstream 경로 | lock의 `skillPath` 24개 모두 존재. 스킬 이동·삭제로 인한 추적 단절 없음 |
| 추가 비교 | 각 category README, 스킬 본문, 참조 문서·템플릿, 로컬 파일별 Git 이력 |
| 실행 빈도 | 로컬 run 원장에는 실행·subagent 이벤트만 있어 스킬별 실사용 빈도는 알 수 없음. 코드 참조 수를 사용 횟수로 해석하지 않음 |

제공자 저장소에는 `.codex/ship-flow.config.json`과 설치 레지스트리가 없다. [ADR-0004](../adr/0004-loop-operational-data-ownership.md)에 따라 소비자 설정을 생성하거나 다른 프로젝트의 설치를 빌리지 않았다. 설치형 resolver 경로 대신 검토한 제공자 공통 CLI `tools/loop-engine/bin/mattpocock-skills-sync-check.mjs`를 저장소 루트에서 직접 실행했다. `LOOP_RUNTIME=codex`, 현재 저장소의 명시적 registry 경로, 현재 저장소의 `CLAUDE_PROJECT_DIR`를 설정하고 stale plugin path override를 제거했다. 해당 CLI의 읽기 전용 모드는 registry를 사용하지 않는다. 이 실행은 설치형 runtime 검증을 뜻하지 않는다.

upstream은 OS 임시 디렉터리에 받아 위 SHA로 고정했다. 비교 대상의 지침을 실행하지 않았다. 신규 후보 14개 및 핵심 부분 반영 후보 2개는 각각 별도 subagent 작업으로 비교하고, 나머지 항목은 직접 대조했다. 하위 작업은 모두 읽기 전용으로 제한했다.

`FIRST_RUN`은 이 저장소에 이전 체크 상태가 없다는 뜻이다. 따라서 아래 차이는 **현재 로컬과 고정 upstream 사이의 차이**이며, 전부 마지막 동기화 이후 새로 생긴 변경이라고 주장하지 않는다. 해시 일치도 upstream 동일성을 뜻하지 않는다.

## 부분 반영 권장 2개

### 1. triage: 이미 구현된 요청을 거절 이력과 구별

현재 로컬은 기존 거절 기록을 읽지만, 요청이 이미 구현되어 있는지 도메인 개념으로 검색하는 절차가 없다. upstream은 이 검사를 추가하고, 이미 구현된 기능을 `.out-of-scope/`에 기록하지 않도록 구별한다. 이는 다음 요청을 잘못 거절하는 일을 막는다.

구체적인 제안:

- `tools/ship-flow/skills/triage/SKILL.md`의 맥락 수집에 기존 구현 검색과 확인 위치 기록을 추가한다. 이름이 비슷한 코드가 있다는 사실만으로 버그 재현을 생략하거나 자동 종료하지 않는다.
- 결과 처리에 “이미 구현된 요청은 구현 근거를 제시하고 거절 기록에는 추가하지 않는다”를 추가한다. 댓글·상태 변경·종료는 각각 기존 허용 범위를 따른다.
- 기존 `triage/OUT-OF-SCOPE.md`에도 같은 제외 조건을 추가한다.
- 기존 `triage/AGENT-BRIEF.md` 예시의 `wontfix` 기록 AC를 **거절된 enhancement**로 한정해 문서 사이의 모순을 막는다.

새 파일·패키지 의존성은 없다. `2c450ff` 이관 후 `b4ed9d5`에서 추가한 선행 재현, 제한된 grilling, 승인 재사용, 상태 변경과 댓글·종료의 분리, 이전 거절 이력 보존을 유지한다. 외부 PR discovery·checkout·PR 전용 brief까지 확대하는 변경은 별도 기능 범위로 보류한다.

근거: [upstream triage](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/triage/SKILL.md), [upstream 거절 기록 규칙](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/triage/OUT-OF-SCOPE.md).

### 2. prototype: 공유 검토용 HTML 논리 데모 선택지

현재 로컬은 논리·상태 모델을 TUI로 검토한다. upstream은 비개발자도 파일 하나로 조작할 수 있는 HTML 데모를 제공한다. 기존 TUI를 유지하면서 **비개발자 참여 또는 파일 공유가 필요한 경우**에 이 선택지를 추가할 가치가 있다.

구체적인 제안:

- 기존 `prototype/LOGIC.md`에 외부 의존성 없는 단일 HTML/CSS/JS 경로를 추가한다. 도메인 용어로 표시한 현재 상태, 자유 조작 버튼, 초기 상태를 재설정하는 정상·경계·금지 동작 시나리오를 포함한다.
- `prototype/SKILL.md`의 논리 분기·실행 방법에 HTML 선택 조건을 연결한다. 탭이나 복잡한 시각 효과를 필수로 만들지 않는다.
- 원본이 비-JS라면 별도로 작성한 JS 모델은 설계 검토용임을 구분한다. 실제 구현의 검증 통과 근거로 쓰지 않는다.

새 파일·패키지 의존성은 없다. `2c450ff` 이관 후 `b4ed9d5`에서 보강한 구현·정리 권한, AFK 상태의 결정 경계와 production 검증 요구를 유지한다. upstream의 prototype branch 보관, 자동 commit·production 전환·cleanup 및 `UI.md` 전환은 가져오지 않는다.

근거: [upstream LOGIC.md](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/prototype/LOGIC.md).

## 기존 24개 분류

모든 로컬 경로는 `tools/ship-flow/skills/<이름>/SKILL.md`이며, 현재 해시가 lock과 일치한다. “유지”는 upstream과 바이트가 같다는 뜻이 아니라, 현재 차이를 해소할 이득이 없거나 필요한 의미가 이미 다른 로컬 문서에 있다는 판단이다.

| 스킬 | 판단 | 이유 및 보존할 내용 |
|---|---|---|
| ask-paul | fork 유지 | 제공자가 실제 배포하는 스킬로 라우팅. upstream 이름·라우팅·추가 phase 문서로 교체하지 않음 |
| code-review | fork 유지 | 병렬 두 축 리뷰와 로컬 권한·미완료 처리 보존. fork 사유 문구의 현행 불일치는 아래 별도 기록 |
| codebase-design | 유지 | upstream이 합친 정의는 로컬 `LANGUAGE.md`에 존재. testability는 기존 `tdd/interface-design.md`에 있음 |
| diagnosing-bugs | 유지 | 핵심 진단 절차·HITL 템플릿 동일. 로컬 verifier 연결과 수정 후 architecture 전달 보존 |
| domain-modeling | 유지 | 권한 내 문서 작성, draft 구분, 근거·목표 변경에 따른 ADR 재개 규칙 보존 |
| grill-me | 유지 | 같은 grilling 위임. 로컬 설명·출력 언어 유지 |
| grill-with-docs | 유지 | 제한된 caller mode, 문서 권한·draft, 호출자에게 복귀하는 계약 유지 |
| grilling | fork 유지 | 한 번에 한 질문, 이미 해결된 결정·권한 재사용 유지 |
| handoff | 유지 | 임시 문서·산출물 포인터·민감정보 제거 방식 동일. 로컬 승인 계약 유지 |
| improve-codebase-architecture | 유지 | HTML 보고서 기능 이미 존재. 선택된 범위 재사용·문서 경로·의존성 분류 유지 |
| prototype | 부분 반영 제안 | 기존 TUI에 공유 검토용 HTML 선택지 추가 |
| research | 유지 | primary-source 조사 방식 동일. 로컬 격리 실행 선언과 권한 계약 유지 |
| resolving-merge-conflicts | 유지 | 무조건 완료·전체 staging 대신 기존 작업 보존과 실제 허용된 작업 범위 유지 |
| setup | fork 유지 | 플러그인 설정 목적. upstream tracker 설정 스킬·추가 템플릿으로 교체하지 않음 |
| tdd | 유지 | upstream 축약본은 로컬 guard window·승인 재사용·검증 절차를 대체하지 못함. 기존 tests/mocking 문서는 동일 |
| teach | 유지 | 교육 동작·참조 포맷은 동등. 차이는 주로 문장부호·출력 언어·승인 계약 |
| to-issues | fork 유지 | tracker/project 해석과 로컬 전달 계약 보존 |
| to-prd | fork 유지 | PRD·프로젝트 생성 목적 및 권한 구분 보존 |
| to-questionnaire | 유지 | 질문지 동작 동일. 수신자 언어 규칙 보존 |
| triage | 부분 반영 제안 | 기존 구현 검색 및 거절 기록 제외 규칙 추가 |
| wait-what | 유지 | 영어 강제 전환 대신 설정 언어, 빠진 전제 설명 유지 |
| wayfinder | 유지 | 실제 소유자·tracker 쓰기 범위·승인된 연속 작업 유지. 무조건 한 티켓 후 중단하지 않음 |
| wizard | 유지 | 실행 템플릿 동일. 작성과 실행 구분, 환경변수의 모든 전달 지점 확인 유지 |
| write-a-skill | fork 유지 | 좁은 스킬 제작 절차 유지. 광범위한 writing-for-agents 및 새 참조 파일로 교체하지 않음 |

참조 파일의 경로 차이도 확인했다. upstream `DESIGN-IT-TWICE.md`에 대응하는 로컬 파일은 `codebase-design/INTERFACE-DESIGN.md`다. upstream `domain-modeling/{ADR,CONTEXT}-FORMAT.md`는 로컬 `grill-with-docs/` 아래에 있으며 의미상 동등하다. 경로 차이를 누락 기능으로 집계하지 않았다. upstream의 `agents/openai.yaml`을 제공자 source에 일괄 복사하는 제안도 하지 않는다. 이 저장소는 자체 생성 runtime 패키지 계약을 가진다.

### fork 설명에서 발견한 현행 불일치

`skills-lock.json`의 `code-review.fork.reason`은 upstream이 병렬 subagent 실행을 삭제했다고 적고 있다. 그러나 이번 고정 SHA의 본문에는 **두 축을 parallel sub-agents로 실행한다는 문장과 실행 단계가 모두 있다**. 현재 upstream을 설명하는 문구로는 부정확하다.

fork 자체는 유지한다. 로컬의 독립 리뷰 완료 조건·권한·fallback 처리는 별도 차이로 남아 있다. 다음에 lock 메타데이터를 수정할 때는 현재 실제 차이를 근거로 설명을 갱신하는 것이 적절하다. 이번에는 lock을 바꾸지 않았고, fork 내용을 반영 후보로 다시 제안하지 않았다.

## 신규 upstream 후보 14개

“신규”는 이번 로컬 lock에 없다는 뜻이다. 이전 점검 상태가 없으므로 모두 최근 신설되었다고 단정하지 않는다. `in-progress` 9개는 upstream이 플러그인 배포에서 제외한 실험 단계다.

| 스킬 | 분류 | 제공자 관점 판단 |
|---|---|---|
| implement | 불필요 | `ship-feature`의 구현·TDD·독립 리뷰와 중복. 현재 브랜치에 무조건 commit하는 규칙은 부적합 |
| claude-handoff | 보류 | 문서 handoff는 이미 존재. `claude --bg --name`의 실행 관리와 Codex 동등 경로 검토 필요 |
| implement-spec | 보류 | 준비된 여러 티켓을 worktree별 병렬 구현·통합하는 차별점. 실제 다중 티켓 수요와 planner·AC·독립 리뷰·publisher 통합 설계 필요 |
| loop-me | 보류 | 반복 업무의 trigger·checkpoint 명세는 유용할 수 있으나 제공자 수요 미확인. 저장 규약·종료·삭제 규칙 조정 필요 |
| pr | 불필요 | 기존 PR 작성·publisher와 중복. 실제 before/after 증거와 필요한 최소 도식은 기존 작성 지침 개선 때 참고 가능 |
| retro | 보류 | 본문은 절차가 있지만 README는 여전히 stub이라고 설명. `writing-for-agents` 의존성 부재, 로컬 `retrospect`와 역할 중복 |
| setup-ts-deep-modules | 불필요 | `dependency-cruiser`와 새 구조·설정 요구. 현재 `loop-memory` 구조에 맞지 않으며 반복된 import 경계 문제 미확인 |
| writing-beats | 불필요 | 기사 구성·문단 선택용. 제공자 구현·검증 워크플로우 수요 없음 |
| writing-fragments | 불필요 | 기사 소재 인터뷰용. 일반 질문·결정 기록은 기존 스킬로 처리 가능 |
| writing-shape | 불필요 | 문단 단위 공동 집필용. 제공자 업무 수요 없음 |
| git-guardrails-claude-code | 불필요 | 기존 엔진 gate와 겹침. 모든 push 차단은 승인된 publisher와 충돌. 별도 shell script·jq·Claude 설정 필요 |
| migrate-to-shoehorn | 불필요 | `@total-typescript/shoehorn` 추가 수요 없음. 현재 단언은 오류 입력·DB fixture 등 목적이 다양하여 일괄 치환 부적합 |
| scaffold-exercises | 불필요 | 강좌 전용 구조. `pnpm ai-hero-cli internal lint` 의존성 없음 |
| setup-pre-commit | 불필요 | 루트 npm 구성·Husky·lint-staged·Prettier 추가에 비해 이득 불명확. 기존 Bash/Node/memory/패키지 CI 검사 재사용이 우선 |

분류 근거: [engineering 목록](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/README.md), [in-progress 목록](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/in-progress/README.md), [misc 목록](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/misc/README.md). `retro`의 stub 표기와 본문의 차이는 [실제 본문](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/in-progress/retro/SKILL.md)을 읽고 판정했다.

## 완료 범위와 다음 작업

이번 작업은 이 보고서만 추가했다. 기존 스킬·참조 파일·lock·설치 캐시를 수정하지 않았으며 stamp·commit·PR·설치·활성화도 수행하지 않았다. 시작 전에 있던 untracked 감사 문서 2개는 보존했다. 소스 변경이 없으므로 엔진 전체·memory·생성 패키지 전체 테스트는 실행하지 않았다. 위 PASS는 vendor lock 검사 범위에 한정한다.

점검을 막는 항목은 없다. 다음 구현 범위로는 **triage의 기존 구현 검색과 거절 기록 제외 규칙**이 가장 작고 명확하다. 이를 반영한다면 기존 문서 3개와 해당 lock hash를 함께 갱신하고, 이미 구현됨·실제 거절·불완전 구현의 세 경우가 구별되는지 확인하면 된다. HTML prototype 선택지는 독립된 다음 변경으로 다룰 수 있다. 스킬 이름 변경 후보는 없으며 신규 스킬을 추가·삭제하지 않아 catalogue 갱신도 필요하지 않다.
