#!/usr/bin/env bash
# Regression test for context-budget.mjs (BAC-582 — O1 상시 컨텍스트 예산 3층 분리 계측).
#
# 계약: O1a(세션 1회 상주 — 레포/개인 레이어 버킷 분리) + O1b(턴당 recall 주입, 실주입 spawn) +
# O1c(온디맨드 — 바이트 참고 표기만). 총합 = o1a.total_tokens + o1b.per_turn_tokens × turns.
# 토큰은 count_tokens 실측(method:"api") 또는 bytes/3 근사(method:"approx") — 근사를 실측으로
# 위장하지 않는다. 결손 축(개인 파일 부재·훅 무출력)은 null/INSUFFICIENT_DATA로 명시, exit 0 고정.
# 전 케이스 hermetic: 실 API·실 ~/.claude 미참조(HOME 격리 + 127.0.0.1 모의 서버).
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../../.."
BUDGET="$ROOT/tools/loop-engine/bin/context-budget.mjs"

fail() { echo "FAIL: $1"; exit 1; }
[ -f "$BUDGET" ] || fail "context-budget.mjs not found at $BUDGET"

DIR="$(mktemp -d "${TMPDIR:-/tmp}/tmp.XXXXXXXX")" || fail "mktemp -d failed"
MOCK_PID=""
trap 'if [ -n "$MOCK_PID" ]; then kill "$MOCK_PID" 2>/dev/null; wait "$MOCK_PID" 2>/dev/null; fi; rm -rf "$DIR"' EXIT

# ── 픽스처: 레포 루트(스킬 1 + node_modules 미끼 스킬 1 + o1c 소스) + 빈 HOME ────────────────
R="$DIR/root"
H="$DIR/home"
mkdir -p "$R/.claude/skills/a" "$R/node_modules/junk/.claude/skills/x" \
  "$R/.loop/lessons" "$R/docs/adr" "$R/docs/agents" "$H"
printf 'repo CLAUDE.md fixture content for context budget measurement' > "$R/CLAUDE.md"
{
  printf -- '---\nname: a\ndescription: fixture skill for context-budget test\n---\n'
  head -c 10240 /dev/zero | tr '\0' 'b'
} > "$R/.claude/skills/a/SKILL.md"
printf -- '---\nname: x\ndescription: must be excluded\n---\nbody\n' > "$R/node_modules/junk/.claude/skills/x/SKILL.md"
printf '{"title":"lesson fixture"}' > "$R/.loop/lessons/one.json"
printf '# adr fixture' > "$R/docs/adr/0001-fixture.md"
printf '# agents fixture' > "$R/docs/agents/fixture.md"

# ── 1) approx 폴백: 키 언셋(env -u — 빈 문자열 할당은 언셋이 아니다) → method:"approx" ───────
JSON="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --json)" || fail "approx mode must exit 0"
node -e '
  const fs = require("node:fs");
  const m = JSON.parse(process.argv[1]);
  const claudeBytes = fs.statSync(process.argv[2] + "/CLAUDE.md").size;
  if (m.method !== "approx") throw new Error("method must be approx without API key, got " + m.method);
  if (m.o1a.repo.claude_md.method !== "approx") throw new Error("claude_md bucket method must be approx");
  if (m.o1a.repo.claude_md.bytes !== claudeBytes) throw new Error("claude_md bytes must match the file");
  if (m.o1a.repo.claude_md.tokens !== Math.round(claudeBytes / 3)) throw new Error("approx must be round(bytes/3)");
' "$JSON" "$R" || fail "approx fallback must be honest (method:approx, tokens=round(bytes/3))"
echo "PASS: no API key falls back to bytes/3 with method:approx (no fabricated precision)"

