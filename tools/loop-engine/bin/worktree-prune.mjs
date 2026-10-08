#!/usr/bin/env node
// worktree-prune.mjs [--apply] — removes the linked worktrees of the current repository that hold
// nothing to lose: clean, unlocked, and exactly the head of a merged PR. Dry run by default.
//
// `git worktree remove` (never --force) refuses changed or untracked files but deletes ignored ones,
// such as `.loop/` receipts; lock a worktree (`git worktree lock --reason ...`) to keep it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseWorktreeList, physicalPath } from '../lib/worktree-session-state.mjs';

const apply = process.argv.includes('--apply');
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// The heads of this branch's merged PRs, or null when gh can't say.
function mergedHeads(branch, cwd) {
  try {
    const out = execFileSync('gh', ['pr', 'list', '--head', branch, '--state', 'merged', '--json', 'headRefOid'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out).map((pr) => pr.headRefOid);
  } catch {
    return null;
  }
}

function verdict(w, current) {
  if (!existsSync(w.path)) return ['prune', 'directory is gone'];
  if (physicalPath(w.path) === current) return ['keep', 'current worktree'];
  if (w.locked) return ['keep', 'locked'];
  if (!w.branch) return ['keep', 'detached HEAD'];
  try {
    if (git(['status', '--porcelain'], w.path)) return ['keep', 'changed or untracked files'];
  } catch {
    return ['keep', 'git status failed'];
  }
  const heads = mergedHeads(w.branch, w.path);
  if (heads === null) return ['keep', 'cannot check PRs with gh'];
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
  console.log(`worktree-prune: skipped (${String(e.stderr || e.message).trim().split('\n')[0]})`);
  process.exit(0);
}
let pruned = false, failed = false;
for (const w of linked) {
  const [action, reason] = verdict(w, current);
  if (action === 'keep' || !apply) {
    console.log(`${action === 'keep' ? 'keep' : `would ${action}`}\t${w.path}\t${reason}`);
    continue;
  }
  if (action === 'prune') {
    pruned = true;
    console.log(`prune\t${w.path}\t${reason}`);
    continue;
  }
  try {
    git(['worktree', 'remove', w.path]);
    console.log(`removed\t${w.path}\t${reason}`);
  } catch (e) {
    failed = true;
    console.log(`failed\t${w.path}\t${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
}
if (pruned) git(['worktree', 'prune']);
process.exit(failed ? 1 : 0);
