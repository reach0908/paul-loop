# 선택적 위험 규칙과 머지·배포 승인 유지

사용자가 #107 머지를 알리고 다음 자체 개선을 요청했다. 기준 커밋은
`24f98f5ab2a457ee4b449c415d05cc93db7636c4`이며 provider source의 별도 worktree에서 수정한다.
이번 source 후보는 loop-engine 0.15.4다.

## 문제와 수용 기준

`gate-risky-commands.mjs`가 선택 사항인 프로젝트 `risk-rules.json`을 항상 `--rules`로
전달했다. 파일이 없는 정상 프로젝트에서도 분류기가 exit 2를 반환해, 사람 승인 안내 대신
플러그인 재설치 안내가 나왔다. 또 단계 정보가 없어 낮은 위험의 사용자 규칙이 머지·배포를
AUTO로 만들 수 있었다. 기존 분류기의 설정 탐색과 human-only stage 정책을 재사용한다.

1. 선택적 기본 규칙이 없으면 gh PR merge, pnpm deploy/redeploy, deploy 경로 실행을
   정상 분류한다. Claude의 일반 permission mode에서는 REQUIRE → ask를 반환한다.
2. 명시적 `CLASSIFY_RISK_RULES`가 프로젝트 기본값보다 우선한다. 기본 파일과 상대 환경변수
   경로는 훅을 시작한 디렉터리가 달라도 `CLAUDE_PROJECT_DIR`를 기준으로 읽는다.
3. merge/deploy 단계를 분류기에 전달해 낮은 위험 규칙도 사람 승인 요구를 없애지 못한다.
   분류기의 위험도 정책을 훅에 복제하지 않는다.
4. 명시한 파일 누락, 잘못된 JSON, 디렉터리, 끊어진 기본 symlink는 계속 deny다.
   공유 분류기도 끊어진 기본 symlink를 규칙 없음으로 취급하지 않는다. 오류 안내는
   규칙 설정과 분류기 runtime을 확인하도록 하고 원문 설정 내용을 출력하지 않는다.
5. 평범한 deploy 문서 읽기는 defer, 셸 실행·복합 명령·리다이렉션은 기존 승인 요구를 유지한다.
   bypassPermissions와 Codex 어댑터에서는 deny를 유지하며 반복 호출도 승인을 기록하지 않는다.

## 범위와 한계

서버 보호, 실제 머지·배포 승인, 토크나이저의 기존 감지 범위는 바꾸지 않는다.
원래 checkout과 설치된 캐시를 수정하거나, 실제 실행 거절을 다른 경로로 우회하지 않는다.
fixture는 명령을 훅의 입력 데이터로만 전달한다. 실제 gh merge/pnpm deploy는 실행하지 않는다.
provider/어댑터 subprocess 검증은 native host 설치·신뢰나 소비 프로젝트 활성화를 증명하지 않는다.
loop-memory 인프라나 다른 프로젝트의 설정은 이 변경의 대상이 아니다.

## 검증 기록

로그는 `.loop/risk-defaults/`에 저장한다. 최초 회귀에서 기본 규칙 부재가 status 2와 deny로
재현됐다(`red.log`). 수정 후 기존 읽기/실행과 선택적 규칙, 환경변수 우선순위, 낮은 위험 규칙,
설정 오류, Codex 반복 거절을 포함한 집중 회귀 4개 그룹은 PASS다(`focused.log`).
기존 classifier 규칙 회귀 11개도 PASS다(`classifier.log`).

생성 패키지 재현 비교, skill lock 일치, strict marketplace/engine manifest 검사는 PASS다.
생성된 Codex 패키지의 실제 어댑터 subprocess에서도 규칙 부재 시 merge/deploy의 승인 거절과
평범한 문서 읽기 defer를 확인했다(`generated-adapter.log`).
전체 engine은 **81/81, VERDICT PASS / EXIT 0**, 428,599ms로 완료됐다(`engine.log`,
`engine.verdict`). 내부 BAC-580 memory-source probe는 tsx 부재로 SKIP이며 PASS로 취급하지 않는다.
최종 head CI 결과는 이 변경의 PR에 남긴다.

### Standards

미해결 finding 0건. staged 9개 파일과 관련 분류·승인 경로를 독립 정적 검토했다.
문서화된 기준 위반이나 조치가 필요한 heuristic 코드 냄새는 발견하지 못했다.

### Spec

미해결 finding 0건. 수용 기준 1~5와 diff, 집중 회귀 4개 그룹 및 classifier 11개 PASS 로그를
독립 대조했다. 별도의 전체 suite나 소비자 설치 검증을 반복하지 않았다.

## 앞선 배포와 현재 실행 환경

#107의 tag-on-publish run `35743981059`는 SUCCESS이며 `loop-engine--v0.15.3` 태그가
`24f98f5ab2a457ee4b449c415d05cc93db7636c4`를 가리킴을 원격 조회로 확인했다.
이번 0.15.4 후보는 별도 PR로 제공한다. 머지·태그 발행·설치된 runtime 갱신은 각각 별도 증거가
필요하며, 기존 설치 훅의 실행 거절을 provider 검증 성공만으로 해제된 것으로 취급하지 않는다.
