#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node --input-type=module - "$HERE/../../ship-flow/workflows" <<'JS'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
const load = name => new AsyncFunction('args', 'agent', 'parallel', 'pipeline', 'phase', 'log', readFileSync(join(process.argv[2], name + '.js'), 'utf8').replace(/^export const meta/m, 'const meta'))
const parallel = thunks => Promise.all(thunks.map(t => t()))
const pipeline = (items, ...stages) => Promise.all(items.map(async item => { let r = item; for (const stage of stages) r = await stage(r, item); return r }))
const review = load('adversarial-review'), audit = load('harness-audit')
const args = { target: 'fixture', domains: [{ key: 'one', prompt: 'read fixture' }] }
const finding = { title: 'bug', detail: 'observed fixture mismatch', severity: 'major' }
const vote = status => ({ status, reason: 'checked fixture', evidence: 'node fixture.test: result observed' })
const run = agent => review(args, agent, parallel, pipeline, () => {}, () => {})
for (const invalid of ['', '  ', {}, []]) {
  const result = await run(async (_, o) => o.phase === 'Find' ? { findings: [] } : invalid)
  assert.equal(result.status, 'incomplete', 'critic must return a substantive report')
}
let r = await run(async (_, o) => o.phase === 'Find' ? null : 'critic')
assert.equal(r.status, 'incomplete'); assert.equal(r.coverage[0].status, 'incomplete')
let n = 0
r = await run(async (_, o) => o.phase === 'Find' ? { findings: [finding] } : o.phase === 'Verify' ? [vote('confirmed'), vote('refuted'), null][n++] : 'critic')
assert.equal(r.confirmed.length, 0); assert.equal(r.refuted.length, 0); assert.equal(r.unverified.length, 1)
r = await run(async (_, o) => o.phase === 'Find' ? { findings: [finding] } : o.phase === 'Verify' ? { status: 'confirmed', reason: 'guess', evidence: '' } : 'critic')
assert.equal(r.status, 'incomplete'); assert.equal(r.unverified.length, 1)
r = await run(async (_, o) => { if (o.phase === 'Find') throw new Error('unavailable'); return 'critic' })
assert.equal(r.coverage[0].status, 'incomplete')
let active = 0, max = 0, calls = 0
r = await review({ ...args, domains: ['a', 'b', 'c'].map(key => ({ key, prompt: 'p' })), maxAgentCalls: 7, maxConcurrency: 2 }, async (_, o) => {
  calls++; active++; max = Math.max(max, active)
  await new Promise(resolve => setTimeout(resolve, 2)); active--
  return o.phase === 'Find' ? { findings: [finding, finding] } : o.phase === 'Verify' ? vote('confirmed') : 'critic'
}, parallel, pipeline, () => {}, () => {})
assert.ok(calls <= 7); assert.ok(max <= 2); assert.equal(r.status, 'incomplete'); assert.ok(r.incompleteCalls.some(c => c.status === 'not_run'))
r = await review({ ...args, budgetMs: 1 }, async () => { await new Promise(resolve => setTimeout(resolve, 5)); return { findings: [] } }, parallel, pipeline, () => {}, () => {})
assert.equal(r.status, 'incomplete'); assert.equal(r.budget.exceeded, true)
const phases = [], prompts = []
r = await audit({ outputLanguage: 'ko' }, async (prompt, o) => {
  phases.push(o.phase); prompts.push(prompt)
  if (o.phase === 'Context') return { path: 'docs/audit.md', context: 'ADR: source operations N/A', repositoryRole: 'provider', outputLanguage: 'en' }
  if (o.label === 'audit:skills') return null
  if (o.phase === 'Investigate') return { dimension: 'untrusted wrong key', level: 'N/A', oneLine: 'provider', evidence: [{ observation: 'read ADR' }], strengths: [], gaps: [] }
  return '보고서'
}, parallel, pipeline, () => {}, () => {})
assert.equal(phases[0], 'Context'); assert.equal(r.status, 'incomplete'); assert.equal(r.findings.length, 6)
assert.equal(r.findings.find(f => f.dimension === 'skills').status, 'incomplete'); assert.equal(r.outputLanguage, 'ko')
assert.ok(prompts.filter(p => p.includes('Prior context')).every(p => p.includes('ADR: source operations N/A')))
assert.ok(prompts.at(-1).includes('in ko'))
const context = { path: '', context: 'provider role observed; no prior report found', repositoryRole: 'provider', outputLanguage: 'ko' }
const lane = { dimension: 'fixture', level: 'N/A', oneLine: 'provider', evidence: [{ observation: 'read ADR' }], strengths: [], gaps: [] }
for (const invalid of ['', '  ', {}, []]) {
  r = await audit({}, async (_, o) => o.phase === 'Context' ? context : o.phase === 'Investigate' ? lane : invalid, parallel, pipeline, () => {}, () => {})
  assert.equal(r.status, 'incomplete'); assert.equal(r.stageCoverage.synthesis, 'incomplete')
  r = await audit({}, async (_, o) => o.phase === 'Context' ? invalid : o.phase === 'Investigate' ? lane : 'report', parallel, pipeline, () => {}, () => {})
  assert.equal(r.status, 'incomplete'); assert.equal(r.stageCoverage.context, 'incomplete')
}
const research = load('improvement-research')
const runResearch = (a, fn) => research(a, fn, parallel, pipeline, () => {}, () => {})
const sourced = (claim, url, load_bearing = true) => ({ claim, source: url, evidence_class: 'empirical', load_bearing })
const opened = status => ({ status, opened: true, source_opened: 'https://a.example', note: 'read original', correction: status === 'corrected' ? 'fixed value' : undefined })
for (const bad of [{ topic: 't' }, { topic: 't', domains: [{ key: 'a', prompt: 'p' }], reportPath: '/r.md' }, { topic: 't', domains: [{ key: '', prompt: 'p' }] }]) {
  await assert.rejects(runResearch(bad, async () => null))
}
r = await runResearch({ topic: 't', domains: [{ key: 'a', prompt: 'p' }, { key: 'b', prompt: 'p' }] }, async (_, o) =>
  o.label === 'collect:a' ? null
  : o.phase === 'Collect' ? { claims: [sourced('kept', 'https://a.example/x'), sourced('no url', ''), sourced('bad url', 'see paper')] }
  : o.phase === 'Verify' ? opened('confirmed') : 'report')
