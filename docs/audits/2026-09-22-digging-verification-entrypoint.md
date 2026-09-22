# Digging의 ship-flow 검증 진입점 정렬

기준: 2026-09-22 KST. [장기 실행 진단](2026-09-22-long-run-diagnosis.md)의 소비 프로젝트 후속 작업이다.

**최신 상태:** [나머지 화면 검증과 보관함 클릭 복구](2026-09-22-digging-remaining-visual-validation.md)에서 최종 소스의 canonical visual 11개는 7 PASS / 4 FAIL이었다. 전체 명령도 한 번 실행했으며 DS receipt freshness에서 FAIL했다. [계약 추적과 fingerprint 정렬](2026-09-22-digging-contract-alignment.md), [직전 DS 갱신·전체 실패](2026-09-22-digging-baseline-refresh.md), [그 이전 실행 결과](2026-09-22-digging-full-verification.json)는 보존한다.

## 변경과 현재 상태

Digging의 `verifyCommand`를 `pnpm verify`에서 **`pnpm verify:evidence`**로 바꾸고 기존 설치 문서에 실제 wrapper 호출을 명시했다. 기존 evidence producer와 launcher를 재사용했다. 검증 코드·fingerprint 범위·CI·의존성 lockfile은 변경하지 않았다.

- 원격을 갱신하니 DS 후속 작업 PR #236은 이미 병합돼 있었다. 기준은 `origin/main`의 `5d5f39e`다.
- 소비 프로젝트: `/Users/jinhokim/dev/digging-n-ditto`.
- 작업 디렉터리: `/Users/jinhokim/.codex/worktrees/digging-verify-evidence/digging-n-ditto`.
- 로컬 branch: `codex/verify-evidence-entrypoint`, commit: **`893aa495638114ae37ccb59d90ff2e4aaa6e9bca`**.
- 변경 파일: `.codex/ship-flow.config.json`, `docs/paul-loop-installation.md` 두 개.
- canonical checkout의 기존 변경과 절대 경로 prefix override는 보존했다. 이 수정은 아직 canonical/설치판에 반영되지 않았으며 push·PR·merge는 하지 않았다.

```text
node tools/paul-loop.mjs exec bin/verdict-run.sh -- pnpm verify:evidence
  → scripts/verify-root-evidence.mjs
  → ROOT_EVIDENCE_GENERATION=1로 기존 전체 pnpm verify 실행
  → 자식 exit와 시작/종료 fingerprint를 검사해 root receipt 기록
  → verdict-run이 해당 exit에 따라 로그·판정 기록
```

generation 변수는 정식 producer가 소유한다. 전체 검사와 다른 runtime/visual receipt의 freshness 조건은 그대로다. 이번 수정은 root receipt의 생성 순서를 정렬하며, 다른 receipt의 재생성이나 모든 직접 shell 호출의 자동 강제를 해결하지 않는다.

## 진입점 수정 당시 확인한 증거

| 검사 | 관측 | 해석 범위 |
|---|---|---|
| portable launcher `doctor` | exit 0; engine `0.15.0+zine.1`, ship-flow `0.11.0+zine.1`, 둘 다 enabled | shell Codex `0.146.0`과 실제 cache manifest 일치. native hook trust는 미검증 |
| `pnpm verify:workspace` | 기존 8 tests PASS, exit 0 | workspace·CI 선언·fingerprint 회귀 계약 |
| 실제 설치 wrapper → 같은 workspace 검사 | `VERDICT: PASS`, `EXIT: 0`, passed=8 | launcher에서 설치된 wrapper로의 실행 및 판정 기록 |
| 설정의 전체 검증 명령 → 실제 producer | DB 입력 누락으로 preflight exit 1 → `ROOT_VERIFY_FAIL` → `VERDICT: FAIL`, `EXIT: 1` | 실패가 producer·wrapper를 거쳐 보존됨. full runtime PASS 아님 |
| 구현 fingerprint | 변경 전후 `008a2538ba936d0962f992b5f6d3b6f30408c46c94e357183be7ddf3401ee117`, 765 files 동일 | 설정·설치 문서 변경이 구현 receipt 범위를 바꾸지 않음 |
| diff 검사 | `git diff --check` PASS, 의도한 두 파일만 commit | provider runtime 코드는 이번에 변경하지 않음 |

실행 환경은 Node 22.19.0, pnpm 10.14.0이다. 새 worktree에는 처음에 `pg` 등 의존성이 없어 preflight import가 실패했다. `pnpm install --frozen-lockfile --offline`으로 기존 cache의 725 packages를 준비했으며 다운로드와 lockfile 변경은 없었다. pnpm이 `unrs-resolver` build script를 차단한 상태도 유지했다.

이후 전체 명령의 실패 전달 확인 전 DB 관련 환경 입력과 `web/.env*`가 없음을 확인했다. 실제 실패는 `FULL_VERIFY_PREFLIGHT_FAIL missing=DATABASE_URL,CUTOVER_TEST_DATABASE_URL|TEST_DATABASE_URL,CUTOVER_TEST_TARGET_ID`다. DB 연결·reset·migration이나 browser/build 단계에는 진입하지 않았다. 같은 실패로 전체 검증을 반복하지 않았다.

첫 doctor 호출은 PATH에서 `/opt/homebrew/bin/codex`를 먼저 선택해 timeout이었다. `/Users/jinhokim/.local/bin/codex` 0.146.0을 먼저 선택한 뒤 성공했다. 시스템 PATH·설치·launcher의 버전 허용 범위를 바꾸지는 않았다. 앱 내장 0.155 계열까지 launcher 호환성을 검증한 결과가 아니다.

## 보존한 로그와 한계