# ── 2) 개인 레이어 부재 = null(N/A) — 값 날조 금지, exit 0 ──────────────────────────────────
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1a.personal.global_claude_md !== null) throw new Error("absent global CLAUDE.md must be null");
  if (m.o1a.personal.memory_md !== null) throw new Error("absent MEMORY.md must be null");
  if (m.o1a.personal.plugin_skill_frontmatter !== null) throw new Error("absent plugins file must be null");
  if (m.o1a.personal_tokens !== 0) throw new Error("personal subtotal must be 0 when all buckets are N/A");
' "$JSON" || fail "absent personal layer must be null (N/A), never fabricated"
echo "PASS: absent personal-layer assets report null, exit 0"

# ── 3) frontmatter만 상주 계측(본문은 O1c) + node_modules 제외 + 훅 부재=INSUFFICIENT_DATA ──
node -e '
  const m = JSON.parse(process.argv[1]);
  const fm = m.o1a.repo.skill_frontmatter;
  if (fm.files !== 1) throw new Error("must find exactly 1 repo skill (node_modules excluded), got " + fm.files);
  if (!(fm.bytes > 0 && fm.bytes < 200)) throw new Error("skill_frontmatter must exclude the 10KB body, got " + fm.bytes + "B");
  if (m.o1c.skill_bodies_bytes < 10000) throw new Error("skill body belongs to o1c, got " + m.o1c.skill_bodies_bytes);
  if (m.o1c.lessons_bytes <= 0) throw new Error("o1c must count .loop/lessons bytes");
  if (m.o1c.docs_adr_bytes <= 0 || m.o1c.docs_agents_bytes <= 0) throw new Error("o1c must count docs/adr + docs/agents bytes");
  if (m.o1b.status !== "INSUFFICIENT_DATA") throw new Error("missing hook must be INSUFFICIENT_DATA, got " + m.o1b.status);
  if (m.total.tokens !== m.o1a.total_tokens) throw new Error("total without O1b data must be O1a only");
  if (m.total.includes_o1b !== false) throw new Error("O1b-less total must declare includes_o1b:false (부분값을 완전값으로 위장 금지)");
' "$JSON" || fail "frontmatter/body split or O1b honesty wrong"
echo "PASS: only frontmatter counts as resident; body is O1c; missing hook is INSUFFICIENT_DATA"

# ── 4) API 경로: 127.0.0.1 모의 count_tokens 서버 → method:"api", 비200 → 버킷별 approx 폴백 ─
cat > "$DIR/mock.js" <<'EOF'
const http = require('node:http')
const fs = require('node:fs')
const srv = http.createServer((req, res) => {
  let b = ''
  req.on('data', (c) => { b += c })
  req.on('end', () => {
    fs.appendFileSync(process.argv[2], b + '\n')
    let model = ''
    try { model = JSON.parse(b).model } catch {}
    res.setHeader('content-type', 'application/json')
    if (model === 'boom') { res.statusCode = 500; res.end('{}'); return }
    res.end(JSON.stringify({ input_tokens: 42 }))
  })
})
srv.listen(0, '127.0.0.1', () => { process.stdout.write(String(srv.address().port) + '\n') })
EOF
node "$DIR/mock.js" "$DIR/requests.jsonl" > "$DIR/port.txt" &
MOCK_PID=$!
for _ in $(seq 1 50); do [ -s "$DIR/port.txt" ] && break; sleep 0.1; done
PORT="$(cat "$DIR/port.txt")"
[ -n "$PORT" ] || fail "mock count_tokens server did not start"

