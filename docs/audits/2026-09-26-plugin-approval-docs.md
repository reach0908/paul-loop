# 플러그인 승인값 안내 보완

기준: #127 merge `c227062ecf3af0bee10b6c52df58951df4deda33`.
사용자가 승인한 범위는 설치·진단 문서의 P2 불일치 수정, 임시 검증, PR 작성이다.

## 변경

- Codex 설치 안내의 오래된 id/version-only lock 예제를 제거하고 기존 프로젝트 lock
  계약으로 연결했다. 설치에 쓴 검토된 build의 `codex/plugin-integrity.json`에서 각 core의
  version과 전체 integrity를 가져오도록 명시했다. 설치 cache에서 승인값을 만들지 않는다.
- 호환성 문서는 경로 registry와 승인 lock을 구분하고 누락 시 실패함을 설명한다.
  소스 진단 예제는 독립적으로 승인한 전체 커밋을 `LOOP_ENGINE_COMMIT`으로 전달한다.
  placeholder 교체, 일치하는 checkout, canonical origin이 선행 조건이다.
- 생성 패키지에도 포함되는 호환성 문서의 계약 링크는 이동 후에도 열 수 있는 provider
  URL을 사용한다. 실제 승인 검사·실행 코드·테스트·CI·버전은 변경하지 않았다.

## 실행한 확인

검증용 provider clone은 위 merge 커밋에 고정하고 canonical origin을 설정했다.
소비자와 HOME/CODEX_HOME, 생성물은 모두 별도 임시 디렉터리에 두었다.

| 확인 | 결과 |
|---|---|
| 수정된 문서의 source probe에 위 커밋 전달 | 종료 0, `problems: []` |
| 같은 probe에서 commit 전달만 생략 | 기대한 종료 1, 승인 누락 오류 유지 |
| 검토한 생성물의 core 승인값으로 lock 작성 후 문서의 launcher doctor 실행 | 종료 0, 두 core의 파일 지문 검증 |
| 같은 launcher의 `exec bin/runtime-doctor.mjs` | 종료 0, `problems: []` |
| `node --test tools/loop-engine/test/runtime-packages.test.mjs` | 11 passed, 0 failed, 0 skipped |
| `node scripts/generate-runtime-packages.mjs` 및 `--check` | 둘 다 종료 0 |
| `node scripts/refresh-skill-lock.mjs --check` | 종료 0 |
| `git diff --check` | 종료 0 |

설치 경로의 CLI 응답은 임시 listing stub이었다. 실제 Codex 설치·활성화·consumer 상태는
변경하지 않았으며 native E2E라고 주장하지 않는다. 패키징 검사는 수정된 두 문서가 있는
임시 checkout에서 실행했고, 생성한 후보 지문을 배포 승인값으로 사용하지 않았다.

실행 코드가 바뀌지 않아 로컬 전체 engine/memory suite는 반복하지 않았다. 최종 커밋의
hosted checks는 PR에서 별도로 확인한다. 이 문서 수정과 일반 호환성 검증은 #127에서
중단된 전문 보안 리뷰를 완료하거나 그 판단을 대체하지 않는다.

직접 diff 검토에서 새 진단 명령이 HEAD를 자동 승인하지 않는지, 승인값의 출처가 설치에
사용한 검토된 build인지, 기존 검사가 그대로 실패를 유지하는지 확인했다. 독립 리뷰라고
주장하지 않는다. 3개 문서 경로의 구현 분류는 AUTO, docs-only, low/full/low였다.
