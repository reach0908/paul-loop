# 연구 기록의 본 저장소 통합

원본은 로컬 `codex/paul-loop-research-simplify`의 커밋
`112e5b5b839a5fb86df0c0c8d4feacf67ed76b54` 아래 `docs/audits/`에 보존돼 있다.
별도 worktree에만 있던 provider 관련 Markdown 7개를 이번 PR로 통합한다.
원본 worktree·commit·비공개 JSON은 삭제하거나 변경하지 않았다.

공개본은 당시 본문과 출처를 유지하되, 현재 상태표로 연결하는 시점 안내를 추가하고
개인 home 경로를 `<local-home>`으로 표시했다. 비공개 JSON과 소비 프로젝트 후속 기록의
링크는 아래 보존 설명으로 연결했다. 이번 통합은 외부 논문·제품의 새 원문 조사가 아니다.
문서에 있는 당시의 설치 버전·미완료 상태·다음 제안은 현재 상태로 승격되지 않는다.

## 문서

- [종합 연구·Ponytail·하네스·메모리 비교](2026-09-22-paul-loop-research-and-roadmap.md)
- [최초 조사 브리프](2026-09-22-research-brief.md)
- [4·5번 섹션 추가 조사](2026-09-22-sections-4-5-research-brief.md)
- [native 사용·설치 관측](2026-09-22-native-capability-and-usage-audit.md)
- [장기 실행 원인 진단](2026-09-22-long-run-diagnosis.md)
- [경량화 구현 검증](2026-09-22-simplification-verification.md)
- [provider 자체 개선 우선순위](2026-09-22-provider-priorities.md)

## Private evidence

원본 세 JSON에는 관측 source 경로·session/turn 식별자·호출 단위 자료가 포함된다.
공개 PR에는 원시 파일을 복제하지 않고 아래 파일명과 SHA-256으로 식별한다.
이 값은 무결성 대조용이며 데이터의 진실성·실사용 효과를 입증하는 서명은 아니다.
원본 JSON의 위치는 위 로컬 commit의 `docs/audits/<파일명>`이다.

## Consumer history

`2026-09-22-digging-verification-entrypoint.md`와 후속 소비 프로젝트 기록은 같은 원본 commit에
보존한다. 이번 통합에서는 provider 개선 근거인 장기 실행 진단까지만 포함한다.
그 소비 프로젝트의 현재 배포·runtime 상태를 재검증하거나 추가 수정한 것은 아니다.

## 원본 SHA-256

아래 값은 안내문·경로 표기를 편집하기 전 원본 바이트의 hash다. 새 평가 원시 출력은
`.loop/routing/`에 별도로 보관하며 이 과거 관측과 섞지 않는다.

| 원본 파일 | SHA-256 |
|---|---|
| 2026-09-22-research-brief.md | `d07a2187d98bd95dc143ed0fb6c6aebc8594fa4eef45729eaf84200be59d2850` |
| 2026-09-22-sections-4-5-research-brief.md | `f68014e4649f75420c7f4aacfcffc964598e0f3e7cf56d1ea01d2e6ac9ce78a2` |
| 2026-09-22-paul-loop-research-and-roadmap.md | `4261d836399734e8864d67222863ae6a379c0adf263119a9fc26c8e083031ae8` |
| 2026-09-22-provider-priorities.md | `aaec011bd5a8b2bfb57910bbed29b2488cb5673aa42fbe38454eb6fb72b4c335` |
| 2026-09-22-native-capability-and-usage-audit.md | `222af8d24cf94a0dbad13dfe138e71c96c435b8b05f59d771fbfd9fc16e1e93b` |
| 2026-09-22-long-run-diagnosis.md | `7efbae034776cf5fcc2fc2557eddc22df9db43525774565a689a7f5214fad149` |
| 2026-09-22-simplification-verification.md | `3670c28981e4a7616ebb64d3a3ff99f0f33ff49d7772333cb0d24b0d6adf0727` |
| 2026-09-22-consumer-usage.json | `3e281765ef0be71b8ba110928443439a21331832e1f57facc22b2508c79faf74` |
| 2026-09-22-native-usage-observations.json | `3cd877f5af35d652c27143cc65e8069748e63cee650d8279b43132f7679809d7` |
| 2026-09-22-long-run-diagnosis.json | `c5eb78e8e8598177875e65e3b9e2a9f0cf753ca6888707fb856e61c7cd5c42ba` |
