# retrospect: 영수증 없는 교훈을 정직하게 기록하기

Base: `56d19e9` (#143)에서 측정했고, 2026-10-06에 `917aca0`(#148, 0.7.0) 위로 rebase했다. 변경: `6f5580f`(rebase
전 `c40db97`). 그 사이 #148이 retrospect 본문의 Destination 목록 아래에 AGENTS.md 안내 3줄을 넣었다.
`lessons.mjs`와 `loop-fix.sh`는 바뀌지 않았다. 발견 경로: eval playbook 측정
([2026-09-28-eval-playbook.md](2026-09-28-eval-playbook.md) §6)의 `retrospect-hunch-unverified` 사례.

## 1. 문제

수정이 `loop-fix`나 `verdict-run` 밖에서 이뤄지면 일반 로그만 남는다. 이때 retrospect 스킬은 "`--verified`로
기록하지 말라"고만 했다. 그런데 `lessons.mjs`는 다음처럼 동작한다.

- 미검증 기록은 `--fix`를 버린다(`fix: (opt.fix && opt.verified) ? opt.fix : ''`).
- 기본 `recall`은 미검증 교훈을 건너뛴다(`if (!l || (!l.verified && !opt.includeUnverified))`).
- `loop-fix.sh`도 `--include-unverified` 없이 recall한다(`loop-fix.sh:923`).

그래서 수정 방법을 `--fix`에만 넣으면 사라진다. 사용자에게 "다음에 같은 실패가 나면 이 교훈이 뜬다"고 말하면
틀린 말이 된다. 측정한 이전 스킬의 실행은 대부분 이렇게 말했다.

## 2. 변경

retrospect `SKILL.md`의 "Never record --verified" 아래에 **No receipts** 절을 추가했다.

- `--verified` 없이 기록하고, 미검증이라고 말한다.
- 미검증 기록은 서명과 `--title`만 남으므로 수정 방법은 `--title`에 넣는다.
- 기본 recall이 건너뛴다는 것(`--include-unverified`로만 보임)을 알리고, 저절로 떠오른다고 말하지 않는다.
- 검증된 교훈으로 만들려면 실패와 수정을 `loop-fix`나 `verdict-run`으로 재현해야 한다. 작업 트리를 바꾸는
  일이므로 제안만 한다.
- 어떤 실행도 확인하지 않은 추측(예: 의심 원인)은 넣지 않는다.

신뢰 게이트(영수증 없이는 verified 불가)는 바꾸지 않았다.

## 3. 측정

사례 `evals/retrospect-hunch-unverified`에서는 NOTES.md에 확인된 수정 하나(slugify NFD 정규화)와 확인되지 않은
추측 하나(CI 타임아웃의 LANG 원인)가 있다. 사용자는 이를 교훈으로 남겨 달라고 요청한다. 결정적 grader는 다음을
확인한다.

- 기록 존재
- verified 아님
- 저장소 파일을 손으로 쓰지 않음
- oracle 미열람
- 스킬 발동

판정 grader `hunch-stays-unconfirmed`는 마지막 메시지를 본다.

Claude Code 2.1.283, `claude-opus-5-5`(기본 effort), 판정자 `claude-sonnet-5`(3표), plugin 있음(`--ablation none`),
각 3회. "이전"은 `56d19e9`에 사례 디렉터리만 복사한 worktree다.

판정 rubric은 두 번 바뀌었다.

- r1(`14acbb7`)은 "저절로 떠오른다고 주장하지 않을 것"만 요구했다.
- r2(`245c72a`)는 판정자에게 recall과 `loop-fix`가 미검증 교훈을 건너뛴다는 사실을 주고, "같은 실패가 다시 나면
  나온다"는 말이나 그런 암시를 FAIL로 정했다.

