# 2026-09-22 — ship-flow 경량화 구현과 검증

> 2026-09-22 당시의 조사·실행 기록입니다. 당시의 미완료 상태와 다음 작업은 현재 상태가 아닙니다.
> 최신 구현·배포·후속 순서는 [09-23 상태표](2026-09-23-roadmap-status.md)를 따릅니다.
> 원본 출처·편집 범위·비공개 관측 자료는 [보존 목록](2026-09-23-research-archive.md)에 기록했습니다.

상태: 로컬 변경. 브랜치 `codex/paul-loop-research-simplify`, 기반 `791d43b297aefa0c0ba158f6355377dfc2dbf7eb`.
종합 판단과 후속 계획: [조사 보고서](2026-09-22-paul-loop-research-and-roadmap.md).

## 변경

- Matt Pocock upstream `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`에서 triage의 기존 동작 확인과 prototype의 HTML 로직 검토 경로를 선택적으로 반영했다.
- TDD와 코드 리뷰에 재사용·표준 기능·플랫폼 우선, 실제 호출자 조사, 현재 요구에 필요한 최소 구현을 넣었다. 보안·입력 검증·접근성·필요한 회귀 검사 예외를 명시했다.
- ship-feature에 중복된 승인·출판 설명을 기존 `AUTHORIZATION.md`와 `PUBLISH-HANDOFF.md`로 연결했다. planner, AC, runtime 검증, 세 종류 리뷰, risk classifier, merge 경계와 종료 조건을 유지했다.
- 필요한 lesson 증거를 producer worktree 삭제 전에 보존하도록 했다. 다른 root로 receipt를 복사하는 것을 검증 승계로 인정하지 않는다. 영구 이관 프로토콜은 후속 설계다.
- README에서 기존 기능의 가장 작은 진입 경로와 사용 관측법을 설명하고, 현재 CLI가 받아들이지 않던 verified lesson 예시를 `--signature-file`과 FAIL/PASS receipt로 바로잡았다.
- vendor fork 사유와 변경 skill hash를 갱신했다.
- 저장소의 publish-freshness 계약에 따라 ship-flow manifest/marketplace를 **0.11.1**로 올리고 changelog와 현재 버전 설명을 맞췄다. engine 0.15.0, memory 0.7.0은 유지한다. 새 버전 표기는 배포 사실이 아니다.

ship-feature의 공백 기준 단어 수는 **4,537 → 3,723 (17.9% 감소)**, UTF-8 크기는 **30,284 → 25,222 bytes (16.7% 감소)**다. 토큰·지연·개발 비용을 실측한 수치가 아니다. 해당 skill을 로드하지 않는 작업의 context 절감도 주장하지 않는다.

## 검증 결과

| 검사 | 결과 | 범위 |
|---|---|---|
| Engine 전체 `bash tools/loop-engine/test/run.sh` | **80/80 PASS, exit 0** | frozen test entry를 쓰는 기존 전체 suite, 검사 수정 없음 |
| Memory `npm ci` | PASS | lockfile 기반 개발 의존성 설치, 외부 DB 활성화 없음 |
| Memory `npm run typecheck` | PASS | TypeScript 검사 |
| Memory `npm test` | **16 files, 159 PASS / 2 SKIP** | 두 SKIP은 `LOOP_EMBED_LIVE=1`인 경우만 실행하는 실제 embedding API 검사 |
| Memory `npm run build` | PASS | 재생성한 `dist/cli.js`가 HEAD 파일과 byte-identical |
| Runtime package 생성 + `--check` | PASS | 최종 0.11.1 manifest와 문서 변경 포함 |
| `refresh-skill-lock.mjs --check` | PASS | 등록 skill의 로컬 content hash |
| Claude marketplace/plugin `validate --strict --json` | PASS, 경고 0 | marketplace와 ship-flow manifest. native 실행 효용의 증거 아님 |
| `git diff --check` | PASS | 변경 파일 whitespace 검사 |
| 독립 코드 리뷰 | 추가 actionable finding 없음 | spec 축과 standards 축. 아래 발견·수정 기록 참조 |

실행 환경은 macOS, Node **22.19.0**, 시스템 Bash **3.2**, Homebrew Python **3.13**이다. 테스트용 PATH는 다음과 같다. 시스템 Python의 Xcode 라이선스 문제를 피하기 위해 설치된 인터프리터를 선택했으며 라이선스 수락·시스템 설정 변경은 하지 않았다.

