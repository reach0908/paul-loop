# AC artifact 경로 제한 (#102)

기준: main `7867af8f4545695e7ce0ec9642b78b7957df1c5b`, engine 0.15.6 배포 완료.
사용자의 “다음 작업 진행해줘”와 기존 provider 개선·PR 발행 권한으로
[#102](https://github.com/reach0908/paul-loop/issues/102)를 처리한다.
소비 설치·DB·native config와 기존 canonical main의 거부된 fast-forward는 변경하지 않는다.

## 수용 기준

1. artifact의 절대 경로·parent segment·물리적 symlink 탈출은 존재 검사와 내용 검색 모두 FAIL.
2. invocation CWD의 물리적 경로를 경계로 고정한다. plan 위치는 경계에 영향을 주지 않는다.
   내부 symlink·디렉터리·한글/공백 경로·복수 artifact·verify가 생성한 파일을 지원한다.
3. 디렉터리 검색 중 외부 링크도 거부하고, 먼저 문자열을 발견해도 나머지 선언과 경로를 검사한다.
   순환 링크는 반복 탐색하지 않는다. 파일은 nofollow FD의 종류 확인과 동일 FD 읽기를 사용한다.
4. verify가 있으면 expect는 명령 log만 검색한다. AC 집계·단일 Verdict block·상태 파일·기존
   zero-contract/zero-test/실패 조건을 유지한다. 기존 assertion을 완화하지 않는다.
5. focused RED/GREEN, engine 전체, base 고정 검사, 생성 재현·manifest, 독립 Standards/Spec
   리뷰와 PR head CI를 확인한다. engine만 0.15.7 후보로 갱신하며 merge는 사용자에게 남긴다.

## 변경과 한계

기존 Bash의 존재 검사와 recursive grep이 각각 raw artifact 경로를 사용했다.
단일 Node helper가 존재·경계·내용 검색을 담당하도록 두 경로를 묶는다.
기존 protected-file helper는 디렉터리와 내부 symlink를 허용하지 않아 이 계약에 재사용하지 않는다.
새 외부 의존성이나 범용 파일 저장 프레임워크는 추가하지 않는다.

기존 CWD-relative 의미를 유지하므로 호출자는 원하는 worktree root에서 실행한다.
Git이 없는 디렉터리도 지원하며, 절대 경로와 모든 `..` segment는 내부 파일이어도 거부한다.
comma-only 목록도 더 이상 빈 검사를 PASS로 만들지 않는다. 내부 symlink는 계속 허용한다.
`verify:` 자체는 임의 shell 명령이며 이번 변경이 sandbox를 제공하지 않는다.
hard link 또는 같은 OS 권한의 프로세스가 상위 디렉터리를 동시에 바꾸는 공격의 완전한 격리는
주장하지 않는다. literal 검색은 한 파일씩 buffer에 읽으므로 대용량 산출물의 memory 한계가 있다.

## 재현과 검증

- RED: 임시 worktree의 sibling 파일을 절대 artifact로 지정한 기존 구현이 실제 PASS/exit 0을
  반환했다. 새 회귀는 FAIL/exit 1을 요구해 실패했다. 폐기 가능한 fixture 밖 데이터는 사용하지 않았다.
- GREEN: 절대·parent·외부 leaf/ancestor 경로, recursive 외부 symlink, 일치 파일 뒤의
  잘못된 artifact, 비어 있는 목록을 FAIL 처리한다. 내부 링크·순환·공백/한글 파일·생성 파일,
  verify-log 전용 expect, 단일 Verdict block과 상태 파일 일치 검사를 통과했다.
- open 직전 실제 leaf를 외부 symlink로 교체하는 preload probe에서 외부 read 없이 FAIL이었다.
  호출 경계 자체가 symlink로 바뀐 경우에도 helper가 새 위치를 경계로 채택하지 않았다.
- 구현 커밋 `9ca6d40`의 engine 전체 **81/81, exit 0**, base `7867af8` 고정 검사 **PASS, exit 0**.
  선택적 BAC-580 memory probe는 tsx 부재로 SKIP이며 실제 memory 검증으로 계산하지 않는다.
  `FAIL: mktemp -d failed` 출력은 실패 주입의 기대 결과이고 해당 회귀는 PASS다.
- runtime 패키지 생성·재현, vendor lock, strict manifest 3개(source marketplace/engine/generated
  Claude marketplace), 변경 문서의 로컬 링크와 diff 공백 검사 통과. 새로운 native 모델 호출은 없다.
- 위 로컬 검증 후 변경은 감사 문서뿐이다. 최종 PR head CI는 발행 후 해당 PR의 checks와
  `.loop/ac-artifacts/final-ci-receipt.json`으로 확인한다. 로그는 `.loop/ac-artifacts/`에 보존한다.
- 새 경로 회귀는 기존 `ac-verify.test.sh`에서 실행하므로 전체 suite에도 포함된다.
- 선행 배포 근거는 [engine 0.15.6 기록](2026-09-23-loop-engine-0.15.6-release.md)에 보존한다.

## 독립 리뷰

Standards: 문서화된 기준 위반과 actionable smell 0건. 공통 경계 검사, 같은 FD 읽기,
기존 집계 흐름과 격리 한계의 명시를 확인했다. Spec: actionable finding 0건.
별도 임시 probe에서 먼저 일치한 파일 뒤의 외부 symlink와 plan 폴더에만 존재하는 파일이
FAIL이었고, PASS/FAIL/설명-only AC 집계는 passed=1 failed=1 skipped=1 및 상태 FAIL과 일치했다.
리뷰가 전체 suite·CI·소비 환경 검증을 대신하지 않으며 reviewer는 이를 반복 실행하지 않았다.

## 권한과 발행 경계

예정 10개 경로의 구현 classifier는 AUTO/standard다. 기존 자체 개선 요청 범위의 가역 수정이다.
최종 10개 경로와 실제 push/PR 명령의 classifier는 명령 규칙 부재로 REQUIRE/standard다.
분류를 AUTO로 바꾸지 않는다. 사용자의 기존 “배포도 알아서 진행하고 개선점들도 계속해서 개발
진행해줘”와 이번 다음 작업 요청을 동일 provider의 `codex/paul-loop-ac-artifacts` → `main`
PR 준비·발행에 재사용한다. merge·소비 설치 교체·보호 설정 변경에는 확장하지 않는다.
