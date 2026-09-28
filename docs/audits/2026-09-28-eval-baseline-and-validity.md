# skill eval 베이스라인과 행동 eval 타당성 보강

기준: **2026-09-28 KST**. base: `96026e5`(improvement-research, 0.2.0). 요청: eval을 돌려 plugin 안 여러 skill의 현재 베이스라인 점수를 확인하고, [eval 딥리서치](2026-09-28-harness-eval-research.md) §7의 권고를 진행한다.

## 판단

- **베이스라인은 5개 사례 중 2개만 측정했다.** Bash가 필요한 3개(diagnose, tdd, review)는 이 머신에서 실행이 거부되어 점수가 없다. 0점이 아니라 미측정이다.
- 측정한 2개: 작은 수정은 plugin 유무 모두 3/3(Δ 0)이고 plugin이 있을 때 실행당 비용이 약 50% 높다. grilling은 plugin 1/3, 없음 0/3(Δ +0.33)이다. 표본 3회씩이라 이 차이는 우연과 구분되지 않는다(Fisher 정확 검정 p = 1.0).
- 행동 eval(`agent-eval`, native runner)에서 후보가 채점 기준과 필수 event 이름을 볼 수 없게 했다. 변경 없는 재실행을 셀 수 있게 verdict 원장에 시작 digest를 남긴다.

## 1. `claude plugin eval` 스위트

`evals/` 아래 5개 사례. 각 사례는 결과 grader와 과정 grader를 함께 둔다. `tool_used: Skill` grader는 두 arm 비교에서 점수가 아닌 발동 지표다.

| 사례 | skill | 결과 grader | 과정 grader |
|---|---|---|---|
| `small-fix` | paul-loop 진입 | README 오타 수정·원문 유지(regex) | delivery skill 미호출, commit·push 없음(`arm: both`) |
| `diagnose-failing-test` | diagnosing-bugs | 할인 이중 적용 제거(regex) | 수정 전 재현(`tool_order`), 테스트 파일 무수정, 수정 후 재실행 통과(llm) |
| `tdd-new-function` | tdd | 테스트 파일 생성 | 테스트가 구현보다 먼저(`tool_order`), red→green(llm) |
| `review-planted-bug` | code-review | `i <= items.length` 발견(llm) | diff 확인, 편집 없음 |
| `grilling-one-question` | grilling | 질문 하나만(llm) | — |

fixture 4개는 로컬에서 먼저 확인했다: 버그는 실패하고 수정하면 통과하며, 리뷰 브랜치의 결함은 실제로 `TypeError`를 낸다.

## 2. 실행과 결과

- Claude Code 2.1.283, `--model claude-opus-5-5`, `--judge-model claude-sonnet-5`, 사례당 3회 × plugin 유/무, `--scaffold --no-publish --allow-tools Write Edit`.
- 원시 결과는 gitignore된 `.loop/plugin-eval/`에만 둔다. `2026-09-28-baseline-nobash/result.json` SHA-256 `3833c9d0ed53b904aa9e256f69e935d4040149a84388107da491fcf17af03f0a`.

| 사례 | plugin 있음 | plugin 없음 | Δ | 실행당 비용(정가 추정) | 비고 |
|---|---|---|---|---|---|
| small-fix | 3/3 | 3/3 | 0 | $0.086 / $0.057 | 두 arm 모두 4턴. plugin skill은 발동하지 않았고 큰 절차로 가지 않았다. Bash를 주지 않아 commit 금지 grader는 자명하게 통과한다 |
| grilling-one-question | 1/3 | 0/3 | +0.33 | $0.126 / $0.073 | grilling skill 3/3 발동. 두 arm 모두 "Q1 하나 + 추천안" 형식이었다. plugin 쪽 실패 2건과 plugin 없는 쪽 1건은 주 질문 뒤에 저장소 경로·예시·규모 같은 요청을 덧붙였고, plugin 없는 쪽 나머지 2건은 Q1 안에 하위 질문을 여러 개 나열했다 |

합계 12회, 65초, 정가 추정 $1.03. 구독 과금과는 다르다.

**미측정 3개 사례.** Bash를 허용한 실행은 모두 시작 전에 거부됐다: `~/.docker` 안의 심볼릭 링크(Docker Desktop CLI plugin 10개) 때문에 Bash sandbox가 Docker 자격 저장소를 확실히 제외할 수 없다는 이유다. 사용자 승인 아래 이 eval 프로세스에만 빈 `DOCKER_CONFIG`를 줬지만 검사는 `~/.docker`를 그대로 봤다(`2026-09-28-smoke2/result.json` SHA-256 `a1b925c76f553d026a1fbca3435dc92dd1089f9d89393c9d23c2b20cfe0d721d`). `~/.docker`는 바꾸지 않았다.

