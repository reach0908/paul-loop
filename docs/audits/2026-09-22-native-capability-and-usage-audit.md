# paul-loop: 실제 host·활성 상태와 사용 기록 점검

> 2026-09-22 당시의 조사·실행 기록입니다. 당시의 미완료 상태와 다음 작업은 현재 상태가 아닙니다.
> 최신 구현·배포·후속 순서는 [09-23 상태표](2026-09-23-roadmap-status.md)를 따릅니다.
> 원본 출처·편집 범위·비공개 관측 자료는 [보존 목록](2026-09-23-research-archive.md)에 기록했습니다.

기준: **2026-09-22 KST**. [연구·개선 방향](2026-09-22-paul-loop-research-and-roadmap.md)의 다음 단계인 native 경계와 실제 사용 경로 점검이다. 기존 문서와 검증된 경량화 변경은 로컬 커밋 **`fcbfd32`**에 보존했다. 이번 후속 작업은 읽기 전용 관측과 문서 변경이다.

## 이번에 달라진 판단

1. **사용자가 기억 기능을 사용하지 않는다는 진단은 맞지 않는다.** Codex native memory가 활성화되어 있고, 선택한 완료 응답 23개 중 22개에 native memory 인용이 있다. 별도 `loop-memory`의 미설치·미관측과 구분해야 한다. 인용은 참조의 흔적이며 개발 성과 개선의 증명은 아니다.
2. **설치된 런타임은 새 provider 변경과 다르다.** 현재 Codex는 Zine의 `ship-flow 0.11.0+zine.1`을 사용한다. 이번 provider의 경량화 변경을 현재 로그의 속도에 연결할 수 없다. 앱과 터미널의 Codex 버전도 다르다.
3. **느림의 원인은 아직 특정하지 못했다.** 짧은 응답과 14시간 이상의 실행이 섞여 있다. 긴 실행의 반복 명령·검사·대기 원인을 먼저 확인할 수 있는 자료를 확보했다. 새 메모리 DB나 계측 서버를 추가할 단계는 아니다.

