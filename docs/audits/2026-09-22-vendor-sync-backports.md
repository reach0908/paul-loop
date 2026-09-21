# vendor-sync 권장 변경 반영

상태: **로컬 반영·검증 완료**. 날짜: 2026-09-22 KST. 선택적 memory probe와 실제 CLI 설치는 미검증이다.

사용자의 “추천하는 방향으로 개선해줘” 요청에 따라 `paul-loop` 제공자 스킬 두 개를 부분 개선했다. 기준은 `791d43b`, 작업 브랜치는 `codex/vendor-sync-backports`다. 원본 checkout의 미추적 감사 문서를 보존하기 위해 별도 worktree에서 작업했다.

## 반영 내용

| 대상 | 변경된 동작 |
|---|---|
| `triage/SKILL.md` | 요청 문구 외에 도메인 개념으로 기존 구현을 검색하고 조사 위치·동작 근거를 제시한다. 부분 구현·확인되지 않은 동작은 계속 조사하며, 버그 재현을 생략하지 않는다. |
| `triage/OUT-OF-SCOPE.md` | 이미 구현된 요청은 거절 기록을 생성하거나 덧붙이지 않는다. 실제로 거절된 enhancement만 허용된 범위에서 기록한다. |
| `triage/AGENT-BRIEF.md` | 예시 AC를 거절된 enhancement로 한정하고, 이미 구현된 요청의 종료가 거절 기록을 바꾸지 않는다는 조건을 추가했다. |
| `prototype/SKILL.md` | TUI 기본값을 유지하면서 비개발자 참여·파일 공유가 필요한 논리 검토에 HTML 선택지를 연결했다. |
| `prototype/LOGIC.md` | 외부 의존성 없는 단일 HTML, 도메인 용어, 자유 조작, 초기 상태를 재설정하는 안내 시나리오, native 버튼 접근성과 오프라인 확인을 추가했다. |
| `skills-lock.json` | `prototype`, `triage`의 `computedHash`만 갱신했다. |
| 버전 메타데이터·변경 기록 | 저장소의 publish-freshness 규칙에 따라 `ship-flow`를 `0.11.1`로 올리고 plugin manifest·marketplace·README·CHANGELOG를 맞췄다. 배포는 수행하지 않았다. |
| `scripts/install-codex.test.mjs` | 현재 생성 버전과 다음 patch 버전을 사용해 설치·업데이트 fixture를 구성한다. 고정된 이전 버전 때문에 실패하던 보존 검사 9건을 수정하고, 실패·rollback·활성화 보존 검사는 유지했다. |

스킬·참조 파일 경로는 `tools/ship-flow/skills/` 아래다. 두 변경 모두 기존 파일만 사용한다. HTML용으로 다시 작성한 JavaScript 모델은 설계 검토 근거이며 원본 구현의 검증 근거가 아니라는 한계도 명시했다.

승인·문서 작성·댓글·이슈 종료·production 구현·cleanup·send 경계는 기존 계약을 유지한다. 일괄 stage/commit, prototype 자동 보관 브랜치, 외부 PR triage 확장, 신규 스킬 설치는 추가하지 않았다. 명시적 fork 7개 및 이름·경로·fork 메타데이터는 유지했다. upstream `code-review`와 달라진 fork 사유 설명도 이번 두 스킬의 반영 범위에 포함하지 않았다.

비교 근거는 고정된 upstream [`c55ee46073ed923f86ce59a5eb3b6d895095d1b7`](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7)이다. 적용 2개, 신규 도입 0개, 이름 변경 0개다.

## 검증

환경: macOS, Node `22.19.0`, Bash `3.2.57`, Claude CLI `2.1.278`, Homebrew Python `3.13.12`.

| 검사 | 결과 |
|---|---|
| 최초 두 스킬 risk gate | `AUTO`, blast low / reversibility full / cost low |
| 버전·fixture·보고서를 포함한 최종 12개 경로 risk gate | verdict `DENY_AND_LOG`, blast high / reversibility full / cost low. `many-files (12 > 10)` 근거를 그대로 보존하고, 기존 구현 승인에 해당하는 로컬 가역 작업만 계속했다. 명령 실행 거부나 외부 발행은 없었다. |
| vendor lock consistency | 종료 0, 등록된 24개 경로·내용 해시 일치 |
| attribution completeness | 종료 0 |
| skill handoff 참조 | 종료 0, 실소스 복사본의 실패·복구 회귀 포함 |
| Markdown 참조 | 종료 0, 64개 문서 |
| skill frontmatter·guard wiring | 두 검사 종료 0 |
| `node scripts/refresh-skill-lock.mjs --check` | 종료 0 |
| `node scripts/generate-runtime-packages.mjs` 및 `--check` | 각각 종료 0, Claude/Codex 패키지 생성·내용·mode·참조 정합성 확인 |
| `claude plugin validate --strict` | 생성된 marketplace와 플러그인 3개 모두 종료 0 |
| `bash tools/loop-engine/test/run.sh` | Homebrew Python PATH로 최종 전체 재실행 종료 0, `80/80 passed`; 내부의 선택적 memory probe 1개는 SKIP |
| `node --test tools/loop-engine/test/runtime-packages.test.mjs` | 설치 검사와 함께 실행한 최종 버전 소스의 runtime 사례 11개 모두 통과 |
| `node --test scripts/install-codex.test.mjs` | fixture 수정 후 종료 0, 85 PASS / 0 FAIL / 1 SKIP (실제 CLI ingestion opt-in) |
| `git diff --check` | 종료 0 |

