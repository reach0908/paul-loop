# Paul Loop 메모리 활성화와 운영

먼저 **파일 교훈은 DB 없이 쓸 수 있다.** [검증된 수정 기록](verified-lesson-workflow.md)이 그 경로다.
이 문서는 질문의 의미로 유사한 교훈을 찾는 **선택 기능인 의미 검색 메모리**를 켜는 절차다.
통합 `paul-loop` 0.1.0 기준이며, 설치·배포 상태는 [처음 사용하기](getting-started.md)에서 확인한다.

순서는 **전용 DB → 스키마 적용 → 프로젝트별 DB 승인 → 키 준비 → 초기 동기화 → 호스트에서 켜기 → 관측**이다.
스위치만 켜도 DB가 생기거나 과거 대화가 저장되지는 않는다. 준비 중에는 메모리 훅을 꺼 둔다.

## 1. 어느 프로젝트의 메모리인지 정하기

서로 다른 프로젝트·별도 clone에는 별도 전용 DB를 쓴다. 일반 Git worktree들은 대표 checkout의
DB를 함께 조회하지만, DB로 교훈을 동기화하는 작업은 대표 checkout에서만 수행한다.
저장소 경로를 이동하면 소유권이 달라지므로 기존 DB를 자동으로 재사용하지 않는다.

소비 프로젝트의 대표 checkout 루트에서 이후 CLI 명령을 실행한다. `git worktree list`로 위치를
확인한다. [프로젝트 launcher와 lock](project-installations.md)을 준비했다면 실제 승인된 설치 경로는:

```bash
node tools/paul-loop.mjs doctor
export PAUL_LOOP_PATH="$(node tools/paul-loop.mjs exec bin/plugin-path.mjs resolve paul-loop)"
export MEMORY_ROOT="$PAUL_LOOP_PATH/tools/loop-memory"
pwd -P
```

`doctor`나 resolve가 실패하면 여기서 설치·핀부터 바로잡는다. 아래 `$MEMORY_ROOT`는 이 경로를
뜻한다. 캐시의 파일을 수정하거나 다른 프로젝트의 설치본을 대신 사용하지 않는다.
Codex Desktop에서 launcher가 지원하지 않는 CLI 버전이면 [호환성 제한](project-installations.md)을
확인한다. 전역 캐시를 검색하거나 검증을 우회하는 절차는 아니다.

## 2. 전용 DB와 스키마 준비하기

PostgreSQL+pgvector의 **새 전용 DB**가 필요하다. 제품 DB나 여러 저장소의 메모리를 함께 넣은
DB를 쓰지 않는다. 기존 데이터가 있다면 [기존 store 전환 절차](../tools/loop-memory/MIGRATION-0.7.md)를
먼저 따른다. 아래 예시는 선택 가능한 로컬 Docker 방식이다.

**설치 캐시가 아닌, 설치 버전과 대응하는 검토한 provider 소스 checkout**에서 실행한다.
컨테이너 시작과 마이그레이션은 실제 인프라 변경이다. 프로젝트 이름과 비어 있는 포트를 선택한
뒤 실행하며, 아래 `example-app-memory`와 `55434`는 예시 값이다.

```bash
cd /absolute/path/reviewed-paul-loop/tools/loop-memory
npm ci --ignore-scripts --no-audit --no-fund
export LOOP_MEMORY_COMPOSE_PROJECT=example-app-memory
export LOOP_MEMORY_PORT=55434
docker compose up -d --wait
LOOP_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/loop_memory npm run db:migrate
```

로컬 helper의 예제 자격증명이며 다른 DB에 재사용할 계정은 아니다. `db:migrate`는 전체 검토된
마이그레이션 체인을 적용한다. Docker의 초기화는 pgvector 확장만 만들므로 컨테이너가 healthy여도
테이블 준비가 끝난 것은 아니다. 별도 제공된 pgvector DB라면 컨테이너 단계는 생략하고 정확한
전용 DB URL로 같은 마이그레이션을 적용한다.

`LOOP_DATABASE_URL`은 이 **운영자 실행 마이그레이션 명령**의 입력이다. 자동 훅과 메모리 CLI의
DB 선택에는 적용되지 않으므로 다음 승인 파일도 필요하다. 기본 주소에 의존하지 말고 명시한다.
helper는 로컬 개발용이며 보존·백업 정책을 대신하지 않는다. 평소 중지는 `docker compose stop`을
같은 소스 폴더·프로젝트 이름·포트로 실행한다. `npm run db:down`은 `down -v`이므로 데이터 삭제가
필요한 경우에만 별도로 판단한다.

## 3. 프로젝트가 사용할 DB 승인하기

