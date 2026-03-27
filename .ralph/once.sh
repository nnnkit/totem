#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env
load_env

issues=$(gh issue list --state open --json number,title,body,comments)
ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

claude \
  --model claude-opus-4-6 \
  --settings "$RALPH_DIR/sandbox.json" \
  "$issues Previous RALPH commits: $ralph_commits @.ralph/prompt.md"
