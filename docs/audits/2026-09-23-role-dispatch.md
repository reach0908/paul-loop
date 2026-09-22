# Codex 역할의 호출·실행 책임 분리

기준 source: `28175886327ae31e76d0c19deb8097a1be2a1de0` (#110 merge).
사용자의 후속 개선 및 기존 배포 요청 범위에서 생성 role 문구를 수정한다.
소비 프로젝트·설치 캐시·전역 config/trust 갱신은 포함하지 않는다.

## 수용 기준

1. 호출용 role skill은 검토된 template을 적용한 fresh subagent와 필요한 제한을 요구한다.
   이미 분리된 역할 실행자에게 같은 역할을 다시 위임하라고 요구하지 않는다.
2. 실행자 template은 맡은 역할을 직접 수행하고 caller에게 반환한다. subagent 도구 부재만으로
   새 위임을 요구하지 않는다. 실제 계획/검토 결함, 누락된 격리·권한은 BLOCK/미완료로 유지한다.
3. reviewer/planner의 read-only, publisher의 별도 실행·승인, 내장 AUTHORIZATION 및 관련
   contract closure를 보존한다. 자동 설치나 권한 확대는 하지 않는다.
4. 공식 custom-agent 경로를 임시 Codex 프로필에만 구성한 두 사례로 확인한다: 검증 가능한
   계획과 AC가 없는 계획. 실제 role identity, template 지침, sandbox와 자식 결과를 대조한다.
   새 공유 예산 600,000ms/사례 180,000ms, 각 1회이며 성능 benchmark가 아니다.
5. 생성 회귀·engine 전체·installer/native 관련 검사와 독립 검토를 완료한다. 배포 payload가
   바뀌는 ship-flow는 0.11.3, 회귀 테스트를 패키지에 포함하는 engine은 0.15.5로 올린다.
   현재 게시 버전과 PR 준비 버전을 구분하며 memory 0.7.0은 유지한다.

## 배포 상태 확인

기존 원격 tag: engine 0.15.4 → `3b58fba`, ship-flow 0.11.2 → `b144538`, memory 0.7.0 → `d2d78c6`.
#109·#110은 문서/평가 도구 변경으로 plugin payload/version을 바꾸지 않았다.
Claude Git marketplace는 source catalog를 제공하고, Codex는 생성한 로컬 marketplace를 별도로
갱신한다. 이 세션의 노출된 ship-flow는 `0.11.0+zine.1`이며 현재 provider 배포와 다른 설치본이다.
설치 갱신·로드·native hook 활성화는 source/tag 게시와 별개다.

#110 merge SHA의 [tag-on-publish 실행](https://github.com/reach0908/paul-loop/actions/runs/35759483073)은
SUCCESS다. 이미 있는 버전 tag는 이동하지 않으므로 #110 SHA에 새 release tag가 생기는 것은 아니다.
이번 PR의 engine 0.15.5 / ship-flow 0.11.3은 **배포 후보**다. merge 후 workflow와 원격 tag를
별도로 확인해야 한다. memory source/runtime은 유지하며 생성 패키지 공통 README의 중복 버전
문장만 manifest/catalog 참조로 바꾼다. 이는 memory 기능 변경이나 설치 갱신이 아니다.

## 변경

[직전 관측](2026-09-23-native-isolation.md)에서 이미 생성된 planner 자식이 추가 subagent 도구
부재를 이유로 BLOCK했다. 공통 생성기의 동일 문장을 분리한다: 역할 skill은 caller에게
검토된 template·fresh subagent·실제 제한 확인을 요구하고, template은 이미 배정된 executor에게
현재 역할을 수행하고 반환하도록 지시한다. 5개 역할의 원래 BLOCK 기준, sandbox 설정,
AUTHORIZATION 및 publisher 계약은 유지한다. 독립 역할을 일반 skill 읽기로 대체하지 않는다.

역할을 두 번 위임할 가능성을 제거하는 지침 수정이며, 이전 timeout의 유일한 원인이나
모든 모델의 실행 시간을 설명하는 것으로 일반화하지 않는다.

## 검증 결과

- 회귀 RED: 기존 생성물에 executor 지침이 없어서 실제 assertion이 실패했다. 수정 후
  runtime 패키지 11/11, engine 전체 81/81을 통과했다. 기존 sandbox·필수 contract·실패 검사는 유지한다.
- installer/native 관련 111개 중 110 PASS, 1 SKIP. SKIP은 opt-in 실제 CLI 설치 테스트다.
  아래 native 관측에서 별도 임시 프로필 설치는 실행했지만 그 SKIP을 PASS로 바꾸지 않는다.
- 생성·재현 비교, vendor skill lock, diff 검사를 통과했다. 최종 공유 문서 수정 후 패키지
  회귀 11/11과 strict manifest 검사(source catalog, engine, ship-flow, 생성 Claude catalog)를
  다시 통과했다. 로컬 Node 22.19.0 / Claude Code 2.1.280 사용. memory 구현·dist는 바꾸지 않았다.

## 실제 planner 관측

앱 CLI `0.155.0-alpha.9.2`, 모델 `gpt-5.6-luna` / `xhigh`를 유지했다. 공식 CLI로 임시
프로필에 engine 0.15.5 / ship-flow 0.11.3을 등록한 뒤, 생성된 planner TOML 그대로를
[공식 custom-agent 경로](https://learn.chatgpt.com/docs/agent-configuration/subagents)인 해당
프로필의 `agents/planner.toml`에 복사했다. 실제 사용자 설치·프로젝트·trust는 변경하지 않았다.
부모에게 `planner` custom agent를 정확히 한 번 호출하도록 지시했다. 이는 dispatcher skill의
자동 선택 평가가 아니라 **명시적 custom-role 실행 관측**이다.

두 fixture의 `sum.cjs`는 뺄셈을 하고 기존 `test.cjs`는 덧셈 결과 5를 요구한다. 정상 계획은
sum.cjs만 덧셈으로 바꿀 scope, standard track, `verify: node test.cjs` AC와 test seam을
명시한다. 부정 사례는 `Make the code better. Track: standard.`만 제공한다. 구현·파일 쓰기·
외부 발행·추가 모델 호출은 요청하지 않았다. PASS는 계획 검토 결과이며 구현 완료가 아니다.

| 사례 | 부모 포함 실행 시간 | 실제 역할·결과 | 카탈로그 부모→자식 | 필요한 격리 |
|---|---:|---|---|---|
| 정상 계획 | 55,354ms | planner, depth 1, 5개 기준 PASS | 32→143 | 미충족: workspace-write |
| AC 없는 계획 | 73,326ms | planner, depth 1, 5개 기준 BLOCK | 32→32 | 미충족: workspace-write |

두 자식 모두 session metadata의 `agent_role=planner`와 실제 developer 메시지의 executor
지침을 확인했다. 부모별 spawn 1회, 자식의 추가 spawn은 0회다. 같은 역할을 다시 위임해야
한다는 BLOCK은 관측되지 않았고, 부정 사례의 계획 결함 BLOCK은 유지됐다.

**격리된 planner 검증 전체는 통과하지 않았다.** template의 `sandbox_mode="read-only"`와
달리 두 자식의 `turn_context.sandbox_policy` 및 실제 `<permissions instructions>`는 모두
`workspace-write`였다. 정상 사례의 자식과 부모는 이 불일치를 언급하지 않고 PASS를 반환했다.
따라서 그 응답을 역할 격리까지 충족한 승인으로 사용할 수 없다. 이 감사의 caller가 native
기록을 대조하여 불일치를 드러냈으며, 다음 작업은 이 호스트의 custom-role sandbox 적용을
확인하는 것이다. 쓰기 probe나 권한 변경으로 억지 통과시키지 않았다.

사용자 skill 70개 제외는 모든 부모·자식에서 유지됐다. 정상 사례 자식만 curated skill
111개가 추가되었고, 부정 사례는 부모와 같았다. 카탈로그 동질성 및 원인도 미해결이다.
두 단회 관측은 지침 반응을 확인한 것이며 성능 비교, 자동 라우팅, hook 활성화, 실제 프로젝트
효용, #87 전체 해결의 증거가 아니다. 새로운 루프·서버·검색 인프라는 추가하지 않았다.

## 증거 보존

- 실행 전에 synthetic 입력·부모 prompt·generator/adapter/probe/template SHA-256을 저장했다.
  template은 두 실행 모두 `b4948f67057805b1690150c366ada01312c11b44822026085f22313da98fbf6b`,
  generator는 `4af22eca1bc71400d2b3a8c507c199075781d8b6c003c0712038839aa40cba4c`다.
  공유 README 수정은 이후 적용됐지만 관측한 template/generator 바이트는 그대로다.
- 새 공유 예산 600,000ms 중 128,680ms 사용. 이전 원장의 250,930ms와 hash를 보존하고
  같은 사례를 재시도하지 않았다. 이 시간은 부모의 자식 대기를 포함하며 비용은 미확인이다.
- 두 프로세스 exit 0, trace complete, parse error 없음, `cleanup=group_absent` 및 임시 프로필
  제거를 확인했다. 원본 3개 파일 hash와 clean fixture Git 상태가 실행 전후 같았다.
- private `.loop/role-dispatch/`에 probe, 입력, 원시 trace, metadata, 예산, 검사 로그를 보존한다.
  원시 대화·auth·사용자 프로젝트 데이터는 공개하지 않는다. 기존 SessionEnd timeout clamping
  메시지는 남아 있으며 hook enforcement의 증거로 쓰지 않는다.

| 사례 | input SHA-256 | rollout SHA-256 |
|---|---|---|
| 정상 | `706198ac3e056ba898d1b673b21addee7cdd44f68b88e5807071baa7fe7a4ed7` | `ee71937d393055d502fb2d8fa00930afc1b9ddcf9a87d498f088aa3018dfb70c` |
| AC 없음 | `210eef685590b389bd5c3fd06c84eaf57646e1914a865a1b9e6192b954f72d24` | `45793ca83cf86d4ae62fe6b706d0eeea7385b32e3234fdd7469a864445a6232c` |

## Standards

초기 P3: 공통 runtime 문서의 고정 버전이 최신 manifest와 달랐다. 중복 버전을 제거하고
manifest/catalog를 기준으로 명시하여 해소했다. 재검토의 잔여 finding은 0건이다.
9개 변경·관측 JSON·저장된 검사 로그의 정합성을 대조하고 역할 계약 보존을 확인했다.
모델/전체 검사를 재실행하거나 host sandbox 원인을 판정한 검토는 아니다.

## Spec

잔여 finding은 0건이다. 원시 role metadata·executor 주입·spawn 횟수·PASS/BLOCK·입력과
소스/trace hash·fixture 무변경·검사 로그를 독립 대조했다. AC1–5의 구현/기록과 미충족
격리의 구분을 확인했으며, 모델/전체 검사는 반복하지 않았다.

## 발행 경계

구현 경로 classifier는 AUTO/standard였다. 실제 push/PR 명령은 일치하는 command rule이
없어 REQUIRE를 반환했다. 사용자의 기존 “배포도 알아서 진행하고 개선점들도 계속해서 개발
진행해줘” 및 이번 후속 요청에 따른 동일 provider 범위의 branch push/PR 발행 권한을 재사용한다.
대상은 `reach0908/paul-loop`, `codex/paul-loop-role-dispatch` → `main`, 위 9개 파일이다.
이는 새 권한 생성이나 command-execution denial 우회가 아니며, 사용자 수동 merge와 소비
설치 변경은 포함하지 않는다. 최종 head의 CI와 merge 이후 tag는 각각 별도로 확인한다.
