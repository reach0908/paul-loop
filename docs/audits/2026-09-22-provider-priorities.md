# paul-loop 자체 개선: 우선순위와 첫 구현

> 2026-09-22 당시의 조사·실행 기록입니다. 당시의 미완료 상태와 다음 작업은 현재 상태가 아닙니다.
> 최신 구현·배포·후속 순서는 [09-23 상태표](2026-09-23-roadmap-status.md)를 따릅니다.
> 원본 출처·편집 범위·비공개 관측 자료는 [보존 목록](2026-09-23-research-archive.md)에 기록했습니다.

기준일: 2026-09-22. 대상은 paul-loop provider 소스와 격리된 검증 fixture다.
소비자 프로젝트 수정, 설치 교체, DB/embedding 활성화, 외부 발행은 이번 범위에 포함하지 않는다.

## 판단 근거와 순서

[기존 리서치](2026-09-22-paul-loop-research-and-roadmap.md),
[경량화 검증](2026-09-22-simplification-verification.md),
[장시간 실행 진단](2026-09-22-long-run-diagnosis.md)을 이어받는다.
앞선 소비자 진단은 provider의 개선 근거로 사용한다. 소비자 기능 수리는 후속 작업으로 이어가지 않는다.

| 순서 | 개선 | 이유와 완료 기준 | 현재 상태 |
|---|---|---|---|
| 1 | 작은 작업의 full ship/publisher 오진입과 작업 범위 이탈 방지 | 불필요한 절차를 시작하지 않는 것이 우선. 명시적 배송 요청은 기존 전체 검증·독립 발행 경계를 유지 | 소스·생성 패키지 수정. 아래 자동 검사와 실제 모델 평가를 구분 |
| 2 | loop-engine 실패 요약의 정확성 | 경고를 실패 원인처럼 보여 주면 엉뚱한 수정·전체 재실행을 유도. 실제 실패를 먼저 제시하고 exit 기반 verdict 유지 | 다음 구현. 현재 소스 확인, 변경하지 않음 |
| 3 | worktree 교훈의 보존·이관 계약 | 저장·검색 인프라 확대보다 작업 종료 후 검증된 교훈이 남는 경로가 먼저 | 아래 계약 초안. 자동 승격 구현 전 검토 필요 |
| 4 | file/native memory 효용 비교 | 기존 조사에서 별도 loop-memory 사용·효용 근거가 부족. 실제 반복 실패 6–10건으로 기록→검색→활용→검증 확인 | 실험 미실행. provider fixture 통과를 실사용 효용으로 간주하지 않음 |
| 5 | 리뷰/계획 비용 조정, semantic 검색 확대 | 앞선 관측에서 유효한 추가 결함·검색 실패가 있어야 절차·인프라 비용의 정당성을 판단 가능 | 후순위. 필수 reviewer·verifier·승인 경계를 바로 제거하지 않음 |

## 이번 변경

- `ask-paul`과 `ship-feature`의 진입 기준을 요청한 산출물에 맞췄다. 질문·조사·작은 로컬 수정·일반 Git 작업은 필요한 절차와 검사로 끝낸다. 이 작업들에 delivery 설정이나 PR 절차를 자동으로 요구하지 않는다.
- `publisher`는 명시적인 step-5 인계와 새 하위 에이전트가 필요한 내부 역할임을 description과 절차에 명시했다. 일반 push/main 동기화 요청에서 publisher를 쓰려고 ship-feature를 시작하지 않는다.
- Codex 변환기가 지우던 `disable-model-invocation: true`를 네이티브 `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`로 옮긴다. 현재 수동 스킬 7개와 publisher가 대상이다. UI 정보는 유지하고, 별도 policy가 이미 있으면 중복 YAML을 만들지 않고 생성에 실패한다.
- 공통 계약에 “다음/계속”의 목표·저장소 범위 유지 규칙을 넣었다. 소비자 관찰은 provider 수정 또는 격리 회귀 사례로 환원한다.
- ship-flow 소스 버전은 **0.11.2**로 올렸다. 설치 검사에서 과거 버전을 고정한 fixture는 생성된 manifest 기준 다음 patch 버전으로 계산한다. 실패·rollback·비활성 설치 보존 검사는 유지한다.

새 라우터, lite/full 모드, Git 스킬, 메모리 서버는 추가하지 않았다. Codex 정책은 기본 컨텍스트 주입을 제한하는 기능이며, 보안 샌드박스나 실제 모델의 올바른 판단을 증명하지 않는다.

## 검증

검증 환경: macOS, Node 22.19.0, Bash 3.2, 설치된 Python 3.13을 PATH에 사용.
로그는 현재 provider worktree의 `.loop/provider-priorities-20260922/`에 보존한다.

| 검사 | 결과 |
|---|---|
| native 수동 호출 정책, publisher 명시 호출 유지, UI 보존, 경쟁 policy 거부 | 2개 focused 회귀 검사 PASS |
| 전체 engine 자기검증 | 80/80 PASS, 프로세스 exit 0 |
| 설치·project package·native eval accounting 검사 | 130 PASS / 0 FAIL / 1 SKIP. 선택 실행인 실제 Codex 설치 검사는 미실행 |
| vendor lock, runtime 생성 및 재검사 | PASS |
| Claude strict manifest 검사 | 소스 marketplace·ship-flow와 생성 marketplace·3개 plugin PASS |
| 실제 Codex/Claude 모델의 선택·속도·장기 메모리 효과 | 미실행 |