소비 worktree의 `.loop/entrypoint-check/`에 원본을 보존했다. 이 디렉터리는 로컬 untracked 상태이며 commit하지 않았다. 실패 실행이 새로 쓴 tracked `root-verify.txt`는 별도 실패 기록을 보존한 후 실행 전 바이트로 복원했다. 복원한 기존 receipt를 이번 작업의 PASS 근거로 사용하지 않는다.

| 파일 | SHA-256 |
|---|---|
| `workspace.log` | `fc7233d0509840ecb79125a1d9920fbe715c639260bb5e96b9952704706bc609` |
| `configured-command.log` | `0feef7c6db64ef84817e3a032f3c9bf5e9ddda322e055a9617b370cf3c2d11a6` |
| `root-verify-failed.txt` | `0ff52bb423d46e59890b38c6d04391de12a538bcebafe7de8d23c7458b2fcccb` |

이 시점의 후속 작업은 disposable 환경에서 같은 최종 명령을 실행하는 것이었다. 아래에 실제 실행 결과를 추가했다. 기존 CI의 raw `pnpm verify`와 앱 host launcher 호환성은 별도 미정렬 경로로 남아 있다. 이번 결과만으로 14시간 문제 해결, 실행 속도 향상, loop-memory 효용을 주장하지 않는다.

## 전체 검증 후속 실행

사용자의 검증 요청에 따라 같은 consumer commit `893aa49`에서 실행했다. 원격을 다시 확인했으며 `origin/main`은 `5d5f39e`로 동일했다.

1. 다른 서비스의 DB를 사용하지 않고 PostgreSQL 17 임시 cluster 두 개를 생성했다. `127.0.0.1:55439`에는 `ddt_cutover`와 새 build DB, `55440`에는 mobile 검증용 DB 두 개를 준비했다.
2. 기존 read-only preflight가 exact target·role·server port·live rows 0을 확인해 **PASS**했다. build DB도 읽기 전용 transaction에서 새 DB·role·port·빈 public schema를 확인한 후 기존 migration을 실행했다.
3. 먼저 기존 `test:runtime-verifier-freshness`를 실행해 **9개 중 6 PASS / 3 FAIL**을 확인했다. 뒤에 연결한 legacy/club 개별 검사는 앞 명령 실패로 실행되지 않았다.
4. 실제 설정 경로의 최종 판정을 확인하기 위해 `verdict-run.sh -- pnpm verify:evidence`를 **한 번** 실행했다. **138,358 ms**, `ROOT_VERIFY_FAIL`, `VERDICT: FAIL`, exit **1**로 종료했다. 같은 실패로 다시 실행하지 않았다.

| 실패 | 확인한 차이 |
|---|---|
| legacy fixture가 현재 origin/main에 연결되는지 | fixture `042730c…` / 현재 main `5d5f39e…` |
| fixture를 캡처한 시점과 현재 production source가 같은지 | captured 248 files / current 251 files; digest 불일치 |
| runtime PASS receipt가 현재 구현을 가리키는지 | `ds-04` receipt의 baseline이 이전 `042730c…`로 남음 |

해당 fixture·검증 코드·DS receipt는 `origin/main`과 바이트 차이가 없다. 이번 변경 두 파일은 구현 fingerprint에 포함되지 않으며, 실행 시작·종료도 `008a2538…01ee117`, 765 files로 동일했다. 따라서 이 실행에서 확인한 기준 자료 불일치는 진입점 수정으로 새로 바뀐 제품 코드에서 발생한 것이 아니다. 이전 기준 이후 product source에는 offline shell·route·style 등 실제 변경이 있으므로 SHA만 새 값으로 덮어써서 해결할 수 없다.

별도 읽기 전용 목록에서는 DS receipt 두 개, canonical visual receipt 11개, integration receipt 한 개 모두 현재 구현 digest를 포함하지 않았다. **14개 각각의 browser 실행이 실패했다는 의미는 아니다.** 전체 명령은 design-system의 freshness 검사에서 중단됐으며, 뒤의 Next production build·PostgreSQL contract·browser runtime·prototype full·mobile final·최종 route matrix에는 도달하지 못했다.

ESLint는 errors 0 / warnings 14로 종료했다. wrapper가 `✖ 14 problems`를 `FAIL:` 후보로 추출했지만 이것은 이번 종료 원인이 아니다. wrapper의 summary `passed=6 failed=3`도 마지막 freshness suite의 수이며 전체 누적 검사 수가 아니다.

원본은 소비 worktree `.loop/full-verification/`에 보존했다. `result.json`, `root-verify.log`, `root-verify-failed.txt`, `verdict.txt`, preflight·migration·focused 검사 로그와 receipt 목록이 있다. 기존 tracked root receipt는 실패 원본을 따로 보존한 뒤 원래 바이트로 돌렸으며, 기존 PASS 표식을 이번 실행의 증거로 사용하지 않는다. 검증을 위해 만든 두 PostgreSQL cluster는 종료했고 두 포트의 listener가 없음을 확인했다. 임시 데이터 디렉터리는 보존했다.

**당시 다음 필요한 수정:** 현재 제품 변경을 검토해 legacy/club 기준 자료를 정식 producer로 다시 관찰·캡처하고, 필요한 visual/integration receipt를 함께 갱신한 후 같은 전체 명령을 재실행하는 것이었다. [후속 실행 기록](2026-09-22-digging-baseline-refresh.md)에 실제 결과와 새 중단 지점을 저장했다. 이 이전 실행에서는 기준 snapshot·verifier·테스트를 변경하거나 완화하지 않았다. full PASS·독립 리뷰·PR·merge는 여전히 미완료다.
