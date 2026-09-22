# paul-loop 개선 현황과 다음 검증

기준: 2026-09-23 KST, main `3b58fba2f54ab2f201d131530f352dc238b9bdee`.
사용자의 “추천하는 방향으로진행”에 따라 배포 확인, 연구 기록 통합, 격리된 native 라우팅
관측을 진행한다. 소비 프로젝트 변경·설치 교체·memory DB 활성화는 포함하지 않는다.

## 구현·배포 완료

| 항목 | 현재 근거 | 남은 구분 |
|---|---|---|
| upstream의 유효 변경 반영 | [vendor backport](2026-09-22-vendor-sync-backports.md), #104 | 전체 upstream 복제가 아닌 검토 후 선택 반영 |
| YAGNI·재사용 원칙, ship-flow 중복 지침·작은 작업 진입 개선 | [ship-flow 0.11.2](2026-09-22-ship-flow-0.11.2-release.md), #105 | 실제 모델의 선택·속도 향상은 별도 관측 |
| 실패 요약 정확성 | [loop-engine 0.15.1](2026-09-22-failure-summary-improvement.md), #105 | 원본 exit/log와 advisory 요약 구분 유지 |
| worktree 교훈 보존·조회 | [loop-engine 0.15.2](2026-09-22-lesson-preservation.md), #106 | 보존은 현재 검증 승격이나 검색 효용의 증거가 아님 |
| 좁은 로컬 fast-forward 동기화 허용 | [loop-engine 0.15.3](2026-09-22-git-sync-gate.md), #107 | 설치된 구버전 훅의 동작은 source 배포만으로 바뀌지 않음 |
| 선택적 위험 규칙 처리, merge/deploy 필수 승인 유지 | [loop-engine 0.15.4](2026-09-23-risk-gate-defaults.md), #108 | Codex ask→deny 및 실제 사람 승인 경계 유지 |

#108은 MERGED다. [tag-on-publish run 35749152223](https://github.com/reach0908/paul-loop/actions/runs/35749152223)
SUCCESS와 `loop-engine--v0.15.4` → 위 main SHA 일치를 원격 조회로 확인했다.
현재 source 버전은 engine 0.15.4 / ship-flow 0.11.2 / memory 0.7.0이다.

원래 로컬 main은 `791d43b`로 5커밋 뒤에 있다. origin/main fetch는 완료했지만 단일
`git merge --ff-only origin/main`이 기존 PreToolUse의 protected-branch 판단으로 거부됐다.
다른 명령으로 우회하지 않았으며, 이 문서의 기준은 최신 origin/main에서 만든 별도 worktree다.
정상 설치 경로의 runtime 업데이트·consumer 적용은 별도 작업으로 남는다.

## 다음 순서

| 우선순위 | 작업 | 완료 판단 |
|---|---|---|
| 1 | 연구·로드맵을 본 저장소에 보존하고 현재 상태와 연결 | [보존 목록](2026-09-23-research-archive.md), 과거 상태가 현재 작업 지시로 오인되지 않음 |
| 2 | 작은 작업과 명시적 PR 요청의 native 라우팅 관측 | [이번 관측](2026-09-23-native-routing.md). 실제 로드된 카탈로그·도구 행동·완료/실패를 확인. 문구 검색을 모델 정확도 PASS로 대체하지 않음 |
| 3 | native 선행 조건 통제 후 같은 조건의 과제 4쌍 비교 | [역할 지침 분리 후속](2026-09-23-role-dispatch.md): 정상 계획 PASS·결함 계획 BLOCK 관측. 실제 custom planner의 sandbox가 template과 다르고 자식 카탈로그도 변동하므로 먼저 해결할 조건으로 남김. 아직 속도 개선율 없음 |
| 4 | 실제 반복 실패 6–10건의 file/native memory 효용 비교 | 기록→검색→관련성→활용→독립 검증. 인용·hit만으로 효용 판정 금지 |
| 5 | 관측에 따라 절차·검색 인프라의 추가 조정 | 비교 근거가 생긴 부분만 변경. review/verifier/승인 경계는 유지 |

기존 [종합 연구](2026-09-22-paul-loop-research-and-roadmap.md)와
[provider 우선순위](2026-09-22-provider-priorities.md)는 당시 기록으로 보존한다.
과거의 소비 프로젝트 수리 제안은 이번 provider 작업의 다음 행동이 아니다.

## 열린 이슈의 상태 해석

- [#85](https://github.com/reach0908/paul-loop/issues/85): main의 memory CI에 재빌드 후
  `git diff --exit-code -- dist/cli.js`가 이미 있다. 열린 이슈 수를 그대로 미구현 수로 세지 않는다.
- [#87](https://github.com/reach0908/paul-loop/issues/87): 정책·카탈로그 변경과 native 라우팅
  관측을 구분한다. 모든 수용 기준을 충족하기 전 해결 완료로 닫지 않는다.
- [#35](https://github.com/reach0908/paul-loop/issues/35): 별도 loop-memory의 실제 hook/활용
  근거는 이번 ship-flow 관측으로 대체되지 않는다.
- #84·#86 및 #96–#103: 열린 보안·설계 backlog다. 이번 작업은 전체 재감사나 해결 선언이 아니다.

## 이번 변경의 수용 기준

1. 당시 연구 7개 문서의 출처/hash와 편집 범위를 보존하고, 최신 배포·미완료 상태를 명시한다.
2. 공개 문서에는 새 평가의 원시 대화·인증 정보·소비 프로젝트 데이터베이스 내용을 넣지 않는다.
3. native 관측은 기존 adapter/budget/임시 프로필을 재사용한다. 실제 발견된 전역 skill,
   host 제약, 누락된 이벤트와 timeout을 결과에 남기며 설정/trust를 우회하지 않는다.
4. 파일·행동 근거와 독립 검토 없이 효과·정확도·속도 PASS를 주장하지 않는다.
5. 문서 링크·증거 무결성을 확인하고, provider/consumer 및 로컬/CI/배포 상태를 구분한다.
