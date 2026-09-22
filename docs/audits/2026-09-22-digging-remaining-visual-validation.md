# Digging 나머지 화면 검증과 보관함 클릭 복구

기준: 2026-09-22 KST. [내비게이션·fingerprint 정렬](2026-09-22-digging-contract-alignment.md)의 후속 검증이다. 원격을 갱신해 `origin/main=5d5f39efdf24fc091f79620689fa4f210d56a4da`가 그대로임을 확인했다. 작업은 기존 `codex/verify-evidence-entrypoint` worktree에서 수행했다.

## 수정한 실제 오류

보관함 runtime이 `D-LIBRARY-RETURN-DESTINATION`에서 실패했다. 390/1440의 x/y/width마다 같은 책임 검사를 보고해 총 6 records였으며, 원인은 좌표가 아니라 **저장 카드의 전체 클릭 링크와 식별자 누락**이었다. `LibraryContentCard`에 `data-entry-id`, `data-content-id`, `card-hit-target[data-card-destination]`가 없었다. 기존 CSS에는 해당 링크와 제거 버튼의 클릭 영역을 나누는 규칙이 남아 있었다.

기존 컴포넌트의 3줄을 복구하고 기존 SSR 테스트에 식별자·원문 링크 검사를 추가했다. fixture·허용 오차·도착 콘텐츠 검사는 바꾸지 않았다. renderer에서 RED를 확인한 뒤 기존 카드 테스트 9개, mobile content/library 테스트 8개, 변경 파일 lint와 `tsc --noEmit`이 통과했다. 실제 보관함 클릭도 canonical `/links/small-ships`와 콘텐츠 ID에 도달해 PASS했다.

소비 commit: **`974539bcf259b14d14aad8990b421118291eed92`**, 2 files / +6 lines. source-only 로컬 commit이며 push·PR·merge·설치 변경은 하지 않았다.

## 화면별 현재 결과

최종 source fingerprint, 실행 시간, 원본 로그와 SHA-256은 [구조화된 기록](2026-09-22-digging-remaining-visual-validation.json)에 연결한다. 8개 후속 producer를 모두 실행했다. 실패한 producer도 DB reset이 확인된 경우에만 다음 독립 화면으로 진행했고, batch 전체 exit는 실패를 유지했다.

| Producer | 관측 | 후속 판단 |
|---|---|---|
| Library | PASS, 21.11초 | 저장 카드의 실제 클릭 및 도착 ID 확인 |
| Profile View | PASS, 22.65초 | 현재 runtime 계약 통과 |
| Profile Settings | FAIL, 24.62초 | 390px nav y=-76, preserve 기준 28; 2 failure records |
| Link Addition | PASS, 41.05초 | 현재 runtime 계약 통과 |
| Link Detail | FAIL, 26.57초 | 1440px related height=314.109375, preserve 기준 267 |
| Story/Collection Detail | FAIL, 32.76초 | story mentioned y, collection content y 및 next x/width 등 고정 기준 차이; 총 7 records |
| Authoring | FAIL, 58.44초 | published-story provenance의 정확한 main selector를 30초 기다리다 timeout |
| Club Proposal | PASS, 29.95초 | signed-out/member 경로 검증 통과 |

프로필 설정 verifier는 section link 클릭·focus 후 `scrollTo(0)` 직후 geometry를 읽고, 앱 nav의 스크롤 반영은 `requestAnimationFrame`을 거친다. 따라서 **측정 시점 경합 가능성**이 있지만 아직 수정·재현 실험으로 확정한 원인은 아니다. 작성 화면은 published 데이터의 DB assertion을 지난 뒤 DOM selector에서 멈췄다. HTTP status·route·DOM 구조를 먼저 기록해야 하며 timeout을 성공이나 권한 문제로 추정하지 않는다.

보관함 수정으로 구현 identity가 바뀌어 이전 Home/Search/Club archive를 최종 증거로 재사용할 수 없게 됐다. 이 세 producer도 다시 실행해 각각 **PASS / 21.42초, PASS / 21.91초, PASS / 44.66초**를 확인했다. canonical visual producer 전체 결과는 **7 PASS / 4 FAIL**이며, 이는 최종 root PASS와 별개다.

## 디자인 시스템과 전체 검증

DS legacy readback은 screenshot 18개 중 15개를 지난 뒤 `search-empty` 390px에서 저장된 PNG와 달라 실패했다. 첫 실행의 byte length는 actual 221536 / baseline 214761이었다. 비교 당시 browser page errors와 write requests는 0이고 source fingerprint도 안정적이었다. 화면 차이를 없애기 위해 기존 PNG·hash·tolerance를 덮어쓰지 않았다.

기존 promotion guard는 `UPDATE_EVIDENCE=1`에서 **production worktree가 현재 origin/main production tree와 같아야 한다**고 요구한다. 이번 branch에는 검증된 제품 CSS 수정과 보관함 수정이 있으므로 이 조건을 만족하지 않는다. 새 기준 생성이 필요하다면 승인된 시각 계약과 candidate provenance를 먼저 정리해야 한다. guard 우회나 fixture를 현재 코드에 맞춰 바꾸는 것은 이 검증에 포함하지 않았다.

최종 source에서 legacy readback을 다시 실행해 같은 PNG 차이로 FAIL했다. 정식 producer가 임시 이미지를 삭제하기 전에 읽기 전용 사본 16개를 `.loop/remaining-visual-20260922/ds-candidate-images/`로 보존했다. `search-empty-390x900.png`와 기존 기준 PNG를 직접 열어, 앞선 Search nav 복원에 따른 위치·너비 차이를 확인했다. 사본은 검토용 candidate이며 기준 이미지로 승격하지 않았다.

