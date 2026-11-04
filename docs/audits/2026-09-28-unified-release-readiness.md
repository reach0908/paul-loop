# Paul Loop 0.1.0 배포 전 확인

대상: [PR #140](https://github.com/reach0908/paul-loop/pull/140)

- 검토 head: `ab6f0b896cc6586792f5d337c8998f609783f90a`
- main/base: `faaed5711f864555a32181011840dea244c9e964`
- 원격 상태: OPEN, Draft, MERGEABLE, 검사 상태 UNSTABLE.
- 신규 태그 `paul-loop--v0.1.0`은 아직 없음.
- 이 문서는 로컬 배포 검토 기록이다. PR의 내용/head와 이미 완료된 CI를 바꾸지 않는다.

## 확인 결과

최신 head의 CI 10개 중 9개 성공. 엔진 selftest, 메모리, Linux/macOS의 Node 22/24
패키지 검사, Claude schema, gitleaks, GitGuardian이 성공했다.
[엔진 및 이전 규격 검사 실행](https://github.com/reach0908/paul-loop/actions/runs/36377244758).

`verifier-pinned-review`만 실패했으며, 이전 테스트 기준 **83/86**, exit 1을 유지한다.
실제 CI 로그와 변경된 테스트를 대조했다.

| 이전 기준에서 실패한 suite | 의도한 변경 | 유지되는 검사 |
|---|---|---|
| check-skill-refs | 기본 폴더 외 manifest 리소스 경로 지원 | 누락된 스킬 참조의 실패와 복구 |
| runtime-packages | 3개 패키지에서 1개 패키지, 내부 모듈 경로·버전 분리 | 전체 무결성, 변조 거부, 모드, 역할 격리, 훅·계약 |
| ship-flow-executable-contract | 공개 호출 이름을 paul-loop:로 통일 | 역할의 존재와 실제 호출, 실행 인자, 검증·게시 조건 |

기존 통합 구현과 가이드의 Standards/Spec 독립 리뷰는 남은 지적 0건으로 기록돼 있다.
이번에는 이미 완료된 전체 검사를 반복하지 않았다. 현재 head에서 skill lock 검사와
Claude/Codex 패키지 재생성·일치 검사, diff 공백 검사를 통과했다. 실제 사용자 프로필이나
메모리 서비스, 임베딩 API를 건드리지 않았다.

## 배포 조건과 절차

기존 `verifier-pinned-review.sh`는 의도된 변경으로 이전 검사가 실패하는 경우
“a human must sign off on it”을 요구한다. AUTHORIZATION.md도 PR별 머지 승인을 유지한다.
계약 변경과 해당 head의 머지·릴리스가 이번에 요청할 구체적인 결정이다.
`classify-risk`의 실제 결과도 merge/release 각각 REQUIRE(exit 10)였다.
일반 진행 지시를 이 실패를 받아들이는 명시적 PR 승인으로 기록하지 않았다.

승인 후 다음 순서로 진행한다.

1. PR head/base가 위 검토 대상과 일치하고 새 실패가 없는지 다시 확인한다.
2. Draft를 해제하고 동일 head를 squash merge한다. 검사 실패 기록을 PASS로 바꾸거나
   보호 규칙을 수정하지 않는다. GitHub가 머지를 거부하면 그 사유를 먼저 확인한다.
3. main의 기존 `tag-on-publish`가 같은 merge commit의 엔진·메모리·런타임·비밀 검사를
   완료하는지 확인한다. 이 워크플로는 main에서 PR 전용 pinned 비교를 수행하지 않으며,
   이는 기존 동작이다. 이번 승인 때문에 검사 조건을 바꾸지 않는다.
4. `paul-loop--v0.1.0` 태그가 그 merge commit을 가리키고 marketplace에 플러그인 하나가
   노출되는지 확인한다. main 검증 실패 시 태그를 수동으로 강제 발행하지 않는다.

소비 프로젝트 설치 갱신·DB 준비·키 설정·메모리 활성화는 이 배포의 부수 효과로 하지 않는다.
공개 배포와 실제 사용 프로젝트 전환은 별도 상태이며 후자는 해당 프로젝트/호스트 범위가
정해져야 한다. 배포 승인 전에는 머지나 태그 생성이 완료된 것으로 보고하지 않는다.

## 사용자 승인 후 실행 결과

사용자가 앞선 검토 대상과 질문에 대해 “응 모두 진행해줘”로 승인했다. 이는 PR #140의
검토 head `ab6f0b896cc6586792f5d337c8998f609783f90a`, 이전 규격 검사 3건의 의도된 변경,
머지와 0.1.0 배포에 대한 승인이다. 머지 전 원격 head/base가 그대로임을 다시 확인했다.
추가 승인 부족을 이번 차단 사유로 기록하지 않는다.

머지 도구의 `gh pr merge --help` 조회가 실제 PreToolUse 훅에서 거절됐다. 머지 자체는
시도되지 않았다. 설치 경로는 `zine-codex/loop-engine/0.15.0+zine.1`이며, 구버전 훅이
없는 프로젝트 `risk-rules.json`을 명시적 `--rules`로 넘긴다. 읽기 전용 분류 재현은
`--rules file not found`, exit 2로 종료했다. provider의 기존 수정은 선택 규칙을 처리하며
실제 merge 분류는 REQUIRE(exit 10)다.

추가로 설치된 Codex hook-adapter는 `ask`를 `deny`로 변환하고 승인 상태를 기록하지
않는다고 명시한다. 따라서 기존 소스 수정이나 이번 대화의 승인이 동일 도구 실행의
허용으로 자동 변환되는 것은 아니다. 설치 캐시·설정·승인 훅을 바꾸거나 다른 API/셸로
머지를 우회하지 않았다. 관련 기존 근거는 `2026-09-23-risk-gate-defaults.md`다.

승인 범위의 PR Draft 해제는 진행했다. GitHub에서 사람이 머지한 뒤 main의 검증과
동일 커밋의 `paul-loop--v0.1.0` 태그를 확인하는 단계가 남는다. 이 기록 시점에 머지,
태그 발행, 소비자 설치 변경, 메모리 활성화는 완료되지 않았다.
