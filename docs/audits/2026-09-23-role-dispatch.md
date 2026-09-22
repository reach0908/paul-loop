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

## 후속 개선: 권한 불일치의 명시적 BLOCK

사용자의 “남은 개선작업들도 진행해줘”에 따라 열린 #111에서 후속 변경을 진행한다.
위 최초 실행과 예산은 보존한다. 후속 수용 기준은 다음과 같다.

1. 실행자가 확인할 수 있도록 template 본문에도 필요한 sandbox를 명시한다. 실제 host
   permissions가 없거나 다르면 역할 작업 전에 BLOCK하고 계획/검토 기준은 미완료로 남긴다.
   호출자는 부모 권한이 아닌 자식의 실제 권한을 확인한다. 기존 sandbox·승인은 약화하지 않는다.
2. 정상 계획+넓은 부모 권한, 정상 계획+read-only 부모, 결함 계획+read-only 부모를 각 1회
   실행해 역할/권한/판정/추가 위임과 catalog를 대조한다. 새 예산 600,000ms, 사례당 180,000ms.
   권한 설정 변경은 격리된 관측 프로세스에만 적용하며 사용자 설정이나 trust를 갱신하지 않는다.
3. `research-with-aside`로 최신 공식 문서와 공개 Codex 소스를 확인하고 상충하는 근거를 남긴다.
   문서상의 설정 지원을 앱 alpha의 실제 동작 증명으로 쓰지 않는다. 원인이 확인되지 않은
   `--sandbox`/config 위치 변경이나 카탈로그 제어 옵션은 구현하지 않는다.
4. 실제 file lesson·공유 history의 존재부터 점검한다. 표본 부재를 검색 효용 실패나 미사용
   전체로 해석하지 않고, consumer 수정·memory DB 활성화 없이 남은 평가 조건을 기록한다.
5. 영향받은 생성 회귀·engine 전체 검사, 독립 Standards/Spec 리뷰, 최종 PR head CI를 확인한다.
   이미 열린 PR의 후보 버전 0.15.5/0.11.3을 유지하며 merge는 사용자에게 남긴다.

### 후속 실제 실행

같은 앱 CLI·모델/effort·기존 native adapter를 사용했다. sandbox 옵션의 위치나 host 구현은
수정하지 않았다. 아래 read-only 관측은 기존 `readonly:true`를 사용해 부모부터 제한했다.
새 코드의 변경점은 모든 역할의 본문에서 요구 권한을 명시하고 실제 권한과 먼저 대조하는 것이다.

| 사례 | 실제 자식 권한 | 자식 결과 | 자식 도구 호출 | 부모 포함 시간 | 부모→자식 skill 수 |
|---|---|---|---:|---:|---|
| 정상 계획·workspace-write 부모 | workspace-write | 권한 불일치 BLOCK, 계획 기준 미완료 | 0 | 67,700ms | 32→143 |
| 정상 계획·read-only 부모 | read-only | 5개 계획 기준 PASS | 2 | 74,922ms | 32→143 |
| AC 없는 계획·read-only 부모 | read-only | 계획 결함 BLOCK | 2 | 73,162ms | 32→32 |

세 실행의 `agent_role=planner`, depth 1, 새 executor 지침 주입을 확인했다. 부모는 각각
한 번 spawn했고 자식의 추가 spawn은 없었다. 실제 host 권한과 판정을 함께 대조했으며,
자식의 “변경하지 않았다”는 약속을 권한 증거로 쓰지 않았다. 입력 3개 파일의 hash와 clean
fixture 상태, trace hash, exit 0, profile 제거와 `cleanup=group_absent`도 대조했다.
새 원장 사용량은 **215,784ms**다. 이전 사용량 128,680ms와 원장 hash를 보존했다.

현재 관측은 **권한 불일치를 무시한 PASS의 수정**과 read-only 계획 검토 동작을 지지한다.
권한이 더 넓은 부모 아래 자식만 좁히는 host 기능은 해결하지 않았다. 악의적인 모델에 대한
sandbox 강제성, 쓰기가 필요한 ship/publisher 전체, 속도 개선이나 일반적인 판정 정확도도
입증하지 않는다. 동일 권한 조건에서도 자식 카탈로그 143/32가 달라 비교 환경은 아직 불균일하다.

### 공식 근거와 반증

`research-with-aside`의 scope를 역할 sandbox 상속과 임시 프로필 catalog로 제한했다.
Aside CLI 1.26.717.1619 / `--effort ultrabrowse`가 원문을 수집했고, 핵심 원문을 별도로
열어 대조했다. 최초 실행은 600초 제한에 도달해 세션 `VKLCy60apxlI41pf`를 이어받았다.
기존 수집 결과로 같은 세션을 재개해 최종 보고서를 받았으며 후속 실행은 exit 0으로 종료됐다.
모든 링크는 2026-09-23 KST에 확인했으며 사용자 설치나 browser account 변경은 하지 않았다.

