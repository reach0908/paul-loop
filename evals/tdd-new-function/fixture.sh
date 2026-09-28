#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test
printf '{ "name": "blog-tools", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/words.js <<'EOF'
function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

module.exports = { countWords }
EOF
cat > test/words.test.js <<'EOF'
const test = require('node:test')
const assert = require('node:assert/strict')
const { countWords } = require('../src/words')

test('counts words separated by any whitespace', () => {
  assert.equal(countWords('  hello   world\n'), 2)
})

test('returns zero for blank text', () => {
  assert.equal(countWords('   '), 0)
})
EOF
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
