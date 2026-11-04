# PR #129 post-merge release verification

- PR: https://github.com/reach0908/paul-loop/pull/129
- Merged: `2026-09-27T02:38:48Z`.
- Merge commit: `c7dbdd269a0d29e270d155022e8fd8234d662544`.
- Reviewed PR head: `0632d717e3d1c009aeede7006f2ce741306d73e8`.
- The merge tree is byte-identical to the reviewed PR tree (`git diff --exit-code` returned 0).
- The dedicated worktree is checked out at the merge commit with detached HEAD. Prior branches,
  private native evaluation evidence and unrelated untracked audits remain intact.
- Rebuilt Claude/Codex packages and `--check` agree at the merge commit; vendor lock check passes.
  Manifest versions: engine `0.15.13`, ship-flow `0.11.6`, memory `0.8.0`.

## Publication

Workflow: https://github.com/reach0908/paul-loop/actions/runs/36289116193

The main publication workflow completed successfully at the merge commit: 9 jobs succeeded;
`engine / verifier-pinned-review` was intentionally skipped on main (it ran on the PR).
Remote `ship-flow--v0.11.6` was initially absent, then the real tag job created it at exactly
`c7dbdd269a0d29e270d155022e8fd8234d662544`. `git ls-remote` and the fetched local tag both match.
No manual duplicate publication or workflow bypass was performed.

Raw release observations belong in `.loop/native-eval/git-routing-2026-09-27/` alongside the PR
evaluation evidence. No consumer plugin cache, project lock or memory configuration was updated.

## Remaining work

- #87 remains open: real Git publication is unqualified under the observed host write restriction.
- The next bounded improvement candidate is avoiding broad worktree/cache searches when the host
  does not expose the configured publisher role.
- README's source-version summary still says ship-flow `0.11.5`; correct this documentation drift
  with the next source documentation change. Actual plugin and marketplace manifests say `0.11.6`.
