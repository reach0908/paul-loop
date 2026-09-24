# #96 시크릿 검사 정책 보호

기준: main `5e5e3a16f4a4c395bcce3983935a42f22bbdd803`.
사용자가 #96 진행을 승인한 범위의 provider CI 변경이다. plugin 버전, 소비 설치,
메모리 인프라, GitHub 서버 보호 설정은 변경하지 않는다.

## 재현과 변경

기존 PR 검사는 제출된 `.gitleaks.toml`을 사용했다. 실제 Gitleaks 8.24.3으로 합성 토큰을
추가하면서 allowlist를 넓히면 exit 0이 되는 것을 재현했다. 설정만 고정해도 제출된
`.gitleaksignore`, 환경변수, `gitleaks:allow` 주석이 다른 예외 입력으로 남는다.

현재 고정된 action은 추가 CLI 옵션을 지원하지 않는다. 별도 wrapper나 중복 스캔 대신
같은 Gitleaks 8.24.3 CLI를 workflow에서 직접 실행한다. 다운로드한 Linux x64 archive의
SHA-256을 고정하고 실행 전에 검사한다. 정책 적용은 기존 workflow 안에서 끝낸다.

- PR 정책은 `pull_request.base.sha`, 검사 대상은 `pull_request.head.sha`에 고정한다.
  main push는 event SHA의 정책과 before..SHA 이력, 수동 호출과 최초 push는 해당 SHA의
  전체 도달 가능한 이력을 검사한다. base 변경은 `edited` 이벤트로 재검사한다.
- 기준 commit의 config와 선택적 ignore 파일만 소유한 임시 디렉터리로 가져온다.
  bare local clone과 임시 cwd를 사용해 제출된 작업 파일이나 ignore 파일을 읽지 않는다.
- `--config`로 환경변수보다 기준 정책을 우선하고, `--ignore-gitleaks-allow`로 제출된
  인라인 예외를 무시한다. 원래 checkout의 파일은 변경하지 않는다.
- 정책·head·base 참조 오류, 기준 config 부재, 잘못된 TOML과 검사기 실패는 job 실패다.
  PR 정책으로 대체하거나 오류를 PASS로 바꾸지 않는다.
- 검사 이후에만 제출된 회귀 테스트를 실행한다. 읽기 전용 권한, publish 선행 검사,
  기존 concurrency와 redacted SARIF artifact를 유지한다. 결과는 CLI 로그와 SARIF로
  확인하며, 제거한 action의 자동 PR 댓글·별도 summary 작성은 사용하지 않는다.
- `.gitleaks.toml`과 `.gitleaksignore`를 CODEOWNERS 민감 경로에 추가했다. 이는 기존
  engine pinned suite를 발동하는 표시이며, 정책 격리는 위 base 선택과 별개의 동작이다.

독립 후보 리뷰에서 두 개의 깨끗한 부모를 가진 merge commit에만 토큰을 추가하면 기본
`git log -p`가 merge diff를 생략하는 문제를 발견했다. 부모가 같은 조건을 재현해 실패를
확인했고 `--diff-merges=first-parent`와 해당 이력의 회귀 검사를 추가했다.

## 검증

| 검사 | 결과 |
|---|---|
| JavaScript 및 workflow YAML 문법, `git diff --check` | PASS |
| `node --test scripts/gitleaks-policy.test.mjs scripts/workflow-actions.test.mjs` | 6/6 PASS |
| config 확대·config symlink·환경변수·ignore 파일·기존 인라인 예외·토큰 추가 후 삭제·merge 전용 추가 | 7개 fixture에서 기존 방식 exit 0 재현, 수정된 실제 workflow body는 모두 토큰 탐지·exit 1 |
| 기존 memory 테스트 fixture, PR/main/manual/최초 push 범위, 기준 commit의 승인된 ignore | PASS, 원래 checkout 변경 없음 |
| 잘못된 policy/head/base, 누락 config, malformed TOML | 오류로 종료, PASS로 처리하지 않음 |
| 현재 main의 전체 도달 가능한 이력, merge diff 포함 | exit 0, SARIF findings 0 |
| 독립 조사·후보 리뷰 | 조사 완료. 후보 리뷰의 merge 누락 1건을 재현·수정하고 회귀 검사 통과 |

로컬 engine 전체 검사와 최종 PR CI는 별도 실행한다. 이 문서의 focused PASS가 전체 CI,
머지 또는 배포 완료를 뜻하지 않는다. 원시 재현·검증 로그는 이 저장소의 Codex Security
artifact collection에 보존한다.

## 한계와 참고

[ADR-0002](../adr/0002-codeowners-and-verifier-pinned-review.md)의 PR workflow 정의 자체에 대한
신뢰 한계는 유지된다. 이 변경은 PR이 실행 정의까지 바꾸거나 서버의 필수 검사를 우회하는
상황을 해결했다고 주장하지 않는다. 현재 기준 config는 내장 기본 규칙만 확장한다.
추후 외부 config 경로를 도입한다면 그 파일도 동일한 기준 revision에서 가져와야 한다.
추가 허용은 별도로 검토되어 기준 브랜치에 먼저 반영된 뒤 이후 PR에 적용된다.

- [기존 action의 고정 실행 인자와 SARIF 동작](https://github.com/gitleaks/gitleaks-action/blob/ff98106e4c7b2bc287b24eaf42907196329070c7/src/gitleaks.js)
- [Gitleaks 8.24.3의 config 우선순위와 ignore 입력](https://github.com/gitleaks/gitleaks/blob/v8.24.3/cmd/root.go)
- [Gitleaks의 Git 이력 명령](https://github.com/gitleaks/gitleaks/blob/v8.24.3/sources/git.go)
- [8.24.3 공식 release 및 checksum](https://github.com/gitleaks/gitleaks/releases/tag/v8.24.3)