검사 로그는 이 worktree의 `build/vendor-sync-checks/`, 생성 패키지는 `build/runtime-packages/`에 있다. 둘 다 로컬 검증 산출물이며 설치 캐시가 아니다.

최초 엔진 전체 검사는 `77/80`이었다. 3개 검사가 시스템 `python3`의 미승인 Xcode license stub에 막혔고, 이미 설치된 Homebrew Python을 PATH에 지정해 재실행했다. 이 중 `publish-freshness`가 변경된 스킬의 미증가 버전을 추가로 발견해 `0.11.1` 메타데이터를 반영한 뒤 통과했다. 시스템 설정이나 설치 캐시는 바꾸지 않았다.

최종 전체 실행은 `export PATH="/opt/homebrew/opt/python@3.13/libexec/bin:$PATH"` 후 수행했다. 최종 증거는 `engine-final.log`(80/80), `install-codex-final.log`(85 PASS, 1 SKIP), `versioned-runtime.log`(수정되지 않은 runtime 검사 11개 PASS), `generate-final.log`, `claude-validate-final.log`, `risk-final.log`다. 최초 실패 기록도 삭제하지 않았다.

버전 변경 후 runtime·설치 통합 검사는 `87 PASS / 9 FAIL / 1 SKIP`이었다. 9개 실패는 모두 `0.11.0`을 고정한 설치 fixture의 보존 기대값이었다. fixture는 생성 manifest의 현재 버전을 기준으로 삼고 다음 patch 버전으로 실제 업그레이드를 모형화하도록 수정했다. 원래의 오류 발생·내용/권한/활성화 상태·backup 보존 단언은 삭제하지 않았다. 보호 파일 수정 사유를 `.loop/guard-off`에 기록한 짧은 수정 창을 사용했고, 파일을 제거한 다음 재검증했다. 실제 CLI ingestion은 opt-in 검사라 실행하지 않았다.

엔진의 선택적 memory lessons probe는 이 worktree에 `tsx`가 없어 SKIP이다. 이를 통과로 취급하지 않으며, 이를 위해 memory 의존성을 설치하거나 활성화하지 않았다.

## 독립 비교 검토

fresh subagent 두 개가 각각 한 스킬의 전체 변경과 관련 계약을 읽었다. `triage` 검토는 세 문서 및 `AUTHORIZATION.md`, `prototype` 검토는 두 변경 문서와 기존 `UI.md`를 포함했다. 두 검토 모두 조치할 모순·회귀를 찾지 못했다.

| 검토 사례 | 문서에서 확인한 조건 |
|---|---|
| 요청한 동작이 이미 구현됨 | 동작 근거 제시, 허용된 종료 처리, 거절 기록은 유지 |
| 구현이 부분적이거나 확인 불충분 | 조사 계속, 이미 구현됨으로 간주하지 않음 |
| 코드가 존재하지만 버그가 보고됨 | 기존 재현 단계 유지 |
| 실제 거절된 enhancement | 허용된 기록·댓글·종료 범위에서만 처리 |
| 읽기 전용 triage 요청 | 제안으로 종료, 외부 변경 권한을 추가로 추론하지 않음 |
| 개발자 중심 논리 검토 | 기존 런타임의 TUI 기본값 유지 |
| 비개발자·공유 검토 | 단일 HTML, 자유 조작 후 안내 시나리오 초기화, 같은 로직으로 실행 |
| 비-JS 구현을 HTML로 재작성 | 설계 모델로 표시, 원본 구현의 검증으로 취급하지 않음 |
| 시각 디자인 질문 | 기존 UI 분기 유지 |

이 표는 두 스킬 문서 계약의 정적 검토다. 소비 프로젝트의 실제 이슈 처리, 모델이 생성한 HTML의 브라우저 동작, 설치·활성화·장기 효과를 검증했다고 주장하지 않는다. 설치 fixture의 후속 수정은 이 독립 문서 검토 범위에 포함되지 않는다. 제품 실행 코드·memory 소스·배포 번들은 변경하지 않아 별도 memory 전체 테스트는 실행하지 않았다.

## 전달 상태

로컬 패치와 소스 버전 `ship-flow 0.11.1`을 준비했다. commit·push·PR·merge·release·소비자 설치·활성화는 실행하지 않았다. sync stamp도 갱신하지 않았다. 로컬 검증 완료 후 남는 단계는 변경 검토와 별도로 요청된 전달 작업이다.

### 후속 배포 요청

사용자는 위 구현 결과를 전달받은 뒤 “배포”를 요청했다. 이 요청의 대상은 검증된 두 스킬 개선과 `ship-flow 0.11.1`이며, 공개 저장소 `reach0908/paul-loop`의 `main`으로 정상 PR 병합 후 기존 `tag on publish` 검증·태그 생성 경로를 사용한다. 시작 시 원격 `main`은 기준 `791d43b`와 같고, 열린 PR과 `ship-flow--v0.11.1` 태그는 없었다. 소비자 설치·활성화, 별도 메시지, 보호/검증 우회는 포함하지 않는다. 이 문서에 기록한 로컬 검증과 원격 CI·태그 발행 결과는 구분한다.
