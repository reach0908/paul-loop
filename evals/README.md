# Skill evals

`claude plugin eval` cases for this plugin. Each case directory holds `prompt.md` (the request and
run limits), optional `case.yaml` + `fixture.sh` (a scaffolded project), and `graders/`. The rules
below adapt pstack's eval playbook (MIT, cursor/plugins `ecc249f`, `poteto-mode/playbooks/eval.md`)
to this runner; `node scripts/check-evals.mjs` enforces the mechanical ones.

## Rules

1. **Blind the target.** No `eval`, `judge`, `experiment`, `rubric`, `score`, `benchmark`,
   `candidate`, `arena`, `grader`, `oracle` (or 평가·채점·실험·벤치마크·루브릭) in the request or
   anything `fixture.sh` creates. `test` and `compare` stay allowed: a failing-test or TDD task
   cannot avoid them. Name files and branches the way a user would.
2. **Organic request.** Write what a user would type: the goal, not the procedure. Don't name the
   skill under test or the criterion (a one-question case never says "one question").
3. **Grade traces and artifacts, not claims.** Never ask the target to list the skills or steps it
   used. Prefer deterministic graders: `file_exists`, `regex` on files, `tool_used`, `tool_order`.
   Every case needs one besides the peek guard; a reply-only case is tagged `dialogue` instead. An
   `llm` grader with `focus: trace` sees only the first and last messages of a long run, so check run
   order (red before green, green after the last edit) with a `regex` on the trace, which reads it all.
4. **Anchor edit scope on the path.** Edit/Write inputs carry file contents, so an Edit/Write
   `input_match` starts with `"file_path"\s*:\s*"[^"]*` and ends at the file name.
5. **Keep the oracle out of reach.** Every case has `graders/no-oracle-peek.md` (a trace regex,
   `arm: both`) that fails a run which opens another case's prompt, graders or fixture.
6. **Don't aim at host-protected paths.** The eval host blocks writes to `.claude/`; a task that must
   create a project skill names a plain location such as `skills/`. The loader also ends a grader's
   frontmatter at the first `---` anywhere, and one unloadable file fails the whole suite: write `-{3}`.
7. **The judge is not the target.** `llm` graders get a different model than `--model` (Opus target →
   Sonnet judge, Sonnet target → Opus judge). This runner has no non-Claude judge, so deterministic
   graders carry the verdict and judge verdicts are secondary.
8. **Read what failed.** Before recording a result, read the trace excerpt of every failing run and of
   one passing run per case. A failure caused by the case (a blocked path, a grader matching the
   wrong thing) is fixed and rerun, and the first run is not reported as a score.
9. **Control arm and sample size.** Plugin effect: the default with/without arms. Model or effort
   choice: `--ablation none` — which scores the `tool_used: Skill` and `arm: with-only` graders
   instead of treating them as indicators, so report model/effort pass rates with those graders
   excluded and the fire rate separately (`scripts/summarize-evals.mjs` does both). Three runs per arm find breakage; they do not support an effect claim.
   Report counts, list-price cost, turns and duration, and Fisher's exact p for a with/without
   difference. Record every reported run in `docs/audits/` with the result file's SHA-256; raw
   results stay in git-ignored `.loop/plugin-eval/`.

Cases tagged `hard` are built to separate models: the obvious fix or reading is wrong. Cases tagged
`git` need the target to run git (see Running).

## Running

```sh
node scripts/check-evals.mjs
# From inside a Claude Code session, drop installed plugins' bin/ dirs (they reach both arms,
# so the no-plugin arm could call an old installed loop-engine) and the session's CLAUDE_EFFORT.
CLEAN_PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/.claude/plugins/cache/' | paste -sd: -)"
# plugin effect (with/without), Opus target
env -u CLAUDE_EFFORT PATH="$CLEAN_PATH" claude plugin eval . --scaffold --trust-plugin --no-publish \
  --allow-tools Bash Write Edit --model claude-opus-5-5 --judge-model claude-sonnet-5 --max-cost-usd 20 \
  --output-dir .loop/plugin-eval/<run> --json .loop/plugin-eval/<run>/result.json
# model or effort choice: with-plugin arm only; effort goes through the environment
env -u CLAUDE_EFFORT PATH="$CLEAN_PATH" CLAUDE_CODE_EFFORT_LEVEL=low claude plugin eval . \
  --ablation none --model claude-sonnet-5 --judge-model claude-opus-5-5 ...
```

`CLAUDE_CODE_EFFORT_LEVEL` is not a documented eval option, but the eval passes `CLAUDE_CODE_*`
variables to its children and it overrides `--effort`, so don't mix the two. A child reports its
level in `$CLAUDE_EFFORT`, which a Bash call can echo. That check needs an effort-capable model
(Haiku leaves the variable alone) and `env -u CLAUDE_EFFORT`, or the parent session's value shows
through unchanged.

**git on macOS.** The eval sandbox (2.1.283) denies file metadata on real git binaries (Xcode,
Command Line Tools, Homebrew), so the shell cannot find them on PATH, and `/usr/bin/git`, the xcrun
shim, fails because it cannot write its cache or reach Xcode. Targets therefore cannot run git on a
macOS host; `git`-tagged cases are only measurable on a host where that works. Fixture scripts run
outside the sandbox and are unaffected.
