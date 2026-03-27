#!/bin/bash
set -eo pipefail

# Usage: worker-run.sh <branch_name> <issue_numbers_json> <task_prompt>
#
# Environment variables required:
#   CLAUDE_CODE_OAUTH_TOKEN - Claude Code auth token

BRANCH_NAME="$1"
ISSUE_NUMBERS="$2"
TASK_PROMPT="$3"
BASE_BRANCH="${PR_BASE_BRANCH:-main}"

if [ -z "$BRANCH_NAME" ] || [ -z "$ISSUE_NUMBERS" ] || [ -z "$TASK_PROMPT" ]; then
  echo "Usage: $0 <branch_name> <issue_numbers_json> <task_prompt>"
  exit 1
fi

echo "=== RALPH Worker: $BRANCH_NAME ==="
echo "Issues: $ISSUE_NUMBERS"
echo "Base: $BASE_BRANCH"
echo ""

# --- Install dependencies ---

echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1

# --- Fetch issue context ---

echo "Fetching issue context..."
ISSUE_CONTEXT=""
for num in $(echo "$ISSUE_NUMBERS" | jq -r '.[]'); do
  ISSUE_JSON=$(gh issue view "$num" --json number,title,body,comments)
  ISSUE_CONTEXT="${ISSUE_CONTEXT}${ISSUE_JSON}"$'\n\n'
done

# --- Fetch recent RALPH commits ---

RALPH_COMMITS=$(git log --grep="RALPH" -n 10 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No RALPH commits found")

# --- Build prompt ---

WORKER_PROMPT=$(cat "$(dirname "${BASH_SOURCE[0]}")/worker-prompt.md")

FULL_PROMPT="## Your Task

${TASK_PROMPT}

## Issue Context

${ISSUE_CONTEXT}

## Previous RALPH Commits

${RALPH_COMMITS}

${WORKER_PROMPT}"

# --- Run Claude Code ---

echo "Running Claude Code..."

tmpfile=$(mktemp)
trap "rm -f $tmpfile" EXIT

stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'
final_result='select(.type == "result").result // empty'

echo "$FULL_PROMPT" | claude -p \
  --dangerously-skip-permissions \
  --output-format stream-json \
  --verbose \
| grep --line-buffered '^{' \
| tee "$tmpfile" \
| jq --unbuffered -rj "$stream_text"

# --- Extract result and PR metadata ---

RESULT=$(jq -r "$final_result" "$tmpfile")

PR_TITLE=$(echo "$RESULT" | grep -oP '(?<=<pr_title>).*?(?=</pr_title>)' || echo "$RESULT" | sed -n '/<pr_title>/,/<\/pr_title>/p' | sed '1d;$d')
PR_DESCRIPTION=$(echo "$RESULT" | sed -n '/<pr_description>/,/<\/pr_description>/p' | sed '1d;$d')

if [ -z "$PR_TITLE" ]; then
  PR_TITLE="RALPH: ${TASK_PROMPT:0:60}"
fi

if [ -z "$PR_DESCRIPTION" ]; then
  PR_DESCRIPTION="Automated PR for issues $ISSUE_NUMBERS"
fi

# --- Push and create PR ---

echo "Pushing branch..."
if ! git diff --quiet HEAD "origin/$BASE_BRANCH" 2>/dev/null; then
  git push origin "$BRANCH_NAME"
elif ! git diff --cached --quiet; then
  git add -A
  git commit -m "RALPH: ${TASK_PROMPT:0:72}"
  git push origin "$BRANCH_NAME"
else
  echo "No changes were made. Skipping PR."
  exit 0
fi

echo "Creating PR..."
PR_TITLE="${PR_TITLE:0:256}"
gh pr create \
  --base "$BASE_BRANCH" \
  --head "$BRANCH_NAME" \
  --title "$PR_TITLE" \
  --body "$PR_DESCRIPTION"

echo "=== Done: $BRANCH_NAME ==="
