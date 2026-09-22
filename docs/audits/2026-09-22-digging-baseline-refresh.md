# Digging DS 기준 자료 재캡처와 후속 검증

기준: 2026-09-22 KST. [이전 전체 검증 실패](2026-09-22-digging-verification-entrypoint.md#전체-검증-후속-실행)의 후속 작업이다.

**결과:** DS 재캡처·readback과 freshness는 통과했다. 전체 검증은 **27분 20초, FAIL / exit 1**이며 Home runtime의 실제 geometry 실패를 route matrix가 거부했다. [구조화된 결과와 원본 해시](2026-09-22-digging-baseline-refresh.json)에 남겼다.

## 해결한 범위

소비 worktree `digging-verify-evidence/digging-n-ditto`에서 현재 `origin/main=5d5f39efdf24fc091f79620689fa4f210d56a4da`를 확인했다. 제품 코드·CSS·verifier·unit test를 바꾸지 않고 legacy fixture의 캡처 기준과 실제 producer의 DS 증거를 갱신했다.

- Legacy: 6 routes × 3 viewports = **18개 관찰**, update-on 캡처 후 **update-off 재검증 PASS**. overflow 0, page errors 0, browser writes 0.
- ClubCard: 2 routes × 3 viewports = **6개 관찰**. current-main의 clean source에서 캡처했다. 기존 PNG와의 유일한 차이는 44 pixels, 최대 channel delta 2로 기존 허용 오차 이내였다. 캡처 원본은 로컬에 보존하고 기존 PNG를 복원한 뒤 **update-off rebind PASS**로 canonical receipt를 생성했다.
- 기존 freshness/readback suite: **9 PASS / 0 FAIL**. 이전에 실패한 exact baseline·production source 일치·실제 receipt readback을 포함한다.
- Legacy PNG 18개 중 **5개**만 변경됐다. 차이 영역은 이미 병합된 ‘최근 공개순’ 문구와 링크의 Ditto 지표·avatar·설명 문구다. 모바일 링크와 데스크톱 클럽의 전후 이미지를 직접 확인했으며, 나머지 13개는 byte-identical이었다. 새로운 시각 디자인 승인을 의미하지 않는다.

작업 원본·전후 backup·이미지 비교 결과·명령별 exit는 소비 worktree `.loop/baseline-refresh/`에 보존했다. fixture baseline만 바꾸고 PASS를 기록한 것이 아니라 실제 브라우저 캡처와 업데이트를 끈 재실행을 수행했다.

## 새로 확인한 Home 검증 차이

DS 갱신 후 canonical visual producer를 순서대로 실행했으나 첫 Home producer에서 **`PIXEL_BASELINE_RUNTIME_FAIL count=8`**로 중단됐다. 이는 아래 네 측정값을 개별 anchor 검사와 fixed disposition 검사에서 각각 보고한 여덟 failure records다.

| 390px Home | 고정 기준 | 실제 | 차이 |
|---|---:|---:|---:|
| navigation x | 22 | 12 | -10 |
| navigation y | 32 | 8 | -24 |
| navigation width | 346 | 366 | +20 |
| hero y | 112 | 120 | +8 |

`verify-mobile-baseline-reconciliation.mjs`의 Home disposition은 story section y만 대체 constraint로 다루며 이 네 값은 preserve다. 반면 현재 main의 mobile navigation CSS는 `top:8px`, `width:calc(100% - 24px)`이다. 관련 제품 소스와 geometry fixture/verifier는 이번 변경에 포함되지 않았다. 이 충돌을 해결하려면 제품의 현재 레이아웃과 승인된 고정 기준 중 어떤 계약을 유지할지 확인해야 한다. 테스트를 통과시키기 위해 승인 fixture·tolerance를 덮어쓰지 않았다.

Home producer는 DB의 exact-target read-only preflight와 기존 contract tests를 거친 후 실제 HTTP 200 화면을 관찰했다. 실패 후 자신이 소유한 server를 종료하고 runtime DB를 reset한 표식을 남겼다. 뒤의 10개 visual producer는 실행하지 않았다.

## 증거 fingerprint의 기준도 서로 다름

추가 소스 점검에서 Home producer는 `FIXED_BASE=2fa4d39df9f14ed65e89fe0b878d83d2b50f31e6`으로 implementation fingerprint를 기록하지만 최종 route matrix는 기본 `origin/main` 기준으로 비교한다. 같은 worktree에서도 오래된 base의 삭제된 파일이 hash 후보에 포함되어 **773 files 대 765 files**, 서로 다른 digest가 나왔다.

이는 Home geometry failure와 별개의, 소스 계약에서 확인한 후속 정렬 후보다. 실제 route matrix는 Home PASS marker 누락에서 먼저 중단됐으므로 fingerprint 불일치를 이번 실행의 종료 원인으로 보고하지 않는다. 고정된 디자인 oracle과 현재 구현 identity를 구분하는 수정 및 회귀 검증이 필요하며, fingerprint 검사 자체를 제거하는 해결책은 적절하지 않다.

## 전체 재검증

갱신된 DS 증거로 설정된 `verdict-run.sh -- pnpm verify:evidence`를 **한 번** 실행했다. 2026-09-22 15:08:24–15:35:46 KST, wrapper 측정 **1,639,948 ms**, `ROOT_VERIFY_FAIL`, `VERDICT: FAIL`, exit **1**이었다. 같은 조건으로 재실행하지 않았다.

| 범위 | 실제 결과 |
|---|---|
| DB preflight·workspace·DS freshness/runtime | PASS; 이전 중단 지점을 통과 |
| production build·DB contract·empty DB build | PASS |
| Unit 08 클럽·라이브러리 integration | PASS; signed-out/owner의 반응형·접근성 검사, fingerprint 일치, 포트 반환 확인 |
| 공개 카탈로그·사회적 지표 | PASS; 사회적 지표 producer와 7개 receipt readback 실행 |
| loading/offline·observability | PASS; loading lifecycle suite 45 PASS / 0 FAIL |
| web 내부 `verify:route-visual-matrix` | **FAIL**: `12-pixel-perfect-baseline.txt is missing PIXEL_BASELINE_RUNTIME_PASS` |

이는 앞서 실제 Home producer가 실패한 receipt를 검사한 결과다. PASS marker를 수동 추가하거나 실패 receipt를 이전 성공본으로 바꿔서 전체 명령을 통과시키지 않았다. ESLint는 0 errors / 14 warnings였으며 wrapper의 `FAIL:` 후보로 잡혔지만 종료 원인은 아니다. wrapper의 비어 있는 tests summary를 전체 test count로 해석하지 않는다.

실행 시작·종료 fingerprint는 `c68e83fed0702d619e3526ac82e4e45c05ad7916ba1a94c9c92c21a375af3c66`, **765 files**로 같았다. root의 뒤쪽 link-card/navigation/authoring runtime, prototype full, mobile final, 바깥쪽 마지막 route matrix에는 도달하지 못했다.

## 저장·정리·다음 작업

소비 branch `codex/verify-evidence-entrypoint`에 **`d37f82a9d61890c590b2f8643a48d5c4d7c0e628`**로 8개 파일을 저장했다. legacy baseline fixture 1개, 실제 DS receipt 2개, legacy PNG 5개다. 실행 시 HEAD는 이전 `893aa49`였고 이 commit은 같은 파일 상태를 저장한다. push·PR·merge·canonical checkout 변경·설치판 교체는 하지 않았다.

실행 중 새로 쓴 tracked 증거 31개는 `.loop/baseline-refresh/observed/` 아래 원래 상대 경로로 복사하고 원본과 SHA-256 일치를 확인했다. 그중 DS 저장 범위 밖의 24개는 원래 tracked 바이트로 복원했다. **복원된 과거 PASS receipt는 이번 실행의 근거가 아니다.** 이번 root FAIL, Home FAIL, Unit 08 PASS 원본은 위 archive와 JSON의 해시를 기준으로 읽는다. 새 untracked runtime 이미지와 generation별 사회적 지표 receipt도 로컬에 보존했다.

검증용 PostgreSQL 두 cluster에는 다른 client가 없음을 확인한 뒤 정상 종료했다. `55439`, `55440`, Unit 08의 `4327` listener가 없고 데이터 디렉터리는 남아 있다. 기존 사용자 DB·다른 worktree 프로세스는 변경하지 않았다.

다음 순서는 **Home의 승인된 geometry 계약 확인 → 고정 디자인 기준과 구현 fingerprint 기준 정렬 → 해당 runtime 재검증과 나머지 visual 증거 갱신 → 전체 명령 1회 재검증**이다. 첫 실패만 확인한 전체 실행에서 나머지 receipt까지 모두 유효하다고 추정하지 않는다. provider 자체의 성능 변경이나 loop-memory 활성화는 이 검증에 포함되지 않는다.

## paul-loop 개선에 주는 관측

이번에 이전 중단 지점을 넘긴 방법은 새 loop나 memory 도입이 아니라 기존 producer의 실제 재캡처와 readback이었다. baseline SHA를 `origin/main`과 정확히 같도록 요구하는 현재 계약은 main이 이동할 때 다시 확인해야 한다. 별도의 `/private/tmp/ds-merge-stable-runtime-evidence-20260922` worktree에서 ancestor·receipt 계약을 다루는 변경이 진행 중인 것도 읽기 전용으로 확인했다. 그 작업을 복사하거나 변경하지 않았으며, 이 기준 갱신을 외부에 올리기 전 중복 범위를 확인해야 한다.

또한 `test:pixel-perfect`는 이름이 unit이어도 브라우저·임시 HTTP server·실제 verifier 자식 프로세스를 사용한다. 이번 실행의 Link Addition 단일 테스트는 약 17초, 두 상태를 확인하는 테스트는 약 34초를 썼다. provider의 지시문 길이만으로 지연 원인을 설명할 수 없다. 후속 성능 개선은 이 실행 비용을 기준으로 판단하되, 실패 검출 계약을 삭제하거나 실행하지 않은 gate를 PASS로 취급하지 않는다. 이 단일 실행으로 14시간 작업의 원인이나 전체 속도 개선을 입증하지 않는다.

해당 suite의 실제 결과는 **116 PASS / 0 FAIL / 1 SKIP, 598,801 ms**였다. SKIP은 `ddt-mobile-ux-local` 대상에서만 실행하는 Link Detail 실패 후 cleanup 검사다. 이번 root 실행 대상은 `ddt-cutover-local`이므로 이를 PASS로 계산하지 않는다. 또한 `verify:club-library:08`은 상위 명령에서 끝낸 build·contract test·empty DB build 등을 내부에서도 실행한다. 독립 실행의 안전 장치라는 역할이 있으므로 무작정 없애지 않고, 후속 최적화 시 동일 구현·대상에 대해 재사용할 수 있는 증거 범위를 먼저 확인해야 한다.
