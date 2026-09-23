# CI 중복 제거와 남은 자체 개선

기준: main `c38b5754bbb376ef329456ca83514b65006761e1`, 2026-09-23.
사용자의 “추천하는 방향으로 진행”에 따라 paul-loop 공급자 저장소의 CI 경량화와 #101을
구현한다. 기존 배포 진행 지시에 따라 검증·리뷰·PR까지 준비하며, 새 PR의 머지는 별도다.
소비 프로젝트 설치, 메모리 DB 활성화, 브랜치 보호 변경은 포함하지 않는다.

## 확인한 문제와 변경 계약

#115–#118은 32초 안에 머지되었고 main 워크플로 18개를 시작했다. 마지막 커밋의
[배포 검증 35833614190](https://github.com/reach0908/paul-loop/actions/runs/35833614190)은
10개 job SUCCESS, PR 전용 pinned review 1개 SKIP으로 끝났다. 기존 버전 태그는 유지된다.

| 항목 | 변경과 유지 조건 |
|---|---|
| main 중복 검증 | 4개 validator의 직접 push 트리거를 제거하고 `tag-on-publish`의 동일 SHA 호출만 유지 |
| PR 재실행 | workflow별 고유 prefix + PR 번호로 오래된 실행을 취소. 재사용 배포 호출은 run ID로 격리하고 취소하지 않음 |
| 배포 필수 검증 | engine, memory, runtime, secrets-scan 의존성 및 tag job의 쓰기 권한 경계 유지 |
| 호환성 검사 | Linux/macOS × Node 22/24와 고정 Claude 2.1.261 schema check 이름 유지 |
| Claude latest | main의 주간·수동 canary로 분리. release 의존성, artifact 업로드, 저장소 secret 주입 없음. 실패를 성공으로 변환하지 않음 |
| Claude 설치 | `.github/claude-code/package-lock.json`에 wrapper와 native binary 버전·npm registry URL·SHA-512를 고정. `npm ci --ignore-scripts` → registry signature 검사 → 고정 installer 실행 순서 |
| Dependabot | Actions minor/patch 업데이트만 묶음. major 업데이트는 별도 검토 |

전체 경로 변경 시 main 기준 top-level 실행은 5개에서 1개, 실행 job은 19개에서 9개로
줄어든다. 중복 제거로 9개, 매번 수행하던 latest 검사 분리로 1개가 줄며 주간 canary는
별도로 실행된다. 약 53%는 **설정상 job 수 감소**이며 실측 시간·청구액·모델 작업 속도가 아니다.

`edited` 이벤트는 유지한다. 제목/본문 수정 시 건너뛴 성공 check가 이전 실패를 가리는
문제 없이 base retarget 검증을 유지하려면 별도 설계가 필요하다. 이번에는 그 조건 분기를
추가하지 않았다. 새 CLI 고정 버전을 선택할 때는 package.json/lock과 기존 schema check
이름을 함께 갱신하고, canary의 결과는 해당 버전 채택 근거로만 사용한다.

GitHub의 [재사용 workflow concurrency 주의사항](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)에 따라
caller의 `github.workflow` 이름을 네 validator의 공통 group으로 재사용하지 않았다.
Dependabot은 [기본 groups 옵션](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups--)을 사용한다.

## 검증 기록

- workflow action/trigger/권한/CLI lock 검사와 runtime packaging: 15/15 PASS.
- 분리된 fixture에서 중복 main push, concurrency 충돌, required latest, 서명 검사 누락,
  native integrity 누락의 다섯 변형을 모두 실패로 검출.
- 변조한 wrapper integrity로 실제 `npm ci` 실행: EINTEGRITY로 실패, installer 미실행.
- macOS에서 고정 CLI 설치 후 registry signature 2개 검증, Claude 2.1.261 실행 확인.
  registry signature는 npm 배포물 검증이며 소스 빌드 provenance attestation을 대신하지 않는다.
- actionlint 1.7.12 PASS. 공식 릴리스 checksum을 확인한 임시 바이너리 사용.
- skill lock 및 생성 runtime package 재현성 PASS.
- 전체 engine suite, strict manifests, 독립 리뷰, 새 PR hosted CI: 진행 중. 완료 결과로 갱신한다.

## 자체 개선은 남아 있다

CI 정리는 개발 과정의 낭비를 줄이지만 ship-flow의 실제 효과를 입증하지 않는다.

1. **ship-flow:** 같은 권한·카탈로그·과제로 기본 모델과 비교하는 4쌍 평가가 남았다.
   작은 작업이 불필요한 계획/역할 위임을 거치는지, 소요시간·호출·사용자 개입·검증 결과를
   비교한 뒤 필요 없는 절차를 삭제한다. #87의 source 지침 변경과 실제 host 라우팅을 구분한다.
2. **loop-engine:** 부모/자식 권한·카탈로그 차이와 provider/설치 runtime 차이를 통제한
   native 검증이 남았다. 이미 있는 doctor·평가 도구를 먼저 사용하며 새 controller를 만들지 않는다.
3. **loop-memory:** #35의 실제 hook → 관련 기억 검색 → 수정에 활용 → 독립 검증 증거가
   부족하다. 실제 반복 실패 6–10건으로 파일 lesson/native memory/semantic recall을 비교한다.
   표본과 효용이 확인되기 전 DB를 기본 활성화하거나 검색 계층을 늘리지 않는다.
4. **남은 결함·설계:** 다음 작은 수정은 #96(보호된 시크릿 검사 정책). #99, #98, #97,
   #84, #86은 별도 신뢰·개인 데이터 설계 backlog다. #85의 dist 재빌드 대조는 이미 CI에 있어
   구현을 반복하지 않고 이슈 정리 대상으로 취급한다.

다음 순서는 이 CI PR 검증·머지 → #96 → 같은 조건의 실행/기억 효용 평가다.
