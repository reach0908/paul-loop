# loop-engine 기본 비교 브랜치 수정

기준: main `4bc97603b1d2012143489a35aed56d0eb714955d` (#119).
사용자의 “추천하는 다음 작업 진행”에 따라 확인된 기본 브랜치 오류를 수정하고 검증·PR을
준비한다. 새 PR 머지, 소비 프로젝트 설치 교체, 메모리 활성화는 포함하지 않는다.

## 원인과 변경 계약

`classify-risk.mjs --from-git`은 base를 생략하면 `origin/develop`을 사용했다.
이 저장소에는 해당 ref가 없어 사용법 오류(exit 2)가 발생했다. Node 진입점과 shell wrapper,
ship-feature의 plan/implement/pr/improve 호출, 위험 명령 hook을 확인했다. wrapper와 skill은
동일한 classifier를 사용하며, 위험 명령 hook은 `--command`/`--stage` 경로라 이 변경과 독립이다.

기본값 한 곳을 `refs/remotes/origin/HEAD`로 바꾼다. Git에 기록된 원격 기본 브랜치를
재사용하므로 브랜치명 목록, 새 설정 파일, 네트워크 조회가 필요 없다.

- 기본 브랜치가 main/master/develop/trunk여도 동일하게 동작한다.
- 명시한 `--from-git <base>`가 우선이며 다른 PR 대상에는 해당 fetched base를 지정한다.
- 완전한 ref 이름을 사용해 로컬 branch/tag `origin/HEAD`가 기준을 가리지 못하게 한다.
- remote HEAD 부재·깨진 참조·공통 조상 부재·잘못된 명시적 base는 exit 2다.
  다른 브랜치나 현재 HEAD로 대체하여 빈 diff를 만들지 않는다.
- 커밋·staged·untracked 경로 수집, 위험 규칙, gate 종료 코드와 merge/deploy 승인 경계는 유지한다.

origin 외 다른 remote를 쓰거나 `origin/HEAD`가 없는 초기화 방식에서는 명시적 base를 사용한다.
로컬 ref가 최신인지 확인하기 위한 fetch는 기존 Git 동기화 단계의 책임이며 이 명령이 대신 하지 않는다.

## 검증 기록

- 새 회귀 검사는 수정 전 main fixture에서 exit 2로 실패했다(`red.log`).
- 수정 후 기본 브랜치 4종, 명시적 override, 동일 이름의 로컬 branch/tag, detached HEAD,
  ref 부재/파손, 공통 조상 부재, 4개 변경 경로 수집, merge 단계 REQUIRE를 실제 Git과 CLI로 검사한다.
- 이 저장소에서 base를 생략한 실제 명령이 main merge-base `4bc97603b1d2`로 판정되는 것을 확인했다.
- 전체 engine suite, runtime/manifest/vendor 검사와 독립 리뷰 및 PR CI 결과는 검증 후 기록한다.

구현 계획 8개 경로의 위험 분류는 AUTO였다. 이 결과는 새 PR의 머지·배포 승인이 아니다.
배포 후보 버전은 loop-engine **0.15.8**이며 다른 plugin 버전은 그대로다.

## 이전 배포와 다음 작업

#119의 [배포 검증](https://github.com/reach0908/paul-loop/actions/runs/35962789634)은 SUCCESS다.
새 구조의 실행 job 9개가 성공했고 PR 전용 pinned review는 SKIP했다. 설치 상태나 실제 개발
속도 개선을 증명하는 결과는 아니다.

이 변경 이후 남는 작업은 #96 시크릿 검사 정책 보호, ship-flow의 동일 조건 과제 비교,
실제 반복 실패에서 memory의 검색·활용 효용 검증이다.
