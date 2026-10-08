# 워크트리 규율: 메인 체크아웃 보호와 병합된 워크트리 정리

Base: `9dba1ae` (#150, 0.8.1).

## 1. 문제

consumer 저장소에서 세 가지가 반복됐다(2026-10-08, 이 기기에서 실측).

- **(a) 메인 체크아웃 오염.** 작은 작업으로 시작해 커진 변경이 메인 체크아웃에 남는다. 변경 파일 수:
  remeet-crm 57, peep-korea 35, lead-call-assist 24, glucofit-samsung-external 17, glucofit-web 16.
- **(b) 메인 체크아웃 브랜치 이탈.** 작업이 끝나도 메인 체크아웃이 다른 브랜치에 남는다.
  glucofit-libreview는 `feat/playwright-migration`, peep-korea는 `verify-peep`에 있었다.
- **(c) 워크트리 누적.** 저장소당 최대 13개가 쌓였다. 그중 16개는 디렉터리 없이 등록만 남았고,
  3개는 병합됐거나 고유 커밋이 없었다. 데이터 볼륨 사용률은 96%였다.

원인은 하나다. ship-feature 0단계는 `git worktree add`로 워크트리를 만들기만 하고 세션은 메인 체크아웃에 둔다.
Claude Code는 `--worktree`나 `EnterWorktree`로 들어간 세션에서만 메인 체크아웃 편집과 git 명령을 막는다
([공식 문서](https://code.claude.com/docs/en/worktrees#how-claude-code-enforces-isolation)). 직접 만든
워크트리는 Claude Code의 주기적 정리 대상도 아니다. 라우터에는 작은 작업이 커질 때의 규칙이 없다.

디스크 실측(`getattrlist`의 `ATTR_CMNEXT_PRIVATESIZE`, 지우면 실제로 풀리는 바이트):

| 항목 | `du` | 실제 |
|---|---|---|
| pnpm `node_modules` (remeet-crm) | 854MB | 0MB (스토어 클론) |
| npm `node_modules` (glucofit-landing, 워크트리당) | 1.08GB | 0.33GB |
| `.next/dev` (remeet-crm 워크트리 하나) | 3.0GB | 3.0GB |
| 워크트리 전체 | 약 27GB | 약 13GB |

## 2. 계획

### 2.1 메인 체크아웃 브랜치 전환 확인 (`hooks/gate-before-merge.mjs`)

프로젝트의 메인 워크트리(`--git-dir`과 `--git-common-dir`의 실제 경로가 같은 곳이면서, 프로젝트 루트와 common dir이
같거나 프로젝트 루트 아래에 있는 저장소)에서 HEAD를 다른 브랜치나 커밋으로 옮기는 명령이면 `ask`를 낸다. tmp의
scratch·fixture 저장소처럼 프로젝트 밖 저장소는 통과다. `deny`가 우선한다. 전환 판정은 merge 경로보다 먼저, 그 `try` 밖에서 계산해 두고,
`allow()`가 그 값이 있을 때만 `ask`로 바꿔 내보낸다. 그래서 `git checkout feat && git merge origin/main`은
지금처럼 `deny`다. 판정 중 오류(존재하지 않는 cwd, 저장소 아님, git 실패)는 통과다.

이동으로 보는 것:

- 생성 플래그(`-b`/`-B`/`-c`/`-C`/`--orphan`)의 새 브랜치
- `git switch <t>`의 대상, `git switch --detach <t>`
- `git checkout <t>`: 위치 인자가 정확히 하나이고, `--`/`--ours`/`--theirs`/`-p`/`--patch`가 없고,
  `git rev-parse --verify -q <t>^{commit}`이 되거나 `refs/remotes/origin/<t>`가 있을 때
- `-`는 `@{-1}`의 브랜치로 바꿔 판정한다
- `gh pr checkout <n>`

통과시키는 것:

- 대상이 보호 브랜치(설정의 integration/release, 없으면 `main`/`master`), 그 디렉터리의
  `origin/HEAD` 브랜치, 지금 브랜치, 또는 `HEAD`
- 파일 복원: 위 조건에 안 맞는 `checkout`(`--pathspec-from-file` 포함). 예: `checkout src/a.ts`, `checkout --ours a`,
  `checkout HEAD src/a.ts`, `checkout HEAD~1 src/a.ts`, `checkout -- a`
- 연결된 워크트리 안의 전환
- `GIT_DIR=`/`--git-dir`/`--work-tree`가 붙은 세그먼트(모델링하지 않음)

실행 디렉터리는 `payload.cwd`(없으면 `CLAUDE_PROJECT_DIR`)에서 시작해 두 토큰짜리 `cd <dir>` 세그먼트와
`git -C <dir>`로 갱신한다. `-C` 처리와 `literal()`은 `gate-worktree-create.mjs`에 있는 것을
`command-tokenizer.mjs`로 옮겨 두 훅이 같이 쓴다. `gitCommonDir`은 merge 경로의 `try` 밖으로 끌어올린다.

알려진 빈틈(가드레일이지 경계가 아니다): 대상 없는 `--detach`, `eval`/`bash -c`/alias, 따옴표 안의 명령.

테스트: 새 `test/main-checkout-switch.test.sh`(node:test 인라인, §4의 snapshot 한도 참고)에 `test()` 하나를 둔다.
`merge-sync.test.mjs`의 기존 5개는 바꾸지 않는다.

- ask: `git switch -c feature/x`, `git checkout -b feature/x`, `git checkout release`(origin DWIM),
  `git checkout <sha>`, `git switch -`, `gh pr checkout 12`, 연결된 워크트리 cwd에서
  `cd <main> && git checkout -b y`, `git -C <main> switch -c q`
- allow: `git checkout main`, `git switch main`, 위 파일 복원 다섯 형태, 연결된 워크트리 안의
  `git switch -c other`, 메인 cwd에서 `git -C <linked> switch -c z`, 존재하지 않는 cwd의 `git checkout release`,
  `git remote set-head origin release` 뒤의 `git switch release`, 설정 `integrationBranch: develop`일 때
  `git switch develop`, `git checkout HEAD`, `GIT_DIR=.git git switch -c g`
- deny 유지: `git checkout feat && git merge origin/main`, `git switch -c x; git pull`

### 2.2 `bin/worktree-prune.mjs`

현재 저장소의 `git worktree list --porcelain -z`를 읽는다. 파서는 `lib/worktree-session-state.mjs`의
`observationCache()` 안에 있는 것을 `parseWorktreeList()`로 꺼내 둘이 같이 쓴다. 경로 비교는 같은 파일의
`physicalPath()`를 쓴다. 첫 항목(메인 워크트리)과 bare 항목은 후보가 아니다. 연결된 워크트리마다 한 줄을
출력한다.

| 상태 | 판정 |
|---|---|
| `git worktree list`가 prunable로 표시(디렉터리 없음, 잠금 없음) | `prune` (`--apply`일 때 끝에서 `git worktree prune` 한 번) |
| 현재 워크트리 | keep |
| `locked`(디렉터리가 없어도) | keep |
| detached HEAD | keep |
| `git status --porcelain`이 비어 있지 않음(추적 변경, 추적 안 된 파일), 또는 status 실패 | keep |
| `gh pr list --head <branch> --state merged --json headRefOid` 실패·없음·잘못된 JSON | keep |
| 병합된 PR 중 `headRefOid`가 HEAD와 같은 것이 없음(병합 PR 없음, HEAD가 더 나아감, 같은 이름 다른 PR) | keep |
| 그 밖 | `remove` |

기본은 dry-run이고 아무것도 바꾸지 않는다. `--apply`는 `remove` 항목마다 `git worktree remove <path>`를
`--force` 없이 실행한다. 하나가 실패하면 보고하고 나머지를 계속하며 종료 코드는 1이다. git을 쓸 수 없거나
저장소가 아니면 `worktree-prune: skipped (<reason>)`를 출력하고 0으로 끝난다. 실행 비트 755.

`git worktree remove`는 gitignore된 파일(예: `.loop/`의 검증 영수증)도 지운다. ship-feature 5단계가 교훈 기록을
위해 제거를 미루는 워크트리는 `git worktree lock --reason ...`으로 잠가서 prune이 남기게 한다.

테스트: `test/worktree-prune.test.sh` 안에 node:test를 인라인으로 둔다(§4의 snapshot 한도 참고), `test()` 5개(dry-run, `--apply` 판정 전체,
`gh` 실패 형태, 제거 실패 시 계속, 저장소 밖 skipped). 가짜 `gh`를 PATH 앞에 둔다(`runtime-packages.test.mjs`
방식). 케이스: dry-run은 아무것도 안 지우고 prune도 안 함, `gh` 비정상 종료, 잘못된 JSON, `[]`(origin/main에서
막 만든 워크트리), HEAD가 PR head보다 앞섬, 같은 브랜치 이름의 다른 `headRefOid`, 추적 변경, 추적 안 된 파일,
locked, detached, 현재 워크트리, 메인 워크트리 비후보, 병합·깨끗한 워크트리 제거, 디렉터리 없는 등록 정리,
제거 하나 실패 시 나머지 계속과 종료 코드 1, 저장소 밖 실행 시 skipped.

### 2.3 스킬

- **ship-feature 0단계**: 위치는 지금처럼 저장소 밖 옆 경로다(2026-10-08 사용자 결정). 만들기 전에
  `{{pluginBinPrefix}}worktree-prune.mjs --apply`를 실행한다. 실패해도 0단계를 막지 않는다. 만든 뒤
  호스트에 진입 도구가 있으면(Claude Code `EnterWorktree`의 `path`) 그것으로 들어간다. 그러면 호스트가 메인
  체크아웃 편집과 git 명령을 막는다. `.claude/worktrees/` 밖 경로라 사용자에게 한 번 승인을 묻는다. 도구가
  없거나 진입이 거부되면 지금처럼 절대 경로로 진행한다. 사용자가 지정한 워크트리를 그대로 쓰는 예외는 유지한다.
  npm 저장소 힌트: macOS에서 `cp -c -R <main>/node_modules .` 후 `npm install`(`npm ci`는 클론을 지운다).
  이 힌트는 2026-10-08 scratch 실측(아래 §4)으로 확인했다.
- **ship-feature 5단계**: 제거를 미루기로 한 즉시(교훈 기록이 범위에 있으면 병합 요청 전에)
  `git worktree lock --reason "<why>" <path>`로 잠그고, 정리할 때 `git worktree unlock` 후 지운다.
- **hotfix 3·6단계**: 3단계에서 남겨 두는 워크트리를 같은 방식으로 잠그고, 6단계 정리에서 풀고 지운다.
  병합된 뒤에도 4~6단계(릴리스 PR, 배포, 헬스체크) 동안 남아 있어야 하기 때문이다.
- **hotfix 0단계**: 지정된 워크트리가 없으면 ship-feature 0단계처럼 만들고 `EnterWorktree`로 들어간다.
- **라우터**: "작은 변경" 행에, 브랜치·커밋·PR이 필요해지면 hotfix 0단계의 이전 규칙으로 워크트리에 옮기고
  메인 체크아웃의 브랜치를 바꾸지 않는다고 적는다. 워크트리 정리 행을 더하고 실행 방법은 ship-feature의
  `pluginBinPrefix` 절을 가리킨다.

### 2.4 버전과 eval

- 0.9.0(`.claude-plugin/plugin.json`, `marketplace.json`), CHANGELOG.
- eval `hotfix-from-wip-branch`, `ship-feature-pr-ready`를 다시 돌린다(2026-10-08 사용자 결정, 비용 승인).
  기준선은 `b322ddc`에서 hotfix 3/3, ship-feature 2/3이다(`2026-10-06-engine-bin-path.md`: Claude Code 2.1.291,
  `claude-opus-5-5`, 판정 `claude-sonnet-5`, `--ablation none`, 케이스당 3회). 같은 설정으로 돌린다.
  2.1의 `ask`는 headless에서 거부로 끝나므로, 메인 체크아웃에서 `git switch -c`로 가던 실행은 막힌다.

범위 밖: `CLAUDE.md.template`의 조건부 문구, Codex 앱 워크트리 보존 설정, consumer 저장소 수정.

## 3. 수용 기준

Node 22(`/Users/paul/.nvm/versions/node/v22.14.0/bin`)로 실행한다. 이 기기의 기본 Node 26.8.1에서는 base도
`run.sh` 82/87이다(`DEP0205` 경고 등 환경 요인, 계획 검증 때 실측).

- AC: 메인 워크트리 브랜치 전환은 ask, 복귀·파일 복원·연결된 워크트리는 통과, merge deny 우선 | verify: bash tools/loop-engine/test/main-checkout-switch.test.sh | expect: pass 1
- AC: worktree-prune은 병합된 깨끗한 워크트리만 지우고 나머지는 남긴다 | verify: bash tools/loop-engine/test/worktree-prune.test.sh | expect: pass 5
- AC: ship-feature 0단계가 EnterWorktree 진입을 지시한다 | artifacts: tools/ship-flow/skills/ship-feature/SKILL.md | expect: EnterWorktree
- AC: ship-feature 0단계가 worktree-prune을 실행한다 | artifacts: tools/ship-flow/skills/ship-feature/SKILL.md | expect: {{pluginBinPrefix}}worktree-prune.mjs --apply
- AC: ship-feature 5단계가 미룬 워크트리를 잠근다 | artifacts: tools/ship-flow/skills/ship-feature/SKILL.md | expect: git worktree lock
- AC: hotfix 0단계가 EnterWorktree 진입을 지시한다 | artifacts: tools/ship-flow/skills/hotfix/SKILL.md | expect: EnterWorktree
- AC: 라우터가 커진 작업을 워크트리로 옮기라고 지시한다 | artifacts: tools/ship-flow/skills/paul-loop/SKILL.md | expect: move it into a worktree
- AC: 두 매니페스트가 0.9.0 | verify: node -e "const p=require('./.claude-plugin/plugin.json').version,m=require('./.claude-plugin/marketplace.json').plugins[0].version;console.log('versions',p,m);process.exit(p===m&&p==='0.9.0'?0:1)" | expect: versions 0.9.0 0.9.0
- AC: CHANGELOG에 0.9.0 항목 | artifacts: CHANGELOG.md | expect: ## paul-loop 0.9.0
- AC: hotfix가 병합된 워크트리를 정리 전까지 잠가 둔다 | artifacts: tools/ship-flow/skills/hotfix/SKILL.md | expect: git worktree lock
- AC: 라우터에 워크트리 정리 행이 있다 | artifacts: tools/ship-flow/skills/paul-loop/SKILL.md | expect: worktree-prune
- AC: 권한 계약이 0단계 prune 예외를 적는다 | artifacts: tools/ship-flow/skills/AUTHORIZATION.md | expect: worktree-prune.mjs --apply
- AC: hotfix 0단계가 prune을 실행한다 | artifacts: tools/ship-flow/skills/hotfix/SKILL.md | expect: worktree-prune.mjs --apply
- AC: hotfix 정리가 워크트리에서 먼저 나온다 | artifacts: tools/ship-flow/skills/hotfix/SKILL.md | expect: ExitWorktree
- AC: ship-feature 정리가 워크트리에서 먼저 나온다 | artifacts: tools/ship-flow/skills/ship-feature/SKILL.md | expect: ExitWorktree
- AC: eval 두 케이스를 기준선 설정으로 3회씩 다시 돌려 통과 수·비용·결과 파일 SHA-256을 §4에 기록한다. 기준선에서 통과하던 grader가 실패하면 README 규칙 8대로 원인을 읽고, 스킬 문구를 고치거나 사용자가 받아들인 회귀로 기록한다. fixture와 grader는 케이스 자체의 결함이 입증될 때만 바꾼다
- AC: 엔진 전체 테스트 통과(Node 22) | verify: env PATH=/Users/paul/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:/usr/bin:/bin bash tools/loop-engine/test/run.sh | expect: selftest:

## 4. 실측 기록

**npm `node_modules` 클론(2026-10-08, scratch).** `typescript@5.6.3`과 `lodash@4.17.21`을 설치한 디렉터리의
`node_modules`(1,176파일, 26MB)를 다른 디렉터리로 `cp -c -R`한 뒤 `npm install`을 돌렸다. 두 디렉터리 모두
private 0MB였다(블록 공유 유지). 같은 클론에 `npm ci`를 돌리면 private 26MB였다(전체 재설치).

**`run.sh` snapshot 한도.** prune 테스트를 처음에 `worktree-prune.test.mjs`로 두자 `verdict-run.sh -- run.sh`가
`EXIT: 2`로 실패했다("test-entry snapshot exceeds inline loader limit"). `run.sh`는 최상위 `.mjs` 테스트를 gzip해
`NODE_OPTIONS`의 data URL로 고정하고, 60,000바이트를 넘으면 실행 전에 멈춘다. 한도를 올리면 verifier를 바꾸게
되므로, 테스트를 `private-hook-artifacts.test.sh`와 같은 방식(`node --input-type=module - "$HERE" <<'JS'`)으로
`.test.sh` 안에 넣었다. `run.sh`는 모든 `*.test.sh`를 실행 전에 메모리로 읽으므로 보호 수준은 같다.

실제 여유는 60,000에서 바깥 preload를 뺀 값보다 작다. 모든 `.test.sh`가 바깥 preload를 `NODE_OPTIONS`로 물려받고,
`toctou-node-entry-overwrite.test.sh`의 fixture 안 `run.sh`가 그 위에 자기 preload(약 2.6KB)를 더해 같은 한도로
검사하기 때문이다. 리뷰 반영 뒤 `merge-sync.test.mjs`에 케이스를 더하자 바깥 preload가 57,456바이트가 되어 전체
실행이 87/88로 실패했다(이 fixture). 그래서 메인 체크아웃 테스트도 `main-checkout-switch.test.sh`로 옮기고
`merge-sync.test.mjs`는 base 그대로 두었다. 이때 바깥 preload는 56,388바이트(base와 같은 수준)이고, 최상위 `.mjs`
테스트가 더 늘 수 있는 여유는 약 0.9KB뿐이다. 이 한도는 이 변경과 별개로 다음 `.mjs` 테스트를 막을 것이므로 따로
다룰 일이다.

이 이동으로 §3 첫 AC의 verify 명령이 `node --test …merge-sync.test.mjs | pass 6`에서
`bash …main-checkout-switch.test.sh | pass 1`로 바뀌었다(같은 검사를 옮기고 리뷰 케이스를 더함). planner 재확인(PASS)의
비차단 제안에 따라 §2.1 범위 문구와 §2.2 표를 코드에 맞추고, 권한 예외·hotfix prune·`ExitWorktree` AC 4개를 더했다.

**런타임 확인(2026-10-08).**

- `glucofit-landing`에서 실제 `gh`로 dry-run: 워크트리 12개 모두 keep(열린 PR이거나 병합 PR이 없음). 아무것도
  바뀌지 않았다.
- 이 기기의 paul-loop 메인 체크아웃을 `payload.cwd`로 훅을 직접 실행: `git switch -c feature/qa-check`는 ask,
  `git checkout -- README.md`와 연결된 워크트리 안의 `git switch -c feature/other`는 통과.
- 이 작업 자체를 `.claude/worktrees/worktree-discipline`에 만들고 `EnterWorktree`로 들어가 진행했다. `.claude/worktrees/`
  안 경로라 승인 창 없이 들어갔고, 이후 변수로 조립한 명령, git을 언급하는 heredoc 같은 형태는 호스트가 거부했다.
  저장소 밖 경로의 1회 승인은 이 세션에서 직접 확인하지 못했다(공식 문서 기준).

**리뷰(4단계).** code-reviewer, test-hunter, verifier-integrity-hunter 모두 BLOCK, ponytail-review는 11줄 축소 제안.
반영한 것:

- 공유 `gitSegmentDir`이 `GIT_DIR=` 프리픽스를 null로 돌려 `gate-worktree-create`의 두 번째 feature 워크트리
  ask를 우회시켰다(커밋 보안 리뷰도 같은 지적). env 판단을 `gate-before-merge`로 되돌리고
  `worktree-session-scope.test.sh`에 회귀 케이스를 넣었다. 이 케이스는 `84bc511`의 tokenizer에서 실패한다.
- 가짜 `gh`가 인자를 검사하지 않아 `--state merged`를 빼도 테스트가 통과했다. 정확한 argv만 답하게 했다.
- `git switch <기존 브랜치>`, `--`/`--ours`/`-p` 복원, `git switch -` 복귀, 연결된 워크트리의 `gh pr checkout`,
  따옴표 경로, `git switch main` 케이스를 더했다. 복원 플래그 제거·평범한 switch 무시·범위 제한 제거 변이는 모두
  실패한다.
- ask는 프로젝트 저장소(같은 common dir)나 프로젝트 루트 아래 저장소의 메인 워크트리에만 낸다. tmp의 scratch·fixture
  저장소는 통과한다.
- 감지 오류는 통과하되 `main-checkout`/`detect-error` red event를 남긴다. ask는 merge deny와 다른 kind로 기록한다.
- prune: 디렉터리 확인을 `prunable`로 바꿔 잠긴 채 디렉터리가 없는 등록을 keep으로 보고, `gh`에 30초 timeout과
  stderr 첫 줄을 사유로 남긴다.
- 0단계의 `--apply`가 다른 세션의 워크트리를 지우는 것은 `AUTHORIZATION.md`의 정리 규칙과 충돌했다. 사용자가
  예외를 명시하는 쪽을 골랐다(2026-10-08). hotfix는 병합 승인을 요청하기 전에 잠그고, 정리 전에 `ExitWorktree`로
  나온다.

남은 한계:

- 감지는 가드레일이다. `-qb`/`-bx` 같은 묶음 짧은 플래그, `gh -R`, `eval`/`bash -c`/alias는 통과한다.
- `git worktree remove --force`를 쓰지 않는다는 점과 detached HEAD keep 규칙은 테스트로 구분되지 않는다.
  변경·잠금 검사가 이미 `--force`가 필요한 경우를 걸러 내고, detached HEAD는 규칙이 없어도 브랜치 없이 부른
  `gh`가 실패해 keep이 되기 때문이다.
- `warn-partial-checkout.mjs`에 cd/-C 해석의 세 번째 사본이 남아 있다(이 변경 범위 밖).

**eval(AC, 2026-10-08).** Claude Code 2.1.294(기준선은 2.1.291), `claude-opus-5-5`(기본 effort), 판정자
`claude-sonnet-5`, plugin 0.9.0, `--ablation none`, 각 3회. 커밋 `2ddf818`의 트리.

| 사례 | 통과 | 비용 | 실행별(turns·비용·시간) | 결과 SHA-256 |
|---|---|---|---|---|
| hotfix-from-wip-branch | 3/3 (기준선 `b322ddc` 3/3) | $1.21 | 14·$0.43·94s, 15·$0.39·81s, 17·$0.39·82s | `4e79d589613e6b280a72570c41d05d36d2471e9bf9102055d570111c72c197c3` |
| ship-feature-pr-ready | 3/3 (기준선 2/3) | $7.44 | 13·$2.64·511s, 40·$1.60·285s, 4·$3.21·1233s | `2439cb6b071664f14c5b42faafa9c1df75c01aefaab94b6d04998a57b3856ab3` |

실패한 실행은 없다. 이 3회는 `--keep-temp` 없이 돌려 trace가 지워졌으므로, README 규칙 8의 통과 실행 trace는 사례마다
1회씩 `--keep-temp`로 더 돌려 읽었다(hotfix 1/1 $0.40, ship-feature 1/1 $1.77). 이 두 실행은 점수에 넣지 않는다.

- hotfix trace: main 기반 워크트리를 만들고 패치를 옮긴 뒤 `verdict-run.sh`로 확인하고 커밋했다. 사용자에게 넘기기 전에
  `git worktree lock --reason "hotfix … awaiting user push/PR/merge"`로 잠갔다(바뀐 3단계 그대로). eval은
  `EnterWorktree`를 주지 않으므로 워크트리 절대 경로로 `cd`해 일했다(0단계의 대체 경로). 이 실행은
  `worktree-prune`을 부르지 않았다.
- 채점용 3회 중 1회는 최종 답변에서 "`worktree-prune.mjs --apply`는 저장소 가드가 막아서 건너뛰었다"고 했다. 플러그인의
  PreToolUse 훅 5개는 이 명령(세 가지 형태)을 모두 통과시킨다(scratch fixture로 확인). 반면 남긴 trace에서 node 자식
  프로세스가 부른 git은 `xcrun … Operation not permitted`로 실패했다. README의 "다른 프로그램이 부르는 git은 shim에
  걸린다"와 같은 현상이고, `worktree-prune.mjs`도 node에서 git을 부르므로 `skipped (git: error …)`로 끝났을 것으로
  본다. 그 실행의 trace는 남지 않아 출력 자체는 확인하지 못했다. 절차대로 막히지 않고 계속 진행해 통과했다.
- ship-feature trace: 이 fixture에서는 셸의 git도 실패해(`xcrun` 캐시 쓰기 거부) 워크트리 없이 제자리에서 일했고,
  AC·verdict·리뷰 3종을 거쳐 통과했다. 리뷰 에이전트가 `.loop/`를 읽으려다 protect 가드에 막힌 것은 기존 동작이다.

그래서 이 eval은 "새 0단계·잠금 문구가 기존 흐름을 깨지 않는다"까지만 보여 준다. 메인 체크아웃 ask와 prune `--apply`는
훅·스크립트가 node에서 git을 부르는데 eval 샌드박스에서는 그 git이 실패하므로, 샌드박스 안에서는 ask가 나올 수 없고
prune은 `skipped`가 된다. 두 동작의 근거는 단위 테스트(`main-checkout-switch.test.sh`, `worktree-prune.test.sh`)와
이 기기에서의 런타임 확인이다.

**디스크 정리(이 작업 중, 사용자 기기).** 안전한 캐시·고아 워크트리 등록 정리로 4,065MB를 회수하고 등록 16개를
prune했다. 이어서 `uv cache prune`이 끝났다. uv는 117.7GiB(1,028만 파일)를 지웠다고 보고했지만 실제 늘어난 여유
공간은 12,725MB였다(다른 곳과 블록을 공유하던 파일이 많아 보고 크기와 실제 회수량이 다르다). 정리 뒤 데이터 볼륨
여유는 55GiB.