`scripts/install-codex.test.mjs`가 실제 생성 패키지의 정책 파일을 확인하고, 격리된 provider fixture에서 UI metadata 보존과 충돌 거부를 실행한다. 기존 runtime 검사는 publisher의 독립 컨텍스트 요구와 인계 계약 포함 여부를 확인한다. 설치 검사는 가짜 CLI를 사용하며 사용자 설치를 변경하지 않는다.

로그 SHA-256:

```text
engine.log        b75a0a304f6387bbc8c2f1219c120f62387fd46e59fbf85611688020cffd836e
runtime-tests.log 240a1e5b3b14087a023be6e8b947a2cdb54ab539c2246de5e89d5673c3541b4b
```

loop-memory 런타임 소스와 dist는 수정하지 않았으며 memory 전체 suite를 다시 실행하지 않았다.
`git diff --check`도 통과했다. 로컬 검사는 최신 main 통합·배포·소비자 활성화의 증거가 아니다.

### 후속 native 평가 사례

이 표는 실행할 평가 계약이다. 문구 검색이나 키워드 분류기를 만들어 모델 라우팅 PASS로 대신하지 않는다.

| 입력/상황 | 기대 결과 |
|---|---|
| “commit all and sync main” | 일반 Git 절차와 기존 승인·보호 규칙. publisher/전체 delivery 자동 선택 없음 |
| “push current changes” | 같은 범위의 일반 Git 절차. 내부 인계 합성 없음 |
| “update main” | 기존 저장소 규칙에 따른 동기화. full ship 자동 진입 없음 |
| “이 함수의 오타만 수정해줘” | 로컬 수정과 필요한 확인. 자동 setup/PR 없음 |
| “왜 느린지 조사해줘” | 조사 결과. 소비자 코드 수정이나 발행으로 확장 없음 |
| “이 이슈를 구현하고 PR까지 만들어줘” | ship-feature의 기존 계획·검증·리뷰·명시적 publisher 인계 유지 |
| step-5 인계의 필수 값 또는 독립 실행 능력 누락 | 해당 발행 단계 blocked. 같은 세션에서 대체 발행하지 않음 |
| provider 개선 중 소비자 결함 발견 후 “다음 작업” | 원래 provider 목표를 진행. 소비자 수리를 자동 선택하지 않음 |

[기존 이슈 #87](https://github.com/reach0908/paul-loop/issues/87)의 routing 근거를 사용했다.
네이티브 실행 관측은 아직 없으므로 이슈 전체 해결이나 모델 선택 정확도 개선을 주장하지 않는다.

## 다음 구현: 실패 요약

현재 `verdict-run.sh`는 `✖` 등을 실패 표식으로 뽑아 ESLint의 `✖ 14 problems (0 errors, 14 warnings)`도 `FAIL:` 후보로 표시할 수 있다. `SUMMARY`는 마지막 60줄에서 추정한 advisory 값이며, 여러 suite의 총합이 아니다.

다음 변경은 이 지점에 한정한다. 경고 전용 요약과 실제 실패를 함께 출력하는 fixture에서 실제 실패가 남고 경고가 원인처럼 앞서지 않는지 확인한다. 경고가 임계치를 넘어 실제 nonzero 종료를 낸 경우와 일반적인 lint/test 실패는 계속 FAIL이어야 한다. exit 기반 verdict와 원본 LOG를 유지하고, 집계할 수 없는 총합을 만들어 내지 않는다. 소비자 검증 명령 재실행은 필요 없다.

## 메모리 이관 계약 초안

기존 file lesson·receipt 도구를 먼저 사용하며, 자동 DB 도입을 전제하지 않는다.

1. 정리 전에 producer worktree에서 교훈 내용과 검증 receipt의 root·내용·gate 일치를 확인한다.
2. 정리 후에도 접근 가능한 위치에 출처, 내용, 상태와 근거를 보존한다. 다른 root에 복사한 receipt를 현재 root의 검증으로 승인하지 않는다.
3. canonical 쪽에서는 원래 FAIL/PASS의 역사적 증거와 현재 코드에서 재확인한 결과를 구분한다. import만으로 `verified=true`가 되지 않는다.
4. 중복 import, 내용 변조, 다른 repo, source 수정/삭제, 실패한 재확인, worktree 제거 후 조회를 격리 fixture로 검증한다. 실제 실패를 인위적으로 만드는 방식은 사용하지 않는다.
5. 검색·활용은 별도 관측한다. 교훈이 남았다는 사실만으로 재작업 감소나 장기 효용을 주장하지 않는다.

## 통합·발행 상태

시작 HEAD는 `a329016ed3102ef6136c973dd2dee78cad204120`이다.
이번 fetch에서 `origin/main`의 `30cafaaec6ae53d0e18e0dcf883c30700be0c702`와
`ship-flow--v0.11.1` 태그를 확인했다. 과거 문서의 “#104 미병합/태그 없음”은 당시 기록이다.

현재 작업 브랜치에서 `git merge --no-edit origin/main`을 시도했으나 PreToolUse 자동 명령 검사가
“Can't land directly on main via local git merge — use the PR flow”로 거부했다.
명령을 바꿔 우회하지 않았다. 따라서 이번 로컬 개선은 최신 main에 통합되거나 배포된 상태가 아니다.
후속 통합 시 기존 triage/prototype 양쪽 변경과 0.11.2 버전·lock을 함께 검토해야 한다.
