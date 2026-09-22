# Digging의 내비게이션 회귀와 검증 fingerprint 정렬

기준: 2026-09-22 KST. [DS 재캡처 후 전체 검증 실패](2026-09-22-digging-baseline-refresh.md)의 후속이다. 소비 프로젝트의 기존 격리 worktree에서 수정했으며 provider의 runtime·설치판 변경은 아니다.

**후속 결과:** [나머지 화면 검증과 보관함 클릭 복구](2026-09-22-digging-remaining-visual-validation.md)에서 canonical 11개를 최종 소스로 확인했다. 7 PASS / 4 FAIL이며 전체 명령은 DS receipt freshness에서 FAIL했다. 아래는 이 수정 당시의 증거다.

## 확인한 원인과 수정

이전 보고서의 “제품 레이아웃과 승인 기준 중 무엇을 유지할지 확인”은 잠정 진단이었다. Git 이력과 최종 CSS cascade를 추적하니 **승인 변경이 아니라 토큰 이관 회귀**였다. `design/APPROVAL.md` 및 모바일 F08 disposition은 내비게이션 x/y/width와 hero y를 유지하도록 한다.

`club-library.css`의 마지막 모바일 규칙은 `top:32px`, `width:calc(100% - 44px)`, `margin-top:0`이다. `f61438d304c10cf43ad8c71c4a00ba69fe94c433`부터 존재한 이 규칙보다 앞의, 이미 덮인 `8px / 24px / 8px` 값을 DS-03A `bb52319929b908a3c35fb6a12ef678a5e535225e`가 토큰으로 옮겼다. 더 구체적인 DS selector 때문에 잘못된 토큰이 최종 화면에 적용됐다.

- Home 공통 모바일 토큰 3개를 실제 최종 CSS 값으로 복원했다. 390px의 nav x/y/width는 `22 / 32 / 346`, hero y는 `112`로 돌아간다.
- 같은 `ProductNavigation`을 쓰는 Search도 조사했다. 검색 전용 desktop width와 mobile top/width/min-height/margin이 DS adapter에서 누락돼 있어 기존 최종 CSS 값을 기존 토큰/alias 패턴으로 연결했다.
- Search 실제 runtime에서 nav 외에 설명문이 잘리는 `flow_clip` 2건도 확인했다. 모바일 section header의 `white-space: nowrap` 한 줄을 `normal`로 바꿨으며 기존 flow verifier로 실패→성공을 확인했다.
- 실제 두 CSS와 컴포넌트를 함께 렌더링해 Home/Search × 390/1440의 nav 위치·너비를 기존 fixture와 비교하는 테스트 **1개**를 추가했다. Home x=12 실패, Home 토큰 수정 후 남은 Search x=22 실패를 각각 관측한 뒤 수정했다.
- 승인 fixture, tolerance, `APPROVAL.md`, 고정 디자인 source hash, F08 compact hero 계약은 바꾸지 않았다.

별도로 11개 pixel runtime producer의 `IMPLEMENTATION_FINGERPRINT`가 고정 디자인 기준 `2fa4d39…`를 사용한 반면 root/matrix는 기본 `origin/main`을 사용했다. 삭제된 과거 파일까지 해시 후보에 포함되어 같은 worktree도 **773 files / 765 files**로 갈렸다. 고정 기준 `SOURCE_FINGERPRINT_START/END`와 변경 감지는 유지하고, 구현 receipt만 기존 `worktreeFingerprint()` 기본값을 재사용하도록 정렬했다. helper의 포함/제외 범위와 삭제 감지는 바꾸지 않았다.

Club producer는 소스 불일치를 기록만 하고 FAIL로 바꾸지 않는 누락도 있었다. 다른 producer와 같은 실패 처리를 추가했다. 실제 실행의 시작 fingerprint 이후 임시 소스 파일을 생성하면 exit 1과 `source fingerprint changed during Club runtime verification`으로 거절됨을 확인했다. 실행 종료 후 그 파일을 제거했으며 `.loop/contract-alignment/check-club-source-drift.mjs`에 재현 명령을 남겼다.

## 검증과 증거

최종 결과, commit, 실행 시간, 원본 SHA-256은 [구조화된 기록](2026-09-22-digging-contract-alignment.json)을 기준으로 한다. 실행 로그와 생성 receipt는 소비 worktree `.loop/contract-alignment/`에 보존한다.

