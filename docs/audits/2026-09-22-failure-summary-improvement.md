# loop-engine 0.15.1: 실패 원인 요약 개선

사용자의 자체 개선·배포 위임에 따라 provider 내부의 두 번째 우선순위를 진행했다.
소비자 프로젝트를 재검증하거나 수정하지 않았다.

## 재현과 수정

`--max-fails 1`에서 아래 로그를 출력하고 exit 1로 끝내면, 기존 구현은 경고 요약만 `FAIL:`에
넣어 실제 회귀 실패가 요약에서 사라졌다. 회귀 검사 추가 후 실제 실패를 확인했다.

```text
✖ 14 problems (0 errors, 14 warnings)
not ok 2 - actual regression
```

수정 후에는 실제 실패 표식이 슬롯을 먼저 얻는다. 0-error 경고 요약은 다른 실패 표식이 없을
때만 fallback으로 남긴다. ANSI 색상과 `@scope/app:lint:` 같은 작업 prefix도 처리한다.
`ESLint found too many warnings`는 실제 임계치 실패로 표시하며, loop-fix에서도 Docker 정리
잡음 때문에 infrastructure 면제를 받지 않는다.

원본 LOG와 exit 기반 VERDICT는 보존한다. 경고만 출력해도 exit가 nonzero이면 FAIL이다.
`PASS: ... [N×]`처럼 성공 문구에 포함된 기호는 실패로 추출하지 않는다. `selftest:`를
Jest `Tests:`로 읽거나 `79/80 passed`를 80개 성공으로 집계하지 않도록 단어·숫자 경계를
보강했다. 정상 Jest/pytest 정수 집계는 유지한다. SUMMARY는 마지막 60줄의 추정값이며 전체
suite 합계가 아니라는 점도 계약에 명시했다. 메모리/검색 인프라나 별도 분류기는 추가하지 않았다.

## 검증

- 계약 회귀: 실제 command fixture에서 RED → GREEN. raw log 보존, exit 1/2/7, warning-only
  fallback, 실제 lint 오류, TAP 실패 이름, 색상·작업 prefix, exit 0 경고를 확인했다.
- infrastructure 회귀: 기존 7가지 경우와 warning-threshold + Docker noise 경우 PASS.
- runtime 버전 일치와 후속 설치의 선행 cache 변조 거부: focused 2 PASS.
  release 번호를 고정하던 test fixture만 manifest/설치 결과에서 가져오도록 바꿨다.
- Standards 독립 리뷰: actionable finding 없음. macOS 기본 awk에서도 주요 입력을 확인했다.
- Spec 독립 리뷰: 최초 실패 요약은 finding 없음. 추가 집계 리뷰에서 Jest 경로의 분수 오인
  P2를 발견해 세 필드의 숫자 경계를 수정하고 분수-only·정수 혼합 회귀를 추가했다.
  수정 후 독립 Spec 재현에서 P2 해소 및 추가 actionable finding 없음을 확인했다.
- 전체 engine 첫 실행: **79/80, FAIL**. 호출자가 지정한 임시 `LOOP_DIR`가 receipt 검사의
  부모 프로세스에만 상속되고 fixture의 자식은 `.loop`를 사용해 실제 producer receipt를
  찾지 못했다. 실패 기록을 보존했고 검사를 약화하지 않았다.
- 기본 `LOOP_DIR`로 통합 재실행: **80/80, exit 0**, 361,957ms. 내부 BAC-580 memory-source
  probe는 tsx 부재로 SKIP이며, 이를 PASS로 계산하지 않는다. 위 Jest 숫자 경계의 마지막
  수정은 이 실행 이후이며 최종 계약 회귀는 다시 PASS. 최종 커밋 전체 검증은 PR CI로 확인한다.
- 통합 installer/runtime: **98 PASS / 0 FAIL / 1 opt-in SKIP**. 생성·재생성 비교,
  vendor lock 일치 및 source strict manifest PASS. 실제 Codex 설치는 수행하지 않았다.

로그는 배포 worktree의 `.loop/provider-release/` 아래 `failure-summary-{red,green,infra}.log`,
`initial-engine.{log,verdict}`, `combined-engine.{log,verdict}`, `combined-runtime.log`,
`final-contract.log`에 보존한다. 최초 증거는 별도 failure-summary worktree에도 남아 있다.
실제 개발 속도나 장기 memory 효용의 개선을 측정한 결과는 아니다.

## 배포 경계

ship-flow 0.11.2와 함께 [PR #105](https://github.com/reach0908/paul-loop/pull/105)에 포함한다.
PR·CI, main 병합, 버전 태그, 소비자 설치는 별도 상태다.
최초 ship-flow 커밋의 CI 11개 통과 후 병합을 시도했지만 설치된 위험 명령 훅이 거부했다.
진단 결과 명시적 `--rules /Users/jinhokim/dev/paul-loop/risk-rules.json` 파일이 없어
classify-risk가 exit 2를 반환했다. 다른 병합 명령으로 우회하거나 설치 캐시·소비자 설정을
변경하지 않았다. 최종 PR의 CI 통과만으로 배포 완료를 주장하지 않는다.

## 다음 우선순위

file lesson·receipt의 worktree 보존과 canonical 이관 계약을 구현 전 검토한다.
다른 root로 복사한 receipt의 `verified` 승격 금지, 역사적 근거와 현재 검증의 구분,
중복/변조/다른 저장소/삭제/재검증 실패를 먼저 확인한다. semantic DB 도입은 실제 검색 부족이
확인된 뒤 판단한다.
