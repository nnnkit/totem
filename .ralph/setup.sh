#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env
load_env

echo "=== RALPH Setup ==="
echo "Repo: $REPO_NAME"
echo ""

# 1. Verify Claude Code is installed
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI not found. Install it:"
  echo "  curl -fsSL https://claude.ai/install.sh | bash"
  exit 1
fi
echo "Claude Code: $(claude --version)"

# 2. Verify Claude authentication
auth_status=$(claude auth status 2>&1 || true)
if echo "$auth_status" | grep -qi "logged in\|authenticated\|active\|max"; then
  echo "Auth: $(echo "$auth_status" | grep -i "subscriptionType\|authMethod\|email" | head -3)"
else
  echo "Not authenticated. Logging in..."
  claude auth login
fi

# 3. Verify GitHub CLI
if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "GitHub CLI not authenticated. Run:"
  echo "  gh auth login"
  exit 1
fi
echo "GitHub: authenticated"

# 4. Check Docker sandboxes (optional)
echo ""
if docker sandbox ls >/dev/null 2>&1; then
  echo "Docker sandboxes: available"
else
  echo "Docker sandboxes: not available (docker mode won't work)"
  echo "  Enable in Docker Desktop → Settings → Features in development"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Usage:"
echo "  .ralph/start.sh                          # local sandbox, 100 iterations"
echo "  .ralph/start.sh local 5                  # local sandbox, 5 iterations"
echo "  .ralph/start.sh local 5 my-branch        # local, 5 iterations, custom branch"
echo "  .ralph/start.sh docker 5                 # docker sandbox, 5 iterations"
echo "  .ralph/start.sh docker 5 my-branch       # docker, 5 iterations, custom branch"
echo ""
echo "Interactive (single task, you watch):"
echo "  .ralph/once.sh"
echo ""
echo "Clean up:"
echo "  .ralph/cleanup.sh"
