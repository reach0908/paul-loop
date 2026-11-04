# 남은 실사용 검증의 선행 조건

관측: 2026-09-28 09:38 KST. Provider 기준 `faaed5711f864555a32181011840dea244c9e964`.
로컬 점검 기록이며 새 PR·런타임 변경·배포는 없다. 열린 #35·#87을 완료로 판정하지 않는다.

## #35: 다음 실제 수정 작업에서 근거 수집

기존 프로젝트 목록에 남아 있는 체크아웃의 기본 `.loop/evidence/*.json`을 읽었다.

| 프로젝트 | 존재하는 체크아웃 | verification 영수증 | FAIL / PASS | 비어 있지 않은 run_id |
|---|---:|---:|---:|---:|
| Rabbit Hole | 1 | 1 | 0 / 1 | 0 |
| Digging | 12 | 95 | 45 / 50 | 0 |
| Signal Feed | 8 | 0 | 0 / 0 | 0 |
| paul-loop | 11 | 5 | 0 / 5 | 0 |

읽기·JSON 해석 오류는 0건이다. 소비 프로젝트의 96건은 실행 ID가 없어 현재 verified lesson
계약에서 같은 수정 작업의 FAIL→PASS 쌍으로 인정할 수 없다. 영수증 수는 독립 결함 수가 아니다.
Digging의 영수증은 9월 22–27일에 생성됐다. 파일을 고쳐 과거 영수증을 승격하지 않는다.

각 소비 프로젝트의 기본 Codex/Claude lock 경로도 확인했다. Digging의 Codex lock만 존재하며
engine `0.15.0+zine.1`, ship-flow `0.11.0+zine.1`을 선언한다. 이는 실제 로드된 버전의 증거가
아니고, lock이 없는 프로젝트도 플러그인 미설치로 판정할 수 없다. 설치·설정은 변경하지 않았다.

다음 단계는 사용자가 지정하는 진행 중인 프로젝트의 실제 실패 한 건에
[기존 수집 절차](../verified-lesson-workflow.md)를 적용하는 것이다. 동일 verifier와 새 실행 ID로
FAIL→수정→PASS를 보존하고, 나중에 자연스럽게 재발할 때 조회·활용·독립 검증을 관측한다.
현재 확보한 [과거 결함 재현](2026-09-28-file-lesson-replay.md)은 실사용 효용 표본에 포함하지 않는다.
이 파일 교훈 경로의 성공도 별도 loop-memory의 의미 검색 효용을 입증하지는 않는다.

범위는 기존 목록의 기본 경로뿐이다. 새 worktree 탐색, 사용자 지정 LOOP_DIR, DB, native memory,
소비 프로젝트의 실행 명령은 포함하지 않는다. 전체 사용 여부나 생산성 효과는 판단할 수 없다.

## #87: 호스트 조건이 바뀐 뒤 실제 Git 검증

현재 Codex CLI는 `0.155.0-alpha.16.4`로 [기존 Git 거부 관측](2026-09-27-native-git-routing.md)과
같다. 이번 세션의 도구에는 등록된 `publisher` 역할을 지정하는 기능이 노출되지 않는다.
생성 템플릿은 여전히 `workspace-write`를 요구한다. 상위 세션의 넓은 권한은 그 조건의 증거가 아니다.

읽기 전용 help/기능 조회에서 재검증을 정당화할 선행 조건 변화는 확인하지 못했다. `.git/FETCH_HEAD`
쓰기 거부 이후의 Git 시도를 반복하거나 권한 확대·메타데이터 이동·다른 도구로 대체하지 않았다.
등록된 역할, 새 대화(`fork_turns=none`), 실제 요구 권한을 제공하는 호스트가 준비되면
[기존 native 평가](2026-09-27-publisher-capability.md)를 재사용해 실제 Git 결과를 검증한다.

로컬 집계 근거: `.loop/native-eval/remaining-readiness-2026-09-28/receipt.json`.
목록 원본 SHA-256: `d8e3dda4fdc64c85b95d543a579d56227b3d4577aad065ae5908f7bedb3fb83a`.
