# Native Git routing and publisher context follow-up

관련: [#87](https://github.com/reach0908/paul-loop/issues/87). 일반 Git 작업과 내부 publisher의
분리를 재관측하던 중, publisher가 Builder 대화를 상속하는 결함을 발견하고 수정했다.
실제 Git 게시, 속도 개선, 보안 강제성 또는 #87 전체 완료를 주장하지 않는다.

## 범위와 실행 조건

- 기준 source: `c79f0078233042612a7dc7a8d4696c569247ac30` (#128 merge).
- 수정 source: `158bf7b1b57b63b4fda896c6d347b0ada52762e9`.
- 앱 CLI: `0.155.0-alpha.16.4`, 실제 turn context 모델 `gpt-6-luna`, effort `xhigh`.
- engine `0.15.13`, ship-flow 기준 `0.11.5` → 후보 `0.11.6`. native 세션에 loop-memory를
  설치·활성화하지 않았다. provider 테스트와 consumer memory 실사용은 별개다.
- 기존 `scripts/native-eval/adapter.mjs`와 `plugins.mjs`를 재사용했다. 각 실행은 임시
  CODEX_HOME에 auth 파일만 비공개로 복사하고 공식 CLI로 생성 plugin을 등록한 뒤 종료 시 제거한다.
  사용자 설정·설치·hook trust를 변경하지 않았다. custom publisher template도 임시 profile에만 둔다.
- 새 공통 원장 한도 600,000ms. 이전 원장의 215,784ms와 SHA-256을 보존했다.
  입력·원시 로그·probe·검사 로그는 `.loop/native-eval/git-routing-2026-09-27/`에 보관한다.
  공개 [evidence JSON](2026-09-27-native-git-routing-evidence.json)은 상태·호출·hash만 포함한다.

## 실제 관측

| 사례 | 시간 | 관측 결과 |
|---|---:|---|
| 모두 커밋하고 main 동기화·push | 39,253ms | publisher/ship-feature 호출 없음. 테스트 1개 통과 후 fetch가 `.git/FETCH_HEAD` 권한 오류로 중단. commit/push 미실행 |
| 기존 지침의 명시적 publisher handoff | 99,723ms | 실제 `agent_type=publisher`, 그러나 `fork_turns=all`로 Builder 이력 상속. 자식의 stdout 명령은 성공했지만 컨텍스트 분리 실패 |
| publisher 역할 미등록 | 115,001ms | generic child나 부모 직접 실행 없이 BLOCK. 다만 등록을 찾으려고 다른 worktree와 설치 cache까지 읽었으므로 최소 탐색이었다고 평가하지 않음 |
| 수정 지침의 동일 유형 handoff | 97,545ms | 실제 `agent_type=publisher`, `fork_turns=none`, 자식 역할과 `workspace-write` 확인. 자식이 literal stdout 명령 1회 실행, exit 0 |

일반 Git fixture에는 변경된 `note.txt`, 테스트, 로컬 bare origin을 준비했다. 전후 HEAD와
remote ref가 같고 수정 파일이 남은 것을 독립적으로 대조했다. 깨끗한 저장소의 no-op 성공이
아니다. host가 필요한 Git 쓰기를 거부했으므로 같은 전제의 push-only/main-update 및 bare 비교는
반복하지 않았다. sandbox 확대나 Git metadata 이동도 하지 않았다.

publisher fixture는 준비된 handoff의 `printf`로 `PUBLISHER_FIXTURE_OK`를 stdout에 내보내는
관측이다. 실제 push/PR/댓글 권한이나 완료를 대신하지 않는다. 기준 trace에는 자식 이력에
부모 session metadata가 함께 남고, 후보에는 별도 publisher session만 남았다. 둘 다 실제
역할은 publisher이며 부모·자식 sandbox는 workspace-write였다. 후보의 명시적 `none` 설정과
trace는 이번 실행의 이력 분리를 지지하지만 악의적 입력에 대한 보안 보증은 아니다.

## 적용한 수정

- publisher 호출자와 ship-feature 게시 단계에 Builder 이력 제외 및 `fork_turns="none"`을 명시했다.
  필요한 literal handoff와 계약만 전달하며, host가 이 경계를 제공하지 못하면 BLOCK한다.
- 실행자도 상속된 Builder 이력이 관측되면 명령 전에 BLOCK한다. 기존 역할·권한 검증과
  일반 Git 요청 제외 규칙을 유지한다. 별도 Git skill이나 실행 프레임워크를 추가하지 않았다.
- 생성된 caller skill·executor template·ship-feature 진입점의 계약을 회귀 검사에 추가했다.
- 평가 지침에 Git 사전조건 실패 후 종속 평가 중단, stdout과 rollout 동시 확인을 명시했다.
  이번 실패한 fetch는 stdout의 `command_execution` 항목에 없고 원본 rollout의
  `custom_tool_call`/output에만 exit 255로 남아 있었다.

## 해석 한계와 다음 조건

- 모든 native 프로세스가 정상 종료했어도 각 작업 판정은 위 표처럼 다르다. collection 완료를
  작업 PASS로 바꾸지 않는다. 각 경우 1회이며 순서 무작위화·반복·bare 대조가 없어서
  99,723→97,545ms를 성능 개선으로 해석하지 않는다.
- 부모 catalog는 32개지만 publisher 자식은 143개였다. `none`은 Builder 이력 복사를 막는
  설정이며 host의 다른 plugin catalog까지 고정하지 않는다. 비교 환경은 여전히 균일하지 않다.
- 누적 입력 토큰은 parent stdout의 사용량이다. 자식 전체 비용이나 고유 context 크기와 같지
  않으며 달러 비용은 미상이다. 정확한 토큰 수와 원장 사용량은 evidence JSON에 남긴다.
- #87의 routine Git 전체 회귀 및 실제 게시 경계는 미완료다. 관련 host/Git 권한 전제가
  달라졌을 때만 실제 commit/fetch/ff-only/push를 재평가한다. 역할 미등록 시 광범위한 파일
  탐색을 줄이는 것은 후속 후보이며 이번 수정으로 해결했다고 주장하지 않는다.

## 검증과 리뷰

- 신규 context 계약 assertion: 수정 전 실패, 수정 후 runtime 전체 11/11 통과.
  이후 같은 assertion을 기존 `scripts/install-codex.test.mjs`의 publisher 변환 검사로 옮겼다.
  engine 배포 파일은 기준 source와 byte-identical하며 후보 native 실행 때의 ship-flow 파일은
  이동 이후에도 그대로다. 검사 위치 변경 후 installer 전체를 다시 실행했다.
- native adapter 23/23, implicit publisher 제외 검사 1/1 통과.
- installer 87 통과 / opt-in 실제 CLI ingestion 1 SKIP. 위 native 실행은 별도 관측이다.
- engine 첫 전체 실행은 80/81, exit 1. engine 폴더에 추가한 생성물 assertion 때문에
  publish-freshness가 engine 미승격 변경을 감지했다. 위 위치 정리로 검사 내용은 유지하고,
  engine 원본을 복원했다. 최초 실패 로그를 보존하고 같은 전체 명령을 재실행해
  **81/81, exit 0**을 확인했다. 검사 범위나 버전 검사 규칙을 줄이지 않았다.
- marketplace/ship-flow strict manifest, vendor lock, 생성물 재현, diff 검사는 통과했다.
- `code-review` 고정 diff `c79f007…158bf7b`: Standards 0건, Spec 0건.
  이는 일반 코드 리뷰이며 독립 보안 심사나 host 격리 인증을 대신하지 않는다.

사용자의 지속적인 provider 개선·PR 게시 범위에서 준비했다. merge는 해당 PR의 사용자 승인에
남긴다. 후보 버전은 merge/tag 확인 전 배포 완료가 아니며 consumer 설치 갱신도 포함하지 않는다.
