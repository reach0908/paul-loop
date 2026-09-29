---
type: llm
focus: { source: file, path: docs/prd/order-csv-export.md }
---

Context the PRD was written from. The repository is a small Node order-admin API: `listOrders({ status, from, to })` filters orders by status and an inclusive createdAt date range; the admin route `GET /admin/orders` is guarded by `requireAdmin` (a bearer token checked against `ADMIN_TOKENS`); orders carry id, createdAt, status, customerName, phone and total; tests use `node:test` against `listOrders`. The meeting notes asked for: a CSV download of the admin order list using the same period and status filters, Korean text that opens unbroken in Excel, phone numbers with the middle four digits masked (010-****-5678), admin-only access, and no bulk exports of tens of thousands of rows this time (maybe a background job later).

PASS if the PRD covers all five requested points, places bulk or background export out of scope, builds on the existing listing filter and admin check rather than designing new filter semantics or a new permission model, and names the existing `listOrders` tests or the `node:test` suite as prior art or the place for new tests.
FAIL if a requested point is missing or contradicted, bulk or background export is planned as in-scope work, it invents filters, roles or data the code does not have, or it adds unrequested features (other file formats, scheduled or emailed reports) as in-scope.
