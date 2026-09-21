# Logic Prototype

A tiny interactive demo that lets the user drive a state model by hand. Default to a terminal app;
use self-contained HTML when non-developers need to drive it or the review needs a shareable file.
Use this when the question is about **business logic, state transitions, or data shape** — the kind of thing that looks reasonable on paper but only feels wrong once you push it through real cases.

## When this is the right shape

- "I'm not sure if this state machine handles the edge case where X then Y."
- "Does this data model actually let me represent the case where..."
- "I want to feel out what the API should look like before writing it."
- Anything where the user wants to **press buttons and watch state change**.

If the question is "what should this look like" — wrong branch. Use [UI.md](UI.md).

## Process

### 1. State the question

Before writing code, write down what state model and what question you're prototyping. One paragraph, in the prototype's README or a comment at the top of the file. A logic prototype that answers the wrong question is pure waste — make the question explicit so it can be checked later, whether the user is watching now or returning to it AFK.

### 2. Pick the language

For a terminal app, use whatever the host project uses. If the project has no obvious runtime, choose an available lightweight one for an authorized
reversible prototype and state the choice; ask only when runtime constraints change the outcome.

Match the project's existing conventions for tooling — don't add a new package manager or runtime just for the prototype.

For HTML, use inline JavaScript with no build step. If it reimplements non-JavaScript production
logic, label it as a design model: its behavior does not verify the actual implementation.

### 3. Isolate the logic in a portable module

Put the actual logic — the bit that's answering the question — behind a small, pure interface that could be lifted out and dropped into the real codebase later. The terminal or HTML shell around it is throwaway.

The right shape depends on the question:

- **A pure reducer** — `(state, action) => state`. Good when actions are discrete events and state is a single value.
- **A state machine** — explicit states and transitions. Good when "which actions are even legal right now" is part of the question.
- **A small set of pure functions** over a plain data type. Good when there's no implicit current state — just transformations.
- **A class or module with a clear method surface** when the logic genuinely owns ongoing internal state.

Pick whichever shape best fits the question being asked, *not* whichever is easiest to wire to the
shell. Keep it pure: no I/O, terminal code, DOM access, or `console.log` for control flow. The shell
calls the module and renders its results; nothing flows the other direction.

This is what makes the prototype useful past its own lifetime. When the question's been answered, the validated logic informs a separately authorized production change with real tests and review.
Remove only owned throwaway files within cleanup scope; a prototype verdict is not release approval.

### 4. Build the smallest shell that exposes the state

Choose one of the following shapes.

**Terminal (default)**

Build it as a **lightweight TUI** — on every tick, clear the screen (`console.clear()` / `print("\033[2J\033[H")` / equivalent) and re-render the whole frame. The user should always see one stable view, not an ever-growing scrollback.

Each frame has two parts, in this order:

1. **Current state**, pretty-printed and diff-friendly (one field per line, or formatted JSON). Use **bold** for field names or section headers and **dim** for less important context (timestamps, IDs, derived values). Native ANSI escape codes are fine — `\x1b[1m` bold, `\x1b[2m` dim, `\x1b[0m` reset. No need to pull in a styling library unless one is already in the project.
2. **Keyboard shortcuts**, listed at the bottom: `[a] add user  [d] delete user  [t] tick clock  [q] quit`. Bold the key, dim the description, or vice-versa — whatever reads cleanly.

Behaviour:

1. **Initialise state** — a single in-memory object/struct. Render the first frame on start.
2. **Read one keystroke (or one line)** at a time, dispatch to a handler that mutates state.
3. **Re-render** the full frame after every action — don't append, replace.
4. **Loop until quit.**

The whole frame should fit on one screen.

**Shareable HTML**

Use one HTML file with inline CSS and JavaScript, no framework, CDN, bundler, server, or external
assets. Use domain language in the configured output language for labels and explanations.

- Show the question, readable current state, and what changed after each action.
- Provide free-play buttons for the relevant actions and explain illegal actions without corrupting state.
- Add short guided scenarios for a normal flow, an awkward edge case, and an illegal action. Each
  scenario starts by resetting to a known initial state, even after free play, and advances through
  real actions using the same logic module. Keep the controls keyboard accessible with native buttons.

### 5. Make it easy to run

For HTML, open the file directly in a browser and provide its path. Check that it works offline,
state updates after actions, and each guided scenario resets and replays correctly after free play.
No task-runner entry is needed. Opening a local artifact does not authorize sending or publishing it.

For a terminal app, add a script to the project's existing task runner (`package.json` scripts, `Makefile`, `justfile`, `pyproject.toml`). The user should run `pnpm run <prototype-name>` or equivalent — never need to remember a path.

If the host project has no task runner, just put the command at the top of the prototype's README.

### 6. Hand it over

Give the user the run command or HTML file path. They'll drive it themselves; the interesting moments are when they say "wait, that shouldn't be possible" or "huh, I assumed X would be different" — those are the bugs in the _idea_, which is the whole point. If they want new actions added, add them. Prototypes evolve.

### 7. Capture the answer

When the prototype has done its job, the answer to the question is the only thing worth keeping. If the user is around, ask what it taught them. If not, leave a `NOTES.md` next to the prototype so the answer can be filled in (or filled in by you, if you've watched the session) before the prototype gets deleted.

## Anti-patterns

- **Don't add tests.** A prototype that needs tests is no longer a prototype.
- **Don't wire it to the real database.** Use an in-memory store unless the question is specifically about persistence.
- **Don't generalise.** No "what if we wanted to support X later." The prototype answers one question.
- **Don't blur the logic and the shell together.** Keep terminal I/O and DOM access outside the pure module.
- **Don't ship the prototype shell into production.** Use the design findings within the implementation, review, and cleanup scope in [SKILL.md](SKILL.md).