# Default and explicit local measurement must not read personal inputs, transmit text or execute a recall hook,
# even with a configured API key and an available hook. Observe actual I/O, not just report fields.
mkdir -p "$H/.claude/plugins" "$R/.claude/hooks"
printf 'PRIVATE_FIXTURE_SENTINEL' > "$H/.claude/CLAUDE.md"
printf '{"version":2,"plugins":{}}' > "$H/.claude/plugins/installed_plugins.json"
cat > "$DIR/observe-reads.mjs" <<'EOF'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve } from 'node:path'
const read = fs.readFileSync
fs.readFileSync = function (path, ...args) {
  if (resolve(String(path)).startsWith(resolve(process.env.CB_PRIVATE_ROOT) + '/'))
    fs.appendFileSync(process.env.CB_READ_LOG, 'personal read\n')
  return read.call(this, path, ...args)
}
syncBuiltinESMExports()
EOF
cat > "$DIR/observed-hook.mjs" <<'EOF'
import { appendFileSync } from 'node:fs'
appendFileSync(process.env.CB_HOOK_LOG, 'hook executed\n')
process.stdout.write('HOOK_FIXTURE_SENTINEL')
EOF
cp "$DIR/observed-hook.mjs" "$R/.claude/hooks/recall-lessons.mjs"
for mode in default local configured; do
  args=(--json --root "$R")
  case "$mode" in
    local) args+=(--local) ;;
    configured) args+=(--project-dir "$R" --plugins-file "$H/.claude/plugins/installed_plugins.json"
      --hook "$DIR/observed-hook.mjs" --model fixture-model --turns 5 --o1b-prompt fixture-prompt) ;;
  esac
  JSON_DEFAULT="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
    CB_PRIVATE_ROOT="$H/.claude" CB_READ_LOG="$DIR/reads.log" CB_HOOK_LOG="$DIR/hook.log" \
    node --import "$DIR/observe-reads.mjs" "$BUDGET" "${args[@]}" 2> "$DIR/local-stderr")" || fail "$mode measurement must exit 0"
  [ ! -s "$DIR/requests.jsonl" ] || fail "local measurement must make zero API requests despite a configured key"
  [ ! -s "$DIR/reads.log" ] || fail "local measurement must not read personal files"
  [ ! -s "$DIR/hook.log" ] || fail "local measurement must not run a recall hook"
  [ ! -s "$DIR/local-stderr" ] || fail "local measurement must not emit a legacy migration notice"
  node -e '
    const m = JSON.parse(process.argv[1]);
    if (m.legacy_defaults !== false || Object.values(m.capabilities).some(Boolean)) throw Error("local mode must disable all capabilities");
    if (m.method !== "approx" || m.o1a.includes_personal !== false) throw Error("local mode must report local repo-only measurement");
    if (Object.values(m.o1a.personal).some(v => v !== null)) throw Error("excluded personal buckets must be null");
    if (m.o1b.status !== "NOT_REQUESTED" || m.total.includes_o1b !== false) throw Error("unrequested recall is not a measured zero");
  ' "$JSON_DEFAULT" || fail "local report must disclose excluded measurement axes"
  echo "PASS: $mode measurement performs no personal reads, API calls or hook executions"
done
rm "$H/.claude/CLAUDE.md" "$H/.claude/plugins/installed_plugins.json" "$R/.claude/hooks/recall-lessons.mjs"

JSON_API="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --json)" || fail "api mode must exit 0"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.method !== "api") throw new Error("method must be api against the mock server, got " + m.method);
  if (m.o1a.repo.claude_md.method !== "api") throw new Error("claude_md must be measured via api");
  if (m.o1a.repo.claude_md.tokens !== 42) throw new Error("tokens must come from count_tokens input_tokens, got " + m.o1a.repo.claude_md.tokens);
' "$JSON_API" || fail "count_tokens api path wrong"
echo "PASS: with a key the buckets are measured via count_tokens (method:api)"

JSON_500="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --model boom --json)" || fail "non-200 must not kill the script"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1a.repo.claude_md.method !== "approx") throw new Error("non-200 must fall back to approx per bucket");
  if (m.method !== "approx") throw new Error("all-fallback run must report approx, got " + m.method);
' "$JSON_500" || fail "non-200 fallback wrong"
echo "PASS: non-200 API response falls back to approx per bucket, exit 0"