## 3. 행동 eval의 채점 기준 분리

[§6](2026-09-28-harness-eval-research.md#agent-eval의-채점-기준-노출--코드로-확인)에서 확인한 노출을 고쳤다.

- `agent-eval.mjs`: 작업공간과 상태 디렉터리를 trial 디렉터리 아래 형제로 둔다. case 파일은 target이 끝난 뒤 작업공간 밖에 쓰고 `EVAL_CASE_PATH`는 grader에만 준다. 작업공간에 `.gitignore`를 덧붙이지 않으므로 빈 fixture도 커밋되게 `--allow-empty`를 쓴다.
- native `run.mjs`: 작업공간 레이아웃은 그대로 두고, `case.json`과 `before.json`을 target 종료 후에 쓴다. 사건 판정은 메모리에 둔 before snapshot을 쓴다. 후보가 실행 중 `before.json`을 만들거나 고쳐도 결과에 영향이 없다.
- 회귀 사례 20개의 `scenario.json`에서 `required_events` 사본만 지웠다. 각 행의 grader용 `required_events`는 그대로다.

검증: `agent-eval.test.sh`에 target이 case 파일·채점 기준을 작업공간과 상위 trial 디렉터리 어디에서도 찾지 못하고 grader는 case를 읽는 사례, 증거 hash 불일치가 incomplete가 되는 사례를 추가했다. 변경 전 driver와 변이 5개(target에 case 경로 제공, 상태를 작업공간 안에 둠, grader에 case 경로 없음, hash 검사 제거, case를 target 전에 작업공간 옆에 씀)가 모두 실패했다. 작업공간 안에 case를 쓰되 target 뒤에 쓰는 변이는 통과했다. target이 볼 수 없으므로 같은 성질이다. `native.test.mjs`의 새 사례는 변경 전 `run.mjs`에서 실패하고 변경 후 24/24 통과한다.

남은 것: 회귀 사례 prompt는 여전히 "required events를 실행하라"고 일반적으로 말한다. pstack식 자연어 요청으로 바꾸는 것은 dataset 재작성이라 이번 범위에 넣지 않았다.

## 4. 변경 없는 재실행

`verdict-run.sh`가 원장 payload에 검증 시작 시점 작업 트리 digest(기존 `START_CONTEXT`의 값, HEAD·추적 파일 diff·status·untracked 내용)를 싣는다. 계산할 수 없으면 `null`이다. `run-metrics`는 같은 명령의 직전 verdict와 digest가 같으면 변경 없는 재실행으로 센다. digest가 없는 verdict는 분모에서 빼고, 비교 가능한 것이 없으면 `INSUFFICIENT_DATA`다.

검증: `run-metrics.test.sh` fixture(명령 사이에 다른 명령이 끼는 경우와 digest 없는 경우 포함)에서 2/3. `ledger-attribution.test.sh`는 실제 `verdict-run.sh`를 세 번 실행해(무변경 2회, 수정 후 1회) digest가 64자 hex이고 무변경 재실행 1/2를 센다. 변경 전 `verdict-run.sh`에서는 실패한다.

## 통합 검증

- 전체 engine suite(Node 22.14): **86/86**. native 테스트 24/24.
- base `96026e5`의 `agent-eval`·`run-metrics`·`ledger-attribution` 테스트와 native 테스트(23개)를 새 코드에 실행해 모두 통과했다. 기존 실패 검출은 유지된다.
- `check-docs-hygiene`, `check-skill-refs`, skill lock, runtime package 생성·`--check`(`evals/`는 패키지에 들어가지 않는다), `claude plugin validate`, publish-freshness 통과. `paul-loop` 0.2.0 → 0.3.0.

## 한계

- 베이스라인은 사례당 3회라 효과를 주장할 수 없다. 추세를 볼 첫 점이다. Bash 사례는 미측정이다.
- `claude plugin eval`은 plugin 유/무만 비교한다. 이전 버전 대비는 같은 스위트를 두 checkout에서 돌려 비교해야 한다.
- plugin hook은 agent sandbox 밖에서 실행되므로 점수는 참고치다.
- 행동 eval 변경은 결정적 테스트로만 확인했다. 실제 Codex·Claude native 실행은 하지 않았다.
