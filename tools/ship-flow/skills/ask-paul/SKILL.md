---
name: ask-paul
description: Ask which skill or flow fits your situation. A router over the skills this plugin ships.
disable-model-invocation: true
---

Follow the [shared authorization and completion contract](../AUTHORIZATION.md) before this procedure.

# Ask Paul

> **Output language.** Read `outputLanguage` (a BCP-47 tag, e.g. `ko`) from
> `.claude/ship-flow.config.json` and write **every human-facing prose artifact** — reports, summaries,
> questions, PR and tracked-issue bodies, your final message — in that language. **Code, commands, flags,
> identifiers, file paths, branch names, and quoted tool output stay verbatim; never translate them.** Key
> absent or unreadable → fall back to the language the user is writing in; never error on this.

You don't remember every skill, so ask.

A **flow** is a path through the skills. Choose the smallest procedure that completes the requested
outcome. A skill name or a finding does not enlarge the task.

**Scope, stated up front:** this routes over what *this plugin* ships. A consuming repo may install its
own skills alongside — those are its to document, and this map won't know about them.

## Choose the endpoint first

| Requested outcome | Procedure |
|---|---|
| Answer, research, diagnosis or review | Answer directly or use the relevant standalone skill; stop at its requested result. |
| Bounded local change | Edit and run the checks required by that change; no automatic plan-to-PR sequence. |
| Commit existing work, push current changes, or sync main | Use the host's normal Git procedure within existing authorization and repository protections. |
| Feature, bug or issue delivered from plan to an open PR | `ship-flow:ship-feature`. |

`publisher` is an internal executor selected only by an explicit `ship-feature` step-5 handoff in a
fresh subagent. It is not a Git shortcut. Do not manufacture a delivery run to use it; missing required
isolation blocks that publication step, with no inline substitute.

## Delivery from plan to PR

`ship-flow:ship-feature` runs the complete delivery sequence for that endpoint. A human merges;
post-merge harness work proceeds only when it belongs to the authorized scope. It calls:

1. **Plan.** `ship-flow:grill-with-docs` when there's a real design decision to settle (it leaves a
   paper trail in `CONTEXT.md` and ADRs); the `planner` agent validates the plan before any code exists,
   fail-closed on acceptance criteria that no machine could check.
2. **Build.** `ship-flow:tdd`, red→green, one behaviour at a time.
3. **Verify.** The repo's own verify command wrapped in the verdict contract — the verifier is the
   ceiling, never the agent's self-report.
4. **Review.** `code-reviewer`, `test-hunter`, and `verifier-integrity-hunter` agents, the last of which
   exists to catch the run grading its own homework.
5. **Publish.** The internal `publisher` agent runs authorized preassembled commands. A human merges.
6. **Learn.** `ship-flow:retrospect` records only what the verifier confirmed.

**Bigger than one unit of work?** `ship-flow:to-prd` turns the conversation into a PRD on the tracker,
then `ship-flow:to-issues` splits it into tracer-bullet issues with blocking edges. Each issue then
re-enters `ship-flow:ship-feature` from the top, with a clear context.

## On-ramps

- **Something's broken** → `ship-flow:diagnosing-bugs`. For the hard ones: the bug that resists a first
  glance, the intermittent flake, the regression between two known-good states. It refuses to theorise
  until it has a tight feedback loop that already goes red on *this* bug.
- **A release needs to go out, or a fix has to jump the queue** → `ship-flow:hotfix`, which knows the
  two-stage branch model and where the human stop points are.

## Codebase and harness health

These produce findings. Implement findings within the user's requested scope; an audit alone does
not authorize follow-up repairs, another project's changes, or a delivery run.

- `ship-flow:improve-codebase-architecture` surfaces **deepening opportunities**: shallow modules worth
  turning deep. It's the survey; `ship-flow:codebase-design` is the bench you design the chosen one on.
- `ship-flow:deps-audit` checks whether installed skills and plugins have drifted from upstream, gone
  unused, or quietly gone stale.
- `ship-flow:harness-maturity-audit` asks the harder question: is the loop itself getting better, or
  just busier.

## Vocabulary underneath

Reach for these directly when the **words**, not the process, are the problem — or let the skills above
pull them in.

- `ship-flow:domain-modeling` sharpens the project's *domain* language: challenge a fuzzy term, resolve
  an overloaded word, record a hard-to-reverse decision as an ADR. It's what keeps `CONTEXT.md` a
  glossary and not a scratch pad.
- `ship-flow:codebase-design` is the deep-module vocabulary — module, interface, depth, seam, adapter,
  leverage, locality — for designing a module's *shape*.
- `ship-flow:grilling` is the interview primitive: the design tree, one question at a time, facts are
  the agent's job and decisions are yours. `ship-flow:grill-with-docs` is the named way in that also
  keeps the docs current; reach for the primitive directly only when you want the interview bare.

## Standalone

- `ship-flow:resolving-merge-conflicts` works an in-progress merge or rebase hunk by hunk, resolving by
  **intent** traced to each side's primary source rather than by picking lines. Reach for it when you're
  already mid-conflict.
- `ship-flow:to-questionnaire` is for when the thing blocking you is in **someone else's** head. It
  interviews you about the *send* — who it goes to, what you need back — and aims the questions at the
  gap. What comes back is material for `ship-flow:grill-with-docs`.
- `ship-flow:wizard` is for steps only a **human** can take: provisioning, credentials, CI secrets, an
  unfamiliar third-party dashboard, a one-off cutover. It generates a bash script that opens each URL
  and captures each value, so the procedure stops being something you re-explain every time. If the
  agent could just do it, it should.
- `ship-flow:wait-what` is the corrective for a message that didn't land. Use it mid-conversation,
  inside any other skill, and the agent re-pitches with the step it skipped.

## Precondition

`ship-flow:setup` configures a consuming repo's delivery flow: tracker, branch model, verify command
and `pluginBinPrefix` in `.claude/ship-flow.config.json`. A question, local change or ordinary Git
operation does not require setup. For delivery, resolve needed values from existing repo evidence
first; ask only for a missing value that blocks the next step.
