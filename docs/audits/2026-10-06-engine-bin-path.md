# 엔진 명령 경로: 통합 설치에서 PATH 가정 없애기

Base: `33baba4` (#149, 0.8.0). 변경:

- `b13ddf0`: 스킬 3개와 eval fixture
- `391d83e`: hotfix fixture의 커밋 ID 고정
- `b322ddc`: guard

## 1. 문제

ADR-0009의 통합 설치에서 엔진 명령은 `<PAUL_LOOP_PATH>/tools/loop-engine/bin/`에 있고, 이 중첩 `bin/`은 PATH에
올라가지 않는다. `AUTHORIZATION.md:4-7`은 이미 "sibling engine의 `bin/`이 PATH에 있다고 가정하지 말고 프로젝트의
검증된 launcher를 쓰라"고 정한다. launcher는 `node tools/paul-loop.mjs exec bin/`이고,
`.claude/paul-loop.lock.json`을 확인한 뒤에만 실행한다.

그런데 스킬 3개는 분리 설치 시절의 설명을 그대로 두고 있었다. `pluginBinPrefix`가 비어 있어도 plugin의
`bin/`이 PATH에 있으니 동작한다는 설명이다.

- `hotfix`: `verdict-run.sh`
- `retrospect`: `lessons.sh`, `loop-fix.sh`
- `deps-audit`: `deps-audit.mjs`

이 기기에서 확인한 설치 상태(`~/.claude/plugins/installed_plugins.json`, user 설정의 `enabledPlugins`):

- user 범위에서 켜진 것은 `paul-loop@paul-loop` 0.1.0(`51731b7`)뿐이다. 예전 분리 설치본(`loop-engine`
  0.15.20, `ship-flow` 0.11.7, `loop-memory` 0.8.2)은 설치는 남아 있지만 user 설정에서 꺼져 있다.
- 이 저장소에는 local 범위 `loop-engine` 0.2.0(`c3bd012`)이 있고, 그 `bin/`이 이 세션의 PATH에 있다. 그래서
  여기서 `command -v verdict-run.sh`는 0.2.0을 가리킨다. 활성 Paul Loop 설치본이 아니다.
- glucofit 저장소들의 설정에는 `pluginBinPrefix`가 없다. 단, `glucofit-partners`에는 0.1.0에 고정된 launcher와
  lock이 있다.

이전 retrospect 측정([2026-09-28-retrospect-unverified-lessons.md](2026-09-28-retrospect-unverified-lessons.md)
§한계)에서는 실행이 교훈 CLI를 설정에서 찾지 않았다. 스킬 기본 디렉터리에서 거슬러 올라가 찾았다. 이는
검증된 launcher를 거치지 않는 경로다.

## 2. 변경

**스킬.** 세 스킬의 설명을 같은 계약으로 바꿨다.

- 보통 값은 검증된 launcher(`node tools/paul-loop.mjs exec bin/`)이고, 엔진 `bin/`의 명시적 절대 경로도 된다.
- 빈 prefix는 `command -v <명령>`이 활성 Paul Loop 설치본 안을 가리킬 때만 쓴다.
- 그 밖에는 launcher가 없다고 보고하고 `setup`을 안내한다. 다른 설치본의 명령을 실행하거나 plugin cache를
  뒤지지 않는다.

**eval fixture.** 엔진 명령을 쓰는 사례 3개(`retrospect-hunch-unverified`, `hotfix-from-wip-branch`,
`ship-feature-pr-ready`)는 이제 `pluginBinPrefix`에 테스트 대상 plugin의 엔진 `bin/` 절대 경로를 적는다. 경로는
`fixture.sh`의 `$0`에서 얻는다. target 세션에는 `CLAUDE_PLUGIN_ROOT`와 `LOOP_ENGINE_PATH`가 없기 때문이다.

- hotfix fixture는 원래 설정 파일을 커밋했다. 절대 경로가 들어가면 checkout 위치마다 커밋 ID가 달라지고,
  고정 ID를 쓰는 grader 4개가 깨진다. 그래서 설정 파일을 consumer 저장소처럼 git이 무시하는 로컬 파일로 두고
  ID를 다시 고정했다(main `a52beeb`, feature/points `442d668`, 두 번 실행해 같음).
- hotfix의 `green-before-commit`는 `verdict-run.sh`의 `VERDICT: PASS`도 통과 표시로 받는다. 남겨 둔 실행
  e-sQCFQU는 이 조건으로만 맞는다. 커밋 전에 테스트를 돌리지 않은 경우와 실패한 경우를 흉내 낸 입력은
  불합격으로 남는다.

**guard (`protect-during-loop.mjs`).** 첫 측정에서 찾은 결함이다(§3).

- Bash 채널은 명령에 `>`가 하나라도 있으면 쓰기 명령으로 본다. 그 명령에 엔진 설치 경로 안의 토큰이 있으면
  "검증기 자신"이라며 막는다. 그래서 `/abs/.../bin/verdict-run.sh -- npm test > log 2>&1`처럼 실행만 하는
  명령도 막혔다.
- 파이프 상태 훅은 `verdict-run.sh`를 `tail`에 파이프하면 정확히 이 형태를 쓰라고 권한다. 두 훅이 서로
  어긋났다.
- 이제 명령 위치(세그먼트의 첫 단어, 앞의 `VAR=…` 제외)에 있는 엔진 경로는 실행으로 보고, 세그먼트마다 한
  번만 예외로 둔다. 같은 경로가 인자, 리다이렉션 대상, 두 번째 출현으로 나오면 그대로 막는다. 엔진 파일에
  쓰기와 authoritative loop state 쓰기도 그대로 막힌다.
- `guard-bypass-and-leak.test.sh` M2c에 허용 1건과 차단 5건을 더했다. 허용 건은 수정 전에 실패해 eval의 차단을
  재현했다. 차단 5건은 수정 전후 모두 통과한다. 첫 측정에서 실제로 막힌 명령 두 개도 수정한 훅에 다시 넣어
  보니 통과했다.

## 3. 측정

Claude Code 2.1.291, `claude-opus-5-5`(기본 effort), 판정자 `claude-sonnet-5`, plugin 있음(`--ablation none`),
각 3회.

| 측정 | 사례 | 통과 | 비용 | 결과 SHA-256 |
|---|---|---|---|---|
| `b13ddf0` | retrospect-hunch-unverified | 3/3 | $1.24 | `992b2ccff30322255d1aabae4e7e8e3c31d97d9ad5555f5fed50c2883dbcf114` |
| `b13ddf0` | hotfix-from-wip-branch | 0/3 | $1.11 | `8b32e60633c8633da49170369eaeb858edc1876ecbd5563c5cf526786eeabbe5` |
| `b13ddf0` | ship-feature-pr-ready | 1/3 | $5.13 | `ae1e1036ce74d77631f875494b535ccbace274fb8031c7032799cab41c43631d` |
| `b13ddf0`, 설정 없음 | retrospect (0.8.0 fixture) | 0/3 | $1.20 | `eae8a01ccfaa84ecaea7c0f3e6935840beb6480e88ec06291901349e332bb15d` |
| `b322ddc` | hotfix-from-wip-branch | 3/3 | $1.09 | `7c9feaf54129a51677aabc10c32c2b30c185e56cedf1eeb3dcf6b9f7afba6e05` |
| `b322ddc` | ship-feature-pr-ready | 2/3 | $5.83 | `89c3f7c2d7bc6e4e279c59025b76af476722887a366930f7389a480b0c5c349f` |

**retrospect.** 3회 모두 설정의 prefix로 `lessons.sh`를 실행해 교훈을 미검증으로 기록했다. 스킬 디렉터리에서
CLI를 거슬러 찾은 실행은 없었다.

**hotfix, `b13ddf0`.** 0/3은 grader가 깨진 결과다.

- 고정 ID grader 4개는 3회 모두 실패했다. 설정 파일이 커밋돼 ID가 바뀌었기 때문이다.
- 3회 모두 main에서 브랜치를 땄고 WIP를 그대로 뒀다.
- 그런데 guard가 3회 중 2회에서 `verdict-run.sh`를 막았다.
  - e-bwAWMB는 정식 검증을 못 했다며 커밋하지 않고 멈췄다.
  - e-B1uqoQ는 그냥 `npm test`로 바꿔 커밋했다.
  - e-sQCFQU만 리다이렉션 없이 실행해 통과했다.

**ship-feature, `b13ddf0`.** guard 차단은 3회 모두에서 나왔다. 2회는 planner를 부르지 않아(`planned`) 실패했다.

**설정 없음.** 0.8.0 fixture를 그대로 쓴 사본이다. 설정 파일도 `pluginBinPrefix`도 없다.

- 3회 모두 교훈을 기록하지 않았다(`lesson-recorded` 0/3). 마지막 메시지는 모두 설정과 `lessons.sh`를 찾지 못했다고
  말하고 `paul-loop:setup`을 안내했다.
- 실행한 명령은 설정·로그·git 기록 읽기, `command -v`, `ls tools`이고, 1회는 자기 메모리 디렉터리도 읽었다.
  다른 설치본이나 plugin cache의 스크립트를 실행한 경우는 없었다.
- 이전 스킬은 이 상황에서 스킬 디렉터리에서 CLI를 찾아 기록했다. 이 차이는 계약에 맞춘 의도된 동작 변화다.

**guard 수정 뒤(`b322ddc`).**

- hotfix는 3/3이다. guard 차단은 0건이고, 3회 중 2회는 리다이렉션을 붙인 `verdict-run.sh`를 그대로 실행했다.
- ship-feature는 2/3이다. guard 차단은 0건이다. 실패 1회는 다시 `planned`다.

실행 수가 3회라 고장은 잡아도 효과의 크기는 말할 수 없다(3/3 대 0/3의 Fisher p는 0.1이다).

## 한계

- eval은 launcher가 아니라 엔진 `bin/` 절대 경로로 실행한다. launcher를 쓰려면 source integrity가 든 lock이
  필요하기 때문이다. launcher 경로는 consumer 저장소에서 `doctor`로 확인해야 하며 이 측정에 들어 있지 않다.
- guard 예외는 명령 위치만 본다. `bash /abs/bin/x.sh > log`나 `node /abs/bin/x.mjs > log`처럼 interpreter의
  인자로 엔진 경로를 넘기면서 리다이렉션을 붙이면 여전히 막힌다. 엔진 디렉터리로 `cd`한 뒤 상대 경로로 쓰는
  경우를 못 잡는 것은 이전과 같다.
- 설정이 없는 consumer는 이제 교훈을 기록하는 대신 `setup` 안내를 받는다.
- ship-feature가 planner를 건너뛰는 문제는 이 변경과 별개이며 따로 다룬다.

원시 결과는 gitignore된 `.loop/plugin-eval/`에만 있다. 비용은 정가 추정이다.
