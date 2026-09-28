#!/usr/bin/env bash
set -euo pipefail
commit() { git -c user.name=fixture -c user.email=fixture@localhost commit -qm "$1"; }
mkdir -p src
printf '{ "name": "orders", "version": "1.0.0" }\n' > package.json
cat > src/orders.js <<'JS'
async function saveAll(orders, db) {
  for (const order of orders) {
    const row = { id: order.id, total: Math.round(order.amount * 100) / 100, status: order.status || 'new' }
    await db.save(row)
  }
  return orders.length
}

module.exports = { saveAll }
JS
git init -q -b main
git add -A
commit initial
git switch -q -c chore/tidy-order-persistence
cat > src/orders.js <<'JS'
/**
 * Normalize an order into the row shape the database stores.
 * @param {{ id: string, amount: number, status?: string }} order
 */
function toRow(order) {
  const total = Math.round(order.amount * 100) / 100
  return { id: order.id, total, status: order.status ?? 'new' }
}

/**
 * Persist every order and report how many were written.
 * @param {Array<{ id: string, amount: number, status?: string }>} orders
 * @param {{ save(row: object): Promise<void> }} db
 */
async function saveAll(orders, db) {
  orders.forEach(async (order) => {
    await db.save(toRow(order))
  })
  return orders.length
}

module.exports = { saveAll, toRow }
JS
git add -A
commit "Tidy order persistence: extract toRow, add JSDoc"
