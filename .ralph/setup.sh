#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env

echo "Repo: $REPO_NAME"
echo ""

# Verify claude CLI is available
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI not found. Install it:"
  echo "  curl -fsSL https://claude.ai/install.sh | bash"
  exit 1
fi

# Check if already authenticated
if claude auth status < /dev/null >/dev/null 2>&1; then
  echo "Claude Code already authenticated."
else
  echo "Authenticating Claude Code..."
  echo "A URL will appear below. Open it in your browser and log in."
  echo ""
  claude auth login --claudeai
fi

echo ""
echo "Setup complete. Run:"
echo "  pnpm ralph           # loop (default: $(jq -r '.defaultIterations // 100' "$RALPH_DIR/config.json") iterations)"
echo "  .ralph/run.sh 10     # loop 10 times"
echo "  .ralph/once.sh       # single iteration"
