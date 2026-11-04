# Consumer setup 커밋 검증 배포 확인

확인 시각: 2026-09-25 10:39 KST. 사용자 요청에 따라 #124 머지 이후 provider 배포를 확인했다.

- [PR #124](https://github.com/reach0908/paul-loop/pull/124): MERGED,
  merge SHA `d962a6f1572ab6608e92a65d5c8582c7c12b990d`.
- 로컬 `main`을 `origin/main`으로 fast-forward했다. 기존 미추적 감사 문서는 보존했다.
- 머지 커밋과 검증된 PR head `ad8076239e184153536a66e8fe872d042caefab4`의
  `git diff --exit-code`는 종료 0이었다.
- [tag-on-publish 36082374164](https://github.com/reach0908/paul-loop/actions/runs/36082374164):
  같은 merge SHA에서 SUCCESS. 실행된 9개 job이 모두 성공했다.
  엔진·메모리·보안·4개 runtime matrix·schema·tag를 포함한다.
- `engine / verifier-pinned-review`는 PR 전용이라 main 배포에서 SKIP됐다.
  PR #124에서는 별도로 PASS했던 검사이며 이번 SKIP을 PASS로 집계하지 않았다.
- 자동 배포가 이미 실행 중이어서 추가 dispatch나 수동 tag push를 하지 않았다.

## 원격 게시 결과

`git ls-remote --tags origin`으로 직접 확인하고 로컬에도 태그를 fetch했다.

| 플러그인 | 버전 태그 | 원격 커밋 |
|---|---|---|
| loop-engine | `loop-engine--v0.15.10` | `d962a6f1572ab6608e92a65d5c8582c7c12b990d` |
| ship-flow | `ship-flow--v0.11.4` | `d962a6f1572ab6608e92a65d5c8582c7c12b990d` |

tag job은 `created 2 tag(s)`를 기록했다. loop-memory `0.7.0` 태그는 기존 것을 유지했다.
source marketplace와 각 plugin manifest의 이름·버전 일치도 확인했다.
[#99](https://github.com/reach0908/paul-loop/issues/99)는 merge와 함께 CLOSED됐다.

이는 provider 마켓플레이스와 버전 태그의 게시 확인이다. 기존 소비 프로젝트에 복사된
setup action이나 설치된 plugin cache가 자동 갱신됐다는 의미는 아니다. 해당 action은
[구현 안내](2026-09-25-consumer-action-identity.md)에 따라 별도로 업데이트해야 한다.

## 다음 후보

현재 열린 PR은 없다. 다음 별도 구현 후보는
[#98 loop-memory DB 연결 설정 분리](https://github.com/reach0908/paul-loop/issues/98)다.
저장소 설정에서 연결 대상이 선택되는 현재 경로와 호환성을 먼저 재검증한다.
이번 배포 확인에서는 해당 소스나 소비 프로젝트 설정을 변경하지 않았다.
