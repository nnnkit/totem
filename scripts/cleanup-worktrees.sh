#!/bin/bash
set -eo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_DIR="$REPO_ROOT/../.ralph-worktrees"
LOGS_DIR="$REPO_ROOT/.ralph/logs"

# Kill any running workers
if [ -f "$LOGS_DIR/.pids" ]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null && echo "Killed worker PID $pid" || true
  done < "$LOGS_DIR/.pids"
  rm -f "$LOGS_DIR/.pids"
fi

# Remove worktrees
if [ -d "$WORKTREE_DIR" ]; then
  for wt in "$WORKTREE_DIR"/*/; do
    [ -d "$wt" ] || continue
    echo "Removing worktree: $wt"
    git worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
  done
  rmdir "$WORKTREE_DIR" 2>/dev/null || true
fi

# Prune stale worktree references
git worktree prune

# Clean up tracking files
rm -f "$LOGS_DIR/.worktrees" "$LOGS_DIR/.branches"

echo "Cleanup complete."
