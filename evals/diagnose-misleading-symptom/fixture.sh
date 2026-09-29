#!/usr/bin/env bash
set -euo pipefail
mkdir -p src test data
printf '{ "name": "shop", "version": "1.0.0", "scripts": { "test": "node --test" } }\n' > package.json
cat > data/prices.txt <<'TXT'
Tea;12,50
Mug;3,20
Spoon;4
TXT
cat > src/catalog.js <<'JS'
const fs = require('node:fs')
const path = require('node:path')

function loadPrices(file = path.join(__dirname, '..', 'data', 'prices.txt')) {
  const prices = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const [name, raw] = line.split(';')
    prices[name] = parseFloat(raw)
  }
  return prices
}

module.exports = { loadPrices }
JS
cat > src/cart.js <<'JS'
const { loadPrices } = require('./catalog')

function total(items, prices = loadPrices()) {
  let sum = 0
  for (const { name, qty } of items) sum += prices[name] * qty
  return Math.round(sum * 100) / 100
}

module.exports = { total }
JS
cat > test/cart.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { total } = require('../src/cart')

test('two teas', () => {
  assert.equal(total([{ name: 'Tea', qty: 2 }]), 25)
})

test('mixed basket', () => {
  assert.equal(total([{ name: 'Tea', qty: 1 }, { name: 'Mug', qty: 1 }, { name: 'Spoon', qty: 2 }]), 23.7)
})

test('whole-number price', () => {
  assert.equal(total([{ name: 'Spoon', qty: 3 }]), 12)
})
JS
