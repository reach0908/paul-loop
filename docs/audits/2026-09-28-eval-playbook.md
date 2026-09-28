# Eval 플레이북 적용과 스킬별 사례 확장

사용자 요청: pstack의 eval 플레이북을 이 plugin에 적용하고, 기존 eval을 개선하고, 스킬마다 사례와
채점 기준을 만든다. 모델 비교는 Opus와 Sonnet만 쓴다. Base: `56d19e9` (#143, paul-loop 0.3.0).

## 1. 플레이북 → 이 runner

pstack `poteto-mode/playbooks/eval.md`(MIT, cursor/plugins `ecc249f`)의 규칙을
`claude plugin eval`(2.1.283)에 맞춰 [evals/README.md](../../evals/README.md)의 규칙 9개로 옮겼다.
기계적으로 확인 가능한 규칙은 `scripts/check-evals.mjs`가 막는다.

| pstack | 여기 | 강제 |
|---|---|---|
| 대상에게 측정 중임을 숨긴다(금지어) | 규칙 1. `test`/`compare`는 허용(실패 테스트·TDD 과제가 피할 수 없음) | checker: prompt 본문, fixture |
| 자연스러운 요청, 절차를 말하지 않음 | 규칙 2 | 사람 검토 |
| 대상의 자기 보고가 아니라 기록과 산출물로 채점 | 규칙 3. 결정적 grader 1개 이상, 대화형은 `dialogue` 태그 | checker |
| 채점 기준을 대상에게서 숨김 | 규칙 5. 모든 사례에 `no-oracle-peek` | checker |
| 판정자는 다른 계열 | 규칙 7. 이 runner에는 다른 계열 판정자가 없어 Opus↔Sonnet 교차, 결정적 grader 우선 | 사람 검토 |
| 모든 출력을 읽는다 | 규칙 8. 실패한 실행과 통과한 실행 1개씩 발췌를 읽고, 사례 탓이면 고쳐 다시 돌림 | 사람 검토 |
| (없음) | 규칙 9. 대조군(with/without), 3회는 고장 탐지용, Fisher p, 결과 SHA 기록 | summarize-evals |

pstack 플레이북에는 대조군이 없다(arena 기본값 3모델 × 1회). 여기서는 plugin 효과를 보려고
기본 with/without 두 조건을 쓴다.

추가한 이 runner 전용 규칙:

- Edit/Write `input_match`는 `"file_path"`에 고정한다(규칙 4). 입력에 파일 내용이 들어 있어, 경로만
  언급한 문서도 걸린다. 기존 diagnose·tdd grader가 이 문제에 걸려 있었다.
- `.claude/`는 eval host가 쓰기를 막는다(규칙 6).
- grader frontmatter 안의 `---`는 loader가 거기서 frontmatter를 끝낸다. 파일 하나가 로드되지 않으면
  suite 전체가 실패한다(규칙 6, checker).
- `tool_used: Skill` grader는 `--ablation none`에서 점수에 들어간다. `summarize-evals`는 이를 발동률로
  따로 세고 통과에서 뺀다. `arm: both`인 Skill 금지 grader(예: small-fix의 `no-delivery-loop`)는
  점수로 남는다.

## 2. 기존 사례 수정

- diagnose `reproduced-first`, `tests-not-edited`, `tests-not-rewritten`, tdd `test-before-implementation`:
  `file_path` 고정.
- grilling: 요청이 "질문 하나씩"이라는 채점 기준을 말하고 있어 자연스러운 요청으로 바꾸고 `dialogue` 태그.
- review 2개 `read-the-diff`: git 호출 시도만 세던 것을 실제 diff 출력(`diff --git a/src/…`)을 요구하도록
  바꿨다(§5).
- 모든 사례에 `no-oracle-peek`.

## 3. 새 사례 11개

| 사례 | 스킬 | 핵심 채점 | smoke(Opus, plugin 있음) |
|---|---|---|---|
| diagnose-misleading-symptom | diagnosing-bugs | 증상(cart)이 아니라 원인(catalog 파싱)을 고침, 테스트 불변 | 전 항목 통과, 스킬 미발동 |
| review-subtle-bug | code-review | 기다리지 않는 `forEach(async)` 발견, diff 읽기, 수정 없음 | 통과(당시 grader는 호출 시도만 셌음) |
| ship-feature-pr-ready | ship-feature | 테스트 먼저, 마지막 수정 후 검증, CLI 실행, planner/리뷰 에이전트, push·PR·merge 없음 | 8/13, 9/13. 스킬 미발동 |
| prd-from-meeting-notes | to-prd | PRD 섹션, user story 3개+, 저장소 사실 반영, 이슈·구현 없음 | 9/9 |
| issues-from-prd | to-issues | 3~8개 이슈, 이슈마다 체크박스, 의존성, 원격 게시 없음 | 9/9 |
| retrospect-hunch-unverified | retrospect | 교훈 CLI로 기록, 영수증 없는 `--verified` 금지, 추측을 확인된 것으로 쓰지 않음 | 8/8(2회차) |
| handoff-mid-task | handoff | 실패 테스트·미완 파일·계획 참조, 비밀번호 제거, 작업 보존 | 10/12 |
| write-skill-release | write-a-skill | `skills/release/SKILL.md`, name·description, 150줄 미만, 스크립트 사용, 릴리스 미실행 | 10/10 |
| setup-draft-config | setup | `npm run verify` 감지(`npm test`가 오답), `ko` 추론, 설치성 쓰기 없음 | 9/9 |
| merge-rename-vs-param | resolving-merge-conflicts | rename과 새 인자 모두 보존, 충돌 없는 파일의 호출부도 수정, merge 완료 | 8/9, 7/9(git 차단) |
| hotfix-from-wip-branch | hotfix | main에서 분기, 수정만 커밋, WIP 보존, push·deploy 없음 | 6/10, 9/10(git 차단). 스킬 미발동 |

smoke는 사례 검증용 1회 실행이라 점수로 쓰지 않는다. 결과 SHA-256은 §7.

사례 설계에서 정한 것:

- ship-feature·hotfix는 게시를 요청하지 않고 사용자가 push·PR을 맡는다고 적었다. fixture에 remote·GitHub
  인증·tracker가 없어, 게시를 요청하면 환경 때문에 막힌 결과만 측정한다.
- handoff 스킬은 `disable-model-invocation: true`라 자연스러운 요청으로는 불러올 수 없다. 이 사례의
  점수는 스킬이 아니라 기본 인수인계 품질이다. 스킬 형식을 따르는지 보는 grader는 `suggests-skills` 하나다.
- setup은 `.claude/ship-flow.config.json`을 쓰는데 host가 막으므로 스킬의 "초안만" 경로를 채점한다.
- to-prd·to-issues는 `backlog-file` tracker 설정으로 게시 대상을 로컬 파일로 한정했다.

## 4. with/without 측정 (git 없이 가능한 12개)

Claude Code 2.1.283, 대상 `claude-opus-5-5`(eval 자식의 기본 effort는 `medium`), 판정자 `claude-sonnet-5`,
조건별 3회, `--allow-tools Bash Write Edit`. `~/.claude/plugins/cache/`를 뺀 PATH와 `env -u CLAUDE_EFFORT`로
실행했다. 통과는 `summarize-evals` 기준(Skill 표시기·`with-only` grader 제외)이고, 턴과 비용은 run 평균,
비용은 정가 추정이다.

| 사례 | plugin 있음 | 없음 | 스킬 발동 | 턴 | 비용 | 없는 쪽이 떨어진 grader |
|---|---|---|---|---|---|---|
| diagnose-failing-test | 3/3 | 3/3 | 0/3 | 6.3 / 5.3 | $0.33 / $0.25 | |
| diagnose-misleading-symptom* | 3/3 | 3/3 | 1/3 | 6.0 / 5.3 | $0.33 / $0.27 | |
| tdd-new-function* | 3/3 | 3/3 | 3/3 | 19.0 / 8.0 | $0.29 / $0.15 | |
| small-fix | 3/3 | 3/3 | 0/3 | 4.3 / 4.0 | $0.12 / $0.09 | |
| grilling-one-question | 3/3 | 2/3 | 3/3 | 4.0 / 2.0 | $0.16 / $0.10 | 질문 하나(1회) |
| prd-from-meeting-notes | 3/3 | 0/3 | 3/3 | 12.0 / 11.0 | $0.43 / $0.27 | PRD 섹션, user story |
| issues-from-prd | 3/3 | 0/3 | 3/3 | 7.3 / 5.0 | $0.41 / $0.27 | 이슈마다 체크박스 |
| retrospect-hunch-unverified* | 1/3 | 0/3 | 3/3 | 2.3 / 6.7 | $0.65 / $0.31 | 교훈 기록 |
| handoff-mid-task* | 3/3 | 3/3 | 0/3 | 9.0 / 7.7 | $0.23 / $0.20 | |
| write-skill-release | 3/3 | 3/3 | 3/3 | 11.3 / 9.0 | $0.48 / $0.36 | |
| setup-draft-config | 3/3 | 0/3 | 3/3 | 10.0 / 5.7 | $0.37 / $0.13 | verifyCommand, outputLanguage |
| ship-feature-pr-ready | 0/3 | 0/3 | 0/3 | 11.3 / 10.3 | $0.28 / $0.22 | (양쪽 모두 planner·리뷰 없음) |

\* 사례나 인프라 문제로 다시 실행한 결과다(규칙 8). 첫 실행에서 tdd는 `red-then-green` 판정자가 긴 기록의
잘린 중간을 보지 못했다. handoff는 부를 수 없는 스킬의 형식을 요구하는 grader 때문에 양쪽 0/3이었다.
retrospect는 1회가 eval 도구의 ENOENT 오류였다. diagnose는 판정 API가 529 과부하였다. tdd의 통과 판정은
기록 정규식(`# fail [1-9]` 뒤 `# fail 0`, 구현 전 실패)으로 바꿨고, handoff의 `suggests-skills`는
`with-only` 표시기로 바꿨다.

읽은 결과:

- plugin이 차이를 만든 사례는 prd·issues·setup 세 개다(각 3/3 대 0/3, Fisher p = 0.1). 세 사례 모두
  떨어진 grader가 스킬 형식(PRD 섹션, 이슈 체크박스, Paul Loop 설정 필드)이라 plugin 쪽이 정의상 유리하다.
  setup은 요청이 "Paul Loop를 붙이려고 해"라서 plugin 없이 알 수 없는 과제다.
- diagnose·tdd·small-fix·write-skill·handoff는 plugin 없이도 통과한다. tdd는 스킬이 매번 발동해 턴이
  2.4배, 비용이 1.9배다.
- retrospect는 plugin 있는 쪽 2회가 영수증이 없다는 설명과 함께 기록 전에 선택을 물었고, 1회는 영수증 없이
  `--verified` 기록을 시도했다가 CLI에 거부됐다. §6의 스킬 공백과 같은 원인이다. 첫 실행(ENOENT 1회 포함)은
  2/3이었다.
- ship-feature는 양쪽 모두 구현·검증은 했지만 스킬이 발동하지 않아 planner와 리뷰 에이전트를 쓰지 않았다.

## 4a. Opus 대 Sonnet (plugin 있음)

같은 12개 사례, 기본 effort(eval 자식 기준 Opus `medium`, Sonnet `high`), 3회. Opus 열은 §4의 plugin 있는 쪽이고,
Sonnet은 `--ablation none`에 판정자 `claude-opus-5-5`로 실행했다. 판정자가 서로 다르므로 `llm` grader만
갈린 차이는 판정자 차이일 수 있다.

| 사례 | Opus | Sonnet | 턴 O / S | 비용 O / S | Sonnet이 떨어진 grader |
|---|---|---|---|---|---|
| diagnose-failing-test | 3/3 | 2/3 | 6.3 / 7.3 | $0.33 / $0.43 | 재현 전에 수정(결정적) |
| diagnose-misleading-symptom | 3/3 | 3/3 | 6.0 / 9.3 | $0.33 / $0.47 | |
| tdd-new-function | 3/3 | 3/3 | 19.0 / 22.0 | $0.29 / $0.32 | |
| small-fix | 3/3 | 3/3 | 4.3 / 3.7 | $0.12 / $0.09 | |
| grilling-one-question | 3/3 | 1/3 | 4.0 / 7.0 | $0.16 / $0.17 | 질문 하나(판정자) |
| prd-from-meeting-notes | 3/3 | 3/3 | 12.0 / 11.7 | $0.43 / $0.38 | |
| issues-from-prd | 3/3 | 3/3 | 7.3 / 16.3 | $0.41 / $0.37 | |
| retrospect-hunch-unverified | 1/3 | 0/3 | 2.3 / 9.0 | $0.65 / $0.59 | 교훈 기록(결정적), 스킬 발동 1/3 |
| handoff-mid-task | 3/3 | 3/3 | 9.0 / 14.3 | $0.23 / $0.29 | |
| write-skill-release | 3/3 | 2/3 | 11.3 / 13.7 | $0.48 / $0.47 | 참조 경로 확인(판정자) |
| setup-draft-config | 3/3 | 2/3 | 10.0 / 10.0 | $0.37 / $0.20 | verifyCommand·outputLanguage(결정적) |
| ship-feature-pr-ready | 0/3 | 0/3 | 11.3 / 14.3 | $0.28 / $0.26 | (양쪽 모두 planner·리뷰 없음) |
| 합계·평균 | 31/36 | 25/36 | 8.6 / 11.6 | $0.34 / $0.34 | |

- run당 비용은 거의 같다. Sonnet은 단가가 낮지만 턴이 평균 35% 많다.
- 절차가 분명한 과제(diagnose-misleading, tdd, small-fix, prd, issues, handoff)는 두 모델 모두 3/3이다.
- 판단이 필요한 과제(grilling의 질문 하나씩, retrospect의 기록 판단, setup의 검증 명령 추론)에서 Sonnet이
  낮았다. 사례별 3회라 어느 차이도 유의하지 않다(grilling 3/3 대 1/3도 Fisher p = 0.4).

## 4b. effort별 비교 (plugin 있음, 3개 사례)

diagnose-misleading-symptom, tdd-new-function, prd-from-meeting-notes를 effort별로 3회씩 돌렸다.
`CLAUDE_CODE_EFFORT_LEVEL`로 지정했고, 지정하지 않은 칸은 eval 자식의 기본값이다(Opus `medium`, Sonnet
`high`). 이 변수가 자식에 적용되는 것은 자식의 `$CLAUDE_EFFORT`로 따로 확인했다(§5). 값은 사례 순서대로
diagnose / tdd / prd다.

| 모델·effort | 통과 | 평균 턴 | run당 비용 | run당 시간 |
|---|---|---|---|---|
| Opus low | 3/3 · 3/3 · 3/3 | 5.0 · 15.7 · 7.0 | $0.32 · $0.24 · $0.31 | 20s · 30s · 57s |
| Opus medium(기본) | 3/3 · 3/3 · 3/3 | 6.0 · 19.0 · 12.0 | $0.33 · $0.29 · $0.43 | 27s · 43s · 85s |
| Opus high | 3/3 · 3/3 · 3/3 | 7.3 · 18.3 · 13.3 | $0.35 · $0.30 · $0.48 | 32s · 47s · 103s |
| Opus max | 3/3 · 3/3 · 2/3† | 19.3 · 29.0 · 14.0 | $1.01 · $1.02 · $1.35 | 232s · 238s · 559s |
| Sonnet low | 3/3 · 3/3 · 2/3 | 9.7 · 19.0 · 11.0 | $0.38 · $0.25 · $0.28 | 39s · 47s · 62s |
| Sonnet high(기본) | 3/3 · 3/3 · 3/3 | 9.3 · 22.0 · 11.7 | $0.47 · $0.32 · $0.38 | 25s · 57s · 113s |
| Sonnet max | 3/3 · 3/3 · 3/3 | 18.3 · 28.3 · 18.3 | $0.38 · $0.44 · $0.93 | 108s · 120s · 349s |

† 1회가 사례 제한 시간(600초)을 넘겼다. Sonnet low의 prd 실패 1회는 user story 형식 grader다.

- 이 세 과제에서는 effort를 올려도 통과가 늘지 않았다. Opus `max`는 기본 대비 비용이 약 3배, 시간이
  5~9배였고 한 번 시간 제한을 넘겼다. Sonnet `max`는 비용 0.8~2.5배, 시간 2~4배였다.
- Opus `low`가 가장 싸고 빨랐고 떨어진 실행이 없었다. 3회씩이라 "low로 충분하다"는 결론은 이 세 과제와
  이 표본에 한정된다.
- 처음 대기열은 사용량 한도에 걸려 뒤쪽 실행이 즉시 실패했다(`You've hit your session limit`). 그 실행은
  점수로 쓰지 않고 한도가 풀린 뒤 다시 돌렸다. Sonnet max의 diagnose 첫 실행은 세 번 모두 올바른 줄을
  고치고 3 pass를 보고했지만, `green-after-fix` 판정자가 긴 기록의 잘린 발췌만 보고 떨어뜨렸다. 이 검사를
  기록 정규식(`green-after-last-edit`)과 마지막 메시지 판정(`cause-reported`)으로 나누고 이 칸만 다시
  돌렸다. 다른 칸은 이전 판정자 grader로 채점했고 모두 통과했다.

## 4c. 이번 결과로 본 선택

사례별 3회라 권고가 아니라 관찰이다.

- 절차가 분명한 과제(버그 재현과 수정, TDD, PRD·이슈 작성): Opus `low`~`medium`과 Sonnet `high`가 모두 3/3이다.
  비용은 Opus `low`가 가장 낮았다.
- 판단이 필요한 과제(질문 하나씩 묻기, 영수증 없는 교훈 기록, 검증 명령 추론): Opus가 Sonnet보다 높았다.
- `max`는 이 과제들에서 비용·시간만 늘었다.

## 5. 측정 환경에서 확인한 것

- **git.** 이 macOS host의 eval sandbox 안에서는 대상이 git을 실행할 수 없다. `/usr/bin/git`(xcrun shim)은
  `/var/folders/.../xcrun_db` cache를 만들지 못하고 Xcode도 찾지 못해 실패한다(exit 72). 실제 git
  바이너리는 sandbox가 파일 정보 조회를 막는다. 같은 Homebrew 폴더의 `scalar`는 보이는데 `git`만
  `Operation not permitted`라, shell이 PATH에서 찾지 못한다(`env git`처럼 execvp로 직접 실행하면 된다).
  PATH 순서를 바꾸는 방법은 통하지 않았다. 의도된 정책으로 보고 우회하지 않았다. git이 필요한 사례 4개
  (review 2, merge, hotfix)에 `git` 태그를 붙였고, 이 host에서는 측정하지 않는다. 확인을 위해 설치했던
  Homebrew git은 삭제했다. 그때 올라간 pcre2 10.48은 그대로 두었다.
- **PATH 누출.** Claude Code 세션 안에서 eval을 실행하면 설치된 plugin의 `bin/`이 자식 PATH에 들어간다.
  이 host에는 이전 loop-engine 0.2.0이 있어 plugin 없는 조건에서도 `lessons.sh` 등을 부를 수 있었다.
  retrospect smoke 1회차는 그 오래된 `lessons.sh`가 sandbox에서 실패해 아무것도 기록하지 못했다.
  README 실행 예시는 `~/.claude/plugins/cache/`를 PATH에서 뺀다. §4 측정은 그렇게 실행했다.
- **effort.** `CLAUDE_CODE_EFFORT_LEVEL`은 문서화된 eval 옵션은 아니지만 자식에게 전달되고 `--effort`보다
  우선한다. 자식의 `$CLAUDE_EFFORT`로 확인할 수 있다. 처음 확인에서 틀린 결론이 나올 뻔했다. Haiku는
  effort를 쓰지 않아 변수를 건드리지 않고, 부모 세션의 `CLAUDE_EFFORT=xhigh`가 그대로 보였다. Sonnet에
  `env -u CLAUDE_EFFORT CLAUDE_CODE_EFFORT_LEVEL=low`를 주면 자식에서 `low`가 보인다. 지정하지 않으면 eval
  자식은 Opus 5.5가 `medium`, Sonnet 5가 `high`다(사용자 설정은 읽지 않는다).
- **사용량.** eval 자식은 사용자의 claude.ai 인증으로 돌기 때문에 같은 사용량 한도를 쓴다. effort 대기열
  중간에 한도에 걸려 뒤쪽 실행이 즉시 실패했고, 이 세션도 함께 멈췄다.
- **판정자 발췌.** `llm` grader는 기록의 앞뒤 일부만 본다. merge 사례의 `green-before-commit`은 중간이
  잘려 통과 실행을 보지 못하고 떨어졌다. 테스트 통과 확인을 `# fail 0` 기록 정규식으로 옮기고,
  판정자에게는 마지막 메시지만 보게 했다.

## 6. 스킬에서 드러난 문제 (별도 변경)

- **ship-feature·hotfix 미발동.** "PR 올릴 수 있게 준비해 줘, push는 내가 할게"에서 두 스킬 모두 2회 중
  0회 발동했다. ship-feature 설명은 "open PR까지"를 말하고, 본문과 `paul-loop` 라우터는 "로컬 수정은
  전체 루프를 시작하지 않는다"고 말한다. 사용자 결정: PR-ready 요청에서도 발동하도록 별도 PR로 고친다.
- **retrospect.** 영수증이 없으면 교훈이 미검증으로 기록되는데 `--fix` 내용이 빠지고, 기본 `recall`은
  미검증 교훈을 건너뛴다. 대상이 "다음에 참고로 뜬다"고 안내한 것은 사실과 다르다(판정자도 놓쳤다).
  사용자 결정: 이 작업 뒤 별도 PR로 고친다.
- **outputLanguage.** `ko` 설정에서도 PRD·이슈 템플릿 제목은 영어로 남았다(본문은 한국어).

## 7. 기록

원시 결과는 gitignore된 `.loop/plugin-eval/`에만 둔다. 비용은 정가 추정이며 구독 과금과 다르다.

[2026-09-28-eval-playbook-results.json](2026-09-28-eval-playbook-results.json)에 결과 파일 70개의 경로,
모델, 판정자, 사례, 비용, SHA-256, 쓰임새와 채점한 사례 버전(`casesCommit`)을 적었다. 사례 버전은 세 가지다.
§4의 첫 실행은 `61fb2ef`, tdd·retrospect·diagnose 재실행은 `d74913a`, 나머지는 `fe53c65`로 채점했다.
Sonnet max diagnose 재실행만 `a6af62d`다. 정가 추정 비용은 모두 $76.72다.

| 묶음 | 파일 | 비용 | 쓰임 |
|---|---|---|---|
| smoke | 18 | $6.23 | 사례 확인용, 점수 아님 |
| with/without(재실행 포함) | 16 | $28.30 | §4. 재실행한 4개 사례는 재실행 결과를 씀 |
| 모델(Sonnet) | 12 | $12.14 | §4a |
| effort | 15 | $24.09 | §4b |
| 대체됨 | 9 | $5.96 | 사용량 한도로 즉시 실패, 판정자 발췌 잘림. 점수 아님 |

환경 확인용 진단 실행(git·effort 확인, Haiku·Sonnet·Opus로 13번)은 점수가 아니어서 목록에 넣지 않았다.

## 한계

- 조건별 3회라 차이는 우연과 구분되지 않는다. 고장을 찾는 용도다.
- 판정자는 대상과 같은 Claude 계열이다. 결정적 grader를 우선 본다.
- git이 필요한 4개 사례는 이 host에서 측정하지 못했다. ship-feature 사례도 대상이 git을 쓰지 못한
  상태에서 측정했으므로, git을 많이 쓰는 plugin 쪽 흐름이 불리할 수 있다.
- 포크된 스킬 subagent 안의 도구 호출이 `tool_used`에 세어지는지 확인하지 못했다. 금지 grader가
  아무것도 확인하지 않고 통과할 수 있다.
