---
type: llm
focus: { source: file, path: docs/backlog.md }
---

Context the backlog was written from. The PRD covers booking cancellation and a waitlist for a small Node room-booking API: a booker cancels their own booking for a slot that has not started; a user joins or leaves a first-come waitlist for a full room and slot; a successful cancellation promotes the first waitlisted person to a booking in the same request and notifies them through the existing log-only notifier; an admin sees waitlist counts per slot behind the existing admin token. Out of scope: payments or refunds, email or SMS, manual reordering of the waitlist. One open question (whether to skip a waitlisted person who already booked another room at that slot) needs the operations team.

PASS if every issue is a thin vertical slice that delivers one behavior end to end (module change, HTTP endpoint and tests together) and can be demonstrated or verified on its own, the issues together cover cancel, join and leave waitlist, automatic promotion with notification, and the admin waitlist view, and each dependency points from a behavior to a slice it actually needs (for example promotion depends on cancel and on the waitlist).
FAIL if any issue is a horizontal layer (only a data structure, only routes, only tests, only documentation), an issue plans out-of-scope work, an in-scope behavior above is not covered by any issue, or an issue treats the open skip question as decided without flagging that it needs the operations team.