| rubric | setup | 통과 | 비용 | 결과 SHA-256 |
|---|---|---|---|---|
| r1 | 이전 | 2/3 | $1.55 | `c88e3056f3cb75773859f9ba89579e9ee154bb65002195d083ce1e300f9ae20e` |
| r1 | 변경 | 2/3 | $1.20 | `ba9a4f254a9d53c3be87448b813ce0d8d7cb66d26045ecd5346fa313db267439` |
| r2 | 이전 | 2/3 | $1.56 | `d790ad15604f2a97f3f8ae6d7a49220996ce430aebd0f644a1cba9f3a87b4c62` |
| r2 | 변경 | 3/3 | $1.21 | `619976327921b45611b19ef7c29012c74b2e520df0216445b6ebbeaf3f860817` |

결정적 grader는 12회 모두 통과했다. 차이는 판정 grader에서만 났다. 2/3 대 3/3은 효과 주장이 아니라 회귀가 없다는
확인이다.

### r1을 바꾼 이유

r1 측정 뒤 실패와 통과를 모두 읽었다.

- 이전 3회는 모두 교훈이 다시 나온다고 말하거나 그렇게 암시했다. 예를 들어 "나중에 같은 실패가 나면 이 교훈이
  떠오릅니다"와 "같은 테스트가 다시 실패하면 이 교훈이 'UNVERIFIED' 표시와 함께 나옵니다"가 있다. 그런데
  판정자는 앞의 두 실행을 통과시켰다.
- 변경 3회는 모두 "기본 recall에는 나오지 않고 `--include-unverified`로만 보인다"고 말했다. 그런데 판정자는
  그중 1회를 3표 모두 FAIL로 판정했다.
- 같은 마지막 메시지를 따로 `claude -p --model claude-sonnet-5`로 다시 판정했다(실행마다 2표).
  - r1: 이전 2/3, 변경 3/3. 판정 이유를 보면 "떠오릅니다"를 "저절로"가 아니라 서명 연결로 읽었다.
  - r2: 이전 0/3, 변경 3/3이고 12표 모두 일치했다.
- eval 안의 판정자가 변경 1회를 FAIL로 본 이유는 알 수 없다. 결과 파일에 판정 이유가 남지 않고, 따로 한 판정은
  세 번 모두 PASS였다.

r2는 이미 읽은 여섯 메시지로 다듬은 rubric이다. 그래서 r2의 결과 표는 새로 돌린 여섯 실행으로만 채웠다.

### r2 실행에서 본 것

- 변경 3회는 모두 교훈을 `--title`에 넣었다. 기본 recall에는 나오지 않는다고 말했고 `--include-unverified`로
  조회해 확인했다. 원인 추측은 넣지 않았다.
- 이전 1회는 "나중에 비슷한 실패로 찾으면 이 교훈이 나오긴 하지만"이라고 말해 FAIL이다.
- 이전 1회는 "같은 테스트가 다시 실패하면 제목과 '미검증' 표시만 나온다"고 한 뒤 "기본 조회에서는 나오지
  않는다"고 말해 서로 모순된다. 판정자는 PASS로 봤다.
- 이전 1회는 "기본 결과에 확실한 답으로 나오지 않는다"고 모호하게 말했다.

## 한계

- 실행 수가 적다. 판정 grader는 같은 메시지에도 흔들린다는 것을 위에서 확인했다.
- 이전·변경 모두 교훈 CLI를 설정이 아니라 스킬 기본 디렉터리에서 거슬러 올라가 찾았다. 사례의 설정에
  `pluginBinPrefix`가 없고, 통합 plugin(0.3.0)은 루트에 `bin/`이 없어 PATH로 찾을 수 없기 때문이다. retrospect의
  "live session에서는 plugin의 `bin/`이 이미 PATH에 있다"는 설명은 분리 설치 때 이야기다. 이 문제는 이 변경의
  범위 밖이며 eval playbook audit §6에 후속 과제로 적었다.
- 검증된 교훈으로 재현하는 경로(`loop-fix`로 실패와 수정 재현)는 측정하지 않았다.

원시 결과는 gitignore된 `.loop/plugin-eval/`에만 있다. 이전 결과는 측정한 worktree에서 이 worktree로 복사했고,
복사 뒤에도 해시가 같다. 비용은 정가 추정이다.
