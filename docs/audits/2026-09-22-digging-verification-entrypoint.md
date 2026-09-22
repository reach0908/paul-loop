# Digging의 ship-flow 검증 진입점 정렬

기준: 2026-09-22 KST. [장기 실행 진단](2026-09-22-long-run-diagnosis.md)의 소비 프로젝트 후속 작업이다.

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

## 실제 확인한 증거

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

남은 작업은 검토 가능한 disposable DB/runtime 입력을 준비한 환경에서 필요한 receipt의 freshness를 먼저 확인하고 이 **같은 최종 명령을 한 번 완주**하는 것이다. full 검증·독립 리뷰·PR·merge는 미완료다. 기존 CI의 raw `pnpm verify`와 앱 host launcher 호환성은 별도 미정렬 경로로 남아 있다. 이번 결과만으로 14시간 문제 해결, 실행 속도 향상, loop-memory 효용을 주장하지 않는다.
