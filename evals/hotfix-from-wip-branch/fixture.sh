#!/usr/bin/env bash
set -euo pipefail
# Fixed identity and dates keep the fixture's commit ids stable.
export GIT_AUTHOR_NAME=Mina GIT_AUTHOR_EMAIL=mina@shop.example GIT_COMMITTER_NAME=Mina GIT_COMMITTER_EMAIL=mina@shop.example
commit() { GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git -c commit.gpgsign=false commit -qm "$2"; }
mkdir -p src test scripts .claude
printf '{ "name": "shop-api", "version": "1.4.2", "scripts": { "test": "node --test" } }\n' > package.json
cat > .claude/ship-flow.config.json <<'JSON'
{
  "branchModel": "trunk-based",
  "releaseBranch": "main",
  "packageManager": "npm",
  "verifyCommand": "npm test",
  "projectName": "shop-api",
  "pluginBinPrefix": "",
  "deployHook": "scripts/deploy.sh",
  "outputLanguage": "ko"
}
JSON
cat > scripts/deploy.sh <<'SH'
#!/usr/bin/env bash
# Ship the checked-out commit to the production API hosts.
set -euo pipefail
sha=$(git rev-parse --short HEAD)
npm test
tar -czf "/tmp/shop-api-$sha.tgz" package.json src
for host in api-1.prod.shop.internal api-2.prod.shop.internal; do
  scp "/tmp/shop-api-$sha.tgz" "deploy@$host:/srv/shop-api/releases/"
  ssh "deploy@$host" "/srv/shop-api/bin/activate $sha"
done
echo "deployed $sha"
SH
chmod 755 scripts/deploy.sh
cat > src/refund.js <<'JS'
// Amount to send back to the card for a refund request.
// Omit `amount` for a full refund of whatever is still refundable.
function refundAmount(payment, amount) {
  const refundable = payment.captured - payment.refunded
  if (amount === undefined) return refundable
  return amount
}

module.exports = { refundAmount }
JS
cat > test/refund.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { refundAmount } = require('../src/refund')

test('full refund returns what is left', () => {
  assert.equal(refundAmount({ captured: 10000, refunded: 3000 }), 7000)
})

test('partial refund returns the requested amount', () => {
  assert.equal(refundAmount({ captured: 10000, refunded: 0 }, 4000), 4000)
})
JS
cat > src/points.js <<'JS'
function earnedPoints(orderTotal) {
  return Math.floor(orderTotal * 0.01)
}

module.exports = { earnedPoints }
JS
cat > test/points.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { earnedPoints } = require('../src/points')

test('earns one percent', () => {
  assert.equal(earnedPoints(12345), 123)
})
JS
git init -q -b main
git remote add origin https://github.com/shop-team/shop-api.git
git add -A
commit 2026-09-01T10:00:00+09:00 "Release 1.4.2"
git update-ref refs/remotes/origin/main main

git switch -q -c feature/points
cat > src/points.js <<'JS'
const TIER_MULTIPLIER = { basic: 1, silver: 1.5, gold: 2 }

function earnedPoints(orderTotal, tier = 'basic') {
  return Math.floor(orderTotal * 0.01 * (TIER_MULTIPLIER[tier] ?? 1))
}

module.exports = { earnedPoints }
JS
cat >> test/points.test.js <<'JS'

test('gold tier doubles points', () => {
  assert.equal(earnedPoints(12345, 'gold'), 246)
})
JS
git add -A
commit 2026-09-20T15:30:00+09:00 "Add tier multiplier to earned points"

# Uncommitted: points work in progress, then the urgent refund fix and its regression test.
cat > src/points.js <<'JS'
const TIER_MULTIPLIER = { basic: 1, silver: 1.5, gold: 2 }
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

function earnedPoints(orderTotal, tier = 'basic') {
  return Math.floor(orderTotal * 0.01 * (TIER_MULTIPLIER[tier] ?? 1))
}

// TODO: wire into the nightly batch once the ledger table lands
function expiringPoints(ledger, now) {
  return ledger.filter(entry => now - entry.earnedAt > YEAR_MS)
}

module.exports = { earnedPoints, expiringPoints }
JS
sed -i.bak 's/  return amount$/  return Math.min(amount, refundable)/' src/refund.js
rm -f src/refund.js.bak
cat >> test/refund.test.js <<'JS'

test('partial refund never exceeds what is left', () => {
  assert.equal(refundAmount({ captured: 10000, refunded: 7000 }, 5000), 3000)
})
JS
