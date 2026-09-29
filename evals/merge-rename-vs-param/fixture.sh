#!/usr/bin/env bash
set -euo pipefail
export GIT_AUTHOR_NAME=Mina GIT_AUTHOR_EMAIL=mina@shop.example GIT_COMMITTER_NAME=Mina GIT_COMMITTER_EMAIL=mina@shop.example
commit() { git -c commit.gpgsign=false commit -qm "$1" ${2:+-m "$2"}; }
mkdir -p src test
printf '{ "name": "shop", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > src/price.js <<'JS'
function calcTotal(items) {
  let sum = 0
  for (const item of items) sum += item.price * item.qty
  return Math.round(sum * 100) / 100
}

module.exports = { calcTotal }
JS
cat > src/checkout.js <<'JS'
const { calcTotal } = require('./price')

function checkoutSummary(cart) {
  return `${cart.items.length} items, total ${calcTotal(cart.items)}`
}

module.exports = { checkoutSummary }
JS
cat > test/price.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { calcTotal } = require('../src/price')

test('sums price times quantity', () => {
  assert.equal(calcTotal([{ price: 1.5, qty: 2 }, { price: 4, qty: 1 }]), 7)
})

test('empty cart is zero', () => {
  assert.equal(calcTotal([]), 0)
})
JS
cat > test/checkout.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { checkoutSummary } = require('../src/checkout')

test('summarises the cart', () => {
  assert.equal(checkoutSummary({ items: [{ price: 2, qty: 3 }] }), '1 items, total 6')
})
JS
git init -q -b main
git remote add origin https://github.com/shop-team/shop.git
git add -A
commit "Initial shop"

git switch -q -c feature/tax-rate
cat > src/price.js <<'JS'
function calcTotal(items, taxRate = 0) {
  let sum = 0
  for (const item of items) sum += item.price * item.qty
  return Math.round(sum * (1 + taxRate) * 100) / 100
}

module.exports = { calcTotal }
JS
cat >> test/price.test.js <<'JS'

test('applies the tax rate', () => {
  assert.equal(calcTotal([{ price: 10, qty: 2 }], 0.1), 22)
})
JS
git add -A
commit "Add optional tax rate to order totals"
cat > src/invoice.js <<'JS'
const { calcTotal } = require('./price')

const VAT = 0.1

function invoiceTotal(items) {
  return calcTotal(items, VAT)
}

module.exports = { invoiceTotal }
JS
cat > test/invoice.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { invoiceTotal } = require('../src/invoice')

test('invoice total includes VAT', () => {
  assert.equal(invoiceTotal([{ price: 10, qty: 3 }]), 33)
})
JS
git add -A
commit "Add invoice totals with VAT"

git switch -q main
sed -i.bak 's/calcTotal/computeTotal/g' src/price.js src/checkout.js test/price.test.js
rm -f src/*.bak test/*.bak
git add -A
commit "Rename calcTotal to computeTotal" "calcTotal read as if it also covered shipping. Every caller now uses computeTotal; the old name is removed, not kept as an alias."
git update-ref refs/remotes/origin/main main
git switch -q feature/tax-rate
git branch -q -f main main~1
git merge origin/main >/dev/null 2>&1 || true
# The sandbox cannot run the /usr/bin/git shim (xcrun cannot write its cache), but the real binary
# runs by full path. Point the target's zsh at it, only inside the sandboxed home.
home="$(cd .. && pwd -P)"
if [[ "$home" == /private/tmp/e-*/home ]] && real_git="$(xcrun -f git 2>/dev/null)"; then
  printf 'git() { "%s" "$@"; }\n' "$real_git" > "$home/.zshenv"
fi
