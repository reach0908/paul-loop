# 하네스 변경 평가 방법 — eval 딥리서치

기준: **2026-09-28 KST**. 상태: **조사 결과와 분석 권고. 원문을 다시 연 항목만 사실로 기록. eval 구현·실행 아님.**
입력: [브리프](2026-09-28-harness-eval-research-brief.md). 선행: [09-28 harvest](2026-09-28-harvest.md), [agent evaluation](../../tools/loop-engine/docs/agent-evaluation.md), [native eval](../../scripts/native-eval/README.md).

## 판단

paul-loop에 필요한 것은 새 eval 인프라가 아니라 **이미 있는 행동 eval을 판정 가능한 상태로 만드는 절차**와 **짝지은 비교를 위한 기록**이다.

1. **한 번에 하나만 바꾸고 같은 과제를 짝지어 비교한다.** 모델·effort·CLI 버전뿐 아니라 host 자원·timeout·동시성도 고정하고 기록한다. Anthropic은 같은 모델·하네스·과제에서 자원 설정만으로 Terminal-Bench 점수가 6%p 움직였다고 보고했다.
2. **회귀 사례 20개는 회귀 탐지용이지 효과 증명용이 아니다.** 20번 모두 위반이 없어도 실제 위반율의 95% 상한은 약 13.9%다. 1% 미만을 보이려면 약 298회의 독립 시행이 필요하다. 결과는 과제 단위로 짝지은 차이와 신뢰구간으로 보고하고, 판단이 안 되면 "inconclusive"로 둔다.
3. **INCOMPLETE를 벗어나는 조건을 구체화할 수 있다.** 필수 event를 지우거나 순서를 뒤집거나 무관한 marker를 넣은 변형을 grader가 실패로 판정하는지 확인하는 mutation test가 event binding 검토의 실체다. LLM 호출 없이 할 수 있다.
4. **최종 상태와 행동 경로를 함께 채점한다.** 결과물은 agent가 수정할 수 없는 깨끗한 환경에서 patch를 다시 적용해 검증한다. 승인·취소·리뷰는 trace로 판정한다. LLM judge는 사람 라벨로 보정한 보조 수단이다.
5. **`claude plugin eval`은 "plugin이 있을 때와 없을 때"의 가치를 재는 도구로 쓴다.** 이전 버전 대비 비교, 코드 기반 grader, 긴 ship-feature trace 판정은 지원하지 않는다. 기존 `agent-eval`/native eval의 독립 grader를 대체하지 않는다.
6. **비용은 USD가 아니라 token·호출 수·시간으로 비교한다.** 구독형 CLI의 실제 과금은 알 수 없고, 제공되는 비용 값은 정가 기준 추정치다.
7. **memory는 효능을 주장하지 않는다.** 실제 표본이 0건이므로, 비교는 no-memory·검색·oracle·stale 네 조건을 갖춘 뒤로 미룬다.
8. **채택 규칙:** 안전·승인·test tampering 위반이 새로 생기면 즉시 되돌린다. 효율 개선은 검증된 성공률이 나빠지지 않았을 때만 유지한다. 신뢰구간이 이득과 손실 모두와 양립하면 기존 동작을 유지한다.

## 방법과 범위

- Aside CLI 1.26.916.1741, `--account u1 --effort ultrabrowse`, 세션 `0ItWCXw8CpysF9QI`, exit 0. 원시 출력·보고서는 gitignore된 `.loop/research/`에만 보관한다.
- Claude Code 공식 문서는 별도로 확인했고, Aside 보고서의 load-bearing 주장은 두 갈래(논문·벤치마크 / 제품 문서·도구)로 WebFetch 원문 대조를 했다.
- 로컬에서 `claude plugin eval --help`, `claude plugin details`, `claude plugin list`를 읽기 전용으로 실행했다. eval·유료 모델 실행·설치 변경은 하지 않았다.

| 로컬 원시 자료 (`.loop/research/`) | SHA-256 |
|---|---|
| 2026-09-28-evals-aside.out | `63d84948c1003180dbbbf81898260bb8f6be1045ca491526c702afbaef3d49fc` |
| 2026-09-28-evals-aside-report.md | `75fe55d5a5f56e3fa92e76ce392436c28d969f38f8ff23018cc37290e896f845` |
| 2026-09-28-pstack-eval-aside-report.md (§6, 사용자 수행) | `17092e0bb77681d3bd94893dc011a77eefcea74022fc684727a6d46764478536` |

## 1. 현재 paul-loop eval 자산

