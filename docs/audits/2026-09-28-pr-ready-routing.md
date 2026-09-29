# "PR 준비, push는 내가" 요청을 ship-feature와 hotfix로 보내기

Base: `56d19e9` (#143)에서 측정했고, 뒤에 `8e10e22`(#146, 0.5.0) 위로 rebase했다. 변경: `39935ec`(rebase 전
`df35913`). 그 사이 #144가 ship-feature 3단계(실행 검증)에 6줄을 넣고 `paul-loop` 라우터에 다른 용도의 줄 하나를
넣었다. 두 변경 모두 이 변경이 바꾼 설명과 발동 조건에 닿지 않지만, 아래 측정은 그 본문으로 돌리지 않았다.
발견 경로: eval playbook 측정
([2026-09-28-eval-playbook.md](2026-09-28-eval-playbook.md))의 `ship-feature-pr-ready` 사례에서 plugin이
있어도 ship-feature가 발동하지 않았다.

## 1. 문제

ship-feature 설명은 "plan에서 열린 PR까지"와 "ship/deliver/land"만 발동 조건으로 적었다. 그래서 사용자가
"PR 올릴 수 있게 준비해 주고 push와 PR 생성은 내가 할게"처럼 게시를 자기 몫으로 남기면 어느 조건에도 맞지 않았다.
모델은 스킬 없이 직접 구현하고 planner, 리뷰 agent, 검증 게이트를 건너뛰었다. hotfix도 "끝난 수정을 따로 떼어
내보낼 준비"는 발동 조건에 없었다.

## 2. 변경

- ship-feature 설명에 "to make it PR-ready while they keep push and PR creation"을 추가했다.
- 순서 설명에 "or to a PR-ready branch"를 추가했다.
- 실행 모드에 "사용자가 push와 PR 생성을 맡으면 0–4단계를 실행하고 검증된 브랜치와 PR 제목·본문으로 끝낸다.
  publisher는 건너뛴다"를 추가했다.
- paul-loop 라우터 표의 ship-feature 줄에 "or make it PR-ready for the user to publish"를 추가했다.
- hotfix 설명에 "끝난 수정을 자기 브랜치로 옮겨 사용자가 push와 merge를 맡은 채 내보낼 수 있게 하는 것"을
  추가했다.

게시 경계는 그대로다. 게시를 사용자가 맡으면 publisher를 부르지 않는다.

## 3. 측정

사례 `evals/ship-feature-pr-ready`에서는 미리 만든 `feat/parse-duration` 브랜치에서 작은 CLI 기능을 요청하고
"PR 제목과 설명까지 써 주고 push와 PR 생성은 내가 한다"고 말한다. 채점 항목은 다음과 같다.

- 스킬 발동
- planner 호출
- 리뷰 agent 호출
- 구현 전 테스트
- 마지막 수정 뒤 검증
- CLI 연결과 실제 실행
- push/PR/merge/publisher 없음
- oracle 미열람
- 한국어 보고(판정자)

Claude Code 2.1.283, `claude-opus-5-5`(기본 effort), 판정자 `claude-sonnet-5`(3표), 각 3회. "이전"은 skill
본문이 `56d19e9`와 같은 eval-playbook worktree에서 plugin 있는 arm이다(with/without 측정). "변경"은 이
worktree에서 `--ablation none`으로 측정했다.

| setup | 스킬 발동 | 전 항목 통과 | planner | 리뷰 agent | 평균 턴 | 평균 비용 | 결과 SHA-256 |
|---|---|---|---|---|---|---|---|
| 이전 | 0/3 | 0/3 | 0/3 | 0/3 | 12.7 | $0.29 | `f30e969dc9127e246a182037e53521aa5895f6b76c270cb03ba6a5a33cae562f` |
| 변경 | 3/3 | 1/3 | 1/3 | 3/3 | 11.0 | $1.38 | `7b2f39d0661670edded49bcafab7a8c487fa365348000a6830e839261c0468f0` |

- 주장할 수 있는 효과는 발동률이다. 0/3 → 3/3이고 Fisher p = 0.1이다. 전 항목 통과 0/3 → 1/3은 효과로 주장하지
  않는다.
- 이전 실행의 plugin 없는 arm도 0/3이다. planner와 리뷰가 없어서 떨어졌고, 1회는 구현을 테스트보다 먼저 했다.
- 변경 후 3회 모두 코드 리뷰, 테스트 강도 리뷰, 보상 해킹 검사를 따로 돌렸다. 3회 모두 push, PR, merge 없이
  PR 제목과 본문으로 끝냈다.
