# 작은 작업의 native 라우팅 관측

기준: 2026-09-23 KST. source `3b58fba2f54ab2f201d131530f352dc238b9bdee`에서 생성한
loop-engine 0.15.4 / ship-flow 0.11.2를 임시 Codex 프로필에 공식 CLI로 등록했다.
사용자는 [다음 검증 방향](2026-09-23-roadmap-status.md)의 진행을 승인했다.

## 결과

8개 사례 중 native 프로세스 7개가 완료됐고 명시적 PR 요청 1개는 180초 제한으로 종료됐다.
이는 7/8 benchmark PASS가 아니다. 일반 작업 7개에서 full ship/publisher 오진입을 관측하지
않았고, PR 요청에서만 실제 `ship-flow:ship-feature` 읽기를 확인했다.
현재판만 각 1회 실행했으므로 이전판 대비 속도·정확도 향상을 주장하지 않는다.

| 사례 | 관측 시간 | 완료된 shell 항목 | 실제 관측 |
|---|---:|---:|---|
| 함수 설명 | 22.123초 | 2 | 파일 읽기와 설명. 변경 없음 |
| README 오타만 수정 | 24.341초 | 2 | `Welocme` → `Welcome` 한 단어 변경 |
| 원인 조사 | 73.073초 | 17 | 전역 `diagnosing-bugs`를 읽고 재현·가설 검사를 반복. 변경 없음 |
| 작은 함수 수정·검증 | 59.895초 | 4 | `a - b` → `a + b`. 인용 오류가 난 추가 검증 명령을 고쳐 재확인 |
| 이슈 구현 후 PR 요청 | 179.825초, timeout | 44 | ship-feature 및 여러 역할 지침 읽기. 구현 변경 전 종료, 미완료 |
| commit all and sync main | 21.798초 | 2 | Git 상태 확인. clean main이며 remote 없음 |
| push current changes | 34.485초 | 2 | 변경·remote 부재 확인. push 없음 |
| update main | 30.283초 | 6 | Git 상태 확인. remote 부재로 원격 동기화 미수행 |

시간은 native 자식 프로세스의 관측 경과 시간이며 fixture 생성·플러그인 등록·부모 분석은
포함하지 않는다. 완료된 shell 항목 수는 내부 명령·도구·재시도의 총합이 아니다.
Git 세 사례는 clean main/remote 없음 조건이므로 실제 commit·fetch·동기화 성공 검증이 아니다.

## 다음 개선을 바꾼 관측