| 층 | 자산 | 판정 가능성 |
|---|---|---|
| 결정론적 엔진 동작 | engine 86·memory 175 테스트, `tier0` 5건, `eval-gate`(pass@k/pass^k) | 가능. 변경으로 인한 회귀를 잡는다 |
| 에이전트 행동 | `agent-eval` driver, 회귀 사례 20개, Codex/Claude adapter, 독립 grader | 불가. event binding 검토 전 INCOMPLETE. 짝지은 기준선 실행 없음. Claude 경로 미인증 |
| 실사용 | `run-metrics`(사람 개입, 첫 통과율, 런당 verdict 수, 압축 후 실패율, recall 건전성) | 부분. 원장에 `ts`·`cmd`는 있으나 작업 트리 상태가 없어 변경 없는 재실행을 셀 수 없음 |

## 2. 원문으로 확인한 근거

| 주제 | 자료 | 확인한 내용 | 보정·한계 |
|---|---|---|---|
| 환경 변동 | [Anthropic infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise), 2026-02-05 | 같은 모델·하네스·과제에서 자원 설정만으로 Terminal-Bench 6%p(p<0.01), SWE-bench 227과제×10 표본에서 RAM 5배 시 +1.54%p. 자원을 "first-class experimental variable"로 다루라고 권고 | — |
| 하네스 ablation | [Natural-Language Agent Harnesses](https://arxiv.org/html/2603.25723v1), 2026-03 | Codex CLI 0.114.0·GPT-5.4 xhigh 고정, SWE-bench Verified 125 + OSWorld 36, 과제당 1회. runtime skill 제거 시 74.4→76.0%, 도구 호출 −30%, 실행 시간 −49% | 1회 표본이라 작은 차이는 확증 불가 |
| 반복 신뢰성 | [τ-bench](https://arxiv.org/abs/2406.12045) | retail 115 + airline 50, 주요 결과는 과제당 최소 3회, pass^k 분석 | — |
| 통계 | [Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640), 2024-11 | "evaluations are experiments". 표준오차, clustered SE, 재표집, 문항 단위 짝지은 차이, 검정력 분석 권고 | — |
| 깨끗한 채점 환경 | [SWE-Bench Pro V2](https://github.com/scaleapi/SWE-bench_Pro-os/tree/main/v2), [DeepSWE](https://arxiv.org/abs/2607.07946) | Pro V2: 642과제·11 repo, oracle patch 642/642 통과, 빈 patch 642/642 실패, 깨끗한 이미지에 patch 재적용. DeepSWE: 113과제, 손으로 쓴 동작 검증기, v1.1부터 별도 깨끗한 컨테이너에서 채점 | oracle·빈 patch 대조군은 grader 자체의 검증 방법으로 차용 가능 |
| judge 편향 | [MT-Bench](https://arxiv.org/abs/2306.05685), [Judging the Judges](https://arxiv.org/abs/2406.12624) | 위치·장황함·자기선호 편향, 사람과 80% 이상 일치. 높은 일치율에도 점수가 크게 다를 수 있어 단순 일치율 이상의 지표 필요 | Aside는 2406.12624 제목을 틀리게 적었다 |
| reward hacking | [METR](https://metr.org/blog/2025-06-05-recent-reward-hacking/), 2025-06-05 | 채점 코드 수정, 정답 참조, 타이머 조작 사례 | 발생률 추정이 아닌 위험 유형의 근거 |
| memory 평가 | [LongMemEval-V2](https://arxiv.org/abs/2605.12493), [STALE](https://arxiv.org/abs/2605.06527) | 451문항·5개 능력 분해, 낡은 기억의 암묵적 충돌 | 채팅·일반 memory 과제. 코딩 효용 근거 아님 |
| 비열등 통계 | 계산 | 0/20의 정확한 단측 95% 상한 = 1−0.05^(1/20) ≈ 13.9% | — |

2차 출처로만 확인: OpenAI SWE-bench Verified 발표(500과제, 개발자 93명, single seed, scaffold에 따른 GPT-4 2.7–28.3%)는 원문 403. Terminal-Bench 논문의 89과제·조합당 최소 5회는 검색 결과로만 확인. Terminal-Bench 4.0의 포화 과제 제거(8개 중 2개가 5/5 포화)는 tbench.ai 공지에서 나왔으며 Aside 보고서는 이를 다른 인용과 섞었다.

## 3. native 도구

### Claude Code `claude plugin eval`

[공식 문서](https://code.claude.com/docs/en/plugin-evals) 기준:

- 격리된 비대화형 세션에서 대상 plugin만 로드한다. 사용자 설정·다른 plugin·CLAUDE.md·memory는 없다. 기본 3회 실행.
- grader 6종: `regex`, `tool_used`, `tool_order`, `file_exists`(무료), `llm`, `baseline`(judge 3회 투표, 2/3 통과). **custom-code grader는 없다.** 기본 judge는 "a small fast model"이라고만 적혀 있다.
- `--ablation with-without`: Δ = plugin 사용 점수 − 미사용 점수. `tool_used: Skill`과 mock 호출 grader는 점수에서 제외된다. Δ는 exit code를 바꾸지 않는다.
- plugin hook이 실행된다. 다만 hook은 agent sandbox 밖에서 돌기 때문에, 격리 환경이 아니면 점수를 advisory로 보라고 한다.
- 결과에 정가 기준 추정 `costUsd`와 `durationSeconds`가 남는다.
- 터미널에서 실행하면, 구독에서 artifact가 켜져 있는 경우 리포트를 비공개 artifact로 게시하는 것이 기본이다. Claude Code 세션 안에서 시작한 실행은 기본적으로 로컬에 남는다. `--no-publish`로 항상 로컬에 둘 수 있다.

hook 중심인 paul-loop에서의 제약:
- 이전 버전 대비 비교는 지원하지 않는다. 두 checkout에서 각각 돌리고 결과를 직접 비교해야 한다.
- "hook이 X를 막았다"는 trace에 대한 `regex`나 `tool_used`/`tool_order` 횟수로만 표현할 수 있다.
- `llm` judge는 trace의 처음과 끝 12개 메시지만 본다. 긴 ship-feature 실행은 잘린다.
- 요금제·rate limit에 걸린 run은 부분 결과가 아니라 0점이 된다. `--model`을 고정하지 않으면 모델 교체가 plugin 회귀처럼 보인다.

### 기타

| 도구 | 측정 대상 | 비고 |
|---|---|---|
| `claude plugin details` | 구성요소와 예상 토큰 비용 | #140 이전 로컬 측정: ship-flow 0.11.7 상시 약 3,320토큰(skill 30개), loop-engine 0.15.20 상시 0(hook만). "Token counts are estimates". 단일 `paul-loop` 설치 단위는 재측정 대상 |
| `/skill-doctor` | skill별 사용·비용, 미사용 skill | 품질 지표 아님. 버전 요건은 확인 못 함 |
| `/doctor prompt-audit` | CLAUDE.md·skill·설정의 낡거나 충돌하는 지시 | v2.1.283 이상. Claude Code commands 문서에 기재 |
| Claude Code OTel | `claude_code.token.usage`, `claude_code.cost.usage`(정가 추정) | prompt·tool 내용은 기본 비수집, opt-in |
| `codex exec --json` | JSONL event, `turn.completed` usage(input/cached/output/reasoning tokens) | 실제 구독 과금 환산은 없음 |
| [Inspect](https://inspect.aisi.org.uk/) | dataset → agent → scorer, Claude Code·Codex CLI 등 외부 agent 실행 | custom scorer 가능. Python 운영 부담 |
| OpenAI Evals platform | dataset eval | **2026-10-31 read-only, 11-30 종료 예정.** 새 의존성으로 쓰지 않는다 |
| Braintrust, LangSmith, Phoenix | trace·실험·dataset | 참고만. hosted는 data 반출, Phoenix는 Elastic License 2.0(source-available) |

## 4. 측정 대상 설치 상태

`claude plugin list` 기준, 이 provider 저장소의 로컬 checkout(`<local-home>/dev/paul-loop`)에는 `local` 범위의 loop-engine **0.2.0**이 있고 user 범위에는 0.15.20이 있다. 오류 메시지가 0.2.0을 가리키므로, 이 저장소 세션에서는 ship-flow 0.11.7과 loop-memory가 `Requires "loop-engine@paul-loop" ^0.15.0, installed 0.2.0`로 로딩되지 않는다. 이 저장소 안의 세션·관측은 ship-flow를 측정한 것이 아니다. 다른 프로젝트의 로딩 상태는 이 출력만으로 판정하지 않았고, 설치는 변경하지 않았다.

같은 날 #140(`51731b7`)이 병합되어 공개 설치 단위가 `paul-loop` 0.1.0 하나로 바뀌었다. 위 관측은 병합 전 분할 설치에 대한 것이다. 기존 설치는 명시적 이전 전까지 그대로 남으므로 local 0.2.0 문제도 이전 전까지 유지된다.

## 5. paul-loop 최소 eval 프로그램 — 분석 권고

| 시점 | 실행 | LLM 비용 |
|---|---|---|
| 매 변경 | 기존 engine/memory 테스트, `eval-gate`, 회귀 사례 grader의 event binding mutation test(필수 event 삭제·순서 뒤집기·무관 marker·로그 누락), run manifest(코드 SHA, 지시 hash, 모델·effort·CLI, fixture digest, 자원·timeout·동시성, grader 버전) | 없음 |
| 릴리스 후보 | binding 검토를 통과한 사례만, 같은 fixture로 기준선·후보를 짝지어 2–3회(20사례면 80–120 run). 과제 단위 Δ, 95% CI, 뒤집힌 과제, 안전 위반, 변경 없는 재실행, token·시간 보고. plugin 자체의 가치는 작은 `claude plugin eval --ablation with-without --no-publish --model <고정>` 스위트로 따로 확인 | 있음. `--max-cost-usd`·lane budget으로 상한 |
| 정기 | 안전·승인 실패 전수와 arm별 무작위 3–5개 trace 수동 검토, 실제 실패를 최소 재현 fixture로 회귀 사례에 추가, 일부는 private held-out으로 분리. 모델 출시와 하네스 변경은 따로 재측정 | 검토 시간 |

| 개선 후보 | 짝지어 바꿀 것 | 유지 기준 / 되돌릴 조건 |
|---|---|---|
| 구형 모델용 지시 정리 | 지시만 교체 | 검증된 성공률·정책 준수 유지와 token 감소. 관련 누락이 늘거나 판단 불가면 복귀 |
| 불필요한 재검증 감소 | 변경 없는 재실행 조건만 | 변경 없는 재실행 감소, 수정 후 필수 검증 유지. 필수 검사 누락 시 즉시 복귀 |
| 모델별 effort | effort 설정만 | 모델별 성공률·token·시간. 평균이 특정 모델의 회귀를 가리면 분리 판단 |
| 작은 가역적 변경 라우팅 | router만 | 해당 bucket의 품질 유지와 시간 감소. 비가역 작업이 가벼운 경로로 가면 보류 |
| semantic memory | off / 검색 / oracle / stale | 실제 검증된 표본 필요. 지금은 교훈 10–20건의 조건·버전·검증일 기록까지만 |

"변경 없는 재실행"은 같은 명령·같은 코드 hash·사이 수정 없음으로 정의한다. `verdict-run.sh`에는 `--guard-mutation`용 작업 트리 digest 계산이 이미 있으므로, 이를 원장 기록에 포함하는 것이 가장 작은 구현 후보다.

## 6. 추가 조사 — pstack `/eval` 비교 (사용자 수행)

사용자가 Aside(u1) 세션 `QGY5grcITxHOC635`로 Cursor pstack의 `/eval` playbook과 paul-loop 평가 체계를 비교한 보고서를 만들었다. 결론은 "pstack은 실험 설계 위생, paul-loop은 실행 가능한 검증 계약과 증거가 강하다. pstack의 blind·transcript 절차를 agent-eval 앞뒤에 이식하라"이다. pstack 원문 4개(`cursor/plugins` main `ecc249f`, 2026-09-25)를 다시 열었고, paul-loop 관련 주장은 저장소 코드·문서와 대조했다.

| 보고서 주장 | 판정 | 원문 기준 |
|---|---|---|
| manifest 0.15.5, playbook 23개 | 확인 | playbooks 디렉터리의 `.md` 23개 |
| 후보가 보는 곳에 실험 단서 금지, 적용한 skill 나열 요구 금지 | 확인·보정 | 금지어는 10개: `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`, `candidate`, `arena`. 디렉터리·파일 이름에도 적용. 다른 후보가 있다는 사실도 알리지 않는다 |
| 실제로 읽은 파일을 transcript로 확인, 다른 프로젝트 transcript 검색 금지 | 확인 | 활성 workspace의 `agent-transcripts/`만 읽는다 |
| 다른 모델 계열의 judge | 보정 | 부모 모델과 다른 계열을 "prefer"하는 권고다 |
| 7단계 "사람의 종합" | 보정 | playbook을 실행하는 agent가 모든 출력을 직접 읽고 judge와 대조해 승격을 권고한다. 사람 검토 단계가 아니다 |
| 표본 수·반복 k·수치 승격 기준 없음 | 확인 | arena 기본값은 서로 다른 모델 3개에 각 1회 |
| paul-loop README 버전(loop-engine 0.15.20 등) | 낡음 | 작성 직후 #140으로 `paul-loop` 0.1.0 단일 버전이 됐다 |
| tier-0 5건, eval-gate 단언 종류, 09-23 native routing 7/8 완료·1건 180초 timeout, memory hook `skipped/no_embedding_key`, file-lesson replay의 prospective 표본 0 | 확인 | 저장소 문서 |

보고서가 약하게 다룬 점: pstack `/eval`에는 기본 대조군이 없다. 모든 후보 디렉터리에 변경안을 넣고 후보끼리는 모델만 다르다. 두 변경안 비교는 조건부 규칙으로만 있다. 판정자는 한 명이고 반복이 없으며, agent와 judge의 불일치는 경고로만 다룬다. 따라서 이 절차만으로는 변경의 효과와 모델의 효과를 분리할 수 없다. 같은 모델에서 기준선과 후보를 짝짓는 §5가 여전히 주 경로이고, pstack에서 가져올 것은 후보 blind 규칙과 transcript 확인이다.

### agent-eval의 채점 기준 노출 — 코드로 확인

보고서는 채점 기준이 후보에게 숨겨진다는 보장을 확인하지 못했다고 했다. 코드상 숨겨지지 않는다.

- `agent-eval.mjs`는 trial 상태 디렉터리를 작업공간 안(`<workspace>/.eval-state`)에 만들고, target을 실행하기 전에 case 전체(`criteria`, `required_events` 포함)를 `.eval-state/case.json`에 쓴다(`agent-eval.mjs:43`, `:58`). target 환경의 `EVAL_CASE_PATH`가 이 파일을 가리킨다(`:59`).
- 회귀 사례 20개 모두 prompt가 `scenario.json`을 읽으라고 하고, 20개 모두 그 파일에 `required_events`가 있다.
- 그래서 현재 사례는 "자연스러운 요청에서 스스로 올바른 절차를 골랐는가"보다 "보이는 요구를 수행했는가"를 잰다.

거짓 PASS로 바로 이어지지는 않는다. driver는 메모리에 있는 `c.required_events`로 누락 event를 판정하므로(`:75`) 파일을 고쳐 필수 event를 지울 수 없다. 후보가 `EVAL_STATE_DIR`에 adapter trace를 위조할 수 있는지는 확인하지 않았다.

## 7. 다음 행동 후보 — 미실행

1. 회귀 사례 20개의 event binding mutation test 설계. LLM 비용 없이 INCOMPLETE 해제 조건을 만든다. target이 `EVAL_STATE_DIR`에 가짜 event를 쓰는 경우를 driver가 거부하는지도 여기서 확인한다.
2. 채점 기준 분리. target에는 작업 입력만 주고 `criteria`·`required_events`는 작업공간 밖 grader 전용 경로에 둔다. 회귀 사례 prompt와 fixture 이름에 pstack의 금지어 규칙을 적용한다. 평가 계약이 바뀌는 변경이므로 verifier 변경 절차를 따른다.
3. verdict 원장에 작업 트리 digest 추가와 `run-metrics`의 변경 없는 재실행 집계.
4. `paul-loop`용 `claude plugin eval` 소규모 스위트(3–5사례)로 plugin 유무 비교. `--no-publish`, `--model` 고정, 비용 상한.
5. 분할 설치에서 단일 `paul-loop`로의 이전과 provider 저장소의 local loop-engine 0.2.0 정리 여부 결정(사용자 결정 사항).
6. 검증된 교훈을 조건·버전·검증일과 함께 기록하는 memory 파일럿.

> 이후(같은 날): 2와 3을 진행했고 1은 증거 hash 불일치와 상태 디렉터리 분리까지만 했다. 20개 사례의 event binding 검토는 남아 있어 native 결과는 여전히 INCOMPLETE다. 4는 5개 사례 중 Bash가 필요 없는 2개만 측정했다. 기록: [eval 베이스라인과 타당성 보강](2026-09-28-eval-baseline-and-validity.md).

## 한계

- Aside 보고서의 오류: 논문 제목 1건(2406.12624), 인용 혼동 1건(Terminal-Bench 4.0), METR 문구의 비축자 인용, `/skill-doctor` 버전 요건 미확인, Phoenix 라이선스 표현. 수치 자체의 오류는 없었다.
- OpenAI SWE-bench Verified 발표와 Terminal-Bench 일부 수치는 2차 출처로만 확인했다.
- 가격은 2026-09-28 확인값이며 변동될 수 있다.
- paul-loop에서 짝지은 실행을 하지 않았다. 위 프로그램은 시작점이며 효과는 미검증이다.
- pstack 비교는 문서와 코드를 대조한 것이다. pstack이나 agent-eval을 실행하지 않았다.
