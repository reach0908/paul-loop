# Plugin provenance 승인 fixture — #97 선행 작업

기준: #125 merge `e4c8d8258f58a7e7b4662d9422b0915bcdf938d7`.
범위: provider resolver의 테스트 자료와 버전 메타데이터. **#97은 미해결이다.**

## 원인과 순서

현재 project launcher와 plugin resolver는 설치 목록·manifest의 이름/버전을 확인하지만
별도로 승인된 코드 내용과 대조하지 않는다. 같은 이름과 버전의 다른 코드가 실행될 수 있다.
빈 사용자 설정과 임시 플러그인으로 재현했으며, 승인 파일 없이 실행한 코드가 sentinel을
생성했다(exit 0). 실제 설치된 플러그인의 침해를 발견했다는 뜻은 아니다.

[ADR-0002](../adr/0002-codeowners-and-verifier-pinned-review.md)에 따라 pinned review는
base의 전체 engine test 디렉터리를 복원한다. 기존 성공 fixture는 승인 없는 manifest만
만들므로, 누락된 승인을 거부하는 실행 코드와 같은 PR에서 바꾸면 과거 fixture가 복원된다.
검증기나 기존 거부 검사를 약화시키지 않고, 승인된 정상 자료를 먼저 머지한 뒤 실행 경계를
수정한다. #99의 [실제 Git fixture 선행 작업](2026-09-24-consumer-action-git-fixture.md)과 같은 순서다.

## 준비한 계약

- 테스트 작성자가 생성한 파일에 한해 명시적으로 승인 helper를 호출한다. 설치 경로의
  self-report, manifest, 곁에 놓인 provenance 파일 자체를 독립된 승인으로 취급하지 않는다.
- 승인값은 artifact 밖 프로젝트의 `.claude/paul-loop.lock.json` 또는
  `.codex/paul-loop.lock.json`에 둔다. 기존 schemaVersion/runtime/plugins 구조를 유지하고
  plugin entry에 `integrity: { repository, sourceCommit, sha256 }`를 추가한다.
- SHA-256 입력은 공백 없는 JSON 객체로, 키 순서는 runtime, name, version, repository,
  sourceCommit, files다. files는 상대 POSIX 경로를 JS 문자열 순서로 정렬한 객체이며 각 값은
  `{ sha256, mode }`다. 파일 내용은 원시 바이트, mode는 `stat.mode & 0o7777`을 사용한다.
  절대 설치 위치와 빈 디렉터리는 포함하지 않는다. symlink와 특수 파일은 거부한다.
- sourceCommit은 fixture 전용 `1` 40자리다. 실제 upstream Git 검증이나 소비자용 승인
  도구가 아니다. 운영 pin은 검토한 provider artifact에서 독립적으로 확보해야 한다.
- 기존 scope/우선순위/worktree/형제 플러그인/argv/cwd/exit/경로 탈출/import 검사를
  유지한다. 정상 실행 파일을 추가한 시점에만 명시적으로 재승인하며 공격 변조 뒤에는 하지 않는다.
- 별도 고정 hash 벡터와 내용·권한 변조, symlink 거부 검사가 fixture 승인의 동작을 검증한다.
  helper는 production에서 호출하지 않으며, 현재 resolver는 이 승인값을 아직 검사하지 않는다.

추가 의존성·CI job·검증기 변경은 없다. 테스트도 게시되는 engine subtree에 포함되므로
publish-freshness 계약에 따라 loop-engine 0.15.12 후보로 올린다.

## 검증과 후속 작업

- `node --test tools/loop-engine/test/plugin-path.test.mjs scripts/project-plugin.test.mjs`:
  30/30 PASS, skip 0. 기존 실행 동작과 새 fixture hash 벡터를 함께 확인했다.
- `node scripts/refresh-skill-lock.mjs --check`, runtime 생성 및 `--check`: PASS.
- Claude Code 2.1.282로 원본 marketplace/3개 plugin과 생성 Claude marketplace/3개
  plugin의 `claude plugin validate --strict`: 모두 PASS. diff 공백 검사도 PASS.
- fresh read-only candidate reviewer: 확인된 새 회귀 없음. 별도 임시 자료에서 resolver와
  launcher 모두 승인 없이 실행되는 기존 #97 동작을 다시 확인했다.
- 전체 engine 및 base 고정 검사는 PR의 CI 결과와 별도 증거 기록으로 확인한다.
  이 준비 작업의 PASS나 배포는 #97의 차단 효과를 입증하지 않는다.

머지 후 launcher의 inspect/sync/update/exec와 resolver의 env/registry/Claude 경로에
승인 누락·출처/버전/내용/권한 불일치의 거부를 적용한다. update가 새 cache를 자동 승인해서는
안 된다. 승인된 fork/vendor artifact와 이미 SHA를 검증하는 consumer CI setup도 보존한다.
후속 검증에는 같은 이름/버전의 payload 교체, 자체 provenance 교체, 추가 파일과 symlink,
변조 후 실행되지 않았다는 증거가 필요하다. 기존 독립 bootstrap 실행 계약도 유지한다.

이 신뢰 경계는 검토된 launcher와 승인 설정을 기준으로 외부 설치 artifact를 대조하는 것이다.
host 자체의 최초 plugin 로딩, 신뢰 설정 자체의 공격자 변경, 동일 권한 프로세스의 동시 변조를
모두 해결했다고 주장하지 않는다. 실제 소비자 lock/cache/설정이나 DB는 변경하지 않는다.
현재 권한은 provider 구현·검증·PR 게시까지이며 새 PR 머지는 사용자의 다음 결정이다.
