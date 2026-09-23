# 파일 lesson 저장 경로 제한 (#103)

기준: #111 merge `16e2e90eec550f680fb88d5585050cf48f698b45`.
사용자의 다음 자체 개선 요청과 기존 provider 발행 권한으로 진행한다.
호스트 권한·카탈로그 통제와 실사용 memory 표본 확보는 별도 조건으로 남아 있다.
이번 범위는 [#103](https://github.com/reach0908/paul-loop/issues/103)의 CLI 경로 결함이다.
소비 프로젝트·설치·DB·native config는 변경하지 않는다.

## 수용 기준

1. 모든 직접 ID와 `--superseded-by`는 producer가 생성하는 소문자 16자리 hex만 허용한다.
   저장 파일명과 JSON 내부 ID가 다르면 해당 데이터를 수정·조회 결과로 사용하지 않는다.
2. 공통 저장 함수에서 lesson 디렉터리와 상위 경로, lesson 파일의 symlink를 거부한다.
   존재하지 않는 디렉터리도 생성 전에 검사한다. 별도 명시한 물리적 lesson 저장 경로는 허용한다.
3. 임시 파일을 배타적으로 만들고 rename하여 기록한다. 미리 설치된 symlink를 따라 외부 파일을
   덮어쓰지 않는다. 정상 record/recall/challenge/retire/invalidate 및 검증 receipt 계약은 유지한다.
4. 임시 fixture에서 traversal·변조 ID·symlink 회귀의 RED/GREEN과 기존 lesson 검사·engine 전체·
   생성 패키지·strict manifest·독립 Standards/Spec 리뷰를 확인한다. 검증 조건을 완화하지 않는다.
5. engine만 0.15.6 후보로 갱신한다. PR·해당 head CI까지 완료하고 merge는 사용자에게 남긴다.

## 범위와 한계

저장 경로는 물리적 경로여야 한다. `/tmp`나 `/var`가 symlink인 시스템에서는 실제 경로를
전달한다. 이는 외부의 명시적 lesson 저장소 사용을 금지하는 정책이 아니다.
동일 OS 권한의 악의적 프로세스가 검사와 사용 사이에 상위 디렉터리를 동시에 바꾸는 공격의
완전한 격리를 주장하지 않는다. 실사용 메모리 효과나 별도 loop-memory DB 검증도 아니다.

## 구현 권한

처음 계획한 11개 경로와 보존 reader·물리적 fixture 경로 보완 후 13개 경로의 classifier는 many-files 기준으로
REQUIRE/risky를 반환했다.
사용자의 “남은 개선작업들도 진행해줘”, “머지했어 다음 작업 진행해줘” 및 기존 자체 개선·
발행 요청을 이 provider 수정에 재사용한다. 분류를 AUTO로 바꾸거나 실행 거부를 우회하지 않는다.
외부 발행 명령은 최종 diff와 함께 별도로 분류한다.

## 선행 배포 확인

#111의 [tag workflow](https://github.com/reach0908/paul-loop/actions/runs/35767502478)는 SUCCESS다.
원격 `loop-engine--v0.15.5`와 `ship-flow--v0.11.3`이 모두 기준 merge SHA를 가리킨다.
새 작업은 이 SHA를 fetch한 별도 worktree에서 진행한다. 이전에 설치 훅이 거부한 canonical
main fast-forward를 다른 명령으로 우회하지 않았고, 기존 미추적 감사 문서도 보존했다.

## 변경과 재현

기존 공통 저장 함수는 직접 입력한 ID뿐 아니라 JSON에서 읽은 ID도 경로로 사용했다.
임시 sibling `victim.json`에 `id: ../victim`을 넣고 `challenge --id ../victim`을 실행하면
기존 코드가 exit 0으로 기록을 수정했다. 새 회귀는 exit 2와 외부 파일 무변경을 요구해 RED를 냈다.

수정은 CLI와 공통 read/write/list 함수에 한정한다. direct ID와 replacement ID를 파싱할 때
제한하고, 읽은 JSON ID가 요청 파일명과 다르면 오류로 남긴다. 상위 디렉터리를 검사한 뒤
생성하며, CLI·preserve·history 읽기는 같은 nofollow FD 함수를 사용한다. 임시 파일은 UUID와 배타적 생성으로 만들고
rename한다. 목록도 같은 읽기 함수를 사용해 `mark-clean`의 저장 경로를 따로 남기지 않는다.

신규 파일/디렉터리는 0600/0700으로 생성한다. 기존 파일 권한을 일괄 변경하지 않으며,
다른 `.loop/` 산출물의 권한 이슈 #86까지 해결한 것으로 해석하지 않는다.
새 외부 라이브러리·공통 저장 프레임워크·검색 인프라는 추가하지 않았다.
별도 writer인 `gstack-scan.mjs` 등 모든 lesson 생산자를 변경한 작업은 아니다.

기존 테스트의 category 없는 legacy fixture는 producer형 ID로 바꿨다. notfound와
superseded-notfound는 형식이 유효하지만 없는 ID를 사용해 기존 실패 분기를 유지한다.
fixture helper는 이미 구한 실제 root 경로를 넘긴다. receipt pairing·승격·retire·재발·검증
동일성 assertion은 제거하지 않았다. 새 경로 회귀는 기존 evidence-integrity 실행에 포함된다.

## 검증 상태

- RED: traversal이 실제 exit 0을 반환하여 기대 exit 2 assertion 실패.
- GREEN: 직접/저장 ID, symlink leaf·ancestor·dangling, 임시 파일 생성 직전 link 주입,
  외부 파일과 원래 lesson 무변경, lock 해제 후 정상 재실행 검사 통과.
- 추가 RED/GREEN: 독립 Spec 리뷰가 찾은 `preserve`의 검사 후 leaf 교체를 재현했다.
  기존 경로는 외부 sentinel을 읽은 뒤 내용 검증으로 exit 2였다. 이를 성공한 보존으로
  표현하지 않는다. 공유 FD 읽기로 보완한 뒤 challenge/preserve 모두 외부 읽기 없이 실패한다.
- 기존 hygiene/category 및 실제 verifier receipt→lesson→worktree history 검사 통과.
- 생성 재현·vendor lock 및 strict manifest 3개(source marketplace, engine, 생성 Claude marketplace) 통과.
- installer/native: 132개 중 **131 PASS·1 opt-in SKIP**. native 실제 모델 호출 검증이 아니다.
- 첫 engine 전체는 **80/81**이었다. macOS `/var` alias를 그대로 전달한 genericity fixture가
  새 물리적 경로 계약에 걸렸다. 임시 디렉터리를 `pwd -P`로 전달하도록 바꾸고 기존 recall-miss
  assertion은 유지했다. 해당 focused 검사는 통과했다.
- 후속 전체 로그 `engine-final.log`는 **81/81**로 끝나지만 사용자 중단 이후 exec 세션의
  종료 코드를 회수하지 못했다. 잔존 프로세스가 없음을 확인했고 로컬 실행 완료 PASS로
  확정하지 않는다. 발행 후 해당 head의 CI engine 전체 검사를 최종 완료 근거로 확인한다.

로컬 로그는 `.loop/lesson-id/`에 보존한다. 모든 경로 공격은 폐기 가능한 fixture 안에서만
실행했으며, consumer 파일이나 DB를 대상으로 재현하지 않았다.

## Standards

잔여 finding과 actionable smell은 0건이다. 추가 reader 보완까지 검토하여 FD·nofollow·
fstat·동일 FD 읽기·finally close의 일치를 확인했다. 원본 receipt 배열 전체 검증과
history의 `current_verified: false`도 유지된다. reviewer는 RED/GREEN 로그를 대조했으며,
전체 테스트·모델·consumer 실행을 반복하지 않았다.

## Spec

초기 P2 한 건: preserve의 별도 pathname 읽기가 검사 이후 leaf 교체를 허용했다.
같은 FD reader를 사용하고 재현 회귀를 추가해 해소했다. 최종 잔여 finding은 0건이다.
reviewer는 전체 원본 receipt 재검증·active lifecycle·history 미검증 상태 유지와 보완
RED/GREEN 로그를 대조했다. 최종 전체 suite·head CI와 소비 환경 효용까지 판정한 리뷰는 아니다.

## 발행 경계

최종 13개 경로와 실제 push/PR 명령 classifier는 REQUIRE/risky다. 사용자의 기존
“배포도 알아서 진행하고 개선점들도 계속해서 개발 진행해줘”와 이번 다음 작업 요청을
`reach0908/paul-loop`, `codex/paul-loop-lesson-id` → `main`의 engine 0.15.6 후보 PR에 재사용한다.
분류 원문은 PR 본문에 포함한다. 이는 merge·설치 교체·별도 loop-memory 활성화 권한이 아니다.