DS ClubCard도 Home 390px screenshot byte length actual 284046 / baseline 282148로 FAIL했다. 이 producer는 **성공할 때만 canonical receipt를 쓴다**. 따라서 실행 후 남아 있던 `ds-02-club-card-runtime.txt`는 이번 실패 실행의 receipt가 아니라 이전 PASS 파일이다. archive에는 `ds-02-historical-baseline-receipt.txt`로 구분하고 현재 실패는 `ds-club-final.log`와 실제 exit 1로 기록했다. 파일이 존재하거나 끝에 PASS가 있어도 이번 실행 성공으로 계산하지 않는다.

설정된 최종 경로 `node tools/paul-loop.mjs exec bin/verdict-run.sh --log .loop/remaining-visual-20260922/root-verify.log -- pnpm verify:evidence`를 **한 번** 실행했다. 결과는 **ROOT_VERIFY_FAIL / VERDICT: FAIL / exit 1**, wrapper 내부 **133,720 ms**(외부 driver 135,071 ms)다. `runtime-verifier-freshness`의 9번째 검사가 실제 실패한 DS legacy receipt를 PASS receipt로 읽을 수 없어 멈췄다.

```text
delivery/implementation/evidence/ds-04-legacy-card-contraction-runtime.txt
must contain a parseable receipt before its PASS marker
```

시작·종료 구현 fingerprint는 `407038d8fe81ac104324275c9bd17e7c4a4a7e1959523c3e8b7dc3f4162ead5c`, **765 files**로 같았다. 최종 canonical receipt 11개의 구현 identity도 모두 같다. 고정 디자인 기준을 측정하는 별도 `SOURCE_FINGERPRINT`와 혼동하지 않는다.

wrapper의 `passed=8 failed=1 skipped=0`은 마지막 freshness suite의 집계이며 전체 검사 수가 아니다. lint의 `14 problems (0 errors, 14 warnings)`도 wrapper의 실패 후보 목록에 잡혔지만 실제 중단 원인은 위 assertion이다. root의 뒤쪽 build·DB integration·mobile·최종 route matrix는 실행되지 않았다. focused producer 안의 DB 테스트 통과로 미실행 root 단계를 대체하지 않는다. 약 2분 만에 실패한 것을 성능 개선으로 계산하지 않는다.

## 격리·보존

별도 작업이 `55439/ddt_cutover`에서 검증 중인 것을 PID/cwd와 읽기 전용 live rows·client 조회로 확인했다. 해당 DB는 사용·reset하지 않았다. 비어 있고 다른 client가 없는 allowlisted `55440/ddt_mobile_ux`에 기존 runtime lease를 사용했고 각 producer가 자신의 server와 DB를 정리했다. 이미 실행 중이던 PostgreSQL 두 프로세스는 이 작업의 소유가 아니므로 종료하지 않았다.

전체 검증 준비용 `ddt_build_visual_20260922`를 55440의 알려진 테스트 cluster에 새로 만들었다. 기존 DB 없음, 정확한 role/address/port, 읽기 전용 transaction에서 public relations 0을 확인한 후 기존 migration을 적용했다. 처음 metadata 비교는 PostgreSQL inet 문자열의 `/32` 표현 때문에 생성 전에 중단됐고, `host(inet_server_addr())`로 주소를 정확히 비교한 뒤 진행했다.

마지막 읽기 전용 preflight는 `safe / live rows 0`이었고 사용한 45664/45665/45671–45682 포트에 listener가 없었다. 별도 build DB와 기존 PostgreSQL 프로세스는 후속 검증을 위해 그대로 남겼다.

실행 원본은 소비 worktree `.loop/remaining-visual-20260922/`와 generation별 `delivery/implementation/evidence/pixel-compare/`에 보존한다. 생성된 tracked 출력 14개(PNG 1개, receipt 13개)를 `observed-tracked/`에 복사하고 바이트·SHA-256 일치를 확인한 뒤 기존 HEAD 바이트로 복원했다. **복원된 과거 receipt는 이번 PASS 증거가 아니다.** 현재 성공·실패는 JSON에 해시로 연결한 archive를 기준으로 한다. archive와 candidate 이미지는 로컬 untracked이며 원격에 게시하지 않았다. provider audit은 consumer runtime 및 실제 출력을 가리키며 provider unit PASS나 설치판 활성화의 증거로 사용하지 않는다.

## 다음 순서와 paul-loop에 주는 근거

1. Profile Settings의 스크롤 상태 반영과 측정 순서를 좁은 재현으로 구분한다. 실제 geometry 오류인지 verifier의 관측 시점 오류인지 먼저 확정한다.
2. Authoring의 provenance 조회에서 HTTP/route/DOM 증거를 확보한다. exact 콘텐츠 ID·작성자·클럽 assertion을 유지한다.
3. Link/Story/Collection의 고정 기준 차이를 승인 artifact 및 적용된 DS 변경과 대조한다. 실제 회귀만 고치고, 승인된 변경은 명시적인 대체 제약으로 연결한다.
4. DS candidate와 기준 이미지 승격의 provenance 계약을 정리한 뒤 관련 receipt와 전체 검증을 한 번에 마무리한다.

이번에 보인 지연 요인은 실제 사용자 동작 누락, 오래된 화면 계약, 소스 변경에 따른 다수 receipt 무효화가 섞여 있다. 새 loop나 memory 인프라를 붙여 해결할 근거는 없다. global fingerprint를 임의로 줄이지 않고, 수정→focused 확인→관련 producer 갱신→마지막 전체 검증 순서를 지키는 것이 먼저다. 이 결과로 전체 개발 속도 향상이나 loop-memory 효용을 주장하지 않는다.