- 비용은 늘었다. 리뷰 agent 세 개가 돌기 때문이다.

### 이전 판정 버그로 버린 실행

첫 "변경" 측정(`c71eeb8e…`, $4.35)은 planner와 리뷰 grader가 `tool: Task`를 찾았다. Claude Code의 subagent
도구 이름은 `Agent`라서 이 grader는 아무것도 맞추지 못했다. 그래서 점수로 쓰지 않았다. trace를 직접 읽은 결과는
다음과 같다(grader가 아니라 사람이 센 값이다).

- planner 2/3, 리뷰 agent 3/3
- 1회는 `outputLanguage: ko`인데 마지막 보고를 영어로 했다(판정 FAIL).

grader를 `Agent`로 고치고 `check-evals`에 `tool: Task`를 거부하는 규칙을 넣은 것은 eval-playbook 쪽 변경이다.

### hotfix

사례 `evals/hotfix-from-wip-branch`: 포인트 작업 브랜치에서 급히 고친 환불 수정을 `fix/refund-overpay`로 옮겨
"운영에 나갈 수 있게 준비해 줘"라고 요청한다. 채점 항목은 다음과 같다.

- main에서 분기
- 브랜치 커밋
- 커밋 전 테스트 통과
- 커밋 내용(마지막 보고)
- WIP 보존
- main·WIP 브랜치 불변
- push·deploy 없음
- 게시를 사용자에게 넘김

사례 버전은 eval-playbook `d638109`다. git은 fixture의 zsh 함수로 실행했다(eval playbook audit §5). 조건은 ship-feature와
같다. "이전"은 eval-playbook worktree의 with/without 측정에서 plugin 있는 arm이다.

| setup | 스킬 발동 | 전 항목 통과 | 평균 턴 | 평균 비용 | 결과 SHA-256 |
|---|---|---|---|---|---|
| 이전 | 0/3 | 3/3 | 9.0 | $0.28 | `c99c3192ce7f3aaed8a31505a83e8b39c88133f27e1d26c9f385612fc7f975d2` |
| 변경 | 3/3 | 3/3 | 15.3 | $0.40 | `9e907947f9c0fb7548d50cd9b4d71ddb7ed9d705aebf4e80d59a67077c51f338` |

- 발동률 0/3 → 3/3(Fisher p = 0.1). 스킬 없이도 결과 grader는 모두 통과했으므로, 이 사례에서 스킬이 바꾼 것은
  결과가 아니라 절차다.
- 변경 후 보고는 검증 래퍼(`verdict-run.sh`)를 찾지 못해 `npm test`로 대신했다고 밝혔다. `.git/config` 쓰기가
  막혀 upstream을 설정하지 못했다는 것도 적었다. merge와 배포는 각각 따로 승인받겠다고 했다.
- 이 사례의 grader는 실패를 읽고 세 번 고쳤다(eval playbook audit §4c). 고치기 전 grader로 잰 "변경" 측정 세
  묶음(각 3회)도 모두 발동 3/3이었다. 합하면 12회 중 12회다.

## 4. 남은 문제(이 변경 범위 밖)

- **planner 생략:** ship-feature는 "compact plan still gets the planner"라고 planner 검사를 필수로 둔다. 변경 후
  2/3이 planner를 부르지 않았고, 보고에도 생략을 적지 않았다. 이번 측정은 trace를 남기지 않아서 이유를 확인할 수
  없다. 버린 실행까지 합하면 6회 중 3회만 planner를 불렀다.
- **엔진 게이트 없음:** 사례 설정에 `pluginBinPrefix`가 없고 통합 plugin은 루트에 `bin/`이 없다. 그래서
  `classify-risk.sh`, `verdict-run.sh`, `ac-verify.sh`를 찾지 못했다. 3회 모두 이를 보고서와 PR 본문에 밝히고
  `npm test`와 CLI 직접 실행으로 대신했다. 이 사례는 게이트 결과가 아니라 순서와 라우팅을 잰다.

## 한계

- 실행 수가 적고, 스킬마다 사례가 하나이며, Opus만 측정했다. Sonnet(plugin 있음, 이전 skill)은 3회 모두 스킬이 발동하지
  않았다(eval playbook audit §4a).
- 원시 결과는 gitignore된 `.loop/plugin-eval/`에만 있다. 이전 결과는 측정한 worktree에서 복사했고 해시가 같다.
  비용은 정가 추정이다.