# ── 5) 플러그인 스캔: installed_plugins.json(version 2) → installPath/skills/*/SKILL.md ──────
P="$DIR/plug"
mkdir -p "$P/p1/skills/s1" "$P/p1/skills/s2" "$P/p2/skills/s3" "$P/none"
printf -- '---\nname: s1\ndescription: plugin skill one\n---\nbody one\n' > "$P/p1/skills/s1/SKILL.md"
printf -- '---\nname: s2\ndescription: plugin skill two\n---\nbody two\n' > "$P/p1/skills/s2/SKILL.md"
printf -- '---\nname: s3\ndescription: plugin skill three\n---\nbody three\n' > "$P/p2/skills/s3/SKILL.md"
cat > "$DIR/plugins.json" <<EOF
{"version":2,"plugins":{"p1@mp":[{"installPath":"$P/p1"}],"p2@mp":[{"installPath":"$P/p2"}],"noskills@mp":[{"installPath":"$P/none"}]}}
EOF
JSON_PLUG="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/plugins.json" --json)" || fail "plugin scan must exit 0"
node -e '
  const m = JSON.parse(process.argv[1]);
  const p = m.o1a.personal.plugin_skill_frontmatter;
  if (!p) throw new Error("plugin bucket must exist with a valid plugins file");
  if (p.plugins !== 2) throw new Error("plugins with skills must be 2, got " + p.plugins);
  if (p.skills !== 3) throw new Error("skills must be 3, got " + p.skills);
  if (!(p.bytes > 0)) throw new Error("plugin frontmatter bytes must be > 0");
  if (!Array.isArray(p.by_plugin) || p.by_plugin.length !== 2) throw new Error("by_plugin must list the 2 skill-bearing plugins");
  if (!p.caveat) throw new Error("plugin bucket must carry the upper-bound caveat (disk sum != injected)");
  if (m.o1a.personal_tokens !== p.tokens) throw new Error("personal subtotal must equal the plugin bucket (others N/A)");
  if (m.o1a.repo_tokens !== m.o1a.repo.claude_md.tokens + m.o1a.repo.skill_frontmatter.tokens)
    throw new Error("repo bucket must sum repo assets only (plugin/personal leak into repo_tokens)");
  if (m.o1a.total_tokens !== m.o1a.repo_tokens + m.o1a.personal_tokens)
    throw new Error("o1a total must be repo_tokens + personal_tokens exactly");
' "$JSON_PLUG" || fail "plugin skill frontmatter scan wrong"
echo "PASS: marketplace plugin skills counted per-plugin in the personal bucket, with caveat"

# ── 6) O1b 실주입 spawn + 총합식: 고정 300자 스텁 → per_turn=100(approx), total=o1a+100×turns ─
cat > "$DIR/stub-hook.mjs" <<'EOF'
import { readFileSync } from 'node:fs'
try { readFileSync(0, 'utf8') } catch {}
process.stdout.write('x'.repeat(300))
EOF
cat > "$DIR/stub-silent.mjs" <<'EOF'
import { readFileSync } from 'node:fs'
try { readFileSync(0, 'utf8') } catch {}
EOF
JSON_HOOK="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --hook "$DIR/stub-hook.mjs" --turns 5 --json)" || fail "o1b run must exit 0"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1b.status !== "OK") throw new Error("stub output must be OK, got " + m.o1b.status + " (" + m.o1b.reason + ")");
  if (m.o1b.per_turn_tokens !== 100) throw new Error("300 chars must approx to 100 tokens, got " + m.o1b.per_turn_tokens);
  if (m.turns !== 5) throw new Error("turns must be the CLI value, got " + m.turns);
  if (m.turns_source !== "--turns") throw new Error("turns_source must record the CLI origin");
  if (m.total.formula !== "o1a.total_tokens + o1b.per_turn_tokens * turns") throw new Error("formula field missing/wrong");
  if (m.total.includes_o1b !== true) throw new Error("measured O1b must declare includes_o1b:true");
  if (m.total.tokens !== m.o1a.total_tokens + 100 * 5) throw new Error("total must be o1a + o1b*turns, got " + m.total.tokens);
' "$JSON_HOOK" || fail "O1b measurement or total formula wrong"
echo "PASS: O1b measured by spawning the real hook contract; total = o1a + o1b*turns"

