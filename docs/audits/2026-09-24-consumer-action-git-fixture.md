# Consumer setup의 실제 Git 검증 — #99 선행 작업

기준: #122 merge `75bf12dee72f4a8e86a212e756dec2bd386b6dcb`.
범위: provider의 setup-action 테스트와 필수 버전 메타데이터. **#99는 미해결이다.**

## 두 단계로 나누는 이유

현재 setup 템플릿은 두 플러그인의 이동 가능한 버전 태그를 clone한 뒤 내려받은
`plugin-path.mjs`를 실행한다. manifest 이름·최소 버전 검사는 실행할 코드의 신뢰하는
커밋을 입증하지 않는다. 실행 전에 별도로 검토·저장한 SHA와 대조하는 후속 변경이 필요하다.

기존 `runtime-packages.test.mjs`의 setup 검사는 Git을 디렉터리 복사 stub으로 바꿨다.
`git clone` 외의 호출은 모두 실패하며 `.git` 객체도 없어서 정상적인 SHA 확인을 할 수 없다.
`verifier-pinned-review.sh`는 base의 전체 test 디렉터리를 복원하므로 템플릿과 테스트를
한 PR에서 바꾸면 이 옛 fixture가 복원된다. 검증기를 우회하지 않도록 fixture를 먼저
실제 Git으로 바꾸고, 머지된 기준 위에서 실행 코드의 SHA 고정을 구현한다.

## 변경한 검증 계약

- Git 명령을 흉내 내지 않고 임시 로컬 저장소에서 실제 commit/tag/clone을 수행한다.
- canonical HTTPS URL만 해당 로컬 저장소로 치환한다. fixture 프로세스는 file transport만
  허용하고 사용자·시스템 Git 설정을 읽지 않으며 실제 네트워크를 사용하지 않는다.
- 두 플러그인을 서로 다른 commit에 기록하고, 설치된 각 경로의 실제 HEAD를 확인한다.
- 기존 공백 경로, 독립된 두 번의 설치, 경로 export, 실패 후 이전 설치 보존을 유지한다.
- 없는 ref와 잘못된 manifest를 거부하고, 실패한 호출의 디렉터리만 정리하며 export가
  비어 있는지 확인한다. timeout이나 process 오류를 정상적인 거부로 인정하지 않는다.
- fixture의 tag/SHA 치환과 literal step env 지원을 준비한다. 실제 템플릿의 실행 동작은
  변경하지 않으며, 이 검사가 이동한 태그 공격을 차단한다고 주장하지 않는다.

추가 의존성이나 CI job은 없다. 기존 runner, CODEOWNERS, workflow는 그대로다.
engine subtree의 테스트도 게시 버전의 일부이므로 기존 publish-freshness 계약에 따라
loop-engine 0.15.9 후보로 올린다. ship-flow 0.11.3 / memory 0.7.0은 그대로다.

## 검증과 다음 단계

집중 검사 `node --test --test-name-pattern='setup action executes'
tools/loop-engine/test/runtime-packages.test.mjs`: 1/1 PASS, skip 0.
JS syntax, diff 공백 및 skill lock 검사도 통과했다. 전체 engine, runtime 및 고정 기준 검사는
최종 커밋에 대해 별도로 기록한다. 이 문서는 CI·머지·배포 완료 증거를 대신하지 않는다.

이 PR 머지 후 #99 후속 PR에서 두 플러그인의 검토된 전체 commit SHA를 실행 전에 확인하고,
setup 안내와 태그 이동·잘못된 pin·다운로드 코드 비실행 회귀를 함께 추가한다.
이미 설치된 소비 프로젝트 action이나 플러그인 cache를 자동 교체하지 않는다.

이번 작업은 기존 provider 자체 개선·게시 요청에 포함된 가역적 변경이다. 분류기는 AUTO를
반환했다. 새 PR의 사람 머지 결정, 소비자 설치 및 서버 보호 설정 변경은 포함하지 않는다.
