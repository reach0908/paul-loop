#!/usr/bin/env node
// worktree-prune.mjs [--apply] — removes the linked worktrees of the current repository that hold
// nothing to lose: clean, unlocked, and exactly the head of a merged PR. Dry run by default.
//
// `git worktree remove` (never --force) refuses changed or untracked files but deletes ignored ones,
// such as `.loop/` receipts; lock a worktree (`git worktree lock --reason ...`) to keep it.
import { execFileSync } from 'node:child_process';
import { parseWorktreeList, physicalPath } from '../lib/worktree-session-state.mjs';

const apply = process.argv.includes('--apply');
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const firstLine = (e) => String(e.stderr || e.message).trim().split('\n')[0];

// The heads of this branch's merged PRs, or the reason gh couldn't say.
function mergedHeads(branch, cwd) {
  try {
    const out = execFileSync('gh', ['pr', 'list', '--head', branch, '--state', 'merged', '--json', 'headRefOid'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
    return { heads: JSON.parse(out).map((pr) => pr.headRefOid) };
  } catch (e) {
    return { error: firstLine(e) };
  }
}

function verdict(w, current) {
  if (w.prunable) return ['prune', 'directory is gone'];
  if (physicalPath(w.path) === current) return ['keep', 'current worktree'];
  if (w.locked) return ['keep', 'locked'];
  if (!w.branch) return ['keep', 'detached HEAD'];
  try {
    if (git(['status', '--porcelain'], w.path)) return ['keep', 'changed or untracked files'];
  } catch (e) {
    return ['keep', `git status failed: ${firstLine(e)}`];
  }
  const { heads, error } = mergedHeads(w.branch, w.path);
  if (!heads) return ['keep', `cannot check PRs with gh: ${error}`];
  if (!heads.includes(w.head)) return ['keep', 'no merged PR at this HEAD'];
  return ['remove', 'merged PR head, clean'];
}

let current, linked;
try {
  current = physicalPath(git(['rev-parse', '--show-toplevel']).trim());
  // The first entry is the main worktree (or a bare repository): never a candidate.
  [, ...linked] = parseWorktreeList(git(['worktree', 'list', '--porcelain', '-z']));
} catch (e) {
  // Not a repository, or no usable git: nothing to clean, and callers must not be blocked by it.
  console.log(`worktree-prune: skipped (${firstLine(e)})`);
  process.exit(0);
}
let failed = false;
for (const w of linked) {
  const [action, reason] = verdict(w, current);
  if (action !== 'remove' || !apply) {
    console.log(`${action === 'keep' || apply ? action : `would ${action}`}\t${w.path}\t${reason}`);
    continue;
  }
  try {
    git(['worktree', 'remove', w.path]);
    console.log(`removed\t${w.path}\t${reason}`);
  } catch (e) {
    failed = true;
    console.log(`failed\t${w.path}\t${firstLine(e)}`);
  }
}
if (apply) git(['worktree', 'prune']); // drops only registrations whose directory is gone; respects locks
process.exit(failed ? 1 : 0);
