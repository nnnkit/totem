#!/bin/bash
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env
load_env

ITERATIONS=$(get_iterations "$1")
echo "Starting RALPH loop: $ITERATIONS iterations"
echo ""

stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

ensure_labels() {
  gh label create "ralph:in-progress" --color "FFA500" --description "Ralph worker is currently working on this" 2>/dev/null || true
  gh label create "ralph:pr-open"     --color "0E8A16" --description "Ralph opened/updated a PR; awaiting review" 2>/dev/null || true
  gh label create "ralph:blocked"     --color "B60205" --description "Ralph flagged a blocker; human needed"     2>/dev/null || true
}

clean_worktree_state() {
  # Defensive: clear any uncommitted state left over from a failed prior iteration.
  # We do NOT reset to main here — Ralph picks the correct PRD branch each iteration.
  git fetch origin --prune --quiet || true
  git reset --hard HEAD --quiet 2>/dev/null || true
  git clean -fd --quiet 2>/dev/null || true
}

ensure_labels

for ((i=1; i<=ITERATIONS; i++)); do
  echo "========================================"
  echo "Iteration $i / $ITERATIONS"
  echo "========================================"

  clean_worktree_state

  tmpfile=$(mktemp)

  # Open issues — the pool Ralph picks from.
  open_issues=$(gh issue list --state open --limit 200 --json number,title,body,labels,comments)
  open_count=$(echo "$open_issues" | jq 'length')

  # Recently closed issues — context for prior slices on the same PRD.
  closed_issues=$(gh issue list --state closed --limit 30 --json number,title,body,labels,closedAt)

  if [ "$open_count" -eq 0 ]; then
    echo "No open issues. Nothing to do."
    exit 0
  fi

  runnable=$(echo "$open_issues" | jq '[.[] | select((.labels // []) | map(.name) | index("ralph:in-progress") == null)] | length')
  echo "Open: $open_count  ·  Unclaimed: $runnable"

  if [ "$runnable" -eq 0 ]; then
    echo "All open issues are currently claimed by other workers. Stopping."
    rm -f "$tmpfile"
    exit 0
  fi

  ralph_commits=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

  prompt_payload=$(cat <<EOF
# Open issues
$open_issues

# Recently closed issues (for context on prior slices)
$closed_issues

# Previous RALPH commits
$ralph_commits

@.ralph/prompt.md
EOF
)

  ENABLE_SECURITY_REMINDER=0 \
  GH_TOKEN="$GH_TOKEN" \
  claude \
    --verbose \
    --print \
    --model claude-opus-4-6 \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --settings "$RALPH_DIR/sandbox.json" \
    "$prompt_payload" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")
  all_text=$(jq -r 'select(.type == "assistant").message.content[]? | select(.type == "text").text // empty' "$tmpfile")

  rm -f "$tmpfile"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]] || [[ "$all_text" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "RALPH complete after $i iterations."
    exit 0
  fi

  if [[ "$result" == *"<promise>NOTHING_RUNNABLE</promise>"* ]] || [[ "$all_text" == *"<promise>NOTHING_RUNNABLE</promise>"* ]]; then
    echo ""
    echo "Nothing runnable right now (all issues blocked or claimed). Stopping."
    exit 0
  fi

  echo ""
done

echo "Finished $ITERATIONS iterations."
