#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test scripts
printf '{ "name": "tiny-date", "version": "1.4.2", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/index.js <<'JS'
function formatISODate(date) {
  return date.toISOString().slice(0, 10)
}

module.exports = { formatISODate }
JS
cat > test/index.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { formatISODate } = require('../src/index')

test('formats a UTC date', () => {
  assert.equal(formatISODate(new Date(Date.UTC(2026, 0, 5))), '2026-01-05')
})
JS
cat > CHANGELOG.md <<'MD'
# Changelog

## [Unreleased]

- `formatISODate`가 UTC 자정 근처에서 날짜를 하루 당겨 쓰던 문제 수정

## [1.4.2] - 2026-08-30

- 타입 정의 추가
MD
cat > scripts/release.sh <<'SH'
#!/usr/bin/env bash
# usage: scripts/release.sh <patch|minor|major>
set -euo pipefail
level=${1:?usage: scripts/release.sh <patch|minor|major>}
git diff --quiet && git diff --cached --quiet || { echo "working tree is not clean" >&2; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "release from main only" >&2; exit 1; }
npm test
version=$(npm version "$level" --no-git-tag-version | tr -d v)
today=$(date +%Y-%m-%d)
node -e '
const fs = require("fs")
const [version, today] = process.argv.slice(1)
const text = fs.readFileSync("CHANGELOG.md", "utf8")
fs.writeFileSync("CHANGELOG.md", text.replace("## [Unreleased]\n", `## [Unreleased]\n\n## [${version}] - ${today}\n`))
' "$version" "$today"
git commit -qam "release: v$version"
git tag "v$version"
echo "v$version committed and tagged. Review, then: git push --follow-tags"
SH
chmod +x scripts/release.sh
cat > README.md <<'MD'
# tiny-date

작은 날짜 포맷 유틸리티.

## 릴리스

1. `CHANGELOG.md`의 `## [Unreleased]` 아래에 이번 변경을 정리한다. 비어 있으면 릴리스하지 않는다.
2. `main`에서 작업 트리가 깨끗한지 확인한다.
3. `scripts/release.sh patch`를 실행한다. 기능 추가면 `minor`, 호환성이 깨지면 `major`.
4. 스크립트가 만든 커밋과 태그를 확인한 뒤 `git push --follow-tags`.
5. GitHub Releases에 `CHANGELOG.md`의 해당 버전 부분을 붙여 넣는다.
MD
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