JSON_SILENT="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --hook "$DIR/stub-silent.mjs" --turns 5 --json)" || fail "silent hook run must exit 0"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1b.status !== "INSUFFICIENT_DATA") throw new Error("empty stdout must be INSUFFICIENT_DATA (fail-open: silence==failure), got " + m.o1b.status);
  if (m.o1b.per_turn_tokens !== null) throw new Error("insufficient O1b must not fabricate per_turn_tokens");
  if (m.total.tokens !== m.o1a.total_tokens) throw new Error("total without O1b must be O1a only");
  if (m.total.includes_o1b !== false) throw new Error("silent-hook total must declare includes_o1b:false");
' "$JSON_SILENT" || fail "silent hook must be honest INSUFFICIENT_DATA"
echo "PASS: empty hook stdout reports INSUFFICIENT_DATA, total falls back to O1a only"

# ── 7) baseline 기록 + 사람용 텍스트 출력 ───────────────────────────────────────────────────
OUT_BASE="$DIR/out/baseline.json"
JSON_BL="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json" --write-baseline "$OUT_BASE" --json 2>/dev/null)" || fail "baseline write must exit 0"
[ -f "$OUT_BASE" ] || fail "baseline file must be created at the given path"
node -e '
  const fs = require("node:fs");
  const b = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (!b.measured_at) throw new Error("baseline must record measured_at");
  if (!b.model) throw new Error("baseline must record the count model (동일 모델 재실행 비교용)");
  if (!b.total || b.total.formula !== "o1a.total_tokens + o1b.per_turn_tokens * turns") throw new Error("baseline must carry the total formula");
' "$OUT_BASE" || fail "baseline content must be a parseable full report"
node -e 'JSON.parse(process.argv[1])' "$JSON_BL" || fail "--write-baseline must keep stdout as clean JSON"
echo "PASS: --write-baseline persists the full report as parseable JSON"

OUT_TXT="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/none.json")"; rc=$?
[ "$rc" = "0" ] || fail "text mode must exit 0, got $rc"
printf '%s' "$OUT_TXT" | grep -q "=== CONTEXT BUDGET (O1) ===" || fail "text output must open with the block marker"
printf '%s' "$OUT_TXT" | grep -q "INSUFFICIENT_DATA" || fail "text output must surface O1b INSUFFICIENT_DATA honestly"
echo "PASS: human-readable output shows the block marker and honest O1b status"

# ── 8) 플러그인 파일 '부재' vs '존재하나 해석 불가' 구분: 손상 JSON → null + stderr 경고 ──────
printf '{not json' > "$DIR/corrupt.json"
ERR_CORRUPT="$DIR/corrupt-err.txt"
JSON_CORRUPT="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --plugins-file "$DIR/corrupt.json" --json 2>"$ERR_CORRUPT")" || fail "corrupt plugins file must still exit 0"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1a.personal.plugin_skill_frontmatter !== null) throw new Error("unparseable plugins file must yield null (no fabrication)");
' "$JSON_CORRUPT" || fail "corrupt plugins file must not fabricate a bucket"
grep -q "not valid JSON" "$ERR_CORRUPT" || fail "unparseable plugins file must warn on stderr (absent vs corrupt must differ)"
echo "PASS: corrupt plugins file stays N/A but is loudly distinguished from absence on stderr"

# ── 9) 개인 레이어 positive 경로: 글로벌 CLAUDE.md + MEMORY.md 키 도출('/'→'-') + 버킷 정합 ──
mkdir -p "$H/.claude"
printf 'global personal claude md fixture' > "$H/.claude/CLAUDE.md"
PKEY="$(node -e 'process.stdout.write(process.argv[1].replaceAll("/", "-"))' "$R")"
mkdir -p "$H/.claude/projects/$PKEY/memory"
printf 'personal memory md fixture content' > "$H/.claude/projects/$PKEY/memory/MEMORY.md"
JSON_PERS="$(env -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL HOME="$H" \
  node "$BUDGET" --api --include-personal --run-hook --root "$R" --project-dir "$R" --plugins-file "$DIR/none.json" --json)" || fail "personal positive run must exit 0"
