# AGENTS.md를 프로젝트 지침으로 다루기

사용자 요청: Claude Code가 AGENTS.md를 지원하게 됐는지 사실 확인하고, setup 스킬이 CLAUDE.md 말고 다른
지침 파일도 다룰 수 있게 한다. Base: `56d19e9` (#143)에서 측정했고, 2026-10-06에 `b737cc2`(#147, 0.6.0) 위로
rebase했다. 그 사이 main은 setup 본문, `classify-risk`, 위험 규칙 예시, 헌장 템플릿을 바꾸지 않았다.

## 1. 사실 확인

세 출처가 일치한다.

- 설치된 Claude Code의 변경 이력(`~/.claude/cache/changelog.md`):
  - 2.1.277 "Added AGENTS.md support: in a project with no CLAUDE.md, Claude Code reads AGENTS.md instead;
    change it under "Project instructions" in `/config`"
  - 2.1.281 "Changed AGENTS.md support to also work on Amazon Bedrock, Google Vertex AI, Microsoft Foundry,
    LLM gateways, and sessions with telemetry disabled"
- 2.1.283 바이너리: 내장 plugin `agents-md`, 옵션 `instructionFiles`. 찾는 이름은 `AGENTS.md`와
  `.claude/AGENTS.md`이고, 이를 막는 CLAUDE 쪽 이름은 `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`다.
- 공식 문서 `code.claude.com/docs/en/memory`의 AGENTS.md 절:
  - 작업 폴더나 그 위에 `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`가 하나도 없을 때만 `AGENTS.md`를
    읽는다. `~/.claude/CLAUDE.md`, 관리 CLAUDE.md, `.claude/rules/`는 이 판단에 들어가지 않는다.
  - 값은 `claude-md-or-agents-md`(기본), `claude-md-and-agents-md`, `claude-md`, `managed-only`다. 이 값은
    사용자·`--settings`·관리 설정의 `pluginConfigs["agents-md@builtin"]`에서만 적용되고, 프로젝트와 로컬
    설정에서는 무시된다.
  - `AGENTS.local.md`, `AGENTS.override.md`, `.agents/` 아래는 읽지 않는다.
  - `CLAUDE.md`의 `@AGENTS.md` import는 두 번 읽지 않는다.

setup은 저장소별로 이 설정을 바꿀 수 없다. 그래서 어느 파일에 쓸지로 해결한다.

2026-10-06 재확인(2.1.291): 2.1.284~2.1.291 변경 이력에서 AGENTS.md를 언급한 줄은 버그 수정 두 개다. 하나는
작업 폴더 밖으로 심볼릭 링크된 지침 파일을 읽기 차단 규칙 아래에서 읽던 문제, 다른 하나는 하위 폴더 AGENTS.md가
@-mention 때 첨부되지 않던 문제다. 선택 규칙(CLAUDE.md가 없을 때만 AGENTS.md)은 바뀌지 않았다.

## 2. 이전 동작의 문제

- setup 3단계는 항상 루트 `CLAUDE.md`에 헌장을 썼다. AGENTS.md만 있는 저장소에서 새 CLAUDE.md가 import 없이
  생기면, Claude Code는 그때부터 AGENTS.md를 읽지 않는다. Codex는 AGENTS.md를 읽으므로 헌장이 보이지 않는다.
- `.claude/CLAUDE.md`나 `.claude/AGENTS.md`는 확인하지 않았다.
- `classify-risk`는 루트 `AGENTS.md`와 `CLAUDE.local.md`를 docs-only(가장 낮은 위험)로 분류했다. 예외는
  `CLAUDE.md`뿐이었다. 예시 `harness` 규칙에도 AGENTS.md가 없었다. 지침 파일을 약화시키는 변경이 간소화
  경로로 빠질 수 있었다.

## 3. 변경

- setup 1단계는 루트와 `.claude/`의 지침 파일을 기록하고, 3단계는 그중에서 대상을 고른다.
  - `CLAUDE.md`가 있으면 그 파일에 쓴다. import되지 않은 AGENTS.md가 옆에 있으면 알리고 `@AGENTS.md`를 제안한다.
  - AGENTS.md만 있으면 AGENTS.md에 쓰고 CLAUDE.md를 만들지 않는다. 이전 Claude Code용으로는 `@AGENTS.md`만
    담은 CLAUDE.md를 둘 수 있다.
  - 둘 다 없으면 Claude 전용은 `CLAUDE.md`에 쓴다. 다른 agent와 함께 쓰면 `AGENTS.md`에 쓰고,
    `@AGENTS.md`만 담은 `CLAUDE.md`를 둔다.
  - `CLAUDE.local.md`에는 쓰지 않는다.
- 헌장 템플릿 제목에서 `CLAUDE.md`를 뺐다.
- `classify-risk`: 이름이 `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`인 파일은 깊이와 상관없이 docs-only가
  아니다. 예시 `harness` 규칙의 `exact`에 `AGENTS.md`를 추가했다. 테스트는 두 부분을 따로 확인한다. 이전
  분류기와 이전 템플릿에서 각각 실패하는 것을 확인했다.
- ship-feature, RISK-GATE, retrospect의 "CLAUDE.md" 설명에 AGENTS.md를 포함했다. `skills-lock.json`의
  setup hash를 갱신했다(`fork` 항목).

## 4. 측정

사례 `evals/setup-agents-md-repo`: AGENTS.md만 있고 `.claude/ship-flow.config.json`은 이미 있는 저장소에서
"건너뛴 개발 규칙 단계를 마저 해 줘"라고 요청한다. 채점은 다음과 같다.

- AGENTS.md에 `npm run verify`가 두 번 이상(헌장 삽입)
- 기존 규칙 유지
- 내용이 있는 CLAUDE.md를 Write하지 않음(`@AGENTS.md`만 있으면 허용)
- `CLAUDE.local.md`에 쓰지 않음
- 마지막 메시지(판정자)

Claude Code 2.1.283, `claude-opus-5-5`, 판정자 `claude-sonnet-5`, plugin 있음(`--ablation none`), 3회.

| setup | 통과 | 턴 | 비용 | 결과 SHA-256 |
|---|---|---|---|---|
| 이전(`56d19e9`, 사례만 복사) | 0/3 | 8.7 | $0.42 | `8b0f1d221558af581d801a1eef12a12be590c331edfc3bcfb2b18ee6ac2079df` |
| 이 변경 | 3/3 | 9.3 | $0.43 | `c1ef2d728d855aaae123767a23ccbe46fd5a4af970a1534e6e7f380beb2101b7` |
| 이 변경, rebase 뒤(2.1.291) | 3/3 | 10.7 | $0.53 | `60ff4cd77beaac496734cfc1a604faed5f85579d2d0df9fe02a14e2913f41ade` |

마지막 줄은 2026-10-06에 rebase한 본문을 Claude Code 2.1.291에서 같은 조건으로 다시 돌린 결과다.

- 이전 3회는 모두 헌장을 새 `CLAUDE.md`에 쓰고 맨 위에 `@AGENTS.md`를 넣었다. 그래서 우려한 가림은 일어나지
  않았다. 세 번 모두 "Claude Code는 AGENTS.md를 자동으로 읽지 않는다"고 설명했는데 2.1.277 이후로는 틀린
  설명이다. 헌장은 Codex에서 보이지 않는다.
- 변경 후 3회는 헌장을 AGENTS.md의 기존 규칙 아래에 붙이고 CLAUDE.md를 만들지 않았다. CLAUDE.md를 만들면
  AGENTS.md를 읽지 않게 된다는 이유를 설명했다. 1회는 `outputLanguage: ko`에 따라 템플릿 설명을 한국어로
  옮겼다.
- 3/3 대 0/3은 Fisher p = 0.1이다. 이전 쪽 실패는 이 변경이 정한 위치(AGENTS.md)를 채점하므로 정의상 떨어진다.

원시 결과는 gitignore된 `.loop/plugin-eval/`에만 있다. 비용은 정가 추정이다.

## 한계

- macOS eval sandbox에서는 대상이 `git`을 그냥 실행하지 못한다(`/usr/bin/git` shim 실패). 이 사례는 git이
  필요 없어 fixture에 우회 함수를 넣지 않았다.
- 내용이 있는 CLAUDE.md 금지 grader는 Write 도구만 본다. Bash 리다이렉트로 만든 CLAUDE.md는 잡지 않는다.
- CLAUDE.md가 있는 저장소와 아무 지침 파일이 없는 저장소의 분기는 측정하지 않았다.
