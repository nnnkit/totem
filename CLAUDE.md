## Repository Rules

- Do not add unnecessary comments.
- Keep comments only when they explain non-obvious constraints, cross-file coupling, browser quirks, side effects, or business rules.
- Remove decorative section headers and comments that only restate the code.

## UI Components

This project uses `@base-ui/react` (v1.2.0) for base UI primitives. Always prefer Base UI components over raw HTML elements when a corresponding component is available. Check `node_modules/@base-ui/react/` for the full list of available components.

## Repository Knowledge

`docs/solutions/` stores documented solutions to past problems and product patterns, organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

`CONCEPTS.md` defines shared domain vocabulary for project-specific entities, named processes, and status concepts. Relevant when orienting to the codebase or discussing domain concepts.

## Extension screenshots

Before capturing, regenerating, editing, or reviewing extension screenshots, read [`docs/extension-screenshot-workflow.md`](docs/extension-screenshot-workflow.md). It is the source of truth for Chrome Web Store screenshot order, dimensions, required copy, asset paths, `agent-browser` capture, and verification.

## Blog pipeline

All blog work is managed in [`docs/blog-pipeline.md`](docs/blog-pipeline.md). It is the single source of truth for ideas, in-progress drafts, and published posts. Before doing any blog-related work — pitching topics, researching keywords, drafting, publishing — read it.

For end-to-end SEO execution, also read [`docs/seo-agent-goal.md`](docs/seo-agent-goal.md). It is the reusable goal/checklist and long-running loop for choosing SEO opportunities, validating SERPs, adding non-commodity evidence, publishing pages, internal-linking them, building the site, updating tracking, writing readable HTML research/status reports under `plans/research/`, writing distribution plans, and looping back until the backlog is done or blocked.

It contains:
- **Voice** — the editorial personality every post must match ("Notes on bookmarks, reading, and the things you save"). Behavioral, honest about scope, specific, terse. No generic listicles without a thesis.
- **Topic filter** — 4 ✅ / 4 ❌ checks to run an idea through before spending `/dataforseo` API budget on research.
- **Workflow** — Idea → `/dataforseo` research (cache JSON in `tmp/dataforseo/`) → fit check → draft in `plans/blog-drafts/NN-slug.md` → publish to `apps/site/src/content/blog/<slug>.md` with frontmatter → Astro renders md → static HTML at build (UTM/`ref` decoration via `apps/site/src/lib/rehype-blog-links.mjs`) → move entry to **Published** table.
- **Frontmatter template** for new posts.
- **Ideas / In progress / Published / Killed** sections.

When the user asks to "add a blog idea," "draft a post," or anything blog-adjacent: update `docs/blog-pipeline.md` first, then do the work. Never write a post that hasn't passed the topic filter.

Original keyword research lives in [`docs/seo-blog-research.md`](docs/seo-blog-research.md) — historical context for the first three published posts.
