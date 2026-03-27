# ISSUES

Issue context JSON is provided at start of context. Parse it to get the issue(s) you've been assigned, with their bodies and comments.

You've also been passed recent RALPH commits (SHA, date, full message). Review these to understand what work has been done.

# TASK

You have been given a specific task prompt. Follow it.

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task. Read CLAUDE.md for project conventions.

# EXECUTION

Complete the task.

Other people may be working on the repo at the same time on other branches. Stay focused on your task. Keep changes minimal and focused.

This project uses pnpm. Run `pnpm test` to validate your changes. Run `pnpm build` to verify the build passes.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Be a single line summarizing the task completed
3. Keep it concise

# PR OUTPUT

After committing, output a PR title and description wrapped in XML tags. The orchestrator that runs you will use these to create the PR.

Example:

<pr_title>RALPH: Fix auth middleware token validation</pr_title>
<pr_description>

## Summary

- Fixed token validation ordering in auth middleware
- Tokens are now validated before permission checks

## Related Issues

- Closes #42

## Key Decisions

- Used existing JWT validation helper rather than adding a new dependency

</pr_description>

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
