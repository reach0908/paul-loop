# Digging 프로필·작성 검증의 잘못된 관측 수정

기준: 2026-09-22 KST. [나머지 화면 검증](2026-09-22-digging-remaining-visual-validation.md)의 두 실패를 기존 소비 worktree에서 추적했다. 시작 commit은 `974539bcf259b14d14aad8990b421118291eed92`, 갱신한 `origin/main`은 이전과 같은 `5d5f39efdf24fc091f79620689fa4f210d56a4da`다. 제품 코드·디자인 기준·설치판을 바꾸지 않고 verifier의 관측을 수정했다.

## 확인한 원인

### Profile Settings: 스크롤 위치와 nav 렌더 시점이 다르다

원래 producer는 section link 클릭·focus 후 `scrollTo(0)` 직후 좌표를 읽는다. 실제 nav는 scroll event → `requestAnimationFrame` → React 상태 반영을 거친다. 동일 소스의 초기 재실행은 PASS해 간헐적인 현상임을 확인했다. section link를 반복한 8회에서는 재현되지 않았지만, 실제 nav가 숨겨진 상태에서 top으로 돌아오는 작은 실험은 **3/3회** 같은 차이를 보였다.

```text
scrollY=0, state=hidden,  y=-76
다음 frame: hidden,       y=-76
상태 반영: visible,       y=28
```

측정 전에 `scrollY=0`, nav의 `data-scroll-state=visible`, nav animation 종료를 최대 2초 기다린다. 조건이 충족되지 않으면 `navigation_not_ready_after_scroll`로 FAIL한다. 정상 좌표·1px tolerance를 그대로 검사하며, 스크롤을 처리하는 제품 코드는 변경하지 않았다. 기존 synthetic server 검사에 지연된 nav와 영구적으로 숨겨진 nav를 추가해 잘못된 성공도 차단한다.

### Authoring: 실제로 없는 루트 속성을 두 검사에서 기다렸다

실제 응답은 **HTTP 200**, 정확한 `/stories/…304`, 단일 Story main이었다. 루트 `data-content-id`는 없고, Story 자신의 저장 폼에는 정확한 `…304`가 있었다. 작성자·클럽의 DB assertion도 통과했다. 최초 검사 도입 commit `bc0db04`의 Story route에도 루트 ID는 없었으므로 DS 추출로 생긴 제품 회귀로 판단하지 않는다.

잘못된 선택자는 `browser-pixel-perfect-authoring.mjs`와 뒤쪽 `verify-pixel-perfect-authoring.mjs`에 각각 있었다. 앞쪽만 고친 중간 실행은 상호작용·DB 불변식·작성자 확인을 통과한 뒤, 뒤쪽 Story empty/draft 검사에서 같은 30초 timeout을 보였다. 두 경로를 모두 수정했다.

- 루트는 종류와 유일성을 검사한다.
- 콘텐츠 ID는 해당 Story의 `.club-story-detail__save` 안에 있는 저장 폼에서 읽고, 개수 1 및 정확한 ID를 검사한다. 참조 카드나 다른 폼의 ID를 대신 읽지 않는다.
- HTTP status·최종 경로를 먼저 관측한다. browser 검사에서는 DOM 조회 전에 로그와 assertion으로 남기고, geometry 검사에서는 missing/duplicate identity를 관측값과 함께 FAIL로 남긴다.
- DB의 published 상태·작성자·클럽, 화면의 작성자·클럽·읽기 정보, 쓰기 요청 없음 및 DB snapshot 불변 조건을 유지한다.

같은 browser 검사 함수를 테스트에서 호출할 수 있도록 실행 진입점만 분리했다. 정상 DOM과 잘못되거나 없거나 중복된 ID, 잘못된 작성자·클럽, 빠진 읽기 정보, 중복 루트, 404, 리다이렉트를 검사한다. geometry 경로에도 wrong/missing/duplicate ID 실패를 추가했다. 승인 fixture를 바꾸지 않고 기존 unit mock의 DOM을 실제 route 구조에 맞췄다.

