#!/bin/bash
set -eo pipefail

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
REPO_ROOT="$(git rev-parse --show-toplevel)"
RALPH_DIR="$REPO_ROOT/.ralph"
LOGS_DIR="$RALPH_DIR/logs"

# --- Check prerequisites ---

if ! command -v claude &> /dev/null; then
  echo "Error: Claude Code CLI is not installed."
  exit 1
fi

# Load .env if it exists
if [ -f "$RALPH_DIR/.env" ]; then
  export $(grep -v '^#' "$RALPH_DIR/.env" | xargs)
fi

if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "Error: CLAUDE_CODE_OAUTH_TOKEN is not set."
  echo "Set it in .ralph/.env or as an environment variable."
  exit 1
fi

BASE_BRANCH="${PR_BASE_BRANCH:-main}"

# --- Gather context ---

echo "Fetching open issues..."
ISSUES=$(gh issue list --state open --json number,title,body,comments --limit 100)

ISSUE_COUNT=$(echo "$ISSUES" | jq 'length')
echo "Found $ISSUE_COUNT open issues."

if [ "$ISSUE_COUNT" -eq 0 ]; then
  echo "No open issues. Nothing to dispatch."
  exit 0
fi

echo "Fetching open RALPH PRs..."
OPEN_PRS=$(gh pr list --state open --json number,title,body,headRefName --limit 100 | jq '[.[] | select(.headRefName | startswith("claude/"))]')
OPEN_PR_COUNT=$(echo "$OPEN_PRS" | jq 'length')
echo "Found $OPEN_PR_COUNT open RALPH PRs."

# --- Ask orchestrator to pick tasks ---

echo "Asking orchestrator to analyze issues and plan tasks..."

PROMPT="$(cat "$REPO_ROOT/scripts/dispatch-prompt.md")

## Open Issues

$ISSUES

## Open RALPH PRs

These PRs were created by previous RALPH runs and are still open (awaiting review/merge). Do NOT dispatch work that duplicates or conflicts with these.

$OPEN_PRS"

RESULT=$(echo "$PROMPT" | claude -p \
  --model sonnet \
  --allowedTools "Read,Grep,Glob")

# Extract JSON from <task_json> tags
TASKS=$(echo "$RESULT" | sed -n '/<task_json>/,/<\/task_json>/p' | sed '1d;$d')

if ! echo "$TASKS" | jq -e 'type == "array"' > /dev/null 2>&1; then
  echo "Error: Orchestrator did not return a valid JSON array."
  echo "Raw output:"
  echo "$RESULT"
  exit 1
fi

TASK_COUNT=$(echo "$TASKS" | jq 'length')

if [ "$TASK_COUNT" -eq 0 ]; then
  echo "Orchestrator found no tasks to dispatch."
  exit 0
fi

# --- Prepare logs directory ---

mkdir -p "$LOGS_DIR"
rm -f "$LOGS_DIR/.pids" "$LOGS_DIR/.worktrees" "$LOGS_DIR/.branches"

echo ""
echo "========================================="
echo "  Dispatching $TASK_COUNT tasks locally"
echo "========================================="
echo ""

# --- Stash any uncommitted changes, create worktrees, launch workers ---

TASK_INDEX=0
PIDS=()
SLUGS=()

# Read tasks into array first (avoid subshell from pipe)
TASK_ARRAY=()
while IFS= read -r task; do
  TASK_ARRAY+=("$task")
done < <(echo "$TASKS" | jq -c '.[]')

for task in "${TASK_ARRAY[@]}"; do
  BRANCH_NAME=$(echo "$task" | jq -r '.branch_name')
  ISSUE_NUMBERS=$(echo "$task" | jq -c '.issue_numbers')
  TASK_PROMPT=$(echo "$task" | jq -r '.prompt')
  SLUG=$(echo "$BRANCH_NAME" | sed 's|claude/||')
  WORKTREE_DIR="$REPO_ROOT/../.ralph-worktrees/$SLUG"
  LOG_FILE="$LOGS_DIR/${SLUG}.log"

  echo "[$((TASK_INDEX + 1))/$TASK_COUNT] $BRANCH_NAME"
  echo "  Issues: $ISSUE_NUMBERS"
  echo "  Prompt: ${TASK_PROMPT:0:80}..."
  echo ""

  # Clean up any existing worktree
  if [ -d "$WORKTREE_DIR" ]; then
    git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || rm -rf "$WORKTREE_DIR"
  fi
  git branch -D "$BRANCH_NAME" 2>/dev/null || true

  # Create worktree from base branch
  mkdir -p "$(dirname "$WORKTREE_DIR")"
  git worktree add -b "$BRANCH_NAME" "$WORKTREE_DIR" "$BASE_BRANCH" 2>&1

  # Launch worker in background, tee to both log file and a named pipe for live viewing
  (
    cd "$WORKTREE_DIR"

    # Export env vars for the worker
    export PR_BASE_BRANCH="$BASE_BRANCH"
    export CLAUDE_CODE_OAUTH_TOKEN
    export GH_TOKEN="${GH_READ_TOKEN:-$GH_TOKEN}"

    bash scripts/worker-run.sh "$BRANCH_NAME" "$ISSUE_NUMBERS" "$TASK_PROMPT" 2>&1
  ) > >(tee "$LOG_FILE") 2>&1 &

  PID=$!
  PIDS+=($PID)
  SLUGS+=("$SLUG")
  echo "$PID" >> "$LOGS_DIR/.pids"
  echo "$WORKTREE_DIR" >> "$LOGS_DIR/.worktrees"
  echo "$BRANCH_NAME" >> "$LOGS_DIR/.branches"

  TASK_INDEX=$((TASK_INDEX + 1))
done

echo ""
echo "========================================="
echo "  All $TASK_COUNT workers running"
echo "========================================="
echo ""
echo "PIDs: ${PIDS[*]}"
echo ""
echo "Waiting for all workers to finish..."
echo "(Press Ctrl+C to cancel all workers)"
echo ""

# Trap Ctrl+C to kill all workers
trap 'echo ""; echo "Cancelling all workers..."; for pid in "${PIDS[@]}"; do kill $pid 2>/dev/null; done; exit 130' INT

# Wait for all workers and report results
FAILURES=0
for i in "${!PIDS[@]}"; do
  pid=${PIDS[$i]}
  slug=${SLUGS[$i]}
  if wait "$pid" 2>/dev/null; then
    echo "  ✓ $slug (PID $pid) — completed"
  else
    echo "  ✗ $slug (PID $pid) — failed (see $LOGS_DIR/${slug}.log)"
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "All $TASK_COUNT tasks completed successfully!"
else
  echo "$FAILURES/$TASK_COUNT tasks failed. Check logs in $LOGS_DIR/"
fi

echo ""
echo "Clean up worktrees with: pnpm ralph:cleanup"
