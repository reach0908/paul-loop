# loop-engine 0.15.6 merge·배포 확인

기준: 2026-09-23 KST. 사용자의 기존 배포 요청과 “머지했어”에 따라 원격 상태를 확인한다.

## Merge

- [PR #112](https://github.com/reach0908/paul-loop/pull/112): MERGED, 2026-09-23T03:14:07Z.
- merge SHA: `7867af8f4545695e7ce0ec9642b78b7957df1c5b`.
- 검토한 PR head: `61ceabab7b1db8a72ab0bc3d1822f130a3464a7b`.
- [#103](https://github.com/reach0908/paul-loop/issues/103): CLOSED.
- PR의 일반 CI 10개는 SUCCESS, pinned 검사는 79/81·exit 1·FAIL이었다.
  비표준 ID에 대한 기존 기대 두 개와 새 제한의 충돌을 고지한 뒤 사용자가 수동 merge했다.
  이 사실을 pinned PASS로 바꾸어 기록하지 않는다.

구현·호환성 변경·회귀 검증은 [lesson 경로 감사](2026-09-23-lesson-paths.md)에 있다.

## 배포

- [tag workflow 35813518830](https://github.com/reach0908/paul-loop/actions/runs/35813518830): SUCCESS.
  engine 전체·strict manifest·memory·runtime·secret scan·tag를 포함해 10개 job이 SUCCESS다.
- `git ls-remote`로 `loop-engine--v0.15.6` → `7867af8f4545695e7ce0ec9642b78b7957df1c5b`
  일치를 확인하고 태그를 fetch했다. marketplace main과 버전 태그의 source 배포를 확인했다.
- merge 시 marketplace/source 버전: engine 0.15.6 / ship-flow 0.11.3 / memory 0.7.0.
- 이 workflow의 pinned job은 pull_request 이벤트 전용이므로 main push에서는 SKIPPED다.
  일반 engine/memory/runtime/secret 검증 완료 후 tag job이 성공했다. PR의 pinned FAIL과는 별개다.

## 로컬·소비 환경 경계

`origin/main`을 merge SHA로 fetch했다. canonical main checkout의 기존 미추적 감사 문서와
설치 훅에 의해 거부된 fast-forward 경계는 유지했다. 소비 프로젝트의 설치·캐시·DB를
변경하지 않았으며, source/tag 배포가 기존 설치의 업데이트나 실제 memory 효용을 증명하지 않는다.

이 배포 기록은 다음 provider 변경인 #102의 AC artifact 경로 감사와 함께 보존한다.
