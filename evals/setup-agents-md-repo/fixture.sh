#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test .claude
cat > AGENTS.md <<'MD'
# 정산 서비스 작업 규칙

- 모든 금액은 원 단위 정수로 저장한다. 소수점 금액을 만들지 않는다.
- 외부 결제사 호출은 `src/gateway/` 밖에서 하지 않는다.
- 커밋 메시지는 한국어로 쓴다.
MD
printf '{ "name": "settlement", "version": "1.0.0", "scripts": { "test": "node --test", "verify": "node --test" } }\n' > package.json
cat > src/amount.js <<'JS'
function toWon(value) {
  if (!Number.isInteger(value)) throw new Error('won amounts must be integers');
  return value;
}
module.exports = { toWon };
JS
cat > test/amount.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert');
const { toWon } = require('../src/amount');
test('keeps integer won amounts', () => assert.strictEqual(toWon(1200), 1200));
test('rejects fractional amounts', () => assert.throws(() => toWon(12.5)));
JS
cat > .claude/ship-flow.config.json <<'JSON'
{
  "branchModel": "trunk-based",
  "releaseBranch": "main",
  "packageManager": "npm",
  "verifyCommand": "npm run verify",
  "projectName": "settlement",
  "trackerName": "none",
  "pluginBinPrefix": "",
  "outputLanguage": "ko"
}
JSON
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm "정산 서비스 초기 구성"
