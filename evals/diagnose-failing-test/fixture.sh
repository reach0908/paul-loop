#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test
printf '{ "name": "checkout", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/price.js <<'EOF'
function applyDiscount(amount, rate) {
  return amount * (1 - rate)
}

function finalPrice(amount, rate) {
  const discounted = applyDiscount(amount, rate)
  return Math.round(applyDiscount(discounted, rate) * 100) / 100
}

module.exports = { applyDiscount, finalPrice }
EOF
cat > test/price.test.js <<'EOF'
const test = require('node:test')
const assert = require('node:assert/strict')
const { finalPrice } = require('../src/price')

test('applies the discount once', () => {
  assert.equal(finalPrice(100, 0.1), 90)
})

test('rounds to cents', () => {
  assert.equal(finalPrice(19.99, 0.15), 16.99)
})

test('keeps the price without a discount', () => {
  assert.equal(finalPrice(50, 0), 50)
})
EOF
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
