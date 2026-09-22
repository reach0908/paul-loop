# Worktree 교훈 보존 — 구현 및 검증 기록

대상은 paul-loop provider다. 시작점은 사용자가 머지한 #105의
`b14453833eefe2bfc4e55d30f37048d904721c5b`이다. 소비자 설치와 DB는 변경하지 않는다.

## 구현 범위와 수용 기준

1. `lessons preserve --id`가 producer worktree의 유효한 active lesson과 원래 FAIL/PASS/seal을
   확인한 뒤 Git 공통 디렉터리에 보존한다. 기존 lessonState와 evidence reader를 재사용한다.
2. 같은 로컬 Git 저장소의 다른 worktree에서 `lessons history --id` 또는 현재 실패 signature로
   조회한다. producer worktree를 삭제해도 교훈 내용과 당시 근거가 남는다.
3. 결과는 `current_verified: false`, `lesson.verified: false`인 역사적 참고 자료다.
   현재 recall/promotion/semantic graduation/검증 상태로 가져오거나 자동 승격하지 않는다.
4. 중복 보존은 같은 파일을 반환하고 재발 횟수를 늘리지 않는다. 손상된 기존 파일을 덮어쓰지
   않으며 내용·근거 변조, 잘못된 id, 다른 저장소로 복사한 archive를 거부한다.
5. 원본 교훈의 내용 변경·무효화·거절, 손상되거나 심볼릭 링크인 receipt는 새 보존을 거부한다.
   과거 snapshot은 이후 lifecycle을 추적하지 않는다. 조회는 현재 재검증의 FAIL을 바꾸지 않는다.
6. `LOOP_LEARNING_OFF=1`은 보존을 차단한다. 자동 cleanup/import, 새로운 DB/검색 서비스는 없다.

Git 공통 디렉터리가 사라지거나 이동하는 경우는 지원하지 않는다. archive는 Git push에 포함되지
않고 수동 조회만 지원한다. hash는 같은 사용자 권한의 위조를 막는 서명이 아니다.
이 단계는 보존 경로를 제공하며, 실제 검색·활용 빈도나 개발 속도 향상을 입증하지 않는다.

## 검증

실제 임시 Git worktree에서 verifier가 발행한 FAIL/fix/PASS와 seal을 사용한다.
미구현 `preserve`로 실패한 RED를 먼저 확인했고 첫 구현에서 GREEN을 확인했다.
실행 로그는 `.loop/lesson-preserve/`에 보존한다. 현재 집중 회귀는 다음을 실제 CLI로 확인했다.

- 보존→중복 재시도→worktree 제거→ID 및 현재 실패 signature 조회.
- raw 교훈·receipt·archive 변조, 잘못된 id, 외부 저장소 복사, learning freeze 거부.
- 두 실제 검증 run 중 하나만 손상돼도 부분 보존을 거부. 기존 recall의 유효 근거 선택은 유지.
- 파일 쓰기 중 ENOSPC를 주입해도 최종·임시 파일이 남지 않고 정상 재시도가 성공.
- history 조회가 현재 FAIL을 바꾸거나 원래 recall에 보존된 교훈을 자동 주입하지 않음.

설치/runtime 검사는 98 PASS / 0 FAIL / 1 opt-in SKIP. 실제 사용자 설치는 수행하지 않았다.
생성 패키지 재생성 비교, skill lock 일치, source strict manifest 검사 PASS.
전체 engine suite는 **80/80, VERDICT PASS / EXIT 0**, 366,785ms로 완료됐다.
내부 BAC-580 memory-source probe는 tsx 부재로 SKIP이며 PASS로 취급하지 않는다.
최종 커밋 CI는 PR에서 확인한다.

### Standards

P2 1건: 최종 파일에 직접 쓰면 중간 I/O 오류 후 부분 JSON이 남아 재시도도 막힌다.
동일 디렉터리의 임시 파일 완성·flush 뒤 배타 link로 발행하도록 수정했다.
리뷰어가 실제 verifier fixture에서 ENOSPC를 재현했고, 수정 후 집중 회귀 exit 0 및 추가 finding
없음을 확인했다.

### Spec

P2 1건: lessonState의 유효 subset만 보존하면 여러 run 중 손상된 근거가 조용히 누락된다.
보존 경계에서 원래 receipt 후보를 모두 검증하도록 수정했다. 두 실제 run을 생성한 회귀를
추가했고 독립 재검토에서 해소 및 추가 finding 없음을 확인했다.

발견: Standards 1 / Spec 1, 모두 수정·재검증. 최종 미해결 finding: 0 / 0.

## 로컬 동기화와 기존 배포

#105 MERGED와 origin/main fetch는 확인했다. 원래 `/Users/jinhokim/dev/paul-loop`의 로컬 main을
fast-forward하는 명령은 PreToolUse 검사가 차단했다. 안내받은 단일 `git merge --ff-only
origin/main`도 거부됐으며 우회하지 않았다. 원래 checkout과 기존 로컬 감사 파일을 보존하고,
origin/main에서 새 `codex/paul-loop-lesson-preserve` worktree를 만들어 개발한다.
이 작업 디렉터리의 최신 기준과 원래 로컬 main의 동기화 완료를 혼동하지 않는다.

훅이 안내한 `git fetch origin && git merge --ff-only origin/main`도 복합 명령이라는 이유로
거부됐다. provider의 `gate-before-merge.mjs` 역시 단일 merge/pull만 받으면서 protected branch는
일괄 거부하고, 오류 문구에는 이 복합 동기화 명령을 제시한다. 별도 정상 복구가 필요한
구체적인 후속 결함으로 기록하며 이번 보존 기능에 권한 게이트 변경을 섞지 않는다.

#105의 main 배포 workflow `35734162249`는 SUCCESS이고,
`loop-engine--v0.15.1`·`ship-flow--v0.11.2`가 모두 `b144538`을 가리킴을 원격 조회로 확인했다.
이 증거는 기존 배포의 완료이며 새 0.15.2 구현의 배포를 뜻하지 않는다.
