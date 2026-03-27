#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

echo "=== RALPH Cleanup ==="

# Clean up git worktrees (local mode)
echo "Worktrees:"
worktrees=$(git worktree list --porcelain | grep "^worktree /tmp/ralph-" | cut -d' ' -f2 || true)
if [ -n "$worktrees" ]; then
  echo "$worktrees" | while IFS= read -r wt; do
    echo "  Removing: $wt"
    git worktree remove "$wt" --force 2>/dev/null || true
  done
else
  echo "  None."
fi
git worktree prune

# Clean up docker sandboxes (docker mode)
echo "Docker sandboxes:"
if docker sandbox ls >/dev/null 2>&1; then
  sandbox_name="ralph-${REPO_NAME}"
  if docker sandbox ls 2>/dev/null | grep -q "$sandbox_name"; then
    echo "  Removing: $sandbox_name"
    docker sandbox rm "$sandbox_name" 2>/dev/null || true
  else
    echo "  None."
  fi
else
  echo "  Docker sandboxes not available (skipped)."
fi

echo "Done."
