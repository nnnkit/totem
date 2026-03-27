#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env
load_env

# Parse args: start.sh [local|docker] [iterations] [branch]
MODE="local"
if [[ "$1" == "local" || "$1" == "docker" ]]; then
  MODE="$1"; shift
fi
ITERATIONS=$(get_iterations "$1")
BRANCH="${2:-ralph/auto}"

echo "=== RALPH ==="
echo "Mode:       $MODE"
echo "Iterations: $ITERATIONS"
echo "Branch:     $BRANCH"
echo ""

# ─────────────────────────────────────────────────
# LOCAL MODE: native macOS sandbox + git worktree
# ─────────────────────────────────────────────────
run_local() {
  WORKTREE_DIR="/tmp/ralph-${REPO_NAME}-$$"
  echo "Worktree: $WORKTREE_DIR"
  echo ""

  # Remove any stale worktree that already has this branch checked out
  existing_wt=$(git worktree list --porcelain | awk -v b="$BRANCH" '
    /^worktree / { wt=$2 }
    /^branch /   { if ($2 == "refs/heads/" b) print wt }
  ')
  if [ -n "$existing_wt" ]; then
    echo "Removing stale worktree: $existing_wt"
    git worktree remove "$existing_wt" --force 2>/dev/null || true
    git worktree prune
  fi

  # Create a git worktree for isolation
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    git worktree add "$WORKTREE_DIR" "$BRANCH"
  elif git show-ref --verify --quiet "refs/remotes/origin/$BRANCH" 2>/dev/null; then
    git worktree add "$WORKTREE_DIR" --track "origin/$BRANCH"
  else
    git worktree add "$WORKTREE_DIR" -b "$BRANCH"
  fi

  cleanup() {
    echo ""
    echo "Cleaning up worktree..."
    cd "$REPO_ROOT"
    git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  }
  trap cleanup EXIT

  cd "$WORKTREE_DIR"

  # Copy .env into worktree (gitignored, not part of worktree)
  cp "$RALPH_DIR/.env" "$WORKTREE_DIR/.ralph/.env"

  # Configure git for Ralph commits
  git config user.name 'RALPH'
  git config user.email 'ralph@noreply'

  # Install dependencies
  echo "Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install 2>/dev/null || npm install 2>/dev/null || true
  echo ""

  # Run the RALPH loop (uses native Seatbelt sandbox via sandbox.json)
  .ralph/run.sh "$ITERATIONS"

  # Push results
  push_results
}

# ─────────────────────────────────────────────────
# DOCKER MODE: Docker Desktop sandbox (microVM)
# ─────────────────────────────────────────────────
run_docker() {
  # Check docker sandbox is available
  if ! docker sandbox ls >/dev/null 2>&1; then
    echo "Docker sandboxes not available."
    echo "Enable in Docker Desktop: Settings → Features in development → Docker Sandboxes"
    exit 1
  fi

  # Find existing sandbox for this workspace
  SANDBOX_NAME=$(docker sandbox ls 2>/dev/null | awk -v ws="$REPO_ROOT" '$0 ~ ws {print $1}')

  if [ -n "$SANDBOX_NAME" ]; then
    echo "Using sandbox: $SANDBOX_NAME"
  else
    SANDBOX_NAME="ralph-${REPO_NAME}"
    echo "Creating sandbox: $SANDBOX_NAME"
    docker sandbox create claude "$REPO_ROOT" --name "$SANDBOX_NAME"
  fi

  # Check if Claude is authenticated inside the sandbox
  # If not, run interactive login before starting the loop
  if docker sandbox exec "$SANDBOX_NAME" -- claude auth status 2>&1 | grep -qi "not logged in\|not authenticated\|error"; then
    echo ""
    echo "Claude is not logged in inside the sandbox."
    echo "Opening interactive login — authenticate in your browser, then type /exit"
    echo ""
    docker sandbox run "$SANDBOX_NAME"
    echo ""
  fi

  echo ""

  # Run the loop — each iteration runs claude in the sandbox by name
  for ((i=1; i<=ITERATIONS; i++)); do
    echo "========================================"
    echo "Iteration $i / $ITERATIONS"
    echo "========================================"

    # Fetch issues from host (has gh auth)
    issues=$(gh issue list --state open --json number,title,body,comments)
    issue_count=$(echo "$issues" | jq 'length')

    if [ "$issue_count" -eq 0 ]; then
      echo "No open issues. Nothing to do."
      break
    fi

    echo "Open issues: $issue_count"

    ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

    prompt="$issues Previous RALPH commits: $ralph_commits $(cat "$RALPH_DIR/prompt.md")"

    # Run claude in the existing sandbox, capture output for error detection
    output_file=$(mktemp)
    docker sandbox run "$SANDBOX_NAME" -- --print "$prompt" 2>&1 | tee "$output_file" || true

    # Check for auth failure — stop and re-login instead of burning iterations
    if grep -qi "authentication_error\|Failed to authenticate\|not logged in\|token has expired" "$output_file"; then
      rm -f "$output_file"
      echo ""
      echo "Auth expired. Re-authenticating..."
      echo "Log in via browser, then type /exit to resume the loop."
      echo ""
      docker sandbox run "$SANDBOX_NAME"
      echo "Resuming loop..."
      # Retry this iteration
      ((i--))
      continue
    fi

    rm -f "$output_file"
    echo ""
  done

  # Push from host (workspace syncs between sandbox and host)
  push_results
}

# ─────────────────────────────────────────────────
# Shared: push results
# ─────────────────────────────────────────────────
push_results() {
  unpushed=$(git rev-list HEAD --not --remotes 2>/dev/null | wc -l | tr -d ' ')
  if [ "$unpushed" -gt 0 ]; then
    echo ""
    echo "Pushing $unpushed commit(s)..."
    git push -u origin "$BRANCH"
  else
    echo ""
    echo "No new commits to push."
  fi
}

# ─────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────
case "$MODE" in
  local)  run_local ;;
  docker) run_docker ;;
esac
