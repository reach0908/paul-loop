# Plugin provenance 실행 경계 — #97

기준: #126 merge `59c79506d735eb29002c9bc8e25db52b7b44f7d3`.
범위: provider launcher/resolver, 승인 지문 생성, 기존 CI setup의 pin 전달.

## 문제와 신뢰 기준

기존 resolver는 승인 없는 동일 이름/버전 artifact의 코드를 실행했다. 임시 plugin의
sentinel 생성으로 재현했다. 신뢰하는 프로젝트 launcher 또는 복사한 resolver가 읽는
프로젝트 lock에 독립적으로 검토한 repository·sourceCommit·파일 지문을 둔다.
cache/registry 또는 artifact 곁의 자체 provenance만으로 승인을 얻을 수 없다.

신뢰 기준은 검토한 launcher·프로젝트 lock·호출자 환경이다. 미검토 프로젝트가 자기 lock과
launcher를 함께 바꾸는 공격, host native 최초 plugin 로딩, 공격자가 이미 시작 스크립트를
실행한 경우, 동일 권한 프로세스의 동시 변조를 모두 해결하는 sandbox라고 주장하지 않는다.
임의 verifier에 필요한 호출자 환경은 보존한다. 이 경계의 원인은 cache substitution이며
별도 환경 allowlist 정책이나 consumer 설치 변경은 포함하지 않는다.

## 변경한 동작

- launcher의 모든 doctor/sync/update/exec 및 resolver의 env/registry/Claude 경로가 승인
  검증을 통과해야 artifact 경로를 반환한다. 누락·불일치에는 다른 설치로 fallback하지 않는다.
- #126의 digest 계약대로 runtime/name/version/repository/sourceCommit, 완전한 상대 파일
  목록, 원시 내용 SHA-256, 권한을 묶는다. 추가/누락 파일, symlink/특수 파일/특수 권한을
  거부하며 `__proto__` 같은 파일 이름도 목록에 포함한다. 빈 디렉터리는 제외한다.
- 두 entrypoint의 동일한 검증 블록은 단일 파일 복사 계약 때문에 포함하며 테스트로 일치를
  확인한다. 선택한 외부 cache에서 검증 helper를 먼저 import하지 않는다.
- reviewed next lock을 `update --approved-lock`으로 전달하면 기존 ID/runtime/scope 안에서
  검증된 버전으로 갱신할 수 있다. 새 cache에서 expected hash를 계산하지 않는다.
  승인이 없는 변경은 기존 lock/registry를 보존하고 host 갱신 부분 완료를 보고한다.
  disabled 설치, 동시 편집, rollback 보존은 계속 검사한다.
- generator는 검토할 원본 Claude 및 생성 Claude/Codex 지문을 별도 파일로 출력한다.
  소비자 lock에 필요한 값을 명시적으로 반영해야 하며 sourceCommit 자체는 서명이 아니다.
- CI는 복사한 action의 독립 commit pin을 유지한다. 실제 Git blob, 실행 비트와 파일 목록을
  비교해 `git status`에 숨긴 변경도 거부하고, 이후 step에 pin을 export한다.
- 검토된 fork/vendor, build metadata 버전, scope와 worktree fallback, literal argv/cwd/exit,
  단독 복사/직접 실행/import 동작, native activation/hook-trust 미확인 상태를 보존한다.

## 검증과 배포 범위

집중 검사에는 승인 누락, 내용/권한/출처/commit 변조, 자체 provenance, 추가/누락 파일,
symlink, prototype 이름, index-hidden/ignored 파일과 실행되지 않은 sentinel 확인을 포함한다.
기존 복구·업데이트 검사와 실제 Git setup도 유지한다. 로컬 결과는 집중 검사 50/50,
전체 engine 81/81, 설치·네이티브 평가 110 passed/1 skipped다. 생략은 명시적 opt-in인
official CLI ingestion이며 실제 consumer 설치·활성화를 검증했다고 주장하지 않는다.
원래 재현은 수정 전 child exit 0/sentinel 생성에서 수정 후 exit 1/미생성으로 바뀌었다.
생성 패키지·생성물 일치·원본/생성 manifest·vendor lock 검사도 통과했다.
고정 기준 CI와 최종 커밋 결과는 PR checks 및 별도 증거에서 확인한다.
verifier, CODEOWNERS, CI job/의존성은 추가하거나 약화시키지 않았다.

**보안 수정 완료 판정은 blocked다.** 사전 경계 조사는 완료했지만 독립 후보 리뷰가
도구의 보안 필터로 중단되어 최종 리뷰를 받지 못했다. 해당 중단을 우회해 재시도하지
않았다. hash 대상 subtree 밖의 저장소를 사용하는 승인된 script에 관한 리뷰 중 가설은
아직 검증되지 않았으므로 확정 finding으로 쓰거나 추측성 수정을 하지 않았다.
필수 독립 검토를 마치기 전까지 이 후보는 draft이며 #97을 닫거나 merge/release하지 않는다.
로컬 PASS와 hosted CI PASS도 이 검토 공백을 대체하지 않는다.

14개 경로에 대한 분류는 `DENY_AND_LOG`, blast=high/reversibility=full/cost=low였다.
이는 shared AUTHORIZATION 계약의 가역적 변경 verdict 경로이며 기존 구현·PR 준비 권한으로
진행했다. command 실행 거절을 우회한 것이 아니며 새 PR 머지는 사용자의 별도 결정이다.

후보 버전은 loop-engine 0.15.13, ship-flow 0.11.5다. loop-memory는 0.8.0을 유지한다.
기존 복사본/lock/CI action은 [설치 안내](../project-installations.md)에 따라 명시적으로
옮겨야 한다. marketplace 배포가 실제 소비자 cache나 프로젝트 승인값을 바꾸지는 않는다.
