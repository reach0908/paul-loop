#!/usr/bin/env bash
set -euo pipefail
mkdir -p .claude docs/agents docs/prd src test
# The repo keeps its tracker in local files, so publishing issues can only write here.
cat > .claude/ship-flow.config.json <<'JSON'
{
  "projectName": "room-booking",
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
printf '{ "name": "room-booking", "version": "1.0.0", "private": true, "scripts": { "test": "node --test" } }\n' > package.json
cat > README.md <<'MD'
# room-booking

사내 스터디룸 예약 API. Node 22 내장 모듈만 쓴다.

- `POST /bookings` `{ roomId, slot, userId }`: 예약. 이미 찬 시간대면 409.
- `GET /bookings?userId=`: 내 예약 목록.
- `GET /admin/bookings`: 전체 예약 목록. `x-admin-token` 헤더가 `ADMIN_TOKEN` 환경 변수와 같아야 한다.
- 예약이 되면 `notify`로 예약자에게 알린다(지금은 로그만 남긴다).

```sh
npm test
ADMIN_TOKEN=dev node src/server.js
```
MD
cat > docs/prd/waitlist.md <<'MD'
# 예약 취소와 대기열

## 문제

인기 있는 시간대는 금방 차는데, 못 오게 된 사람이 예약을 취소할 방법이 없다. 그래서 방은 비어 있고, 그 시간대를 원하던 사람은 빈자리가 나는지 계속 새로고침한다.

## 해결 방안

예약자가 자기 예약을 취소할 수 있게 한다. 꽉 찬 시간대에는 대기 등록을 받고, 예약이 취소되면 그 시간대의 대기 1순위에게 예약을 자동으로 넘긴 뒤 알린다.

## 사용자 스토리

1. 예약자로서, 내 예약을 취소하고 싶다. 그래야 못 쓰는 방을 다른 사람이 쓸 수 있다.
2. 예약자로서, 꽉 찬 시간대에 대기 등록을 하고 싶다. 그래야 자리가 나면 순서대로 받을 수 있다.
3. 대기자로서, 앞사람이 취소하면 자동으로 예약되길 원한다. 그래야 계속 확인하지 않아도 된다.
4. 대기자로서, 자동으로 예약되면 알림을 받고 싶다. 그래야 예약이 생긴 걸 바로 안다.
5. 대기자로서, 대기를 그만두고 싶다. 그래야 필요 없어진 자리를 뒷사람이 받는다.
6. 관리자로서, 시간대별 대기 인원을 보고 싶다. 그래야 방을 늘릴 시간대를 고를 수 있다.

## 구현 결정

- 예약 모듈에 취소를 추가한다. 본인 예약만, 아직 시작하지 않은 시간대만 취소할 수 있다.
- 대기열은 방·시간대별 선착순 목록이고 예약 모듈이 관리한다. 한 사람이 같은 방·시간대에 예약과 대기를 함께 가질 수 없다.
- 취소가 성공하면 같은 요청 안에서 대기 1순위를 예약으로 옮긴다. 별도 작업 큐는 두지 않는다.
- 알림은 기존 notify를 그대로 쓴다.
- 관리자 조회는 기존 관리자 토큰 확인을 그대로 쓴다.
- API: `DELETE /bookings/:id`, `POST /waitlist`, `DELETE /waitlist/:id`, `GET /admin/waitlist?date=`.

## 테스트 결정

- 예약 모듈의 공개 함수와 HTTP 핸들러에서 바깥으로 보이는 동작만 확인한다.
- 기존 예약 테스트(node:test)와 같은 방식으로 쓴다.
- 꼭 필요한 시나리오: 취소 뒤 대기 1순위 승격, 대기 순서 유지, 남의 예약 취소 거부, 지난 시간대 취소 거부.

## 범위 밖

- 결제·환불 (지금 예약은 무료)
- 이메일·문자 알림 (기존 notify 로그만 쓴다)
- 대기 순번 수동 조정

## 기타

- 대기 1순위가 같은 시간대에 이미 다른 방을 예약해 둔 경우 건너뛸지는 아직 정하지 않았다. 제안은 건너뛰고 다음 순번에게 넘기는 것이고, 운영팀 확인이 필요하다.
MD
cat > src/bookings.js <<'JS'
// Bookings by room and slot. Production replaces this Map with a database.
const bookings = new Map()
let nextId = 1

function createBooking({ roomId, slot, userId }) {
  for (const b of bookings.values()) {
    if (b.roomId === roomId && b.slot === slot) {
      const err = new Error('slot taken')
      err.code = 'SLOT_TAKEN'
      throw err
    }
  }
  const booking = { id: String(nextId++), roomId, slot, userId }
  bookings.set(booking.id, booking)
  return booking
}

function listBookings({ userId } = {}) {
  return [...bookings.values()].filter(b => !userId || b.userId === userId)
}

function reset() {
  bookings.clear()
  nextId = 1
}

module.exports = { createBooking, listBookings, reset }
JS
cat > src/notify.js <<'JS'
// Notifications. For now they only go to the log.
function notify(userId, message) {
  console.log(`[notify] ${userId}: ${message}`)
}

module.exports = { notify }
JS
cat > src/server.js <<'JS'
const http = require('node:http')
const { createBooking, listBookings } = require('./bookings')
const { notify } = require('./notify')

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

function isAdmin(req) {
  return Boolean(process.env.ADMIN_TOKEN) && req.headers['x-admin-token'] === process.env.ADMIN_TOKEN
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'POST' && url.pathname === '/bookings') {
    try {
      const booking = createBooking(await readJson(req))
      notify(booking.userId, `${booking.roomId} ${booking.slot} booked`)
      return send(res, 201, booking)
    } catch (err) {
      if (err.code === 'SLOT_TAKEN') return send(res, 409, { error: 'slot taken' })
      throw err
    }
  }
  if (req.method === 'GET' && url.pathname === '/bookings') {
    return send(res, 200, listBookings({ userId: url.searchParams.get('userId') }))
  }
  if (req.method === 'GET' && url.pathname === '/admin/bookings') {
    if (!isAdmin(req)) return send(res, 403, { error: 'forbidden' })
    return send(res, 200, listBookings())
  }
  send(res, 404, { error: 'not found' })
}

if (require.main === module) http.createServer(handle).listen(process.env.PORT || 3000)

module.exports = { handle }
JS
cat > test/bookings.test.js <<'JS'
const test = require('node:test')
const assert = require('node:assert/strict')
const { createBooking, listBookings, reset } = require('../src/bookings')

test.beforeEach(reset)

test('books a free slot', () => {
  const booking = createBooking({ roomId: 'A', slot: '2026-10-01T10', userId: 'kim' })
  assert.deepEqual(listBookings({ userId: 'kim' }), [booking])
})

test('rejects a slot that is already booked', () => {
  createBooking({ roomId: 'A', slot: '2026-10-01T10', userId: 'kim' })
  assert.throws(() => createBooking({ roomId: 'A', slot: '2026-10-01T10', userId: 'lee' }), { code: 'SLOT_TAKEN' })
})
JS
git init -q -b main
git add -A
git -c user.name=fixture -c user.email=fixture@localhost commit -qm initial
