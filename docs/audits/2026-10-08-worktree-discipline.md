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

메인 워크트리(`--git-dir`과 `--git-common-dir`의 실제 경로가 같은 곳)에서 HEAD를 다른 브랜치나 커밋으로 옮기는
명령이면 `ask`를 낸다. `deny`가 우선한다. 전환 판정은 merge 경로보다 먼저, 그 `try` 밖에서 계산해 두고,
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

테스트: `test/merge-sync.test.mjs`에 `test()` 하나를 더한다. 기존 5개는 바꾸지 않는다.

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
| 디렉터리 없음 | `prune` (`--apply`일 때만 끝에서 `git worktree prune` 한 번) |
| 현재 워크트리 | keep |
| `locked` | keep |
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

테스트: `test/worktree-prune.test.mjs` + `.test.sh` 래퍼, `test()` 5개(dry-run, `--apply` 판정 전체,
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

- AC: 메인 워크트리 브랜치 전환은 ask, 복귀·파일 복원·연결된 워크트리는 통과, merge deny 우선 | verify: node --test tools/loop-engine/test/merge-sync.test.mjs | expect: pass 6
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
- AC: eval 두 케이스를 기준선 설정으로 3회씩 다시 돌려 통과 수·비용·결과 파일 SHA-256을 §4에 기록한다. 기준선에서 통과하던 grader가 실패하면 README 규칙 8대로 원인을 읽고, 스킬 문구를 고치거나 사용자가 받아들인 회귀로 기록한다. fixture와 grader는 케이스 자체의 결함이 입증될 때만 바꾼다
- AC: 엔진 전체 테스트 통과(Node 22) | verify: env PATH=/Users/paul/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:/usr/bin:/bin bash tools/loop-engine/test/run.sh | expect: selftest:

## 4. 실측 기록

**npm `node_modules` 클론(2026-10-08, scratch).** `typescript@5.6.3`과 `lodash@4.17.21`을 설치한 디렉터리의
`node_modules`(1,176파일, 26MB)를 다른 디렉터리로 `cp -c -R`한 뒤 `npm install`을 돌렸다. 두 디렉터리 모두
private 0MB였다(블록 공유 유지). 같은 클론에 `npm ci`를 돌리면 private 26MB였다(전체 재설치).