node -e '
  const fs = require("node:fs");
  const m = JSON.parse(process.argv[1]);
  const H = process.argv[2];
  const PKEY = process.argv[3];
  const g = m.o1a.personal.global_claude_md;
  const mem = m.o1a.personal.memory_md;
  if (!g) throw new Error("existing global CLAUDE.md must be measured, got null");
  if (g.bytes !== fs.statSync(H + "/.claude/CLAUDE.md").size) throw new Error("global CLAUDE.md bytes must match the file");
  if (!mem) throw new Error("existing MEMORY.md must be found via project-dir key derivation, got null");
  if (mem.bytes !== fs.statSync(H + "/.claude/projects/" + PKEY + "/memory/MEMORY.md").size) throw new Error("MEMORY.md bytes must match the file");
  if (m.o1a.personal_tokens !== g.tokens + mem.tokens) throw new Error("personal subtotal must sum personal buckets only");
  if (m.o1a.repo_tokens !== m.o1a.repo.claude_md.tokens + m.o1a.repo.skill_frontmatter.tokens)
    throw new Error("personal assets must not leak into repo_tokens");
  if (m.o1a.total_tokens !== m.o1a.repo_tokens + m.o1a.personal_tokens) throw new Error("o1a total must be repo + personal exactly");
' "$JSON_PERS" "$H" "$PKEY" || fail "personal-layer positive path (global CLAUDE.md / MEMORY.md key derivation) wrong"
echo "PASS: existing personal-layer assets are found, measured, and kept out of the repo bucket"

# The capability flags are independent; a configured key/path does not grant another capability.
printf 'PRIVATE_GLOBAL_FIXTURE' > "$H/.claude/CLAUDE.md"
printf 'PRIVATE_MEMORY_FIXTURE' > "$H/.claude/projects/$PKEY/memory/MEMORY.md"
API_BEFORE="$(wc -l < "$DIR/requests.jsonl")"
JSON_PERSONAL_ONLY="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  CB_PRIVATE_ROOT="$H/.claude" CB_READ_LOG="$DIR/reads.log" CB_HOOK_LOG="$DIR/hook.log" \
  node --import "$DIR/observe-reads.mjs" "$BUDGET" --include-personal --root "$R" --project-dir "$R" \
  --plugins-file "$DIR/plugins.json" --hook "$DIR/observed-hook.mjs" --json)" || fail "personal-only measurement must succeed"
[ -s "$DIR/reads.log" ] || fail "personal opt-in must actually read the fixture"
[ ! -s "$DIR/hook.log" ] || fail "personal opt-in must not run a hook"
[ "$API_BEFORE" = "$(wc -l < "$DIR/requests.jsonl")" ] || fail "personal opt-in must not send text despite a key"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.method !== "approx" || !m.o1a.includes_personal || !m.o1a.personal.memory_md) throw Error("personal-only report mismatch");
  if (m.o1a.personal.plugin_skill_frontmatter.skills !== 3 || m.o1b.status !== "NOT_REQUESTED") throw Error("selected scope mismatch");
' "$JSON_PERSONAL_ONLY" || fail "personal-only scope must remain local"
rm "$DIR/reads.log"
echo "PASS: personal opt-in reads personal/plugin inputs without API or hook effects"

JSON_HOOK_ONLY="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  CB_PRIVATE_ROOT="$H/.claude" CB_READ_LOG="$DIR/reads.log" CB_HOOK_LOG="$DIR/hook.log" \
  node --import "$DIR/observe-reads.mjs" "$BUDGET" --run-hook --root "$R" \
  --hook "$DIR/observed-hook.mjs" --json)" || fail "hook-only measurement must succeed"
