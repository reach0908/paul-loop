#!/usr/bin/env bash
set -euo pipefail
mkdir -p .claude docs/agents src test
# The repo keeps its tracker in local files, so publishing a PRD or an issue can only write here.
cat > .claude/ship-flow.config.json <<'JSON'
{
  "projectName": "order-admin",
  "packageManager": "npm",
  "verifyCommand": "npm test",
  "trackerName": "backlog-file",
  "trackerDoc": "docs/agents/issue-tracker.md",
  "outputLanguage": "ko"
}
JSON
cat > docs/agents/issue-tracker.md <<'MD'
# 이슈 트래커

외부 트래커(GitHub Issues, Linear 등)는 쓰지 않는다. PRD와 이슈 모두 이 저장소 안의 파일로 관리한다.

- PRD: `docs/prd/<주제>.md` 파일 하나.
- 이슈: `docs/backlog.md` 한 파일에 모은다. 이슈 하나가 섹션 하나이고, 제목 줄은 `## #1 로그인 세션 만료 처리`처럼 `## #<번호> <제목>` 형식이다. 번호는 1부터 차례로 붙인다.
- 다른 이슈는 본문에서 `#<번호>`로 가리킨다.
- 프로젝트·에픽 같은 묶음은 없다. 모든 이슈가 같은 목록에 들어간다.
MD
printf '# Backlog\n\n형식은 docs/agents/issue-tracker.md 참고.\n' > docs/backlog.md
printf '{ "name": "order-admin", "version": "1.0.0", "private": true, "scripts": { "test": "node --test" } }\n' > package.json
cat > README.md <<'MD'
# order-admin

운영팀이 쓰는 주문 관리자 API. Node 22 내장 모듈만 쓴다.

- `GET /admin/orders?status=paid&from=2026-09-01&to=2026-09-30`: 관리자 전용 주문 목록(JSON). `status`, `from`, `to`는 모두 선택이고 기간은 양 끝을 포함한다.
- 관리자 확인은 `Authorization: Bearer <토큰>` 헤더로 한다. 토큰 목록은 `ADMIN_TOKENS` 환경 변수(쉼표 구분).

```sh
npm test
ADMIN_TOKENS=dev-token node src/admin.js
```
MD
cat > src/orders.js <<'JS'
// Order store. Production replaces this array with a database query.
const ORDERS = [
  { id: 'A-1001', createdAt: '2026-09-02', status: 'paid', customerName: '김민수', phone: '010-1234-5678', total: 32000 },
  { id: 'A-1002', createdAt: '2026-09-03', status: 'cancelled', customerName: '이서연', phone: '010-9876-5432', total: 15000 },
  { id: 'A-1003', createdAt: '2026-09-10', status: 'shipped', customerName: '박지훈', phone: '010-5555-0101', total: 87000 },
]

function listOrders({ status, from, to } = {}, source = ORDERS) {
  return source.filter(o =>
    (!status || o.status === status) &&
    (!from || o.createdAt >= from) &&
    (!to || o.createdAt <= to))
}

module.exports = { listOrders, ORDERS }
JS
cat > src/admin.js <<'JS'
const http = require('node:http')
const { listOrders } = require('./orders')

const ADMIN_TOKENS = new Set((process.env.ADMIN_TOKENS || '').split(',').filter(Boolean))

function requireAdmin(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  if (ADMIN_TOKENS.has(token)) return true
  res.writeHead(403, { 'content-type': 'application/json' }).end('{"error":"forbidden"}')
  return false
}

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'GET' && url.pathname === '/admin/orders') {
    if (!requireAdmin(req, res)) return
    const filter = Object.fromEntries(url.searchParams)
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify(listOrders(filter)))
  }
  res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}')
}

if (require.main === module) http.createServer(handle).listen(process.env.PORT || 3000)

module.exports = { handle, requireAdmin }
JS
cat > test/orders.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { listOrders } = require('../src/orders')

const sample = [
  { id: '1', createdAt: '2026-09-01', status: 'paid' },
  { id: '2', createdAt: '2026-09-15', status: 'cancelled' },
]

test('filters by status', () => {
  assert.deepEqual(listOrders({ status: 'paid' }, sample).map(o => o.id), ['1'])
})

test('filters by an inclusive date range', () => {
  assert.deepEqual(listOrders({ from: '2026-09-15', to: '2026-09-30' }, sample).map(o => o.id), ['2'])
})
JS
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
