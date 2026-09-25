# Consumer setup 실행 전 커밋 검증 — #99

기준: #123 merge `e151fffacd60864f4da3468ff56215f70db618a4`.
해당 SHA의 [tag-on-publish](https://github.com/reach0908/paul-loop/actions/runs/36020345853)는
SUCCESS이며 원격 `loop-engine--v0.15.9`도 이 커밋을 가리킨다. 이번 후보는
ship-flow 0.11.4 / engine 0.15.10이다. engine 변경은 회귀 테스트뿐이다.

## 경계와 구현

기존 setup action은 이동 가능한 태그를 clone한 뒤 내려받은 resolver를 즉시 실행했다.
태그 값은 셸 소스에 직접 들어갔다. resolver의 manifest 검사는 호환성 확인이며, 그
resolver 자체를 실행해도 되는지 판단할 신뢰 근거가 아니다.

1. 설치 안내에서 검토된 릴리스의 전체 lowercase 40자리 commit SHA를 태그와 함께
   consumer action에 기록한다. annotated tag는 tag object가 아닌 commit으로 peel한다.
2. 네 값을 literal step env로 넘기고, 네트워크/임시 설치 전에 버전·SHA 형식을 확인한다.
3. 두 태그를 `--no-checkout`으로 clone한다. HEAD와 fully qualified tag의 peeled commit이
   각각 기록된 SHA와 일치해야 한다. 태그와 같은 이름의 branch도 별도로 구별한다.
4. **양쪽 검증이 모두 끝난 뒤** 정확한 SHA를 checkout하고 기존 resolver/manifest 검사를
   실행한다. 그 뒤 기존 세 환경 변수를 export한다.

실패하면 기존 ERR trap이 해당 호출의 임시 디렉터리만 정리한다. 성공한 설치는 보존한다.
다운로드한 파일, 현재 remote의 태그 값, resolver의 자기 보고에서 expected SHA를 계산하지
않는다. 별도 서명 체계나 의존성, wrapper, CI job을 추가하지 않았다.

setup 안내는 치환 전에 따옴표·개행·셸 코드·GitHub expression을 거부하도록 명시한다.
YAML의 single quote 자체가 GitHub expression 평가를 끄는 것은 아니다. 이 검증의 신뢰
기준은 검토된 consumer action과 그 안의 literal pin이며 action 정의 변조 전체를 막는
서버 정책이 아니다. 이미 복사된 소비자 action은 명시적인 별도 업데이트가 필요하다.

## 확인한 증거

- 수정 전 실제 Git fixture에서 이동한 engine 태그가 종료 0으로 실행되어 새 회귀 검사가
  RED였다. 수정 후 같은 동작은 checkout/resolver 실행·export 전에 실패한다.
- 실제 action shell을 실행하는 집중 검사 1/1 PASS: 양쪽 태그 이동, 충돌하는 branch와
  branch-only alias, 누락·짧은·잘못된 SHA, command substitution 등 셸 형태 입력 거부.
- Git checkout filter와 resolver에 실행 표식을 둔다. 거부 시 표식이 없고, 명시적으로
  재검토한 SHA로 갱신하면 표식이 생기는 positive control도 통과했다.
- 두 독립 커밋, 공백·한글 경로, 반복 설치, 실패 정리, 잘못된 manifest 거부, annotated
  tag 및 승인한 pin 갱신의 정상 동작을 유지했다.
- resolver/adapter/runtime 검사 29/29 PASS, skip 0. JS syntax, YAML 파싱, diff 공백 및
  skill lock 검사 PASS. 699개 runtime package 생성·무결성 검사와 두 runtime에 포함된
  setup template의 byte 일치도 확인했다.
- 실제 공개 릴리스 engine 0.15.9 (`e151fff`)와 ship-flow 0.11.3 (`16e2e90`)의 검토된 SHA를
  사용해 임시 디렉터리에서 HTTPS clone→검증→resolver→export까지 종료 0으로 확인했다.
  설치된 cache나 consumer 프로젝트를 변경한 것은 아니다.

전체 engine, 고정 기준 및 hosted CI 결과는 최종 커밋에 결속된 검증 기록에서 확인한다.
이 문서의 집중 PASS는 전체 검사·머지·배포 완료 선언이 아니다. 기존 pinned runner,
CODEOWNERS와 workflow는 그대로이며 #123에서 채택한 실제 Git 기준을 사용한다.

근거: [Git clone 옵션](https://git-scm.com/docs/git-clone),
[GitHub의 immutable pin 권고](https://docs.github.com/en/actions/reference/security/secure-use),
[선행 fixture 변경](2026-09-24-consumer-action-git-fixture.md).

기존 provider 개선·게시 요청의 범위에서 구현하며 분류기는 AUTO였다. 새 PR의 사람 머지,
소비 프로젝트 설치와 서버 보호 설정 변경은 포함하지 않는다.
