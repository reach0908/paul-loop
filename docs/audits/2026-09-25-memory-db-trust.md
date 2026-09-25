# loop-memory DB 대상 승인 경계 — issue #98

기준: `d962a6f1572ab6608e92a65d5c8582c7c12b990d`. 대상은 provider 소스다.
사용자 지시의 자체 개선·PR 게시 범위를 이어서 수행했다. 소비자 설치, 실제 사용자 설정,
기존 DB, 병합 및 배포는 이 변경의 실행 범위에 포함하지 않는다.

## 문제와 변경

기존에는 프로젝트 dotenv와 plugin option의 `LOOP_DATABASE_URL`이 훅 → CLI → pg Pool로
전달됐다. 스토어 소유권을 검사하려면 먼저 연결해야 하므로 그 검사는 잘못 지정된
서버에 대한 최초 접속을 막지 못했다. 엔진의 자동 heartbeat에도 같은 입력 경로가 있었다.

자동 연결은 OS 사용자 홈의 `.config/paul-loop/memory-databases.json`에 별도로 승인한
canonical repository 항목만 사용한다. 설정 파일은 사용자 소유의 일반 파일, 권한 `0600`,
단일 hard link여야 하고 경로의 symlink 및 타 사용자 쓰기 권한을 거부한다. `HOME`, XDG,
프로젝트 환경 변수, plugin option은 승인 파일이나 DB 대상을 선택하지 못한다.

- 미승인 대상은 Pool 생성/네트워크 전에 고정된 오류 코드로 거부한다. localhost 기본
  접속도 제거했다. 원격 대상은 명시적 `allowRemote: true`와 인증서를 검증하는 TLS가 필요하다.
- 승인 URL은 검증한 필드로 분해한다. pg의 URL 재해석, TCP host/port query override,
  SSL 파일 매개변수, 중복 query key를 거부한다. 명시적 Unix socket과 `options`는 유지한다.
- 비밀번호 callback과 명시적 TLS/options로 ambient pg 설정 및 pgpass 선택을 방지한다.
  훅의 자식 환경은 필요한 키만 전달하고 현재 Node 실행 파일을 사용한다.
- CLI, graduate/recall 훅, detached recall 기록, 엔진 heartbeat의 공통 경로를 확인했다.
  자격 증명 우선순위와 훅 exit-0 계약은 유지한다. 상대 dotenv의 symlink는 거부한다.
- 독립 검토에서 `.git` 포인터만으로 다른 승인 저장소를 사칭하는 재현을 확인했다.
  실제 등록된 worktree이면서 해당 경로를 포함하는 경우만 canonical 승인을 상속한다.
  정상 worktree/하위 디렉터리는 같은 승인 항목을 사용한다.

공개 라이브러리의 명시적 `createLoopDb(url)`과 소스의 수동 `db:migrate`는 계속 호출자가
대상을 선택하는 API다. 자동 훅은 이 경로를 호출하지 않는다. OS 사용자 권한으로 임의
코드를 실행하거나 승인 파일 자체를 바꿀 수 있는 공격자까지 격리한다는 주장은 하지 않는다.

## 호환성

후보 버전은 **loop-memory 0.8.0**, **loop-engine 0.15.11**이다. ship-flow는 0.11.4 그대로다.
기존 DB 환경 변수만 있던 설치는 자동 연결이 중단되므로 사용자가 승인 파일을 직접
작성해야 한다. 파일 형식과 마이그레이션은 README와 `tools/loop-memory/MIGRATION-0.7.md`에
기록했다. 자동 이전이나 인프라 활성화는 하지 않았다.

## 검증

| 검사 | 결과/범위 |
|---|---|
| 최초 회귀 | 기존 구현에서 사용자 승인 없이 Pool 생성: RED |
| Git 포인터 재현 | 미승인 디렉터리가 승인 DB 설정을 얻던 RED 확인 후 차단 |
| 실제 CLI/heartbeat | 프로젝트 지정 TCP listener에는 접속 0회; 사용자 승인 후 접속 확인 |
| memory typecheck/build | PASS, 배포용 `dist/cli.js` 재생성 |
| memory unit | 175 PASS, 선택적 실제 embedding API 2 SKIP |
| PostgreSQL 통합 | PostgreSQL 17 + pgvector의 임시 Unix socket cluster: 54 PASS |
| runtime 검사 | 160 PASS, 선택적 공식 Codex CLI 설치 시험 1 SKIP |
| source/generated Claude manifest | strict validation PASS |
| runtime 생성/skill lock | 생성 후 `--check`와 skill lock 검사 PASS |

PostgreSQL 검사는 새 임시 cluster와 fixture DB만 생성하고 실제 migration CLI,
graduation/recall/기록/통계를 실행했다. 종료 및 해당 fixture 삭제까지 완료했다.
기존 메모리 DB, 실제 API, 설치된 플러그인은 사용하지 않았다.

엔진 전체 suite와 원래 base의 verifier-pinned-review는 별도 필수 병합 검사다. PR의 현재
head에 대한 CI 결과를 확인해야 하며 이 문서의 unit/fixture 결과가 이를 대체하지 않는다.
기존 엔진 테스트나 verifier를 수정하지 않았다. 테스트용 환경 변수를 자식에게 재허용하는
대신 fake CLI 입력을 fixture 내부에 넣었으며, DB 테스트는 별도 OS 사용자 홈 fixture를 쓴다.

독립 사전 조사 1회와 후보 검토 1회를 수행했다. 검토의 Git 포인터 재현을 부모가 직접
확인하고 회귀 검사로 남겼다. 호스트가 제공하는 `CLAUDE_PROJECT_DIR`의 프로젝트 설정
덮어쓰기 가능성은 실제 호스트에서 입증되지 않았으며 임의 호스트 실행 문맥 변조 방어를
완료했다고 주장하지 않는다. IPv6 heartbeat의 기존 진단 문제는 이번 변경의 신규 회귀가 아니다.

## 커밋 이력의 키 노출 확인

사용자 추가 요청에 따라 공개 브랜치/태그와 PR ref 91개에서 도달 가능한 243개 커밋을
Gitleaks 8.24.3 기본 규칙으로 검사했다. 저장소 예외 및 inline allow 주석을 적용하지 않았다.
탐지 3건은 모두 동일한 테스트용 고정 서명 문자열이었다. 운영 자격 증명으로 확인된 항목은
없었다. 이것은 탐지 0건이라는 뜻이 아니며 Actions 로그·첨부물·접근할 수 없는 과거 객체
전체에 대한 감사도 아니다. 원문 키를 게시하거나 실제 자격 증명을 API로 시험하지 않았다.

redacted 원본, 실행 로그와 상세 판정은 별도의 Codex Security artifact collection에 보관했다.
이 이력 검사와 provider 테스트는 소비자 활성화, 배포, 장기 메모리 효용을 증명하지 않는다.