| 주장 | 원문·근거 종류 | 판단과 남은 확인 |
|---|---|---|
| 문서는 custom agent의 sandbox 설정과 부모 runtime override 재적용을 함께 설명한다 | [OpenAI subagents 문서](https://learn.chatgpt.com/docs/agent-configuration/subagents), 공식 기능 설명 | 문서 확인. 앱 alpha의 적용 결과는 별도 native 기록으로 판단 |
| 같은 버전명의 공개 alpha는 역할 적용 필드에 sandbox를 포함하지 않는다 | [고정 commit의 role.rs](https://github.com/openai/codex/blob/4607249e430dac1c961df4dc615beae88e33cec8/codex-rs/core/src/agent/role.rs), `AgentRoleOverrides` 및 `build_next_config` | 부모 config를 복사한 뒤 허용 필드만 갱신. 역할 template 선언만으로 권한 적용을 인정하지 않음 |
| 역할 적용 뒤 부모의 effective permission snapshot을 재적용한다 | [child_config.rs](https://github.com/openai/codex/blob/4607249e430dac1c961df4dc615beae88e33cec8/codex-rs/core/src/agent/child_config.rs), `prepare_agent_spawn_config`, `apply_spawn_agent_runtime_overrides` | 이 경로에는 명시적 `--sandbox`에서 온 권한에만 적용하는 분기가 없다. flag를 config 파일로 옮기는 해결책은 채택하지 않음 |
| `remote_plugin`은 기본 켜진 원격 catalog 설정이다 | [OpenAI config reference](https://learn.chatgpt.com/docs/config-file/config-reference), 공식 설정 설명 및 로컬 `features list` | 설정 존재 확인. catalog 전체를 고정하는 옵션으로 해석하지 않음 |
| 원격 catalog 비활성화와 모든 plugin 동기화 중단은 다르다 | [plugin manager](https://github.com/openai/codex/blob/4607249e430dac1c961df4dc615beae88e33cec8/codex-rs/core-plugins/src/manager.rs), `remote_global_catalog_active`, `maybe_start_curated_repo_sync_for_config`, `maybe_start_plugin_startup_tasks_for_config`, `maybe_start_remote_installed_plugin_bundle_sync` | 원격 catalog 비활성 시 허용된 curated Git 동기화가 시작될 수 있고, installed bundle은 별도 plugin/auth 조건으로 비동기 동기화한다. `remote_plugin=false`만으로 catalog 고정을 보장하지 않음 |

GitHub API에서 공개 `rust-v0.155.0-alpha.9.2` 태그가 위 commit
`4607249e430dac1c961df4dc615beae88e33cec8`을 가리킴을 확인했다. 앱 CLI와 버전명은 같지만
앱 바이너리의 build provenance까지 확인한 것은 아니다. 공식 문서·공개 구현·native 실행은
별도 근거로 유지한다. 관측된 권한 상속은 해당 소스와 일치한다.

카탈로그 변동이 비동기 초기화와 관련됐을 가능성은 있지만 실제 호출 시각·원격 할당을
대조하지 않아 원인이나 속도 영향을 확정하지 않는다. `openai-curated-remote` 경로와 공개
curated Git catalog도 동일시하지 않는다. 로컬 시험 plugin을 유지하면서 전체 자동 동기화를
동결하는 단일 지원 설정은 이번 근거에서 찾지 못했다. 다음 비교에서는 개수뿐 아니라
skill/plugin의 실제 경로·identity·hash를 대조해야 한다. 추측성 옵션·고정 sleep은 추가하지 않았다.

### 메모리 평가 표본 점검

읽기 전용으로 등록 worktree의 기본 `.loop/lessons/*.json`과 각 공통 Git 디렉터리의
`loop/lesson-history/*.json`을 확인했다. 실제 `lesson-history.mjs`의 저장 위치를 사용했다.

| 저장소 | 등록 worktree 수 | 기본 lesson JSON | 공유 history JSON |
|---|---:|---:|---:|
| Rabbit Hole | 2 | 0 | 0 |
| Digging | 38 | 0 | 0 |
| paul-loop | 10 | 0 | 0 |

이는 확인한 기본 경로의 표본 부재다. 사용자 지정 `LESSONS_DIR`/`LOOP_DIR`, 삭제되거나
등록되지 않은 checkout, DB, native memory 전체의 미사용을 뜻하지 않는다. 파일/공유 history의
검증된 실패 사례 6–10건은 현재 표본으로 구성할 수 없다. 인용 빈도나 합성 테스트를 실제
검색 효용으로 대체하지 않는다. 따라서 다음 메모리 단계는 실제 재발 실패의 검증 receipt와
현재 유효한 지식을 함께 확보하는 것이며, 검색 서버나 자동 승격을 추가하는 것이 아니다.

### 후속 검증과 증거

새 요구 권한 assertion의 RED와 수정 후 runtime 11/11 PASS를 확인했다. 기존 역할별 sandbox,
계약·부정 검사는 유지했다. engine 전체는 **81/81 PASS**이며 기존 선택적 조건의 skip은
개별 로그에 남겼다. 생성 재현·vendor lock·source marketplace/ship-flow strict 검사도 통과했다.
installer/native **110 PASS·1 opt-in SKIP**은 위 최초 변경에서 실행한 결과로, 후속 native adapter
코드 변경은 없다. 후속 최종 문서의 로컬 링크 15개, diff, 생성물 재현·vendor lock 및 strict
manifest 4개(source catalog, engine, ship-flow, 생성 Claude catalog)도 통과했다. 새 head CI는
발행 후 해당 PR에서 확인하며, 현재 로컬 결과만으로 완료 처리하지 않는다.
원시 연구 출력·합성 입력·probe·native JSONL·표본 inventory·관측 JSON은 private
`.loop/runtime-followup/`에 보존한다. 원문 대화나 소비 데이터는 공개하지 않는다.

세 실행의 공통 template SHA-256은 `c2bac242c7c30be35f2b8b330dd8fb7c272ac243a58443bb3bd4605e70ca9b3a`,
generator는 `38c78c1e8a8762db3886515507cc5a508e81e7f6793e844192923fb243b8b7a8`이다.
runtime 공통 문서의 후속 설명은 관측 template 바이트에 영향을 주지 않는다.

| 사례 | input SHA-256 | rollout SHA-256 |
|---|---|---|
| 권한 불일치 | `bd477be2bee26303002b2d0d9f88b0aa6d8f596e3f1da12798b89794ea43e8dc` | `f139a2715186b06c2ddc766ea34c823ecf098386501f9e19df964edd977d6270` |
| 정상·read-only | `3eab78b345a2c5b91b2838a57ec03c29d30494f05e0d11dc769895dc09d24ed2` | `b4a8574e4848e4cb807042347c92fa43a8151af95d54f760c41c7167bc88b14f` |
| 결함·read-only | `b402ec9e8c9fad5f272ceb534116ae73b264ff7eb66049433c8c25e65db1ec90` | `59273023402570b0987de908726c4e60e43b60652daff38e5a9b18bb5b70e6fd` |

### 후속 Standards

actionable finding과 heuristic smell은 0건이다. 필요한 sandbox·실제 자식 권한의 구분,
누락/불일치 시 작업 전 BLOCK, 관측·audit·roadmap의 일치를 확인했다. 공개 alpha 소스와 앱
바이너리의 차이, 카탈로그 변동 및 표본 범위도 명시했다. 보존된 engine 81/81 로그를 대조했다.
리뷰에서 새 모델·전체 검사를 실행하지 않았으며, 공개 원문 전체를 독립 재검증한 것은 아니다.

### 후속 Spec

잔여 actionable finding은 0건이다. 후속 AC1–5와 최종 diff를 대조하고 기존 sandbox·승인·
역할별 BLOCK 보존을 확인했다. 원시 실행의 역할·권한·판정·catalog 수 및 입력/template/
rollout/generator hash를 독립 대조했다. engine 81/81 로그와 연구·표본의 제한도 확인했다.
새 head CI는 발행 후 확인할 항목으로 남는다. 모델·전체 검사를 다시 실행한 리뷰는 아니며,
넓은 부모 아래 자식 권한 축소·sandbox 강제성·publisher 전체·속도·실사용 효용은 미입증이다.

### 후속 발행 경계

후속 구현 classifier는 6개 경로에 AUTO/standard다. 최종 PR diff는 base `28175886327a` 대비
10개 파일이며, 실제 push/PR 갱신 명령의 classifier는 앞선 발행과 같이 REQUIRE를 반환했다.
사용자의 기존 배포 및 남은 개선 요청을 동일 provider branch/PR #111 발행에 재사용한다.
후보 버전 0.15.5/0.11.3, 대상 저장소·branch·main 및 수동 merge·설치 제외 경계는 유지한다.
이는 관측한 host 권한을 바꾸거나 거부된 명령을 다른 경로로 실행하는 작업이 아니다.
