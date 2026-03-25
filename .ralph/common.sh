#!/bin/bash

RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")

require_env() {
  if [ ! -f "$RALPH_DIR/.env" ]; then
    echo "Missing .ralph/.env file. Copy the example and fill in your tokens:"
    echo "  cp .ralph/.env.example .ralph/.env"
    echo ""
    echo "Required:"
    echo "  GH_TOKEN  - GitHub PAT with 'repo' scope"
    exit 1
  fi

  local val
  val=$(grep "^GH_TOKEN=" "$RALPH_DIR/.env" | cut -d= -f2-)
  if [ -z "$val" ]; then
    echo "Missing GH_TOKEN in .ralph/.env"
    exit 1
  fi
}

load_env() {
  if [ -f "$RALPH_DIR/.env" ]; then
    local val
    val=$(grep "^GH_TOKEN=" "$RALPH_DIR/.env" | cut -d= -f2-)
    if [ -n "$val" ]; then export GH_TOKEN="$val"; fi
  fi
}

get_iterations() {
  if [ -n "$1" ]; then
    echo "$1"
  else
    jq -r '.defaultIterations // 100' "$RALPH_DIR/config.json"
  fi
}