## 검증 결과와 보존

최종 결과·원본 로그·SHA-256은 [구조화된 기록](2026-09-22-digging-profile-authoring-diagnosis.json)에 저장했다. 소비 수정은 **`eaa2125210dffce63c5bcf13a1f57cddae5cc0d2`**, 5 files / +168 −85이며 상당 부분은 기존 browser 실행부의 들여쓰기 이동이다.

| 검사 | 결과 | 범위 |
|---|---|---|
| Profile/Authoring/scroll-nav 관련 suite, 설치된 verdict wrapper 경유 | **21 PASS / 0 FAIL / 0 SKIP**, exit 0, 37.19초 | 지연·영구 숨김 nav, ID/작성자/클럽/응답/경로 등 실패 주입 포함 |
| 변경 파일 lint | exit 0, **0 errors / 기존 3 warnings** | 변경 JS 5개 |
| 최종 Profile Settings producer | **PASS**, 29.71초 | 390/1440의 geometry·flow·section 동작 |
| 최종 Authoring producer | **PASS**, 37.40초 | signed-out/owner, Story·Collection empty/draft, 콘텐츠 출처·DB 읽기 불변식 |
| 구현 fingerprint 및 source 변경 감지 | **일치** | 두 receipt 모두 `54de8ee8…028769`, 765 files; 실행 중 변경 없음 |
| 마지막 읽기 전용 preflight | **safe / live rows 0 / 다른 client 0** | 45686/45687 listener 없음 |

회귀 검사의 RED 원본을 보존했다. 초기 테스트 작성 중 navigation timeout을 network-idle 최소 대기보다 짧게 둔 문제, mock 응답 charset 누락, 브라우저 요청 가로채기의 redirect 한계도 있었다. 실제 HTTP mock server와 명시적 UTF-8/별도 navigation timeout으로 고친 뒤 위 전체 관련 suite를 다시 통과했다. 이 중간 실패를 제품 오류나 최종 검증 결과로 세지 않는다.

실행 원본은 소비 worktree `.loop/profile-authoring-20260922/`에, 최종 producer의 source snapshot·PNG·index는 `pixel-compare/{profile-settings,authoring}-runtime/profile-authoring-verified-20260922/`에 남겼다. 생성된 tracked 출력 3개를 별도 archive에 바이트·SHA-256 일치로 보존한 뒤 기존 HEAD로 복원했다. **복원한 과거 receipt는 이번 결과의 근거가 아니다.** JSON이 연결하는 최종 archive를 사용한다. 원본과 새 이미지는 로컬 untracked 상태다.

전체 `pnpm verify:evidence`는 이번에는 실행하지 않았다. 이미 확인된 다른 상세 화면·DS 문제를 해결하지 않은 채 같은 전체 실패를 반복하지 않는다. 두 focused PASS를 전체 PASS나 이전 7 PASS와 합산한 새 전체 결과로 표현하지 않는다. push·PR·merge·deploy는 하지 않았다.

## 적용 범위와 다음 단계

소비 worktree는 `/Users/jinhokim/.codex/worktrees/digging-verify-evidence/digging-n-ditto`다. 다른 checkout과 설치판, 기존 PostgreSQL 프로세스는 변경하지 않는다. allowlisted `ddt-mobile-ux-local`을 읽기 전용 preflight로 확인하고 기존 runtime lease로 사용했다.

이번 문제는 제품 기능을 덧붙여 해결할 문제가 아니었다. 실제 DOM과 렌더 순서를 먼저 확인하고, 잘못된 verifier를 고칠 때는 실패를 거부하는 검사를 함께 유지해야 했다. provider engine·ship-flow·memory 변경이나 장기 성능 개선을 입증하는 결과는 아니다.

다음은 Link/Story/Collection의 남은 geometry 차이를 승인 artifact와 대조하는 작업이다. DS screenshot candidate 승격과 전체 검증은 그 차이를 정리한 뒤 진행한다. 과거 7 PASS / 4 FAIL을 이번 소스의 전체 결과로 합산하지 않는다.
