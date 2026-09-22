# 로컬 fast-forward 동기화 게이트 수정

사용자가 #106 머지를 알리고 다음 자체 개선을 요청했다. 기준 커밋은
`a031fce3e594c05f8f2459a8ce898d6fe90ccc11`이며, provider source를 별도 worktree에서 수정한다.
원래 checkout의 파일과 설치된 플러그인 캐시는 변경하지 않는다.

## 문제와 수용 기준

`gate-before-merge.mjs`는 보호 브랜치의 모든 merge/pull을 거부하면서
`git fetch origin && git merge --ff-only origin/main`을 권했다. 같은 훅이 복합 명령도 거부해
실행 가능한 안내가 아니었다. 임시 로컬 remote를 실제 clone/fetch한 회귀에서 재현했다.

1. 실제 실행 디렉터리가 같은 Git 저장소이고 현재 브랜치가 확인된 경우에만 동기화를 판단한다.
2. 허용 형태는 단일 리터럴 `git merge --ff-only origin/<현재 브랜치>`다.
   fetch는 별도 도구 호출로 실행한다. pull, 다른 source, 추가 옵션·환경 prefix·경로 변경·
   복합 명령은 이 예외에 포함하지 않는다. 셸 확장이 일어날 수 있는 브랜치명도 제외한다.
3. 짧은 source 이름이 정확한 `refs/remotes/origin/<현재 브랜치>`로 해석되고, HEAD가 그 ref의
   ancestor여야 한다. ref 누락, local branch/tag shadow, divergence, local-only commit을 거부한다.
4. 설정된 보호 브랜치와 linked worktree에서도 실제 실행 브랜치를 사용한다. 다른 저장소,
   사라진 경로, 실행 디렉터리 미확인은 동기화 예외를 받지 않는다.
5. 게이트 자체는 Git 상태를 변경하지 않는다. 허용 후 실제 fast-forward가 실행되고 미추적
   파일이 유지됨을 확인한다. 일반 feature branch 병합 및 merge abort의 기존 동작도 유지한다.

이는 기존 차단 계약의 명시적이고 좁은 변경이다. 기존 deny 회귀는 유지하고 새 허용·거부
행동 회귀를 추가한다. 원격 PR merge/deploy 승인, 서버 보호, 위험 명령 classifier는 바꾸지 않는다.
`risk-rules.json` 누락과 설치된 기존 훅의 정상 업데이트는 별도 문제로 남긴다.

## 한계

검사 대상은 로컬의 remote-tracking ref이며 서버 최신 상태나 PR 승인 여부를 증명하지 않는다.
같은 사용자 권한의 ref/config 변경과 검사 후 동시 변경을 막는 보안 경계도 아니다.
Git의 `--ff-only`가 실제 실행 시 fast-forward를 강제한다. source 테스트 통과만으로 설치된
Claude/Codex 플러그인의 동작이 바뀌었다고 주장하지 않는다.

## 검증 기록

로그는 `.loop/git-sync/`에 저장한다. 최초 회귀는 4개 중 3개 실패로 기존 차단과 모순 안내를
재현했고, 좁은 허용 경로 및 셸 리터럴 제한을 적용한 집중 회귀 5개는 PASS다.
전체 engine은 **81/81, VERDICT PASS / EXIT 0**, 384,635ms로 완료됐다.
내부 BAC-580 memory-source probe는 tsx 부재로 SKIP이며 PASS로 취급하지 않는다.
최종 head CI는 이 변경의 PR에 남긴다.

- 생성 패키지 재현 비교, skill lock 일치, strict marketplace/engine manifest 검사 PASS.
- 생성된 Codex 어댑터를 직접 실행한 임시 fixture에서 정확한 sync는 defer, 일반 merge와
  pull은 deny임을 확인했다. 이는 어댑터 subprocess 검사이며 native host 설치·신뢰 검사가 아니다.

### Standards

미해결 finding 0건. staged 9개 파일과 관련 파서·런타임 경로를 독립 정적 검토했다.

### Spec

미해결 finding 0건. 수용 기준과 diff, 집중 회귀 5 PASS 로그를 독립 대조했다.

## 앞선 배포와 현재 실행 환경

#106의 tag-on-publish run `35740524285`는 SUCCESS이고 `loop-engine--v0.15.2`가
`a031fce`를 가리킴을 원격 조회로 확인했다. 이번 source 후보는 0.15.3이다.
기존 설치 캐시를 편집하거나 원래 checkout에 거절된 동기화 명령을 우회 실행하지 않았다.
이 provider 변경이 배포·명시적 runtime 업데이트를 거치기 전까지 기존 훅의 동작은 그대로다.