| 검사 | 결과 | 범위 |
|---|---|---|
| navigation·fingerprint·mobile reconciliation·DS 단위 검사 | **38 PASS / 0 FAIL / 0 SKIP**, 7.73초 | 최종 코드의 관련 4개 test file |
| 변경 JS lint | exit 0, 0 errors / 기존 3 warnings | 11 producer와 navigation test |
| Search runtime | **PASS**, 26.20초 | 390/1440, 기존 geometry·flow·검색 상호작용 계약 |
| Home runtime | **PASS**, 21.81초 | 390/1440, 기존 preserve 및 F08 계약 |
| Club runtime | **PASS**, 36.79초 | 390/1440, empty/single/dense 3상태 포함 |
| Club 실행 중 소스 변경 주입 | producer **FAIL / exit 1**, negative check PASS | 변경 감지·DB reset·실패 전파 |
| 세 최종 receipt의 구현 identity 비교 | **PASS** | 모두 `2f459fa7…83d183d`, 765 files로 root 기본 fingerprint와 일치 |
| 정리 후 read-only preflight | **safe**, live rows 0 | `ddt-mobile-ux-local`; 45671/45672/45673 listener 없음 |

최종 Home/Search 390px PNG를 직접 열어 확인했다. 이는 화면 관찰이며 새 사용자 디자인 승인은 아니다. 검색 설명문 줄바꿈은 기존 `D-SEARCH-FLOW-390`의 clipping 검사가 실패→성공한 증거로 판단했다.

소비 수정은 로컬 commit **`9706ce14af5aad7e2d988bdb468a064f10ea7a8b`**, 14 files / +77 −15로 저장했다. 최종 실행 원본 3개를 `observed/`에 복사하고 SHA/바이트 일치를 확인한 뒤, source-only commit을 위해 tracked receipt를 실행 전 HEAD 바이트로 복원했다. **복원된 과거 receipt는 이번 PASS 근거가 아니다.** 이번 결과는 JSON에 해시로 고정한 archive와 generation별 runtime index/PNG를 사용한다. `.loop/`와 새 이미지들은 로컬 untracked로 보존했고 원격에 게시하지 않았다.

전체 명령은 이번 turn에 실행하지 않았다. 위 시간은 각 focused 검사 시간이며, 이전 27분 전체 검증과 비교해 성능 향상률로 해석하지 않는다.

## 환경과 적용 범위

소비 worktree: `/Users/jinhokim/.codex/worktrees/digging-verify-evidence/digging-n-ditto`, branch `codex/verify-evidence-entrypoint`. 시작 commit은 `d37f82a9d61890c590b2f8643a48d5c4d7c0e628`, 확인한 `origin/main`은 `5d5f39efdf24fc091f79620689fa4f210d56a4da`다. canonical checkout과 다른 작업의 `/private/tmp/ds-merge-stable-runtime-evidence-20260922` 변경은 건드리지 않았다.

이전 turn에서 만든 PostgreSQL 55439/55440 프로세스가 이번에는 이미 실행 중이었다. 재시작 준비가 port guard에서 거부된 뒤, shell이 중단되지 않아 초기 Home 검사까지 진행한 실행이 있었다. 그 Home 검사는 자체 exact-target preflight와 lease를 거쳐 성공했지만, 이번 turn이 DB 프로세스를 시작했다고 해석하면 안 된다. 이후 명령은 `set -e`로 실행했다.

후속 Club 실험은 55439 대상의 `live_rows_present`에서 읽기 전용 사전 검사로 거절됐다. 해당 데이터를 지우거나 재시도하지 않았다. 별도 allowlisted `127.0.0.1:55440/ddt_mobile_ux`가 live rows 0·다른 client 0임을 확인한 후 기존 runtime lease로 남은 검증을 실행했다. 서버 프로세스와 test probe는 각 검증이 정리하며, 기존 PostgreSQL 프로세스는 종료하지 않는다.

## paul-loop에 반영할 결론과 다음 작업

이번 사례에서 긴 검증을 반복할 이유는 모델 성능이나 별도 메모리 부족이 아니었다. 소비 프로젝트의 CSS 회귀와 receipt 기준 불일치를 먼저 좁혀야 했다. 실패 근처의 작은 재현 → 같은 컴포넌트의 호출 경로 조사 → 실제 producer 확인 순서가 유효했다. 전체 검증을 반복하기 전에 실행 결과를 현재 구현에 연결하는 계약을 확인한다는 기존 실패 복구 지침을 뒷받침한다.

최종 Home/Search/Club 실행 성공도 전체 11개 producer·integration·DS 화면 기준·root PASS를 뜻하지 않는다. 나머지 visual receipt와 DS production-source freshness를 확인/갱신한 뒤 `verdict-run.sh -- pnpm verify:evidence`를 한 번 실행하는 것이 다음 단계다. 변경된 제품 CSS를 기존 DS screenshot 기준에 무조건 승격하지 않는다. 독립 리뷰, CI, push, PR, merge와 loop-memory 활성화·장기 효용 평가는 이번 범위 밖이다.
