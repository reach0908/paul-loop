# Digging 장기 실행: 전체 검증 재진입과 증거 갱신 순서

> 2026-09-22 당시의 조사·실행 기록입니다. 당시의 미완료 상태와 다음 작업은 현재 상태가 아닙니다.
> 최신 구현·배포·후속 순서는 [09-23 상태표](2026-09-23-roadmap-status.md)를 따릅니다.
> 원본 출처·편집 범위·비공개 관측 자료는 [보존 목록](2026-09-23-research-archive.md)에 기록했습니다.

기준: **2026-09-22 KST**. [직전 사용 현황 점검](2026-09-22-native-capability-and-usage-audit.md)에서 선정한 단일 장기 turn의 후속 조사다. [구조화된 관측](2026-09-23-research-archive.md#private-evidence)에 요청·프로세스 ID·종료 관측·원본 식별자를 저장했다.

## 결론

14시간 실행에서 반복된 것은 주로 **전체 검증 재시작과 소스 변경 후 증거 재생성**이었다. 대표적으로 `ds-04` 증거를 갱신하고 전체 검증을 다시 돌린 뒤 `ds-02`도 오래됐음을 발견하는 순서가 두 번 확인됐다. 관련 증거를 함께 점검할 기존 경로가 있는데도 전체 검증을 다음 누락을 찾는 수단으로 사용했다.

다만 14시간 전체를 불필요한 반복으로 계산할 수 없다. 브라우저 검사 실패, 실행 경로 오류, 소스 수정, 정상적인 장기 검사도 섞여 있다. 각 구간의 필요성과 변경 영향을 전부 판정한 실험이 아니며 절감 시간을 추정하지 않았다.

더 큰 적용 공백도 있다. 확인한 전체 검증 요청 33개 중 `verdict-run.sh`를 포함한 요청은 **1개**였다. provider에는 이미 wrapper 사용 규칙이 있지만 이 실행의 대부분은 직접 shell 명령이었다. 이번 복구 지침 보강은 이 경로의 자동 집행이나 실사용 개선을 증명하지 않는다.

## 1. 실제로 연결한 실행

- 세션: `01a07780-7d5e-7df3-a458-1ec7f9ffa01c`, turn: `01a0ab47-cae5-7330-847b-259293d0f427`.
- 구간: **2026-09-16 17:33:24 → 09-17 07:42:40 UTC**, host 경과 시간 50,956.601초. 당시 turn의 모델은 `gpt-5.6-luna`, effort xhigh.
- 기존 감사의 원본 1,152,806,707바이트 SHA-256을 다시 계산해 일치함을 확인했다. 해당 turn의 기록만 private 임시 파일로 추출했다. 역사적 명령은 실행하지 않았다.
- `exec` 입력은 Node에 포함된 Acorn 8.15.0으로 구문 분석했다. 2,737개 바깥 도구 호출과 2,737개 반환을 연결했고 구문 오류는 0개다. 임의 코드를 평가하거나 과거 명령을 재실행하지 않았다.
- 전체 검증은 단순 문자열 검색 대신 shell 토큰에서 실제 `pnpm verify` / `pnpm verify:evidence` 진입 명령을 골랐다. `rg 'pnpm verify'` 같은 조회는 제외했다. 33개 모두 반환된 프로세스 session ID가 있다. 명령을 시작했다는 관측이며 전체 suite를 33회 완료했다는 뜻은 아니다.

| 관측 | 결과 | 해석 제한 |
|---|---:|---|
| `pnpm verify` 요청 | 15 | 한 요청은 자식 검사 실행 전에 실패할 수도 있음 |
| `pnpm verify:evidence` 요청 | 18 | wrapper가 호출하는 내부 `pnpm verify`를 다시 더하지 않음 |
| 명시적인 최종 exit 1을 연결한 요청 | 19 | 모두 PASS 아님. 시작부터 종료 관측까지의 합은 약 223분이나 절감 가능 시간은 아님 |
| 명시적인 최종 exit를 연결하지 못한 요청 | 14 | 일부 stdout에는 FAIL이 있지만 종료 코드를 추정해 채우지 않음 |
| `verdict-run.sh`를 포함한 전체 검증 요청 | 1 | 나머지 요청을 engine의 판정 기록·제한된 복구 루프 사용으로 계산할 수 없음 |

마지막 전체 요청의 session ID는 `53001`이다. 선택 구간의 마지막 관측까지 명시적인 종료 코드를 확보하지 못했다. host의 turn 완료 이벤트와 검증 프로세스의 성공 완료는 다르다.

### 순서를 복원한 두 사례

아래는 모두 UTC다. 시간·요청 ID·명령 해시는 JSON의 `repeated_receipt_chains`와 `root_requests`로 연결된다.

| 순서 | 첫 번째 사례 | 두 번째 사례 |
|---|---|---|
| 전체 검증 시작 → `ds-04` fingerprint 불일치로 exit 1 | 09-16 23:33:01, 약 132초 | 09-17 01:28:28, 약 132초 |
| legacy-card의 실제 runtime producer 실행 | 기록 index 1194 | 기록 index 1509 |
| 전체 검증 재시작 → 이번에는 `ds-02` fingerprint 불일치로 exit 1 | 09-16 23:37:17, 약 131초 | 09-17 01:32:29, 약 132초 |
| club-card의 실제 runtime producer 실행 | 기록 index 1204 | 기록 index 1520 |
| 전체 검증 다시 시작 | 09-16 23:41:02 | 09-17 01:36:11 |

실제 진단에는 `runtime PASS receipts are read back and bound to the observed implementation` 실패와 각 receipt의 `worktree fingerprint must describe the current implementation snapshot`이 있다. 두 경우 모두 첫 receipt를 갱신한 뒤 곧바로 전체 검증에 재진입했다. 두 번째 receipt까지 먼저 확인·재생성하고 기존 freshness 검사를 통과시킨 뒤 전체 검증을 시작하는 순서가 더 적절하다. focused 검사 자체에도 비용이 있으므로 위 경과 시간을 그대로 절감액으로 쓰지 않았다.

18:42의 `verify:evidence` 실행에서는 약 26분 뒤 `12-pixel-perfect-baseline.txt is stale and does not fingerprint the current implementation`이 확인됐다. 06:31 이후에도 visual wrapper의 implementation fingerprint 불일치가 나타났다. 초기 receipt 두 개 외에도 최종 gate가 요구하는 증거의 의존 관계를 확인할 필요가 있었다.

## 2. 소비 프로젝트에서 확인한 구조적 원인

다음은 역사적 작업 디렉터리가 아닌 **현재 canonical checkout `bc0db04`**의 읽기 전용 검사다. 과거 디렉터리는 없어졌으므로 당시 모든 설정과 같다고 가정하지 않는다. 각 파일의 현재 SHA-256은 JSON에 남겼다.

| 파일 | 확인한 동작 |
|---|---|
| `.codex/ship-flow.config.json` | `verifyCommand`가 `pnpm verify` |
| `package.json` | `verify` 마지막에 `verify:route-visual-matrix` 실행. `verify:evidence`는 `scripts/verify-root-evidence.mjs` 실행 |
| `scripts/verify-root-evidence.mjs` | 시작 fingerprint를 잡고 `ROOT_EVIDENCE_GENERATION=1`로 동일한 `pnpm verify` 실행. 종료 코드 0과 시작/종료 fingerprint 일치를 모두 확인해 `root-verify.txt` 기록 |
| `web/scripts/verify-route-visual-matrix.mjs` | generation 모드가 아니면 **기존** `root-verify.txt`가 현재 fingerprint와 일치해야 함. visual wrapper 증거도 각각 현재 fingerprint를 요구 |
| `web/scripts/worktree-fingerprint.mjs` | 구현·테스트·스크립트 등을 넓게 포함. `delivery/implementation/evidence/`, `.loop/`, `.codex/` 등은 제외 |

**소스에서 도출한 결론:** 구현이 바뀌고 root receipt가 오래된 경우, 설정의 raw `pnpm verify`는 마지막 단계에서 기존 receipt를 읽지만 그것을 새로 작성하지 않는다. `verify:evidence`가 이 생성 순서를 소유한다. 이는 검증 결과를 통과로 바꾸는 플래그를 임의로 붙일 문제가 아니라, 기존의 정식 producer를 올바른 진입점으로 쓰는 문제다.

소비자 측 후속 수정 후보는 `verifyCommand`를 **`pnpm verify:evidence`**로 정렬하고 기존 `verdict-run.sh -- <verifyCommand>` 경로를 유지하는 것이다. 이 변경은 아직 적용하지 않았고 현재 소비 환경에서 full PASS로 검증하지도 않았다. 설정·문서·실제 호출의 정렬과 필요한 disposable DB/runtime 검증을 하나의 소비 프로젝트 작업으로 다뤄야 한다.

fingerprint가 넓게 묶여 있으므로 관련 소스 수정 뒤 여러 receipt가 동시에 낡아질 수 있다. 그러나 현재 helper는 증거 출력 디렉터리를 제외한다. 따라서 **“증거를 쓰는 행위 자체가 fingerprint를 바꾸는 무한 루프”는 이번 근거로 확인되지 않았다.** 파일 범위를 임의로 줄이거나 서명·fingerprint만 덮어쓰는 수정은 하지 않았다.

## 3. polling과 관측 누락

AST에서 발견한 `write_stdin` 호출 위치는 1,139개이며, 그중 1,007개가 30초 대기를 요청한다. 조건부 호출과 map 내부 호출이 있으므로 이는 실제 동적 실행 횟수가 아니다. 앞선 보고서의 1,137은 바깥 요청마다 도구 이름을 한 번만 세었던 값으로 집계 단위가 다르다.

구조화된 결과에서 stdout이 빈 경우 522개, 해당 필드를 확보하지 못한 경우 580개다. 시작·종료 사이의 정상 대기도 포함되므로 빈 출력만으로 낭비라고 분류하지 않았다. 짧은 polling 간격만을 14시간의 주원인으로 볼 근거도 부족하다.

`Unknown process id` 출력은 5개 요청 위치에서 관측했다. 첫 요청부터 이전 turn의 process ID를 조회하다 실패했다. 이후 에이전트 설명은 이를 프로세스 종료로 해석했지만 **unknown ID 자체는 OS 프로세스 종료나 검증 실패의 증명이 아니다.** 다시 시작하기 전에 살아 있는 프로세스와 소유한 로그·exit 기록을 구분해 확인해야 한다.

역사적 worktree와 조사한 임시 로그 경로들은 현재 존재하지 않는다. 필요한 메시지는 원본 transcript에 남아 있지만 일부 도구 호출이 `text(result.output)`만 전달해 exit/session 정보를 버렸다. 따라서 14건의 최종 exit를 보수적으로 미확인으로 남겼다. stdout의 FAIL, host script 완료, 실제 검증 프로세스 종료를 하나로 합치지 않았다.

## 4. 이번 provider 개선

새 실행기나 기록 체계 대신 기존 [공유 복구 계약](../../tools/ship-flow/skills/AUTHORIZATION.md)의 실패 처리 문구를 보강하고 [ship-feature의 기존 구현 단계](../../tools/ship-flow/skills/ship-feature/SKILL.md)에서 그 계약을 명시했다. 공유 계약의 기존 호출자를 확인했으며 hotfix 등에도 같은 복구 원칙이 적용된다.

- 긴 검사 전에 설정된 검증 진입점과 정식 evidence producer·기존 사전 검사를 대조한다.
- 프로세스 식별자·로그·최종 exit를 보존한다. unknown session을 실패나 종료로 단정해 재시작하지 않는다.
- 실패 원인을 고친 뒤 해당 focused 검사를 통과시킨다. 소스 변경으로 무효화된 관련 증거는 실제 producer로 함께 갱신한 뒤 전체 검증을 다시 한다.
- 같은 입력에서 같은 실패가 반복되면 새 진단을 먼저 한다. 기존 전체 gate, AC, reviewer, 승인 경계와 PASS 기준은 유지한다.

이는 지침 변경이다. 모델이 실제로 준수하는지, 현재 설치판에 적용되는지, 전체 시간이 줄어드는지는 아직 확인되지 않았다. 소비자의 source 범위가 불필요하게 넓은지는 별도의 의존 관계·회귀 검증 없이 바꾸지 않는다.

## 5. 검증과 다음 한 작업

- Engine 전체 suite: **80/80 PASS, exit 0**. 로그 `/tmp/paul-loop-recovery-engine-20260922.log`와 SHA-256을 관측 JSON에 기록했다.
- 기존 ship-flow 실행 계약·verdict wrapper 집중 검사, runtime 생성물 재생성/일치 검사, vendor skill lock, 문서 링크·집계 검산·`git diff --check`: **PASS**.
- 새 memory 코드가 없어 memory suite는 재실행하지 않았다. 실제 모델 비교·소비 프로젝트 full runtime·속도 개선 검증은 **미실행**이다.
- 초기 점검은 시스템 `python3`의 Xcode license 문제와 이전 생성물의 drift로 실패했다. 임시 PATH에서 Python 3.13을 사용하고 이 worktree의 생성물을 재생성한 뒤 확인했다. 설치 캐시·소비 프로젝트 설정은 변경하지 않았다.

다음 우선 작업은 **Digging의 검증 진입점·증거 생성 순서·실제 wrapper 호출을 한 경로로 정렬하는 소비 프로젝트 수정**이다. 작은 작업의 publisher 오진입 조사와 기억 효용 실험보다, 이번에 확인한 반복 경로를 먼저 고치는 편이 근거가 강하다. 새 DB나 memory 활성화로 해결할 문제라는 증거는 없다.

후속: [소비 프로젝트의 진입점 수정과 실제 wrapper 확인](2026-09-23-research-archive.md#consumer-history)을 로컬 commit으로 저장했다. workspace 8 PASS와 전체 명령의 preflight 실패 전달을 확인했으며, disposable 환경의 full runtime·PR·merge는 남아 있다.
