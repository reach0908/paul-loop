#!/usr/bin/env bash
# Real local Git remotes; no network or consumer state.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
node --test "$HERE/merge-sync.test.mjs"
