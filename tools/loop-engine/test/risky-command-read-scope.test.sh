#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node --input-type=module - "$HERE/../hooks/gate-risky-commands.mjs" <<'JS'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
const root = mkdtempSync(join(tmpdir(), 'risky-read-'))
const hook = process.argv[2]
const plugin = dirname(dirname(hook))
const env = { ...process.env, CLAUDE_PROJECT_DIR: root }
delete env.CLASSIFY_RISK_RULES
try {
  writeFileSync(join(root, 'risk-rules.json'), JSON.stringify({ version: 1, pathRules: [], commandRules: [{ id: 'cmd-irreversible', patterns: ['tools/deploy/', 'gh\\s+pr\\s+merge'], dims: { revers: 'none' }, why: 'shared action' }] }))
  const run = (command, options = {}, payload = {}) => spawnSync(process.execPath, [hook], { encoding: 'utf8', cwd: root, env, ...options, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, ...payload }) })
  const decision = (result, expected) => {
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout).hookSpecificOutput
    assert.equal(output.permissionDecision, expected, output.permissionDecisionReason)
    return output.permissionDecisionReason
  }
  for (const command of ['cat tools/deploy/README.md', 'head -20 tools/deploy/script.sh', 'ls tools/deploy/']) {
    const r = run(command); assert.equal(r.status, 0); assert.equal(r.stdout, '')
  }
  for (const command of ['bash tools/deploy/release.sh', 'cat tools/deploy/README.md; gh pr merge 1', 'cat tools/deploy/README.md > result.txt', 'cat "$(tools/deploy/release.sh)"', 'gh pr merge 1']) {
    decision(run(command), 'ask')
  }
  console.log('PASS: plain deploy-document reads defer; execution, redirection, substitution and merge retain approval')

  rmSync(join(root, 'risk-rules.json'))
  for (const [command, stage] of [['gh pr merge 1', 'merge'], ['pnpm deploy', 'deploy'], ['pnpm run redeploy', 'deploy'], ['bash tools/deploy/release.sh', 'deploy']]) {
    assert.ok(decision(run(command), 'ask').includes(`human-only-stage (${stage})`))
  }
  assert.equal(run('cat tools/deploy/README.md').stdout, '')
  assert.match(decision(run('gh pr merge 1', {}, { permission_mode: 'bypassPermissions' }), 'deny'), /human-only-stage/)
  // Exercise the actual adapter subprocess; repeated calls never record an approval.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = spawnSync(process.execPath, [join(plugin, 'runtime/hook-adapter.mjs'), 'hooks/gate-risky-commands.mjs'], {
      encoding: 'utf8', cwd: root, env,
      input: JSON.stringify({ cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'gh pr merge 1' } }),
    })
    const reason = decision(result, 'deny')
    assert.match(reason, /Human review required/)
    assert.match(reason, /human-only-stage/)
    assert.doesNotMatch(reason, /classify-risk failed/)
  }
  console.log('PASS: optional rules may be absent; merge/deploy require approval; Codex and bypass mode deny')

  const rules = id => JSON.stringify({ commandRules: [{ id, patterns: ['.*'], dims: { blast: 'low', revers: 'full', cost: 'low' } }] })
  writeFileSync(join(root, 'risk-rules.json'), rules('project-rule'))
  assert.match(decision(run('gh pr merge 1', { cwd: tmpdir() }), 'ask'), /project-rule/)
  writeFileSync(join(root, 'override.json'), rules('env-rule'))
  for (const path of ['override.json', join(root, 'override.json')]) {
    const reason = decision(run('pnpm deploy', { cwd: tmpdir(), env: { ...env, CLASSIFY_RISK_RULES: path } }), 'ask')
    assert.match(reason, /env-rule/)
    assert.doesNotMatch(reason, /project-rule/)
    assert.match(reason, /human-only-stage/)
  }
  console.log('PASS: project cwd and env override are honored; permissive rules cannot waive approval')

  writeFileSync(join(root, 'bad.json'), '{invalid')
  for (const path of ['missing.json', 'bad.json']) {
    assert.match(decision(run('gh pr merge 1', { env: { ...env, CLASSIFY_RISK_RULES: path } }), 'deny'), /classify-risk failed/)
  }
  writeFileSync(join(root, 'risk-rules.json'), '{invalid')
  assert.match(decision(run('gh pr merge 1'), 'deny'), /classify-risk failed/)
  rmSync(join(root, 'risk-rules.json'))
  mkdirSync(join(root, 'risk-rules.json'))
  decision(run('pnpm deploy'), 'deny')
  rmSync(join(root, 'risk-rules.json'), { recursive: true })
  symlinkSync(join(root, 'missing.json'), join(root, 'risk-rules.json'))
  assert.match(decision(run('gh pr merge 1'), 'deny'), /classify-risk failed/)
  const classified = spawnSync(process.execPath, [join(plugin, 'bin/classify-risk.mjs'), '--path', 'src/example.ts', '--no-gate'], { encoding: 'utf8', cwd: root, env })
  assert.equal(classified.status, 2, 'a broken default symlink must not silently become empty rules')
  assert.match(classified.stderr, /not found/)
  console.log('PASS: explicit missing, malformed, directory and broken-symlink rules fail closed')
} finally { rmSync(root, { recursive: true, force: true }) }
JS