원자료의 집계·세션 식별자·읽은 바이트 범위의 SHA-256은 [관측 JSON](2026-09-23-research-archive.md#private-evidence)에 보존했다. 대화 본문, 명령 원문, 기억 내용, 인증 정보는 저장하지 않았다.

## 1. 실제 설치와 native 경계

공식 문서에 기능이 존재하는지와 이 컴퓨터에서 사용할 수 있는지를 분리했다. 아래는 로컬 바이너리의 `--version`, `features list`, `plugin list --json`, 관련 설정에서 관측한 값이다.

| 대상 | 확인한 값 | 의미 |
|---|---|---|
| Codex 데스크톱 앱 | `/Applications/ChatGPT.app`, 앱 `26.915.31945` / build `9922`; 내장 바이너리 `0.155.0-alpha.9.2` | 터미널의 `codex`와 다른 바이너리 |
| 터미널 Codex | `~/.local/bin/codex`, `0.146.0` | CLI 실험 결과를 앱의 결과로 취급하면 안 됨 |
| Codex 기능 | 두 바이너리 모두 `memories`, `hooks`, `plugins`가 `stable true`; `runtime_metrics`는 false | 기능·설정 상태. 프로젝트별 실제 효과까지 증명하지 않음 |
| Codex 설치 플러그인 | `loop-engine@zine-codex 0.15.0+zine.1`, `ship-flow@zine-codex 0.11.0+zine.1`, installed/enabled true | 앱·CLI에서 관련 항목 확인. 설치 출처는 Zine의 로컬 plugin 디렉터리 |
| Codex loop-memory | 설치 목록에 항목 없음 | native memory와 다른 제품. 자동으로 활성화하지 않음 |
| Claude Code | `2.1.278` | Codex와 별도 host |
| Claude native memory | 전역·확인한 프로젝트 설정에 명시적인 off가 없음. Digging의 native memory 디렉터리에 Markdown 6개 | 저장 흔적만 확인. 모든 프로젝트의 Claude recall 실행이나 효용을 입증하지 않음 |
| Claude paul-loop 플러그인 | Zine project scope의 engine `0.15.0`, ship-flow `0.11.0`이 enabled false | Zine cwd에서도 재확인. 다른 방식의 직접 명령 사용까지 부정하지 않음 |

`~/.codex/config.toml`에도 `features.memories=true`, `features.hooks=true`가 있다. Claude의 `autoMemoryEnabled` 및 `CLAUDE_CODE_DISABLE_AUTO_MEMORY`는 확인한 설정에서 unset이다. unset을 true라고 바꾸어 보고하지 않았다. 현재 셸의 loop-memory off/frozen 플래그도 unset이지만 과거 실행의 환경을 증명하지 않는다.

**실험의 고정 조건:** 앱/CLI 실행 파일 경로, 실제 모델·effort, provider commit, 설치 플러그인 출처·버전, native memory와 loop-memory 조건을 각각 기록해야 한다. 기존 세션의 `cli_version`은 세션 생성 당시 메타데이터이므로 이후 모든 turn의 실행 버전이라고 단정할 수 없다.

## 2. 프로젝트별로 연결된 것과 끊긴 것

이번 표는 canonical root만 다시 확인했다. 모든 등록 worktree를 포함한 앞선 [9개 프로젝트 집계](2026-09-23-research-archive.md#private-evidence)와 분모가 다르다. `.loop/runs`는 세션 이벤트이며 하나의 `run.started`가 독립 과제 하나를 뜻하지 않는다.

| 프로젝트 | Codex 프로젝트 registry | canonical의 최근 verdict 시각 (UTC) | 이번에 확인한 한계 |
|---|---|---|---|
| Rabbit Hole | engine·ship-flow의 Zine cache 경로 등록 | PASS 09-13 16:33, FAIL 09-13 16:28 | 세션 이벤트는 09-21에도 있으나 최근 작업의 verdict 연결은 별도 확인 필요 |
| Digging | engine·ship-flow의 Zine cache 경로 등록 | PASS 09-16 10:03, FAIL 09-16 09:29 | 최근 표본에 skill·verdict 명령 경로 참조가 있지만 성공적인 실행 여부와 중복 검사는 미분류 |
| Signal Feed | 해당 registry 파일 없음 | 관측 없음 | 전역 플러그인·세션 hook과 프로젝트의 검증 명령 연결은 다른 경로 |
| Zine | 로컬 `plugins/`를 가리키는 상대 경로 등록 | canonical에서는 관측 없음 | 앞선 전체 worktree 집계에는 verdict가 있음. 미사용으로 결론 내릴 수 없음 |

네 canonical root 모두 `.loop/otel/*.jsonl`은 0개였다. 기존 [otel-metrics](../../tools/loop-engine/bin/otel-metrics.mjs)를 Rabbit Hole·Digging·Signal Feed에 실행한 결과, 사용자 대기 H2·USD 비용 C1·토큰 C2는 모두 **`INSUFFICIENT_DATA`**였다. 비용·대기를 0으로 기록하지 않았다. 계측을 켜거나 서버를 설치하지 않고 Codex의 기존 세션 기록으로 확인 가능한 범위를 보완했다.

현재 provider의 [run-event hook](../../tools/loop-engine/hooks/record-run-event.mjs)은 시작·종료·compaction·권한·subagent 이벤트를 남긴다. 이 정보만으로 개별 구현·테스트·리뷰 시간이나 모델 비용을 분해할 수 없다. subagent 시작/종료 수 역시 항상 대응하지 않는다.

## 3. 기존 Codex 세션의 작은 표본

### 선택·집계 방법

- 9월 session 파일 1,004개의 첫 메타데이터만 확인하여, 세 프로젝트의 정확한 canonical cwd와 일치하는 파일 중 수정 시각이 가장 최근인 세션 하나씩을 골랐다. 그 세션의 09-15 UTC 이후 시작된 완료 turn을 최근 최대 10개씩 선택했다. **편의 표본이며 전체 사용량이나 프로젝트 간 생산성 비교가 아니다.** worktree·다른 세션·Claude 작업은 이 표본에 없다.
- 완료 시간은 host의 `task_complete.duration_ms`를 사용했다. 도구 관측은 `task_started`/`task_complete` 이벤트의 실제 timestamp 경계 안에서 `call_id`별 첫 호출/반환을 연결했다. 겹치는 구간은 합집합으로 집계했다. 선택된 도구 호출은 모두 대응 반환이 있었다.
- 토큰은 `token_usage_record.usage`를 `response_id`마다 한 번만 합산하고 `turn_id`로 귀속했다. 누적 `token_count`를 반복 합산하지 않았다. 파싱 오류·같은 response ID의 상충은 0건이었다.
- 인용 수는 assistant의 `final_answer`에 실제 포함된 `<oai-mem-citation>`만 세었다. 시스템 지침이나 user 메시지에 들어 있는 인용 양식은 제외했다. 도구 인자의 경로 문자열은 **요청 흔적**으로 따로 세었으며 실행 성공이나 교훈 활용으로 승격하지 않았다.

| 프로젝트 | 완료 turn | turn에서 기록된 모델 / effort | native memory 인용 turn | 경과 시간 중앙값 / 최대 | 누적 입력 중 cached 비율 |
|---|---:|---|---:|---:|---:|
| Signal Feed | 3 | `gpt-6-astra` / xhigh | 3 | 2.32분 / 16.61분 | 94.52% |
| Rabbit Hole | 10 | `gpt-5.6-luna` / xhigh | 10 | 4.12분 / 16.29분 | 97.15% |
| Digging | 10 | `gpt-5.6-luna` / xhigh | 9 | 21.90분 / 849.28분 | 98.48% |

경과 시간에는 도구, 추론, 서비스 지연, 대기 등이 섞여 있다. 요구 범위와 모델도 서로 다르므로 빠른 프로젝트 순위로 읽으면 안 된다. 첫 유용한 diff까지의 시간, 완료 품질, 추가 리뷰가 잡은 고유 결함, 실제 청구액은 이번 집계에 없다. cached 비율도 매 요청의 입력을 합산한 비율이며 단일 컨텍스트의 점유율이나 할인율이 아니다.

### 메모리에 관해 말할 수 있는 것

native memory 경로를 참조한 도구 요청이 있는 turn은 Signal Feed 3개, Rabbit Hole 1개, Digging 0개였다. Digging의 인용 9건을 이번 turn에서 수행한 새로운 검색 9건이라고 해석하면 안 된다. 이전 turn의 기억이나 compacted context를 이어 쓸 수 있고 인용 자체도 정확성 검증을 대신하지 않는다.

세 표본 모두 별도 `loop-memory/` 경로 요청 흔적은 없었다. 전역 플러그인 목록의 부재 및 기존 recall/graduate 미관측과 일치한다. 그러나 이 표본이 모든 DB·과거 설치·숨겨진 호출 경로를 조사한 것은 아니다.

따라서 다음 기억 실험의 기준선은 **현재 사용 중인 native memory + 필요한 프로젝트 파일**이다. 이 상태를 무시하고 별도 loop-memory를 켠 뒤 전체 효과를 loop-memory의 성과로 계산하면 안 된다. native 인용이 올바른 코드 선택·재발 방지·독립 검증으로 이어졌는지는 실제 사례 6–10건을 읽고 별도로 평가해야 한다.

### 긴 실행에서 확보한 단서

Digging의 가장 긴 turn `01a0ab47-cae5-7330-847b-259293d0f427`은 **50,956.601초, 도구 호출 2,737개**였다. 도구 인자에서 `exec_command` 요청 1,514회, `write_stdin` 요청 1,137회, `apply_patch` 요청 91회를 식별했다. 한 호출에 여러 도구가 들어갈 수 있으므로 이 수들을 단순 합산하여 전체 호출 수와 비교하면 안 된다.

이 turn의 host가 관측한 도구 호출/반환 구간 합집합은 약 **30,967초**였다. 이것은 명령의 CPU 시간이나 불필요한 대기 시간과 다르다. 비동기 실행·yield·poll 사이의 시간도 완전히 귀속하지 못한다. 나머지를 모델 추론 시간이라고 계산할 수 없다. `write_stdin`이 많다는 사실만으로 잘못된 polling이라고 판정하지 않았다.

다음 지연 조사의 구체적 대상은 이 turn이다. 명령 시작→프로세스 session ID→poll→종료→다음 수정·검사를 연결하면, 긴 정상 검사, 실패 후 필요한 재검사, 변경 없는 반복 검사, 완료를 기다리는 조회를 구분할 수 있다. 이 원인을 밝히기 전에는 reviewer 수를 줄이거나 timeout을 일괄 변경할 근거가 부족하다.

**후속 조사:** [장기 실행 진단](2026-09-22-long-run-diagnosis.md)에서 전체 검증 요청 33개를 프로세스 ID와 연결했고, 오래된 증거를 하나씩 발견하며 전체 검증에 재진입한 두 사례를 확인했다. 현재 소비자 설정과 정식 evidence producer의 진입점 차이도 확인했다. provider의 공유 복구 지침을 보강했으며, 소비 프로젝트 정렬과 실사용 효과 검증은 별도 미완료다.

## 4. 이 관측에 따른 다음 작업

| 순서 | 작은 작업 | 끝났다고 판단할 기준 |
|---|---|---|
| 1 | 위 Digging 실행 한 건의 긴 명령·재실행 이유 분석 | 영향이 큰 명령별로 실행·종료·관련 변경을 연결. 반복이 필요했는지 판정 불가한 경우 그대로 남김 |
| 2 | 작은 작업의 ship/publisher 오진입 경로 조사·최소 수정 | 기존 #87의 증상과 실제 skill description/caller를 확인하고 routine sync·간단 수정·명시적 PR 요청의 기대 동작 검증 |
| 3 | Rabbit Hole·Digging의 실제 교훈 6–10건으로 native/file 기준선 작성 | 각 교훈의 출처·현재 유효성·검색·실제 결정 영향·독립 검사 결과 기록. 인용만 있는 사례는 효과 미확인 |
| 조건부 | 같은 모델·host·과제에서 한 절차씩 비교 | 기존 [평가 runner](../../tools/loop-engine/docs/agent-evaluation.md)와 [native adapter](../../scripts/native-eval/README.md) 재사용. 현재 qualification 제한과 native memory 조건을 해소한 뒤 비교 |

**지금 추가하지 않을 것:** 별도 메모리 인프라, 자동 교훈 승격, 새 계측 서버, 모든 작업을 full ship-flow로 보내는 강제 경로. native 기능과 기존 스크립트로 먼저 확인할 수 있다. verifier 무결성·실제 요구사항 검사·공개 쓰기 승인 경계는 유지한다.

## 5. 보존·검증 상태

- 기존 조사·경량화: `fcbfd32`로 로컬 Git 보존. 원본 체크아웃과 소비 프로젝트 설정은 변경하지 않았다.
- 이번 관측: JSON 구조·합계·turn 경계·인용 수·캐시 범위 검증, 문서의 로컬 링크와 `git diff --check` 확인. 임시 collector는 interval 합집합·중복 response 제거·경계 존재 assertion을 실행했다. 위치·해시는 JSON에 기록했으며 제품 코드로 추가하지 않았다.
- 새 코드 변경이 없으므로 앞서 통과한 engine/memory 전체 suite를 재실행하지 않았다. 설치 상태 조회가 hook 성공이나 효과 실험의 PASS를 뜻하지 않는다.
- 아직 없는 결과: 지연의 원인 판정, 메모리의 인과 효과, 새 provider 변경의 소비자 적용·실사용 효과. 유료 모델 실험·consumer 활성화·원격 push·게시·병합·배포는 이번 작업에 포함하지 않았다.