[ "$(wc -l < "$DIR/hook.log" | tr -d ' ')" = 1 ] || fail "hook opt-in must execute exactly once"
[ ! -s "$DIR/reads.log" ] || fail "hook opt-in must not enable personal reads"
[ "$API_BEFORE" = "$(wc -l < "$DIR/requests.jsonl")" ] || fail "hook opt-in must not send its output to count_tokens"
node -e '
  const m = JSON.parse(process.argv[1]);
  if (m.o1b.status !== "OK" || m.o1b.method !== "approx" || !m.total.includes_o1b) throw Error("hook-only report mismatch");
  if (m.o1a.includes_personal) throw Error("hook execution is not personal-input permission");
' "$JSON_HOOK_ONLY" || fail "hook-only scope must be reported accurately"
echo "PASS: hook opt-in executes only the hook; its output is counted locally"

JSON_API_ONLY="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  CB_PRIVATE_ROOT="$H/.claude" CB_READ_LOG="$DIR/reads.log" CB_HOOK_LOG="$DIR/hook.log" \
  node --import "$DIR/observe-reads.mjs" "$BUDGET" --api --root "$R" \
  --plugins-file "$DIR/plugins.json" --hook "$DIR/observed-hook.mjs" --json)" || fail "API-only measurement must succeed"
[ ! -s "$DIR/reads.log" ] || fail "API opt-in must not enable personal reads"
[ "$(wc -l < "$DIR/hook.log" | tr -d ' ')" = 1 ] || fail "API opt-in must not run another hook"
node -e '
  const fs = require("node:fs"), m = JSON.parse(process.argv[1]);
  const requests = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(Number(process.argv[3]));
  if (requests.length !== 2 || m.method !== "api" || m.o1a.includes_personal || m.o1b.status !== "NOT_REQUESTED") throw Error("API-only scope mismatch");
  if (requests.some(r => /PRIVATE_.*_FIXTURE|HOOK_FIXTURE_SENTINEL/.test(r))) throw Error("API-only must not transmit excluded content");
' "$JSON_API_ONLY" "$DIR/requests.jsonl" "$API_BEFORE" || fail "API-only must send just the selected repo buckets"
echo "PASS: API opt-in does not read or transmit the excluded personal/hook fixtures"

API_BEFORE="$(wc -l < "$DIR/requests.jsonl")"
env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  CB_HOOK_LOG="$DIR/hook.log" node "$BUDGET" --api --include-personal --run-hook --root "$R" --project-dir "$R" \
  --plugins-file "$DIR/plugins.json" --hook "$DIR/observed-hook.mjs" --json > "$DIR/full.json" || fail "full opt-in must succeed"
node -e '
  const fs = require("node:fs"), m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const requests = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(Number(process.argv[3]));
  if (requests.length !== 6 || m.legacy_defaults || !Object.values(m.capabilities).every(Boolean)) throw Error("full opt-in must measure all six buckets explicitly");
  for (const text of ["PRIVATE_GLOBAL_FIXTURE", "PRIVATE_MEMORY_FIXTURE", "HOOK_FIXTURE_SENTINEL"]) {
    if (!requests.some(r => r.includes(text))) throw Error("authorized fixture input was not measured");
  }
' "$DIR/full.json" "$DIR/requests.jsonl" "$API_BEFORE" || fail "full opt-in must retain actual API measurement"
echo "PASS: explicit full measurement retains personal, plugin and hook API coverage"

for capability in --api --include-personal --run-hook; do
  env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
    node "$BUDGET" --local "$capability" --root "$R" > "$DIR/conflict-out" 2> "$DIR/conflict-err"
  [ "$?" = 2 ] || fail "--local must reject conflicting capability flags"
done
LOCAL_TEXT="$(env HOME="$H" ANTHROPIC_API_KEY=dummy ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT" \
  node "$BUDGET" --root "$R")" || fail "default text report must succeed"
printf '%s' "$LOCAL_TEXT" | grep -q 'NOT_REQUESTED' || fail "local text report must disclose excluded measurements"
echo "PASS: conflicting flags are rejected and local text output discloses unmeasured inputs"

exit 0
