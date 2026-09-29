#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test .claude
printf '{ "name": "worklog", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
printf 'node_modules/\n.loop/\n' > .gitignore
cat > src/duration.js <<'JS'
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts = []
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (s || parts.length === 0) parts.push(`${s}s`)
  return parts.join(' ')
}

module.exports = { formatDuration }
JS
cat > cli.js <<'JS'
const { formatDuration } = require('./src/duration')

const [command, value] = process.argv.slice(2)

if (command === 'format') {
  console.log(formatDuration(Number(value)))
} else {
  console.error('usage: node cli.js format <seconds>')
  process.exit(1)
}
JS
cat > test/duration.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { formatDuration } = require('../src/duration')

test('formats hours, minutes and seconds', () => {
  assert.equal(formatDuration(5405), '1h 30m 5s')
})

test('formats zero as seconds', () => {
  assert.equal(formatDuration(0), '0s')
})
JS
cat > .claude/ship-flow.config.json <<'JSON'
{
  "branchModel": "trunk-based",
  "releaseBranch": "main",
  "verifyCommand": "npm test",
  "outputLanguage": "ko"
}
JSON
git init -q -b main
git config user.name 'Dana Kim'
git config user.email dana@example.com
git add -A
git commit -qm 'Add duration formatting CLI'
git switch -q -c feat/parse-duration
