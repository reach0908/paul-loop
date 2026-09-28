#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test scripts
cat > package.json <<'JSON'
{
  "name": "invoice-mailer",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "lint": "node scripts/lint.mjs",
    "test": "node --test",
    "verify": "npm run lint && npm test"
  }
}
JSON
cat > package-lock.json <<'JSON'
{
  "name": "invoice-mailer",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": { "name": "invoice-mailer", "version": "0.1.0" }
  }
}
JSON
cat > scripts/lint.mjs <<'JS'
import { readdirSync, readFileSync } from 'node:fs'

let bad = 0
for (const dir of ['src', 'test']) {
  for (const file of readdirSync(dir)) {
    if (/[ \t]+$/m.test(readFileSync(`${dir}/${file}`, 'utf8'))) { console.error(`${dir}/${file}: trailing whitespace`); bad++ }
  }
}
process.exit(bad ? 1 : 0)
JS
cat > src/invoice.js <<'JS'
function dueDate(issued, days = 30) {
  const d = new Date(issued)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

module.exports = { dueDate }
JS
cat > test/invoice.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { dueDate } = require('../src/invoice')

test('due in 30 days by default', () => {
  assert.equal(dueDate('2026-01-15'), '2026-02-14')
})
JS
cat > README.md <<'MD'
# invoice-mailer

매달 거래처에 청구서 메일을 보내는 작은 서비스.

## 개발

- Node 22
- PR을 올리기 전에 `npm run verify`를 돌려 주세요. lint와 테스트를 함께 실행합니다.
- `main`에 바로 PR을 올립니다.
MD
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm "Initial invoice-mailer"
