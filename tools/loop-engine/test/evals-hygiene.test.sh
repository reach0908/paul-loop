#!/usr/bin/env bash
# The repo's eval suite passes scripts/check-evals.mjs, and the checker fails each rule it exists
# for: a leaking request, an llm-only case, an unanchored edit grader, a .claude/ target, a grader
# frontmatter the loader would cut early or reject, and a missing oracle-peek guard. Rules: evals/README.md.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
CHECK="$ROOT/scripts/check-evals.mjs"
fail() { echo "FAIL: $1"; exit 1; }

out="$(node "$CHECK" "$ROOT/evals")" || fail "repo eval suite violates evals/README.md rules:
$out"
echo "PASS: repo eval suite passes the eval checks"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
good() { # $1 case dir: a minimal case that passes every rule
  mkdir -p "$1/graders"
  printf -- '---\ndescription: d\ntags: [x]\nmax_turns: 5\ntimeout_seconds: 60\n---\n\nFix the typo in README.md.\n' > "$1/prompt.md"
  printf -- "---\ntype: regex\ntarget: trace\nmatch: not_contains\npattern: 'evals/'\narm: both\n---\n" > "$1/graders/no-oracle-peek.md"
  printf -- "---\ntype: file_exists\npath: 'README.md'\n---\n" > "$1/graders/kept.md"
}
expect_fail() { # $1 label, $2 expected message fragment
  out="$(node "$CHECK" "$T")" && fail "$1: checker passed"
  printf '%s' "$out" | grep -q "$2" || fail "$1: expected '$2', got: $out"
  echo "PASS: $1 is rejected"
  rm -rf "${T:?}"/*
}

good "$T/ok"; node "$CHECK" "$T" >/dev/null || fail "a minimal compliant case is rejected"; rm -rf "${T:?}"/*
echo "PASS: a minimal compliant case passes"

good "$T/c"; sed -i.bak 's/Fix the typo/Help me benchmark and fix the typo/' "$T/c/prompt.md"
expect_fail "a request naming the measurement" "names the measurement"

good "$T/c"; rm "$T/c/graders/kept.md"; printf -- '---\ntype: llm\n---\nPASS if good.\n' > "$T/c/graders/j.md"
expect_fail "an llm-only case" "no scored deterministic grader"

good "$T/c"; printf -- "---\ntype: tool_used\ntool: Edit\ninput_match: 'src/a\\\\.js'\nmax: 0\n---\n" > "$T/c/graders/e.md"
expect_fail "an Edit grader matching file contents" 'anchor on "file_path"'

good "$T/c"; printf -- "---\ntype: file_exists\npath: '.claude/skills/x/SKILL.md'\n---\n" > "$T/c/graders/f.md"
expect_fail "a grader aimed at .claude/" "targets .claude/"

good "$T/c"; printf -- "---\ntype: regex\ntarget: trace\npattern: '^---'\n---\n" > "$T/c/graders/d.md"
expect_fail "a grader pattern containing ---" 'frontmatter contains "---"'

good "$T/c"; sed -i.bak 's/^path:.*/&\narm: with-only/' "$T/c/graders/kept.md"
expect_fail "a case whose only deterministic grader is with-only" "no scored deterministic grader"

good "$T/c"; printf -- "---\ntype: file_exists\npath: 'README.md'\narm: with\n---\n" > "$T/c/graders/a.md"
expect_fail "an arm value the loader rejects" "arm must be both or with-only"

good "$T/c"; printf -- "---\ntype: tool_used\ntool: Task\ninput_match: 'planner'\n---\n" > "$T/c/graders/t.md"
expect_fail "a grader on the Task tool name" "the subagent tool is Agent"

good "$T/c"; rm "$T/c/graders/no-oracle-peek.md"
expect_fail "a case without the peek guard" "no-oracle-peek grader missing"

node --input-type=module -e '
  import { fisher, summarize } from "'"$ROOT"'/scripts/summarize-evals.mjs";
  const near = (x, y) => Math.abs(x - y) < 1e-6;
  if (!near(fisher(3, 0, 0, 3), 0.1) || !near(fisher(2, 1, 3, 0), 1) || !near(fisher(10, 0, 0, 10), 2 / 184756)) throw new Error("fisher");
  const g = (name, passed, scored = true) => ({ name, passed, scored });
  const [row] = summarize({ cases: [{ name: "c",
    graders: [{ name: "fired", type: "tool_used", config: { tool: "Skill" } }, { name: "out", type: "file_exists", config: {} },
              { name: "guard", type: "tool_used", config: { tool: "Skill", max: 0, arm: "both" } },
              { name: "format", type: "regex", config: { arm: "with-only" } }],
    arms: { with: [{ graders: [g("fired", false), g("out", true), g("guard", true), g("format", false)], turns: 2, costUsd: 1, durationSeconds: 3 },
                   { graders: [g("fired", true), g("out", false), g("guard", true)], turns: 4, costUsd: 3, durationSeconds: 5 },
                   { graders: [g("fired", false), g("out", true), g("guard", false)], turns: 6, costUsd: 5, durationSeconds: 7 }] } }] });
  const a = row.arms.with;
  if (a.passed !== 1 || a.fired !== 1 || a.turns !== 4 || a.cost !== 3) throw new Error("summarize " + JSON.stringify(a));
' || fail "summarize-evals: pass counting (Skill graders excluded) or Fisher p is wrong"
echo "PASS: summarize-evals excludes Skill and with-only indicators (not arm-both guards) from pass and computes Fisher p"

echo "PASS: evals-hygiene"