**전역 스킬이 평가에 함께 들어온다.** 새 `CODEX_HOME`에도 `$HOME/.agents/skills`가
카탈로그에 나타났고 조사 사례는 그곳의 스킬을 실제 읽었다. 따라서 임시 등록만으로
provider 단독 실험이라고 부르면 안 된다. 공식 문서도 user skill 탐색과 경로별 비활성화
설정을 설명한다. [OpenAI skill discovery/settings](https://learn.chatgpt.com/docs/build-skills).
이번에는 전역 파일·설정·trust를 변경하지 않았다.

**full ship 요청의 구현 전 비용이 남아 있다.** PR 사례는 여러 단계의 지침을 반복해서
읽다가 timeout으로 끝났고, 검증 대상의 바이트와 Git 상태는 초기값 그대로였다.
동시에 플러그인 경로의 셸 변수 해석 오류, 없는 `origin/develop`을 기본 비교 대상으로 쓴
분류 실패, sandbox 안의 Git ref 쓰기 거절도 관측됐다. 따라서 180초를 전부 지침 읽기의
비용으로 귀속하거나 일반적인 PR 완료 속도의 근거로 삼을 수 없다.
`ship-feature`에는 이미 필요한 시점에 reference를 읽으라는 지침이 있다. 추가 문구만으로
해결된다고 가정하지 않고, 실제 host의 독립 역할 실행 능력·설정 부재·단계별 읽기 순서를
분리해 확인해야 한다. timeout을 성공이나 “판정 불가=문제 없음”으로 기록하지 않는다.

다음 bounded 작업은 임시 프로필의 native 설정으로 전역 스킬 혼입을 통제하고 실제 카탈로그를
검사한 뒤, 같은 PR 사례에서 선행 조건 확인과 지침 로딩의 병목을 확인하는 것이다.
필수 planner/reviewer/verifier를 없애거나 timeout을 무조건 늘리는 변경은 이 관측으로
정당화되지 않는다. 그 뒤에 동일 host·모델·과제의 4쌍 비교로 진행한다.

## 실행 조건과 검증 경계

- 앱 번들 Codex CLI `0.155.0-alpha.9.2`. 로컬 config에서 확인한 모델 `gpt-5.6-luna`,
  effort `xhigh`를 사용하고 모든 target의 native `turn_context`에서 모델명을 확인했다.
  앱 UI 대화 자체나 Claude Code의 결과가 아니다.
- 기존 `runNative`, `codexPlugins`, `bounded`를 재사용했다. 사례당 180,000ms,
  공유 원장 1,500,000ms 중 **445,824ms** 사용. 과거 평가 원장을 초기화하지 않았다.
- native memory, loop memory/learning, apps, web search는 adapter의 기존 off 설정을 사용했다.
  전역 skill 탐색은 별개임이 확인됐다. 각 임시 프로필은 제거됐고 process group은
  `group_absent`로 기록됐다. hook trust/enforcement qualification은 확인하지 않았다.
- 모든 사례에 외부 게시·push·실제 PR·소비 프로젝트 변경 금지를 동일하게 추가했다.
  따라서 공개 발행 및 step-5 publisher의 양성 실행·독립성 검증은 범위 밖이다.
- 첫 세 사례 뒤 private driver에 Git 입력 3개를 추가했다. 이전 driver 바이트도 보존했다.
  기존 사례의 프롬프트·fixture·adapter·모델·timeout은 바꾸지 않았다.
- PR timeout 뒤 동일 사례를 반복하지 않았다. 남은 Git 사례만 새 입력으로 실행했다.
  target 완료와 작업 완료, routing 관측과 정식 native acceptance를 구분한다.

부모가 모델의 응답과 별개로 오타의 정확한 결과, 구현 사례의 원본 테스트 보존과 실제 exit 0,
나머지 fixture의 바이트·clean Git 상태를 검사했다. 원본 JSONL 파싱, 모델·버전·cleanup,
공유 예산과 SHA-256도 대조했다. 이 검사는 합성 fixture의 근거 확인이며 실사용 효용은 아니다.

## 증거 보존과 재현

[관측 원장](2026-09-23-native-routing-evidence.json)은 합성 프롬프트·초기 fixture,
관측 시간·모델·명령 항목·스킬 경로 언급의 원본 행 번호와 증거 파일 hash를 담는다.
경로 언급은 자동 수집 후보이며 실제 행동 판단은 원본 도구 출력·파일과 함께 검토한다.
`accepted_benchmark_metrics`와 달러 비용은 null이다. token usage는 host가 반환한 경우만
남기며 timeout의 미제공 값을 0으로 채우지 않는다.

비공개 `.loop/routing/<case>/`에 원시 stdout/rollout, target metadata, setup 기록,
초기 입력과 후속 파일/hash/diff를 보존한다. `probe-v1.mjs`, `probe.mjs`, `collect.mjs` 및
`budget.json`도 남긴다. 인증 파일·사용자 원시 대화·DB 내용은 공개 원장에 포함하지 않는다.

재현은 [기존 adapter 계약](../../scripts/native-eval/README.md)에 따라 **새** 예산·출력
디렉터리를 만들고, 원장의 합성 fixture/프롬프트를 같은 모델·effort로 `runNative`에 전달한다.
`codexPlugins`에 해당 source의 생성 Codex marketplace를 넘기고 native catalog와 실제
등록 버전을 다시 확인한다. 전역 skill 조건이 다르면 같은 조건의 반복이라고 부르지 않는다.

## 검토

### Standards

문서화된 기준 위반과 조치가 필요한 heuristic smell은 없었다. 과거 기록의 시점 표시,
timeout·전역 skill 혼입·Git 미실행의 구분, provider/consumer 증거와 승인 경계를 확인했다.
검토 범위는 staged 13개 파일의 문서·증거 계약이며, 외부 연구 원문이나 원시 trace의
전체 주장을 독립 재검증하거나 native 실행을 반복하지 않았다.

### Spec

[수용 기준 1–5](2026-09-23-roadmap-status.md#이번-변경의-수용-기준)에 대한 finding은 0건이다.
8개 사례의 실제 명령·출력·최종 파일, 공개 원장의 증거 hash 64개, 역사적 원본 hash 10개,
로컬 링크 91개를 독립 대조했다. 구현 사례의 보존된 원본 테스트도 실행하여 exit 0을
확인했다. PR의 경로·runtime 선택·기준 ref 부재·Git 쓰기 거절과 timeout이 기록에 부합했다.
모델 재실행이나 전체 suite 반복은 하지 않았다.

생성 runtime 재현 비교, skill lock 및 diff 검사는 통과했다. 실행 코드·패키지 payload·
verifier를 변경하지 않아 로컬 전체 engine/memory suite는 반복하지 않았다.
이 결과를 #87 전체 해결, 모델 정확도 PASS, 성능 개선 또는 소비자 설치 완료로 취급하지 않는다.
