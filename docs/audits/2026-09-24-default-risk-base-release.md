# loop-engine 0.15.8 머지·배포 확인

사용자의 “머지했어” 확인 후 PR, 배포 workflow와 원격 태그를 직접 조회했다.

- [PR #121](https://github.com/reach0908/paul-loop/pull/121): MERGED,
  2026-09-24T13:34:02Z, merge commit `5e5e3a16f4a4c395bcce3983935a42f22bbdd803`.
- [tag-on-publish run 36006534621](https://github.com/reach0908/paul-loop/actions/runs/36006534621):
  위 merge commit에서 SUCCESS. engine, memory, runtime, secrets-scan, tag를 포함한
  실행 job 9개가 성공했고 PR 전용 verifier-pinned-review 1개는 조건에 따라 SKIP했다.
- 원격 `loop-engine--v0.15.8`이 동일한 merge commit을 가리키며 로컬에도 fetch했다.
- marketplace 및 plugin manifest의 engine 버전은 0.15.8이다.
  ship-flow 0.11.3, loop-memory 0.7.0은 유지한다.
- 작업 worktree `/Users/jinhokim/.codex/worktrees/paul-loop-lesson-id/paul-loop`를
  위 commit의 detached HEAD로 동기화했다. 기존 feature branch와 미추적 감사 문서는 보존했다.
  원래 `/Users/jinhokim/dev/paul-loop`의 main 체크아웃은 이번에 변경하지 않았다.
- 동기화된 worktree에서 base 없는 `classify-risk.mjs --from-git`이
  `BASE=5e5e3a16f4a4`로 정상 판정됐다. 이전 PR의 소스와 merge 결과도 일치한다.

원시 workflow 결과와 검증 receipt는 `.loop/default-risk-base/release-run.json`,
`release-receipt.json`에 저장했다. 구현 및 이전 검증은
[기본 비교 브랜치 수정](2026-09-24-default-risk-base.md)에 기록되어 있다.

이는 provider 마켓플레이스 게시 확인이다. 소비 프로젝트 설치·활성화·장기 효용은
변경하거나 검증하지 않았다. 다음 우선순위는 #96 시크릿 검사 정책 보호다.
