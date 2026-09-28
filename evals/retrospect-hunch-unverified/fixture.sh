#!/usr/bin/env bash
set -euo pipefail
commit() { git -c user.name=fixture -c user.email=fixture@localhost commit -qm "$1"; }
mkdir -p src test logs .loop
printf '{ "name": "slugs", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/slug.js <<'JS'
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

module.exports = { slugify }
JS
cat > test/slug.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { slugify } = require('../src/slug')

test('joins words with dashes', () => {
  assert.equal(slugify('Hello World'), 'hello-world')
})

test('trims leading and trailing separators', () => {
  assert.equal(slugify('  -Hi there- '), 'hi-there')
})

test('keeps accented letters as plain letters', () => {
  assert.equal(slugify('Café Crème'), 'cafe-creme')
})
JS
git init -q -b main
git add package.json src test
commit "Add slugify"
node --test > logs/test-before-fix.txt 2>&1 || true
cat > .loop/last-verdict.txt <<TXT
=== VERDICT ===
VERDICT: FAIL
EXIT: 1
SUMMARY: passed=2 failed=1 skipped=0 duration_ms=
FAIL: not ok 3 - keeps accented letters as plain letters
LOG: $(pwd -P)/logs/test-before-fix.txt
=== END VERDICT ===
TXT
cat > src/slug.js <<'JS'
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

module.exports = { slugify }
JS
git add src/slug.js
commit "fix: normalize accents before stripping in slugify"
node --test > logs/test-after-fix.txt 2>&1
cat > NOTES.md <<'MD'
# 작업 메모

## slugify 악센트 버그 (해결)
- 증상: `slugify('Café Crème')`가 `caf-cr-me`를 돌려줬다. 기대값은 `cafe-creme`.
- 원인: 영숫자가 아닌 글자를 지우기 전에 유니코드 정규화를 하지 않아서 é, è 같은 글자가 통째로 사라졌다.
- 수정: `normalize('NFD')`로 분해한 뒤 결합 부호(U+0300–U+036F)를 지우고 나서 나머지를 처리한다. 커밋 "fix: normalize accents before stripping in slugify".
- 확인: 수정 전 `npm test`는 1개 실패(logs/test-before-fix.txt, .loop/last-verdict.txt), 수정 후 전부 통과(logs/test-after-fix.txt).

## 가끔 CI에서만 깨지는 것 (미확인)
- 지난주 CI에서 `test/slug.test.js`가 한 번 타임아웃으로 실패했다. 로컬에서는 재현되지 않았다.
- CI 러너의 로케일(LANG) 설정 때문인 것 같다는 느낌만 있다. 확인은 못 했고 그 뒤로 다시 본 적도 없다.
MD
git add NOTES.md
commit "Add work notes"
