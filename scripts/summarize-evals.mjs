#!/usr/bin/env node
// Summarize `claude plugin eval --json` results the way evals/README.md rule 9 reports them.
// A run passes when every scored grader passes, not counting `tool_used: Skill` indicators: those are
// reported as a fire rate, because `--ablation none` would otherwise score them. A Skill guard with
// `arm: both` (e.g. "no delivery loop") stays scored.
// Usage: node scripts/summarize-evals.mjs <result.json> [more.json ...]
import { readFileSync } from 'node:fs';

const isSkill = g => g.type === 'tool_used' && g.config?.tool === 'Skill' && g.config?.arm !== 'both';

// Two-sided Fisher exact test for [[a, b], [c, d]].
export function fisher(a, b, c, d) {
  const lf = n => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const p = x => Math.exp(lf(r1) + lf(r2) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(r2 - c1 + x));
  const observed = p(a);
  let total = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) if (p(x) <= observed * (1 + 1e-9)) total += p(x);
  return Math.min(1, total);
}

export function summarize(result) {
  return result.cases.map(c => {
    const skill = new Set((c.graders || []).filter(isSkill).map(g => g.name));
    const arms = Object.fromEntries(Object.entries(c.arms || {}).map(([arm, runs]) => {
      const scored = run => run.graders.filter(g => g.scored !== false && !skill.has(g.name));
      const mean = f => runs.length ? runs.reduce((s, r) => s + f(r), 0) / runs.length : 0;
      return [arm, {
        runs: runs.length,
        errors: runs.filter(r => r.error).length,
        passed: runs.filter(r => !r.error && scored(r).every(g => g.passed)).length,
        fired: skill.size ? runs.filter(r => r.graders.some(g => skill.has(g.name) && g.passed)).length : null,
        turns: mean(r => r.turns), cost: mean(r => r.costUsd), seconds: mean(r => r.durationSeconds),
      }];
    }));
    const w = arms.with, o = arms.without;
    return { case: c.name, arms, fisherP: w && o ? fisher(w.passed, w.runs - w.passed, o.passed, o.runs - o.passed) : null };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of process.argv.slice(2)) {
    const result = JSON.parse(readFileSync(file, 'utf8'));
    const s = result.suite || {};
    console.log(`# ${file}\nmodel ${s.modelOverride ?? 'default'} · judge ${s.judgeModel} · plugin ${s.plugins?.map(p => p.version).join(',')} · $${(result.costUsd ?? 0).toFixed(2)} · ${result.durationSeconds}s${result.partial ? ' · PARTIAL' : ''}`);
    for (const row of summarize(result)) {
      const arms = Object.entries(row.arms).map(([arm, a]) => `${arm} ${a.passed}/${a.runs}${a.errors ? ` (${a.errors} err)` : ''}${a.fired === null ? '' : ` fired ${a.fired}/${a.runs}`} · ${a.turns.toFixed(1)} turns · $${a.cost.toFixed(3)} · ${a.seconds.toFixed(0)}s`);
      console.log(`${row.case}: ${arms.join(' | ')}${row.fisherP === null ? '' : ` | Fisher p ${row.fisherP.toFixed(2)}`}`);
    }
  }
}