assert.equal(r.status, 'incomplete'); assert.equal(r.coverage.find(c => c.domain === 'a').status, 'incomplete')
assert.equal(r.verified.length, 1); assert.equal(r.rejected.length, 2)
const verifyPrompts = []
r = await runResearch({ topic: 't', reportPath: '/abs/report.md' }, async (prompt, o) => {
  if (o.label === 'extract') { assert.match(prompt, /untrusted data/); return { claims: [sourced('a', 'https://a.example'), sourced('b', 'https://b.example'), sourced('c', 'https://c.example')] } }
  if (o.phase === 'Verify') {
    verifyPrompts.push(prompt)
    if (prompt.includes('https://a.example')) return { status: 'unreachable', opened: false, note: '403' }
    if (prompt.includes('https://b.example')) return { status: 'confirmed', opened: false, note: 'from memory' }
    return { status: 'corrected', opened: true, note: 'date differs' }
  }
  return 'report'
})
assert.equal(r.mode, 'verify'); assert.equal(r.unreachable.length, 1); assert.equal(r.refuted.length, 0)
assert.equal(r.inconclusive.length, 2, 'unopened confirm and correction without a value stay inconclusive'); assert.equal(r.status, 'incomplete')
assert.ok(verifyPrompts.length === 3 && verifyPrompts.every(p => p.includes('untrusted data')))
r = await runResearch({ topic: 't', domains: [{ key: 'a', prompt: 'p' }], maxClaimsPerDomain: 1 }, async (prompt, o) =>
  o.phase === 'Collect' ? { claims: [sourced('minor', 'https://m.example', false), sourced('major', 'https://j.example')] }
  : o.phase === 'Verify' ? (assert.ok(prompt.includes('major')), opened('corrected')) : 'report')
assert.equal(r.verified.length, 1); assert.equal(r.verified[0].claim, 'major')
assert.equal(r.unverifiedOverCap.length, 1); assert.equal(r.unverifiedOverCap[0].claim, 'minor'); assert.equal(r.status, 'incomplete')
calls = 0
r = await runResearch({ topic: 't', domains: [{ key: 'a', prompt: 'p' }, { key: 'b', prompt: 'p' }], maxAgentCalls: 2 }, async (_, o) => {
  calls++
  return o.phase === 'Collect' ? { claims: [sourced('x', 'https://x.example')] } : o.phase === 'Verify' ? opened('confirmed') : 'report'
})
assert.ok(calls <= 2); assert.equal(r.status, 'incomplete'); assert.ok(r.incompleteCalls.some(c => c.status === 'not_run'))
r = await runResearch({ topic: 't', domains: [{ key: 'a', prompt: 'p' }], outputLanguage: 'ko' }, async (prompt, o) =>
  o.phase === 'Collect' ? { claims: [sourced('x', 'https://x.example')] }
  : o.phase === 'Verify' ? opened('confirmed') : (assert.ok(prompt.includes('in ko')), '보고서'))
assert.equal(r.status, 'complete'); assert.equal(r.reportBody, '보고서'); assert.equal(r.verified.length, 1)
r = await runResearch({ topic: 't', domains: [{ key: 'a', prompt: 'p' }] }, async (_, o) =>
  o.phase === 'Collect' ? { claims: [sourced('x', 'https://x.example')] } : o.phase === 'Verify' ? opened('confirmed') : '  ')
assert.equal(r.status, 'incomplete'); assert.equal(r.reportBody, '')
console.log('PASS: required lane coverage, evidence-backed quorum, global dispatch limits, prior context and language; improvement-research source-verified claims')
JS
