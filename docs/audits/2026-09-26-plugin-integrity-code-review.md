# PR #127 머지 후 code-review

사용자 요청: 머지한 #127을 `code-review` 스킬로 검토.
리뷰 대상: merge `c227062ecf3af0bee10b6c52df58951df4deda33`,
기준 `59c79506d735eb29002c9bc8e25db52b7b44f7d3`.
검토 worktree의 HEAD `7563aa1e863fe3a2a03ac92007e37345d7c50624`와 merge의
tree가 동일함을 `git diff --exit-code`로 확인했다.

고정 diff: `git diff 59c79506d735eb29002c9bc8e25db52b7b44f7d3...HEAD`.
커밋 목록: `7563aa1 fix: require independently approved plugin contents`.
14개 파일, 490 additions / 44 deletions. 소스나 테스트를 수정하지 않았다.

`/Users/jinhokim/.agents/skills/code-review/SKILL.md`에 따라 Standards와 Spec을
서로 다른 새 읽기 전용 작업의 리뷰어에게 맡겼다. 이는 작업 지침상 읽기 전용 리뷰이며,
호스트 sandbox 격리나 이전에 중단된 전문 보안 검증의 완료를 뜻하지 않는다.
`docs/agents/issue-tracker.md`가 없어 GitHub #97과 설치·호환성 문서를 직접 사용했다.
공통 스킬의 이슈 트래커 연결을 설정하려면 `/setup-matt-pocock-skills`를 실행해야 한다.
이번 리뷰는 이미 확인한 GitHub 이슈를 사용했으므로 설정 작업 때문에 중단하지 않았다.

## Standards

**[P2] 필수 승인값 도입에 맞춰 기존 설치·진단 예제를 갱신해야 한다.**

변경 지점은 `scripts/project-plugin.mjs:87`의
`approvalDescriptor(entry.integrity, name)` 및
`tools/loop-engine/bin/plugin-path.mjs:146`의 필수 승인 분기다.
그러나 `docs/codex-installation.md:142`부터는 여전히 id/version만 있는 lock을 만든
뒤 doctor를 실행하도록 안내한다. 정확한 설치 버전을 넣어도 승인 누락으로 종료한다.
`docs/runtime-compatibility.md:120`부터도 generated registry만으로 동작한다고
설명하고, 124–128행의 저장소 진단 명령에는 승인 lock이나 commit pin이 없다.
이는 해당 문서의 Installation resolution 계약과 새 동작의 불일치다.
두 예제를 `docs/project-installations.md:34`부터의 승인값 준비 절차로 연결하고
필요한 입력을 명시해야 한다. 승인 검사를 유지하는 수정이 적절하다.

그 밖의 실행 가능한 기준 위반이나 수정 권고할 baseline smell은 보고되지 않았다.
두 entrypoint의 동일 검증 블록은 가능한 Duplicated Code이지만, 단일 파일 복사 계약과
일치 검사 때문에 별도 모듈로 추출하라는 권고는 하지 않는다.

## Spec

**[P2] 새 필수 승인값을 기존 설치·진단 안내에도 반영해야 한다.**

현재 설치 계약은 “필요한 plugin의 version과 integrity만 기존 lock에 명시적으로
반영한다”이다(`docs/project-installations.md:38`). 반면 Codex 설치 안내는
“create a project … lock.json with installed identities and … exact versions”라고
안내하고 id/version 예제로 doctor를 실행한다(`docs/codex-installation.md:142`).
승인값 생성·복사 절차나 새 계약으로 연결하는 링크도 없다.
정상 설치 후 예시 버전을 최신 값으로 맞춰도 host 조회 전에
`independent integrity approval missing`으로 실패한다.
같은 누락으로 호환성 문서의 “offline read-only probe”도 실패한다.
승인 검증 자체는 의도된 변경이며, 두 안내에 승인값 준비·전달 절차를 추가해야 한다.

이슈 #97의 환경 allowlist 권고는 구현되지 않았다. 현재 audit과 설치 계약은 호출자
환경을 신뢰 전제로 두며 해당 정책을 범위에서 명시적으로 제외한다. 이번 일반 리뷰는
그 범위 결정을 새로운 구현 결함으로 단정하거나 원래 보안 요구 전체가 충족됐다고
판정하지 않는다. 미검증 가설은 확정 finding에 포함하지 않았다.

## 검증과 한계

- Codex 설치 문서의 JSON 예시를 그대로 임시 디렉터리에 기록하고 양쪽 readLock을
  호출했다. 기준 커밋은 수용했고 merge와 동일한 새 코드는 승인 누락 오류로 거부했다.
  호스트 CLI 호출 전 결과이며 실제 설치본·소비자 설정·캐시에는 접근하지 않았다.
- 위 확인은 `node --input-type=module`에서 `assert.equal`과 `assert.throws`로 검사했고
  종료 0이었다. 임시 디렉터리는 확인 후 제거했다.
- 두 리뷰어는 정적 코드·문서·기존 테스트를 검토했다. 이번 읽기 전용 리뷰에서 전체
  engine/installer/native suite를 새로 실행하거나 기존 PASS로 대체하지 않았다.
- PR head의 기존 hosted checks 10개는 현재 조회에서도 SUCCESS다. 이 증거는 해당
  head에만 적용되며 보안 검토 공백을 해소하지 않는다.
- 이전 전문 보안 리뷰의 도구 보안 필터 중단은 재시도하거나 다른 리뷰로 우회하지
  않았다. 이번 결과는 Standards/Spec 일반 코드 리뷰이며 보안 수정 완료 판정이 아니다.
- GitHub #97은 조회 시 CLOSED였다. 이 리뷰가 이슈를 닫거나 외부 리뷰를 게시하지 않았다.

## 머지·배포 관찰

#127은 2026-09-26 04:30:53 UTC에 merge됐다. 배포 workflow 36218058612는 마지막
조회에서 진행 중이었다. runtime·memory·secret 검사는 성공했고 engine selftest는
진행 중, PR 전용 pinned-review는 해당 push 이벤트에서 SKIPPED였다. 이는 PASS가 아니다.
이 시점에 원격 `loop-engine--v0.15.13`, `ship-flow--v0.11.5` 태그는 조회되지 않았다.
배포 완료 또는 consumer 설치 갱신을 주장하지 않는다.

로컬 보고서 기록 분류: AUTO, docs-only, low/full/low. 새 코드·커밋·PR·외부 댓글은
만들지 않았다. 기존 사용자 파일과 설치 상태를 유지했다.

Standards: P2 1건. Spec: P2 1건. 두 축이 같은 문서 불일치를 가리킨다.