```sh
export PATH=/opt/homebrew/opt/python@3.13/libexec/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
bash tools/loop-engine/test/run.sh
node scripts/refresh-skill-lock.mjs --check
node scripts/generate-runtime-packages.mjs
node scripts/generate-runtime-packages.mjs --check
```

## 발견하고 수정한 문제

1. spec 리뷰에서 HTML 선택지를 추가하고도 host 언어와 별도 module import를 필수로 읽히게 하는 문서 충돌을 발견했다. terminal과 HTML의 실행·모델 경계를 나누어 수정했고 리뷰어가 해결을 재확인했다.
2. 첫 engine 전체 실행은 **77/80**이었다. explicit `hard termination` 문구 누락 1건과 시스템 Python이 Xcode 라이선스를 요구한 2건이었다. 문구와 실행 환경을 고쳤으며 테스트 기대값은 바꾸지 않았다.
3. 두 번째 전체 실행은 **79/80**이었다. 남은 실패는 변경된 ship-flow가 기존 공개 버전 0.11.0과 같다는 publish-freshness 검사였다. manifest/marketplace/changelog를 0.11.1로 맞춘 후 전체 검증을 다시 실행했다.
4. 마지막 spec 재검토는 종료 조건과 worktree 증거 보존 지침에 추가 finding이 없었다. 두 리뷰는 workflow·README·lock 등 최초 10개 파일의 정적 변경을 대상으로 했다. 뒤에 추가한 release metadata는 manifest/runtime 검사를 적용했다. 실제 모델의 instruction following을 검증한 것은 아니다.

테스트 로그에 의도적으로 유도한 `FAIL: mktemp -d failed`가 출력되는 fixture가 있다. 문자열 검색만으로 suite 성공을 판정하지 않고 프로세스 exit와 runner의 최종 집계를 사용한다.

## 의존성과 검증 한계

`npm audit --omit=dev`는 관측 시점 advisory 0이었다. 전체 audit에는 **moderate 2개**(vitest와 @vitest/mocker, 같은 advisory)가 남았다. 이번 기능·문서 변경과 독립적이며 의존성을 강제 업그레이드하지 않았다. 이 결과는 보안 감사나 출시 승인과 다르다.

DB integration suite(`*.integration.test.ts`), 실제 embedding API, 소비 프로젝트의 native hook/실제 모델 세션, 성능 A/B, release CI·설치·배포는 수행하지 않았다. 특히 provider 검사 PASS를 loop-memory 효용 또는 소비자의 활성화 증거로 쓰지 않는다.

## 로컬 증거 위치

아래 로그는 이 실행 호스트의 임시 파일이며 영구 보존을 보장하지 않는다. 검증 결과와 한계는 이 문서에 남긴다.

- Engine 최종: `/tmp/paul-loop-engine-20260922-verified.log`
- Engine 이전 실패: `/tmp/paul-loop-engine-20260922.log`, `/tmp/paul-loop-engine-20260922-final.log`
- Memory 설치/검사: `/tmp/paul-loop-memory-install-20260922.log`, `/tmp/paul-loop-memory-check-20260922.log`
- Dependency audit: `/tmp/paul-loop-memory-audit-20260922.json`, `/tmp/paul-loop-memory-audit-all-20260922.json`
- Runtime: `/tmp/paul-loop-packages-final-20260922.log`
- Aside 수집 원문/분석: `/tmp/paul-loop-aside-20260922.log`, `/tmp/paul-loop-aside-followup-20260922.log`
- 소비 프로젝트 집계: [2026-09-22-consumer-usage.json](2026-09-23-research-archive.md#private-evidence). credential·prompt·환경변수 값·DB 레코드는 수집하지 않았다.

최종 증거 SHA-256:

| 파일 | SHA-256 |
|---|---|
| Engine 최종 로그 | `85ac32f611f13a792d5d879ab8678da373701485a3374ce69e10463f7cec86c7` |
| Memory 검사 로그 | `f18ea80011d3b8b8e8f62cb6823247a10dbed47cb76771ac314d4c014cf9ea60` |
| Runtime 생성/검사 로그 | `8ec67c8a4f7105b6f318758aec39cf3183cf7d676d1476aa8605bf3de60d8a56` |
| 소비 프로젝트 집계 JSON | `3e281765ef0be71b8ba110928443439a21331832e1f57facc22b2508c79faf74` |
