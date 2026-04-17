#!/bin/bash
# Show Ralph's view of the issue queue: what's runnable, claimed, in review, blocked.
set -eo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_env
load_env

issues=$(gh issue list --state open --limit 200 --json number,title,labels,body)

echo "=== RALPH queue status ==="
echo ""

runnable=$(echo "$issues" | jq -r '
  .[]
  | select((.labels // []) | map(.name) | (index("ralph:in-progress") == null and index("ralph:pr-open") == null))
  | "  #\(.number)  \(.title)"
')
claimed=$(echo "$issues" | jq -r '
  .[] | select((.labels // []) | map(.name) | index("ralph:in-progress")) | "  #\(.number)  \(.title)"
')
in_review=$(echo "$issues" | jq -r '
  .[] | select((.labels // []) | map(.name) | index("ralph:pr-open")) | "  #\(.number)  \(.title)"
')
blocked=$(echo "$issues" | jq -r '
  .[] | select((.labels // []) | map(.name) | index("ralph:blocked")) | "  #\(.number)  \(.title)"
')

[ -n "$runnable" ]  && printf "Runnable:\n%s\n\n" "$runnable"   || echo "Runnable: (none)"
[ -n "$claimed" ]   && printf "\nIn-progress:\n%s\n" "$claimed"
[ -n "$in_review" ] && printf "\nPR open (awaiting review):\n%s\n" "$in_review"
[ -n "$blocked" ]   && printf "\nBlocked (human needed):\n%s\n" "$blocked"
echo ""
