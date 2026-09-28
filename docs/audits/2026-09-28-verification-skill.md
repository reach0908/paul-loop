# 검증 스킬(기능 지도) 도입과 워크숍 리서치 검증

기준: **2026-09-28 KST**. base: `56d19e9`(paul-loop 0.3.0). 요청: 추가 리서치 문서(Lauren Tan 워크숍 분석)를 확인하고, 그 권고 중 paul-loop에 없는 것을 진행한다.

## 판단

- 리서치 문서의 사실 주장은 대부분 원문과 맞는다. 틀린 곳은 두 군데(인용 하나, 사람 검토)이고, eval로 "개선/회귀를 관찰"한다는 서술은 대조군이 없는 pstack 절차에 비해 과장이다.
- 문서 §8의 권고 7개 중 paul-loop에 없던 것은 **기능 지도(검증 스킬)** 하나다. 검증 계약에는 입증 기준과 정리 규칙이 빠져 있었다. 둘을 이번 변경에 넣었다.
- Docker 링크를 정리해 Bash 사례를 처음 측정했다. 검증 스킬 사례는 plugin 있음 3/3, 없음 0/3이다. plugin 없이도 스킬 파일은 만들지만 기능 지도를 만들지 않았다. diagnose·review는 두 조건 모두 3/3, tdd는 2/3 대 3/3이다. 모두 조건별 3회라 효과 주장은 하지 않는다([§4](#4-bash-사례-첫-측정)).

## 1. 리서치 문서 검증

대상: `ai-agent-workshop-analysis-ko.md`(SHA-256 `e43a51df3f6e386711aee7129dbcd7cb9c39aad022fd1cec2f73ed199c21b5e2`, 수정하지 않음). 원문 기준: cursor/plugins `ecc249f1e306`(pstack 마지막 변경 `12d587d`, 2026-09-23), garrytan/gstack `01593aa67c94`. 원시 노트는 gitignore된 `.loop/research/2026-09-28-workshop-verify/`에만 둔다.

| 주장 | 판정 | 근거 |
|---|---|---|
| pstack manifest: Lauren Tan, MIT, 0.15.5 | 맞음 | `pstack/.cursor-plugin/plugin.json` |
| playbook 23개·원칙 23개, `control-ui`/`control-cli`는 `cursor-team-kit` | 맞음 | README, `playbooks/*.md` 23개, `skills/principle-*` 23개 |
| eval 블라인드(금지어 10개), 스킬 나열 요청 금지, 산출물 직접 확인 | 맞음 | `playbooks/eval.md` L7·L9–10·L22–23 |
| 판정자는 다른 모델 계열 | 일부 | eval.md는 단정하지만 arena는 부모 대비 "선호"다. 기본 실행 모델과 판정자 풀이 같은 3계열이라 판정자는 늘 후보 하나와 같은 계열이다 |
| 사람이 최종 확인 | 틀림(playbook 기준) | step 7은 실행 에이전트가 산출물을 읽는다. 강연 발언인지는 미확인 |
| create/maintain-verification-skill의 절차·기능 지도·clean/changed/blocked | 맞음 | 각 `SKILL.md` |
| Benny: 자동화 2개, draft PR까지만 | 맞음 | `automations/benny/FOR_AGENTS.md` L5·L36 |
| Dune은 pstack에 없음 | 맞음 | cursor/plugins 전체 검색 0건 |
| "GStack에서 이름을 땄다"의 출처가 pstack 저장소 | 틀림 | README에 해당 서술 없음. 강연에서만 나온 이야기로 보인다(미확인) |
| gstack MIT, Think→…→Reflect, 23 specialists / 8 power tools | 맞음 | LICENSE, README L23·L209 |
| Maven 행사(60분, Cursor MTS, 목차 순서), Cursor harness 블로그(Keep Rate, A/B) | 맞음 | 각 페이지 |
| 영상 제목·길이·날짜 | 맞음 | YouTube 메타데이터 |
| 영상 본문(같은 워크숍, PR 수치, Dune 규칙), X 글 | 미확인 | 자막 요청 429, X 글은 시도하지 않음 |

[이전 조사 §6](2026-09-28-harness-eval-research.md)과의 관계: pstack은 그때 고정한 `ecc249f`에서 바뀌지 않았다. 대조군이 없다는 점, 기본값이 모델 3개 × 1회라는 점은 새 문서에 빠져 있다.

## 2. §8 권고와 paul-loop

| 권고 | 이전 상태 | 이번 변경 |
|---|---|---|
| 검증 계약 | AC 계약·verdict·3단계 실행 확인은 있음. 입증 기준·정리 규칙 없음 | ship-feature 3단계에 입증 기준 추가 |
| 기능 지도 | 없음. 3단계가 매번 앱 실행 방법을 새로 찾음 | `create-verification-skill` 추가 |
| 불변 eval 세트 | 회귀 20개, `evals/` 5개. prompt가 메타 표현, 판정자 같은 계열, Bash 사례 미측정 | 사례 1개 추가(미측정). 나머지는 후속 |
| 교정 규칙을 코드로 | 게이트 hook·check·CI 있음 | — |
| 결정·증거 로그 | evidence, 원장 digest, PR 결정 기록 있음 | — |
| 격리 병렬화 | worktree 격리 있음. 다중 에이전트 fan-out은 의도적으로 뺌(ADR-0061) | — |
| 권한 확장 | AUTHORIZATION과 merge 게이트 있음 | — |

## 3. 변경

- `create-verification-skill`: pstack 원본을 옮기되 세 가지를 바꿨다. 생성 위치를 host의 프로젝트 스킬 디렉터리(`.claude/skills/`, Codex `.agents/skills/`)로, 본문에 이 plugin의 권한·출력 언어 계약을, 지도 유지를 별도 `maintain-verification-skill` 대신 ship-feature 3단계로. `references/feature-map-example/`은 그대로 복사했다. MIT 고지는 `NOTICE`, 출처와 차이는 `skills-lock.json`의 `fork` 항목에 있다. maintain 스킬은 옮기지 않았다. 주기적 감사가 필요해지면 그때 추가한다.
- ship-feature 3단계: 프로젝트에 `verify-*` 스킬이 있으면 그 Launch/Doctor/Drive/Evidence/Cleanup으로 바뀐 기능의 모든 진입점을 돌리고, 지도의 해당 기능 파일을 같은 변경에서 고친다. 없더라도 입증 기준(실제 사용자 경로, 행동과 결과 상태, 부수효과, dry-run이 실제로 건너뛰는 것의 관찰, 정리 후 증거 존재)을 적용한다.
- 진입 라우팅(`paul-loop`)과 `ask-paul`에 한 줄씩 추가.
- `evals/verification-skill-cli`: todo CLI fixture에서 자연어 요청으로 검증 스킬을 만들게 한다. 결과(스킬·지도 파일 생성, 기능 파일 형식)와 과정(실제 실행, 정리 후 증거 존재, 제품 코드 무수정)을 채점한다. prompt와 fixture에는 pstack 금지어가 없다. 요청에 저장 위치 `skills/`를 적는다: eval host는 `.claude/`를 쓰기 금지 경로로 막는다(아래 §4).

## 4. Bash 사례 첫 측정

Bash sandbox가 거부하던 원인은 `~/.docker` 안의 심볼릭 링크 31개(CLI plugin 15, Model Runner dylib 16)였다. 사용자가 백업을 남기고 `cliPluginsExtraDirs`로 plugin 경로를 옮긴 뒤 dylib 링크를 사본으로 바꿨다(링크 0개, `docker compose`/`buildx` 정상). 그 뒤 plugin 0.4.0 checkout으로 측정했다. Claude Code 2.1.283, `--model claude-opus-5-5`, `--judge-model claude-sonnet-5`, 조건별 3회, `--allow-tools Bash Write Edit`.

| 사례 | plugin 있음 | 없음 | 스킬 발동 | 평균 턴 | 평균 비용(정가 추정) |
|---|---|---|---|---|---|
| diagnose-failing-test | 3/3 | 3/3 | 0/3 | 6.0 / 5.7 | $0.25 / $0.20 |
| review-planted-bug | 3/3 | 3/3 | 0/3 | 6.3 / 4.0 | $0.20 / $0.22 |
| tdd-new-function | 2/3 | 3/3 | 3/3 | 19.3 / 8.0 | $0.40 / $0.24 |
| verification-skill-cli | 3/3 | 0/3 | 3/3 | 18.0 / 12.3 | $0.66 / $0.43 |

- diagnose·review는 이 난이도에서 plugin 없이도 통과하고, 해당 스킬은 발동하지 않았다. 모델 간 차이를 보려면 더 어려운 사례가 필요하다.
- tdd는 스킬이 매번 발동해 턴이 약 2.4배다. 실패 1건은 "실패 후 통과" 판정 표가 1:2로 갈린 경우이고, 결정적 grader(테스트 먼저 작성, 파일 생성)는 3회 모두 통과했다.
- verification-skill-cli: plugin 없는 쪽도 스킬 파일은 만들었지만(3/3) 기능 지도는 만들지 않았고(0/3), 1회는 끝까지 실행한 증거가 판정에서 떨어졌다. 기능 지도 grader는 이 스킬이 정한 형식이라 plugin 쪽이 정의상 유리하다. 두 조건 공통 목표(스킬 작성 후 실제 실행 입증)는 3/3 대 2/3이다. 통과율 3/3 대 0/3의 Fisher 정확 검정 p = 0.1.
- 첫 실행(`2026-09-28-bash-cases`)에서 이 사례는 6회 모두 스킬 파일 grader가 실패했다. 원인은 스킬이 아니라 사례 설계였다. eval host가 `.claude/skills/`를 보호 경로로 막아 모든 실행이 임시 폴더에 만들고 옮겨 달라고 안내했다(우회하지 않았다). 또 제품 파일 수정 grader가 Edit 입력 전체를 검사해, 스킬 문서 안의 `bin/todo.js` 글자에도 걸렸다. 저장 위치를 요청에 적고 grader를 `file_path`로 고정해 다시 실행했다. 첫 실행 결과는 점수로 쓰지 않는다.

- **측정 뒤 확인된 환경 한계.**
  - 이 macOS host의 eval sandbox 안에서는 대상이 git을 실행할 수 없다. `/usr/bin/git`(xcrun shim)은 cache 파일을 만들지 못해 실패하고, 실제 git 바이너리(Xcode·Homebrew)는 sandbox가 파일 정보 조회를 막아 PATH에서 찾히지 않는다. 위 표의 24회 중 13회에서 판정 발췌에 git 실패가 보인다(diagnose 4, review 3, tdd plugin 없음 3, verification plugin 없음 3).
  - diagnose·tdd·verification은 과제에 git이 필요 없다. review-planted-bug는 "main 대비 리뷰"라 git diff가 필요한데, `read-the-diff` grader는 git 호출 시도만 셌다. 그래서 diff를 보지 못한 실행도 통과했다. 이 사례의 3/3 대 3/3은 유효한 비교가 아니다. 후속 변경에서 이 grader가 실제 diff 출력(`diff --git`)을 요구하도록 바꾼다.
  - 이 세션에서 실행한 eval은 두 조건 모두 자식 PATH에 설치된 loop-engine 0.2.0의 `bin/`이 들어가 있었다. 결과 발췌를 검색해 보니 위 네 사례에서는 그 명령을 호출한 흔적이 없다.

원시 결과는 gitignore된 `.loop/plugin-eval/`에만 둔다. `2026-09-28-bash-cases/result.json` SHA-256 `cb1de9b8cf5ce0fe34a201d9e05b0112d46892e1a3e34f7c50cb606cd06ef525`(1,429초, 정가 추정 $8.76), `2026-09-28-verification-rerun/result.json` SHA-256 `1edcaae5ef2cac515ec119e31da2397c40b393e088230d6765a59f0df13ac7e3`(609초, $3.29). 구독 과금과는 다르다.

## 한계

- 조건별 3회라 모든 차이는 우연과 구분되지 않는다. 추세를 볼 첫 점이다.
- `llm` 판정자(Sonnet 5)는 대상(Opus 5.5)과 같은 계열이다. 결정적 grader(파일·도구 사용)를 우선 본다.
- plugin hook은 agent sandbox 밖에서 실행되므로 점수는 참고치다.
