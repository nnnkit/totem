# INPUTS

- **Open issues JSON** — open issues with number, title, body, labels, comments. Parse it.
- **Recently closed issues JSON** — last N closed issues (title + body + `closedAt`). Use this to understand prior slices that have landed, especially ones from the same PRD.
- **Previous RALPH commits** — last 10 `RALPH:` commits with full messages, for continuity.

# PICK ONE TASK

From open issues, **exclude** any that:
- Have label `ralph:in-progress` — another worker has it.
- Have a `Blocked by #N` line in the body where #N is still OPEN.

From what remains, prioritize:
1. Critical bugfixes (title starts with `fix:` / contains `bug` / `broken`)
2. Unblocked tracer-bullet features — prefer the smallest, most-foundational slice of a PRD that has no prior slices yet, **or** the next slice of a PRD whose branch already exists (to keep momentum on one PRD at a time).
3. Polish and quick wins.
4. Refactors.

**Exit conditions:**
- If ALL open issues are blocked/claimed: `<promise>NOTHING_RUNNABLE</promise>` and stop.
- If ZERO open issues remain: `<promise>COMPLETE</promise>` and stop.

# IDENTIFY THE PRD & BRANCH

Every slice issue references its parent PRD in its body, like:
```
## Parent PRD
#15
```

Extract the parent PRD number. If no parent PRD is referenced, treat the issue itself as a standalone PRD.

Fetch the PRD title to derive a slug:
```
prd_title=$(gh issue view <PRD_NUM> --json title --jq .title)
```

Slug rules: lowercase, ≤6 words, hyphens, no symbols. Example: `intent-system-daily-reading-ritual`.

**Branch name:** `ralph/prd-<PRD_NUM>-<slug>` — e.g. `ralph/prd-15-intent-system`.

All slices of the same PRD share this one branch. The PR for the branch grows as more slices land.

# CLAIM THE ISSUE

```
gh issue edit <N> --add-label "ralph:in-progress"
```

# CHECKOUT THE PRD BRANCH

```
git fetch origin --prune --quiet
git reset --hard HEAD --quiet && git clean -fd --quiet   # defensive: clear any leftover state

if git show-ref --verify --quiet "refs/remotes/origin/ralph/prd-<N>-<slug>"; then
  git checkout -B "ralph/prd-<N>-<slug>" "origin/ralph/prd-<N>-<slug>"
elif git show-ref --verify --quiet "refs/heads/ralph/prd-<N>-<slug>"; then
  git checkout "ralph/prd-<N>-<slug>"
  git pull --ff-only origin "ralph/prd-<N>-<slug>" 2>/dev/null || true
else
  git checkout -b "ralph/prd-<N>-<slug>" "origin/main"
fi
```

After checkout, **read `git log --oneline origin/main..HEAD`** to see what prior slices have already landed on this branch. Read closed issues referenced in those commits (via `gh issue view <N>`) if you need details on what was built.

# WORK

Read the issue's acceptance criteria and the parent PRD it references. Use prior slice commits as context — later slices often build directly on earlier ones. If a prior slice shipped a module you need (e.g. `Classifier`, `IntentRepo`, `StreakTracker`), import and extend rather than re-invent.

**Non-negotiables:**

- **Theme tokens** — `src/index.css` `@theme` defines the palette: terracotta accent + grayscale + `--color-success`. NO blue/teal/amber hardcodes. If a new semantic color token is genuinely required, add it to `@theme` with a clear name (e.g. `--color-intent-act`) and document the rationale in the PR body.
- **Base UI primitives** — prefer `@base-ui/react` over raw HTML.
- **Virtualization** — don't break `@tanstack/react-virtual` on long lists.
- **Explicit completion** — never auto-mark items read via scroll / time / heuristics.
- **Local-first** — no new external network calls.
- **One-line commits, no Co-Authored-By** — project convention.

**Scope discipline:** complete only what the acceptance criteria call for. No adjacent refactors.

**Before committing, run the repo's checks:**
```
pnpm typecheck && pnpm test && pnpm lint
```
(or the commands defined in `package.json`.)

# COMMIT

One line, no body, no Co-Authored-By:

```
RALPH: <concise summary> (closes #<N>)
```

# PUSH THE BRANCH

```
git push -u origin "ralph/prd-<PRD_NUM>-<slug>"
```

# OPEN OR UPDATE THE PR

Check if a PR already exists for this branch:

```
pr_url=$(gh pr list --head "ralph/prd-<PRD_NUM>-<slug>" --json url --jq '.[0].url // empty')
```

**If no PR exists**, open one:

```
gh pr create \
  --base main \
  --head "ralph/prd-<PRD_NUM>-<slug>" \
  --title "<PRD title> (PRD #<PRD_NUM>)" \
  --body "$(cat <<EOF
## Parent PRD

#<PRD_NUM>

## Slices landed on this branch

- [x] #<N> — <slice title>

_More slices will land on this branch as they're completed._

## Theme review checklist (running, per-slice)

- [ ] Slice #<N>: no blue/teal/amber hardcodes, verified in light + dark

## Test plan

- [ ] pnpm typecheck / test / lint pass at each slice
EOF
)"
```

**If a PR already exists**, append this slice to the PR body. Use `gh pr edit <pr-number> --body ...` with the updated list of slices. Keep the format tidy.

# HANDOFF

```
gh issue edit <N> --remove-label "ralph:in-progress" --add-label "ralph:pr-open"
gh issue comment <N> --body "Landed on PR: <pr-url>"
```

**Do NOT close the issue** — the PR's `Closes #<N>` will close it on merge.
**Do NOT merge the PR** — leave it for human review.

# HARD RULES

- One issue per iteration.
- Never push to `main` directly.
- Never merge a PR.
- Never amend commits from previous iterations — always a new commit for new work.
- Never add `Co-Authored-By` lines.
- Never modify anything under `.ralph/`.
- On any unexpected failure (merge conflict, auth error, missing dependency, tooling broken): remove the `ralph:in-progress` label, comment on the issue describing the problem, and stop. Do not force through.
- Do NOT output `<promise>COMPLETE</promise>` unless every open issue is closed.
