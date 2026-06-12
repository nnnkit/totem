# Repository Rules

- Do not add unnecessary comments.
- Keep comments only when they explain non-obvious constraints, cross-file coupling, browser quirks, side effects, or business rules.
- Remove decorative section headers and comments that only restate the code.
- Before capturing, regenerating, editing, or reviewing extension screenshots, read `docs/extension-screenshot-workflow.md`.

## Repository Knowledge

`docs/solutions/` stores documented solutions to past problems and product patterns, organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

`CONCEPTS.md` defines shared domain vocabulary for project-specific entities, named processes, and status concepts. Relevant when orienting to the codebase or discussing domain concepts.

## SEO and Blog Work

Before doing SEO or blog work, read `plans/blog-pipeline.md`. For end-to-end SEO execution, also read `plans/seo-agent-goal.md`; it is the reusable goal/checklist and long-running loop for researching, publishing, testing, tracking, distributing, and looping back through the SEO backlog until it is done or blocked. SEO research and status reports should be written as readable HTML files under `plans/research/`.