DB 주소는 저장소 밖의 **OS 사용자 홈**에 있는 `~/.config/paul-loop/memory-databases.json`에서 읽는다.
`HOME`·XDG·프로젝트 `.env`로 이 위치를 바꿀 수 없다. 실제 위치를 확인하려면:

```bash
node -p 'require("node:os").userInfo().homedir + "/.config/paul-loop/memory-databases.json"'
```

본인이 관리하는 설정 편집기에서 아래 항목을 추가한다. 파일이 이미 있으면 다른 프로젝트 항목을
보존한다. 키는 1단계 대표 checkout의 **실제 절대 경로**이고, URL은 2단계의 같은 DB여야 한다.

```json
{
  "/absolute/path/example-app": {
    "url": "postgresql://postgres:postgres@127.0.0.1:55434/loop_memory"
  }
}
```

파일은 본인 소유의 일반 파일·권한 `0600`이어야 한다. 상위 설정 디렉터리도 본인 소유여야 하고
다른 사용자에게 쓰기 권한이 있거나 symlink이면 거부된다. 새 `paul-loop` 설정 디렉터리는 `0700`으로
만든다. 원격 DB는 `allowRemote: true`와 인증서 검증 TLS 등 [DB 승인 계약](../README.md#database-destination)을
따라 별도로 설정한다. 이 파일을 Git에 넣지 않는다.

## 4. 임베딩 키와 서명 키 준비하기

아래 수동 초기화 명령에도 같은 값을 전달할 수 있도록, 처음에는 소비 프로젝트의 gitignored
`.loop/.env` 또는 세션 환경을 사용한다. 기존 파일을 덮어쓰지 말고 필요한 항목만 추가한다.
`.loop/.env`가 Git에서 제외되는지 확인하고 권한을 `0600`으로 제한한 뒤 실제 키를 넣는다.

```bash
# 소비 프로젝트의 대표 checkout 루트에서 확인한다.
git check-ignore .loop/.env
```

출력·성공이 없으면 파일을 만들기 전에 `.loop/.env`를 `.gitignore` 또는 로컬 exclude에 추가한다.
추적 중인 파일이었다면 ignore만 추가해서는 보호되지 않는다. 실제 키를 커밋하지 않는다.

```dotenv
LOOP_EMBED_PROVIDER=openai
OPENAI_API_KEY=<실제 임베딩 API 키>
LOOP_MEMORY_SIGNING_KEY=<프로젝트 전용으로 생성해 보관한 랜덤 비밀값>
```

Gemini를 선택하면 `LOOP_EMBED_PROVIDER=gemini`와 `GEMINI_API_KEY`를 사용한다. 임베딩 API 자격증명은
Claude·ChatGPT 구독 로그인과 별개다. 두 키가 모두 있더라도 provider를 명시해 혼동을 피한다.
서명 키는 비밀 저장소의 생성 기능이나 `openssl rand -hex 32`로 만든 값을 안전하게 보관한다.
명령어 문자열을 키 값으로 넣지 않으며, 매 세션 다시 생성하지 않는다.

모델은 기본값을 사용하거나 `LOOP_EMBED_MODEL`로 처음부터 선택한다. 한번 초기화한 DB에서
provider·모델·차원을 바꾸면 그대로 조회할 수 없다. 서명 키 교체도 기존 서명을 새로 동기화하는
계획이 필요하다. [소유권·모델·서명 계약](../tools/loop-memory/HARDENING.md)을 따른다.

우선순위는 **세션 환경(빈 값 포함) → Claude plugin 옵션 → 허용된 dotenv 항목**이다.
Claude 옵션에만 넣은 키는 터미널의 수동 CLI로 자동 전달되지 않는다. CLI에도 세션 환경이나
동일한 `.loop/.env`를 준비해야 한다. `PAUL_LOOP_MEMORY`, `LOOP_MEMORY_OFF` 같은 동작 스위치는
`.loop/.env`의 허용 목록에 없으며 파일에 적어도 켜지거나 꺼지지 않는다.

## 5. 대표 checkout에서 처음 동기화하기

기존 `.loop/lessons`를 보존한다. 비어 있는 새 디렉터리로도 store를 초기화할 수 있지만, 저장된
교훈이 0개라면 이후 검색 결과도 없을 수 있다. 실제 수정의 FAIL→PASS 근거가 없는 과거 메모를
검증된 교훈으로 꾸미지 않는다.

```bash
# 소비 프로젝트의 대표 checkout 루트. 1단계 MEMORY_ROOT와 4단계 키 설정을 사용한다.
mkdir -p .loop/lessons
node "$MEMORY_ROOT/dist/cli.js" graduate --json
node "$MEMORY_ROOT/dist/cli.js" stats --json
```

준비한 canonical DB에 소유권과 임베딩 identity를 처음 연결한다. 초기화 중
`LOOP_MEMORY_OFF=1`, `LOOP_LEARNING_OFF=1`, `LOOP_MEMORY_RECALL_ONLY=1`이 설정돼 있으면 해당
작업이 거부된다. 의도적으로 정한 제한인지 확인하고, 이 설정 세션에서 허용할 작업만 진행한다.

`graduate`의 JSON에서 `outcome: "synced"`와 실제 추가·갱신 수를 확인한다. `partial`, `locked`,
`skipped`는 exit 0이어도 동기화 완료가 아니다. `stats`는 DB 관측이며 임베딩 요청을 하지 않지만
DB 승인·서명 키·초기화된 store가 필요하다. `stats`부터 실행해 DB를 초기화할 수는 없다.

선택한 지식 문서를 넣으려면 기존 소스 형식을 확인하고 해당 옵션만 추가한다.

```bash
node "$MEMORY_ROOT/dist/cli.js" graduate --json --knowledge docs/adr --context CONTEXT.md
```

위 명령은 실제 해당 문서를 사용하는 프로젝트의 예시다. 없는 파일을 만들 필요는 없다.
ADR은 `# ADR-NNNN: 제목`, context는 `**용어**:` 형식 등 지원되는 파서 계약을 따른다.
`--research`, `--design`은 `##` 섹션으로 나뉜 Markdown 디렉터리다. CLI의 선택 옵션과 별개로,
Claude 자동 훅에서 계속 동기화하려면 plugin 옵션 `loop_adr_dir`, `loop_context_file`,
`loop_research_dir`, `loop_design_dir` 중 사용할 것을 설정한다. 현재 자동 경로는 이 Claude 옵션을
읽는다. Codex에서 선택 문서의 동기화는 위 CLI 플래그로 명시적으로 실행한다. 일반
`LOOP_ADR_DIR` 같은 환경 변수나 `.loop/.env`에 경로를 적는 것만으로 자동 설정되지 않는다.

동기화 대상으로 지정한 각 corpus는 **권위 있는 전체 snapshot**이다. 임시 부분집합이나 빈
경로로 바꾸면 기존 내용이 철회될 수 있다. 선택하지 않은 corpus는 동기화하지 않는다.
feature worktree의 근거는 같은 DB를 조회하더라도 대표 checkout의 새 검증 근거로 자동 승격되지
않는다. worktree 삭제 전 [파일 교훈 보존 절차](verified-lesson-workflow.md)를 따른다.

## 6. 새 세션에서 확인하기

이제 자동 메모리 훅을 켠다. 이미 구성한 키·DB·프로젝트 범위는 그대로 사용한다.

| 호스트 | 켜는 방법 |
|---|---|
| Claude Code | `/plugin configure paul-loop@paul-loop`에서 `memory_enabled=true`로 설정하고 새 세션 시작 |
| Codex CLI | 소비 프로젝트 루트에서 `PAUL_LOOP_MEMORY=1 codex`로 새 세션 시작 |
| Codex Desktop | 해당 작업의 **실행 호스트 프로세스**에 `PAUL_LOOP_MEMORY=1`이 전달되도록 환경을 설정하고 새 세션 시작 |

Desktop 작업 안의 터미널에서 `export`한 값은 이미 실행 중인 앱·호스트에 역으로 전달되지 않는다.
호스트 환경 전달 방법이 확인되지 않으면 먼저 CLI로 위 경로를 확인한다. 전역 설정 파일이나
설치 캐시를 임의로 수정하는 활성화 절차는 없다. 원격 호스트라면 DB 승인·키도 그 실행 호스트에
준비해야 한다. plugin 활성 상태와 호스트의 훅 신뢰 역시 확인한다.

`PAUL_LOOP_MEMORY=0` 또는 다른 명시적 비활성 값이 프로세스 환경에 있으면 Claude의 true 옵션보다
우선한다. `LOOP_MEMORY_OFF=1`은 어느 opt-in보다 우선한다. 끄는 플래그가 의도적으로 설정된 상태를
자동으로 해제하지 않는다.

저장된 교훈과 관련된 실제 질문을 한 뒤, 프로젝트 터미널에서 확인한다.

```bash
node "$MEMORY_ROOT/dist/cli.js" liveness --root "$PWD" --runs 100 --json
node "$MEMORY_ROOT/dist/cli.js" liveness --root "$PWD" --runs 100 --assert
```

이 명령은 DB·임베딩 API를 호출하지 않고 기본 `.loop/runs`를 읽는다. `--assert`는 recall 이벤트가
있으면 `skipped`나 `no_match`여도 통과한다. 최근 시각·reason·주입 수를 함께 확인한다.

| 관측 | 의미와 다음 확인 |
|---|---|
| 이벤트 없음 | 기본 off, 훅 미실행, 다른 실행 호스트/프로젝트, liveness off, 사용자 지정 `LOOP_DIR` 등을 확인. 기본 off에서는 이벤트도 만들지 않음 |
| `skipped / no_embedding_key` | 해당 호스트에서 키를 읽었는지, 빈 환경 값이 덮어쓰는지 확인 |
| `no_match / no_hits` 또는 `above_cutoff` | 검색은 실행됐지만 충분히 가까운 결과가 없음. store 내용과 질문 적합성 확인 |
| `injected` | 컨텍스트 전달이 관측됨. 작업에 도움이 됐다는 증거는 별도 |
| `error / cli_failed` | 아래 수동 CLI로 고정 reason을 확인. exit 0인 외부 훅만 보고 성공으로 판단하지 않음 |

DB·임베딩까지 직접 확인할 때는 민감하지 않은 질의를 stdin으로 전달한다.

```bash
printf '%s\n' '이 프로젝트에서 재발한 테스트 실패의 원인과 수정은 무엇이었나?' |
  node "$MEMORY_ROOT/dist/cli.js" recall --query-stdin --json
```

수동 CLI는 의도적으로 호출한 DB/API 작업이므로 자동 훅의 `memory_enabled` 스위치를 거치지
않는다. `LOOP_MEMORY_OFF` 등의 정책 플래그는 적용된다. CLI의 빈 결과와 훅의 거리 cutoff에 따른
미주입은 다를 수 있다. 테스트용 `--allow-stub`을 실제 의미 검색을 켜는 옵션으로 사용하지 않는다.

## 7. 끄기와 문제 해결

자동 훅만 끄려면 Claude의 `memory_enabled=false`로 바꾸거나 호스트 환경의
`PAUL_LOOP_MEMORY`를 제거/비활성화하고 새 세션을 시작한다. CLI에서 환경을 제거하는 것만으로
Claude의 true 옵션을 덮어쓰지는 않는다. 메모리 DB/API 작업 전체를 끄려면 실행 호스트 환경에
`LOOP_MEMORY_OFF=1`을 전달한다. 이 설정은 기존 파일이나 DB를 삭제하지 않는다.

| 제어 | 범위 |
|---|---|
| `LOOP_MEMORY_OFF=1` | 의미 검색·메모리 DB/API 접근 차단. 파일 교훈은 별도 |
| `LOOP_LEARNING_OFF=1` | 파일 교훈과 메모리 학습 쓰기 차단 |
| `LOOP_MEMORY_RECALL_ONLY=1` | 초기화된 store 조회만. 동기화·조회 카운터·liveness 쓰기 없음 |
| `LOOP_LIVENESS_OFF=1` | 메모리 작동 기록만 중지. 메모리 자체를 끄는 설정은 아님 |

제어 플래그는 실행 환경에 둔다. 기존 세션을 종료하고 새 호스트 세션에 실제 전달됐는지 확인한다.

| CLI reason / 증상 | 확인할 항목 |
|---|---|
| `database_config_missing` | OS 사용자 홈의 승인 파일, 대표 checkout의 실제 경로 키 |
| `database_config_untrusted` | 소유권·권한·symlink·hard link. 승인 검사를 우회하지 않음 |
| `signing_key_missing` | 훅뿐 아니라 수동 CLI에도 같은 서명 키가 있는지 |
| `embedding_provider_ambiguous` / `embedding_provider_key_missing` | 선택 provider와 해당 키, 환경 우선순위 |
| `store_uninitialized` / `frozen_store_uninitialized` | 스키마 적용 후 대표 checkout에서 쓰기를 허용한 초기 graduate가 있었는지 |
| `store_owner_mismatch` / `legacy_store_unowned` | 다른 저장소/이동한 경로/옛 DB 여부. [새 전용 store 전환](../tools/loop-memory/MIGRATION-0.7.md) |
| `embedding_identity_mismatch` | 기존 DB와 provider·모델 identity가 같은지. 임의 메타데이터 수정 금지 |
| `runtime_error` / `cli_failed` | 컨테이너 상태·포트·마이그레이션·키/네트워크부터 확인. CLI 출력만으로 원인을 단정하지 않음 |

의미 검색은 정제된 질문·선택된 문서를 외부 임베딩 API로 보낸다. 정제가 모든 민감한 문장을
판별하지는 않는다. 데이터 전송과 API 사용료를 허용할 프로젝트에서 켠다. 로컬 이벤트·주입 횟수는
관측 자료이며 변조 방지 증명이나 효용 지표가 아니다. 실제 재발에서 도움이 됐는지 별도로 기록한다.
