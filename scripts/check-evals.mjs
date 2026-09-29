#!/usr/bin/env node
// Static checks for the `claude plugin eval` suite under evals/ (rules: evals/README.md).
// Catches what a run cannot: a prompt or fixture that tells the target it is being measured,
// graders that only an LLM can pass, edit-scope graders that match file contents instead of the
// edited path, graders aimed at the host-protected .claude/ tree, and cases without the
// oracle-peek guard. Usage: node scripts/check-evals.mjs [evals-dir]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// pstack's blinding list minus `test` and `compare`, which are ordinary task words here (a TDD or
// failing-test request cannot avoid them), plus this repo's own meta vocabulary.
const LEAK = /\b(eval|evals|evaluation|judge|experiment|rubric|score|benchmark|candidate|arena|grader|oracle)\b|평가|채점|실험|벤치마크|루브릭/i;
const PEEK_GRADER = 'no-oracle-peek';

const frontmatter = text => {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  return m ? { head: m[1], body: m[2] } : { head: '', body: text };
};
const field = (head, name) => new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(head)?.[1].trim();

export function checkCase(dir) {
  const problems = [];
  const prompt = join(dir, 'prompt.md');
  if (!existsSync(prompt)) return ['prompt.md missing'];
  const { head, body } = frontmatter(readFileSync(prompt, 'utf8'));
  for (const f of ['description', 'tags', 'max_turns', 'timeout_seconds']) if (!field(head, f)) problems.push(`prompt.md: ${f} missing`);
  if (LEAK.test(body)) problems.push(`prompt.md body names the measurement: "${body.match(LEAK)[0]}"`);
  const fixture = join(dir, 'fixture.sh');
  if (existsSync(fixture) && LEAK.test(readFileSync(fixture, 'utf8'))) problems.push(`fixture.sh leaks: "${readFileSync(fixture, 'utf8').match(LEAK)[0]}"`);

  const gdir = join(dir, 'graders');
  const graders = existsSync(gdir) ? readdirSync(gdir).filter(f => f.endsWith('.md')).map(f => ({ name: f.slice(0, -3), ...frontmatter(readFileSync(join(gdir, f), 'utf8')) })) : [];
  if (!graders.length) problems.push('no graders');
  const type = g => field(g.head, 'type');
  // Indicators are not scored under with/without: Skill graders not marked `arm: both`, and `arm: with-only`.
  const indicator = g => (type(g) === 'tool_used' && field(g.head, 'tool') === 'Skill' && field(g.head, 'arm') !== 'both') || field(g.head, 'arm') === 'with-only';
  // A reply-only case (tag `dialogue`) has no artifact to check; its judge verdicts get a human read.
  const dialogue = /\bdialogue\b/.test(field(head, 'tags') || '');
  if (!dialogue && !graders.some(g => type(g) !== 'llm' && !indicator(g) && g.name !== PEEK_GRADER)) problems.push('no scored deterministic grader besides the peek guard (llm judges and Skill indicators alone cannot carry a case; tag `dialogue` if the reply is the only artifact)');

  const peek = graders.find(g => g.name === PEEK_GRADER);
  if (!peek) problems.push(`${PEEK_GRADER} grader missing`);
  else if (type(peek) !== 'regex' || field(peek.head, 'target') !== 'trace' || field(peek.head, 'match') !== 'not_contains' || field(peek.head, 'arm') !== 'both') problems.push(`${PEEK_GRADER} must be a regex, target trace, match not_contains, arm both`);

  for (const g of graders) {
    const t = type(g);
    // Claude Code names its subagent tool Agent; a `tool: Task` grader matches nothing and a max-0 guard passes vacuously.
    if (['tool_used', 'tool_order'].includes(t) && /\btool:\s*Task\b/.test(g.head)) problems.push(`${g.name}: the subagent tool is Agent, not Task`);
    // The eval loader ends frontmatter at the first `---` anywhere, and one unloadable file fails the whole suite.
    if (g.head.includes('---')) problems.push(`${g.name}: frontmatter contains "---", which ends it early for the eval loader (write -{3})`);
    const arm = field(g.head, 'arm');
    if (arm && !['both', 'with-only'].includes(arm)) problems.push(`${g.name}: arm must be both or with-only, which the eval loader accepts`);
    if (t === 'file_exists' && /^['"]?\.claude\//.test(field(g.head, 'path') || '')) problems.push(`${g.name}: targets .claude/, which the eval host blocks writes to`);
    // Edit/Write inputs carry file contents: an unanchored path pattern also matches a document
    // that merely mentions the file.
    const clauses = t === 'tool_used' ? [{ tool: field(g.head, 'tool'), match: field(g.head, 'input_match') }]
      : t === 'tool_order' ? ['before', 'after'].map(k => {
        const v = field(g.head, k) || '';
        return { tool: /tool:\s*(\w+)/.exec(v)?.[1], match: /input_match:\s*(.+?)\s*}\s*$/.exec(v)?.[1] };
      }) : [];
    for (const c of clauses) if (['Edit', 'Write'].includes(c.tool) && c.match && !c.match.includes('"file_path"')) problems.push(`${g.name}: ${c.tool} input_match must anchor on "file_path"`);
  }
  return problems;
}

export function checkSuite(root) {
  const cases = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'results').map(d => d.name).sort();
  return Object.fromEntries(cases.map(name => [name, checkCase(join(root, name))]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || join(fileURLToPath(new URL('..', import.meta.url)), 'evals'));
  const report = checkSuite(root);
  let failed = 0;
  for (const [name, problems] of Object.entries(report)) {
    for (const p of problems) { console.log(`FAIL ${name}: ${p}`); failed++; }
    if (!problems.length) console.log(`PASS ${name}`);
  }
  if (!Object.keys(report).length) { console.log('FAIL no cases found'); failed++; }
  process.exitCode = failed ? 1 : 0;
}
