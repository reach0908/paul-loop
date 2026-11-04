# 자체 개선 배포 상태 — 2026-09-22

이 문서는 최종 CI 관찰 후 저장한 로컬 감사 기록이며 PR 커밋에 포함되지 않는다.
대상: [PR #105](https://github.com/reach0908/paul-loop/pull/105),
head `19a8862d6059cc8a1f52eee157d145cc594a010a`,
base/main `30cafaaec6ae53d0e18e0dcf883c30700be0c702`.

## 현재 상태

- ship-flow 0.11.2: 작은 작업의 전체 절차 자동 진입 억제, Codex 수동 호출 정책 보존,
  최소 구현·재사용 및 작업 범위 유지. ship-feature는 401→346줄, 30,284→25,516 bytes.
  실제 모델의 선택 정확도·속도 향상을 측정한 수치는 아니다.
- loop-engine 0.15.1: 실제 실패를 경고 요약보다 우선 표시, 경고 임계치 실패 보존,
  PASS 문구의 기호·분수 집계 오인 수정. 원본 로그와 exit 기반 판정 유지.
- 소스는 커밋·push 완료. PR은 OPEN이고 main 병합·두 버전 태그 생성은 미완료.
  소비자 설치·메모리 인프라는 변경하지 않았다.

## 검증 증거

- 로컬 통합 engine 80/80, installer/runtime 98 PASS·1 opt-in SKIP.
  마지막 Jest 숫자 경계 수정 후 계약 회귀와 독립 Spec 재검토 PASS.
- 최종 head의 CI: 완료된 check run **17 SUCCESS / 2 FAILURE**.
  PR synchronize/edited에 따른 중복 실행을 포함하며 19개의 독립 검증 분야라는 뜻이 아니다.
- [현재 engine 검사](https://github.com/reach0908/paul-loop/actions/runs/35731800399/job/106758952485),
  memory typecheck/test/build, Ubuntu/macOS Node 22/24 runtime, strict schema, 보안 검사 통과.
  engine 내부 BAC-580 memory-source probe는 tsx 부재로 SKIP이며 PASS로 바꾸지 않는다.
- 최초 임시 LOOP_DIR 호출의 79/80 실패도 보존했다. 상세는
  [실패 요약 개선 기록](2026-09-22-failure-summary-improvement.md)을 참조한다.

## 남은 두 차단 원인

1. **기존 테스트 기준의 버전 고정.** 두 실패는 같은 `verifier-pinned-review`의 반복이다.
   [원본 로그](https://github.com/reach0908/paul-loop/actions/runs/35731800399/job/106758952773)는
   base의 `runtime-packages.test.mjs:55`가 `'0.15.0'`을 요구해 실제 `'0.15.1'`과 불일치함을
   보여 준다. 기존 suite 결과는 79/80이다. PR에서는 생성 패키지 버전을 source manifest와
   비교하도록 바꿨지만, 고정 검사는 의도적으로 base 테스트를 복원하므로 이 수정이 적용되지
   않는다. 새 버전을 거짓 보고하거나 고정 검사를 수정·제외하지 않았다.
   [ADR-0002](../adr/0002-codeowners-and-verifier-pinned-review.md)의 기준 검증 취지를 유지하며,
   의도된 버전 assertion 변경은 별도 검토·기준 반영이 필요하다. 실패는 PASS가 아니다.
2. **설치 훅 실행 오류.** 앞선 ship-flow-only CI가 모두 통과했을 때 병합을 시도했지만
   PreToolUse `gate-risky-commands`가 classify-risk status=2로 거부했다.
   `/Users/jinhokim/dev/paul-loop/risk-rules.json`이 없는데 명시적 `--rules`로 전달된다.
   파일 부재를 마지막 원격 상태 확인 시 다시 확인했다. 대체 병합 명령·설치 캐시 변경·
   게이트 비활성화로 우회하지 않았다. 사용자 배포 위임의 부재와 구분한다.

## 다음 행동

배포는 위 기준 변경과 설치 훅 실행 오류의 정상 복구가 먼저다. 검증을 우회해 merge하거나
버전 태그를 직접 만들지 않는다. 다음 기능 우선순위는 기존 file lesson 도구를 사용하는
worktree 교훈 보존·이관이다. producer 경로에서 검증한 역사적 근거를 보존하되, 다른 root로
복사한 receipt를 현재 검증으로 승격하지 않는 계약부터 확정한다. DB/검색 인프라 확대는
실제 반복 실패 6–10건의 기록→검색→활용→검증에서 부족함이 확인된 뒤 판단한다.

실행 로그·CI JSON은 이 worktree의 `.loop/provider-release/`에 보존한다.
