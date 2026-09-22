# Native 평가의 사용자 스킬 격리

기준 source: `f3ee6a5cfef8c9ee996f4ff081be50c7d848e341` (#109 merge).
사용자의 “머지했어. 다음 작업 진행해줘”에 따라 이전 관측에서 드러난 전역 스킬 혼입과
PR fixture 선행 조건을 통제한다. 소비 프로젝트·설치 캐시·전역 설정 변경은 포함하지 않는다.

## 범위와 수용 기준

1. 공통 Codex adapter가 사용자 `.agents/skills`의 실제 `SKILL.md` 경로를 수집하고,
   해당 실행에만 native `skills.config` 제외 설정을 전달한다. 심볼릭 링크·순환·없는
   디렉터리를 처리하며 원본 스킬과 전역 config/auth/trust를 수정하지 않는다.
2. plugin target과 bare grader/reviewer가 같은 제외 경로를 사용한다. 설정 전달은
   실제 카탈로그 검증과 구분하고, target metadata에 요청한 제외 경로를 보존한다.
3. 실제 native 기록에서 전역 스킬 제외와 생성 ship-flow 카탈로그 보존 여부를 확인한다.
   PR fixture는 준비 상태·Git 권한·독립 역할 도구의 유무를 명시한다. timeout·도구 부재를
   완료나 성능 향상으로 승격하지 않는다.
4. 이전 관측과 원장은 덮어쓰지 않는다. 새 공유 예산 600,000ms 안에서 bare 카탈로그,
   진단, 준비된 PR 사례만 실행한다. 사례 제한은 60,000/180,000/180,000ms다.
5. 기존 native 테스트 전체, 생성 runtime/lock 검사와 독립 검토를 마친다.
   engine/memory 구현·verifier·배포 payload는 변경하지 않는다.

## 결과

사용자 스킬 제외는 실제 부모·자식 카탈로그에서 확인했다. **전체 평가 환경의 동질성은 아직
확보되지 않았다.** PR 자식에서 별도의 curated plugin 카탈로그가 추가됐으며, PR 작업도
완료되지 않았다. 4쌍 성능 비교는 이 두 조건을 정리한 뒤 진행한다.

| 사례 | 프로세스 관측 시간 | 실제 카탈로그 | 결과 |
|---|---:|---|---|
| bare, 도구 없이 READY 응답 | 5.169초 | 시스템 5개 | 완료, shell 0건 |
| sum 오동작 원인 조사 | 65.939초 | 시스템 5 + 생성 ship-flow 27 | 생성 `ship-flow:diagnosing-bugs`를 읽고 원인을 보고, 파일 변경 없음; shell 13건 |
| 준비된 PR fixture | 179.822초 | 부모 32개, planner 자식 143개 | 부모 timeout, 구현·PR 미완료; 부모 shell 6건 |

모든 카탈로그에서 USER 경로는 없었고, 70개 canonical 경로 제외 설정을 확인했다.
PR 자식에는 동일 시스템 5개와 ship-flow 27개에 `openai-curated-remote` 스킬 111개가
추가됐다. 이는 사용자 `.agents/skills` 제외 실패와 다른 현상이다. 현재 증거만으로
추가 등록의 원인이나 카탈로그 크기가 지연에 미친 영향을 확정하지 않는다.

## PR의 새 관측과 다음 수정

이전 PR 사례와 같은 `issue.md`·`sum.cjs`·원본 `test.cjs`를 사용하되, 별도 seed 저장소에서
연결한 feature worktree를 미리 할당했다. `main` 비교 기준, `node test.cjs`, 생성 engine의
명시적 `pluginBinPrefix`, 외부 발행 금지·독립 역할 계약을 fixture에 제공했다. Git 쓰기 권한과
hook trust를 넓히지 않았다. 따라서 이전 단회 결과와 조건이 같지 않으며 시간 차이를
개선율로 계산할 수 없다.

부모는 할당된 worktree를 재사용하고 classifier의 경로 기반 track 조회까지 성공했다.
이전의 플러그인 경로 해석·없는 비교 ref·branch 생성 실패는 이번 trace에서 관측되지 않았다.
native `spawn_agent`와 부모-자식 session metadata로 **독립 planner 실행 자체는 확인**했다.
자식의 `agent_role`은 null이며, 검토된 project-agent template 적용과 역할별 read-only
sandbox 보장은 확인하지 않았다. 새 세션 생성만으로 역할 계약 전체가 충족된 것은 아니다.
그러나 자식은 계획의 각 기준을 PASS로 평가하고도, 자신에게 추가 subagent 도구가 없다는
이유로 전체 BLOCK을 반환했다. 부모는 그 결과를 받은 뒤 제한 시간 안에 끝나지 않았다.

생성 role skill의 첫 문장은 `Run this role in a fresh subagent`다. 이미 분리된 역할 실행자도
이 문장을 다시 위임하라는 요구로 해석할 수 있다. 다음 provider 수정 후보는
[`generate-runtime-packages.mjs`](../../scripts/generate-runtime-packages.mjs)의 **호출자와 이미
분리된 실행자 지침 구분**이다. 관측된 BLOCK 이유와 일치하는 가설이며 반복 실험으로 확정한
일반 원인은 아니다. 독립 리뷰를 제거하거나 BLOCK을 PASS로 바꾸는 방향은 허용하지 않는다.
부모-자식 카탈로그 차이와 실제 역할 template 적용도 함께 확인해야 한다.

## 실행·증거 경계

- 앱 CLI `0.155.0-alpha.9.2`, target은 이전 관측과 같은 `gpt-5.6-luna` / `xhigh`로 고정했다.
  이번에 읽은 사용자 config 기본값은 `gpt-6-astra`였으며, 이를 사용했다고 주장하지 않는다.
  실제 부모·자식 `turn_context`의 모델을 확인했다. Claude Code는 실행하지 않았다.
- 생성 source 버전은 engine 0.15.4 / ship-flow 0.11.2. 사용자 설치 캐시를 복사·갱신하지 않고
  공식 CLI로 임시 프로필에 등록했다. memory/apps/web off, sandbox와 승인 설정은 그대로다.
  사용자 스킬 제외는 [공식 경로별 설정](https://learn.chatgpt.com/docs/build-skills)을 사용한다.
- 새 예산 600,000ms 중 **250,930ms**를 사용했다. 부모 실행 시간은 그 안의 planner 대기를
  포함한다. 비용은 null이며 token/자식 실행 시간을 별도 비용으로 재계산하지 않았다.
  이전 원장 hash와 사용량 445,824ms를 새 원장에 남겼고 같은 사례를 재시도하지 않았다.
- 원시 JSONL의 파싱 오류는 없었다. 각 target의 `cleanup=group_absent`와 임시 프로필 제거를
  확인했다. 기존 `SessionEnd` timeout clamping 메시지는 남으며 hook enforcement는 미검증이다.
- 부모가 원본 fixture 바이트와 clean Git 상태, metadata의 원시 hash를 대조했다.
  원시 trace·합성 입력·fixture·예산·검사 결과는 private `.loop/isolation/`에 보존한다.
  사용자 대화·auth·DB 내용을 공개하지 않는다. hash는 권한이나 독립 승인 증명이 아니다.
- 실제 실행은 최종 alias 회귀 수정 전 adapter를 사용했다. bare/진단은 POSIX 이름 검사,
  PR은 `basename` 버전을 사용했고 해당 소스 스냅샷과 차이를 기록했다. 초기 두 실행의
  소스 스냅샷은 편집 이력에서 재구성했으며 당시 attestation으로 취급하지 않는다.
  **최종 코드의 실제 사용자 제외 목록과 실행별 70개 경로가 정확히 같음**을 재확인했다.
  발견된 alias 누락은 별도 회귀에서 RED→GREEN으로 검증했다.

설정 전달은 카탈로그 적용 증명이 아니고, 카탈로그 제외는 명시적 파일 읽기를 차단하는
보안 경계가 아니다. 시스템·admin·fixture repository 스킬은 이 USER 제외의 범위 밖이다.
새 성능 수치·실사용 효용·hook qualification·#87 전체 해결을 주장하지 않는다.

## 검증과 독립 검토

native 테스트 전체 23/23, 생성 runtime 재현 비교, skill lock 검사를 통과했다.
실행 plugin payload와 engine/memory/verifier를 변경하지 않아 해당 로컬 전체 suite는
반복하지 않았다. CI의 최종 head 결과는 PR checks에 남긴다.

### Standards

초기 P2: 먼저 방문한 일반 파일 별칭이 canonical 파일을 방문 처리하여 정상 `SKILL.md`
제외를 누락했다. 디렉터리만 순환 검사하고 파일은 별도 Set으로 중복 제거하도록 수정했다.
재검토의 잔여 finding은 0건이다. focused 회귀 1/1을 독립 실행하고, 최종 제외 설정과
실제 argv의 일치 및 문서의 증거 경계를 확인했다. native 모델이나 전체 suite는 재실행하지
않았으며, 원시 trace의 모든 행동을 재판정한 것은 아니다.

### Spec

초기 P2: 같은 alias 재현이 AC1의 symlink 수집 계약을 위반했다. 회귀를 추가해 수정했다.
재검토의 잔여 finding은 0건이다. focused 회귀 1/1, 전체 23/23 로그, 세 실행의 실제
카탈로그·제외 설정·fixture/hash를 대조했다. native spawn과 depth 1 연결, planner BLOCK,
부모 timeout을 확인했다. 모델 재실행이나 전체 suite 반복 없이 AC1–5의 기록과 한계를 검토했다.

## 원시 증거 hash

| 사례 | stdout SHA-256 | rollout SHA-256 | target metadata SHA-256 |
|---|---|---|---|
| bare | `b53d1725d3d8dea89ea01201f0489e54cd5b8d266e6a880ffc6a0c1a554cf4a7` | `1de97e52644853284d9048778e37101991dac21b2ef2a0f0790415256c5fade9` | `342b7fef386354353e2703057d38dcaf443fa3856a096dfa43cb21a8b3122b59` |
| investigate | `4e3953e7f150d9c14db87acece6c40eee75e9041a498fc1abd365a1e4f14bf0f` | `64a5f5d82b85690cf207f67d900f60952490a098ac41d8a67a0ff25d799656c2` | `53e0061db00be4d618668fb20f8b149422ac004d76e57b937aaecf516e5f9ae1` |
| pr-ready | `1be232774b5fc402166224472e8f5866903345b2a41ab2091471b1659f8a479f` | `70cfe24da9ee08bdbdaa91109b4a31382d874d153b8a7a5990bd55682360e641` | `9f8732172f63e9b040d292890670d81ef7de5f9d74e1590f01772ae2e683a011` |
