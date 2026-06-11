# Totem SEO Agent Goal

Use this file as the reusable goal prompt for any agent working on Totem SEO.
The job is not to mass-produce generic articles. The job is to find one real
search gap, add evidence that does not already exist everywhere else, publish a
useful page in Totem's voice, then connect and distribute it.

## Portability

This file is Totem-ready, not automatically project-ready.

If you copy it into another project, run an adaptation pass before writing or
publishing anything:

1. Identify the product, audience, conversion goal, and SEO lane.
2. Find the publishing system: blog/content directory, frontmatter schema,
   layouts, image paths, sitemap/robots setup, and build command.
3. Find the project's editorial source of truth. If none exists, create a
   lightweight `plans/blog-pipeline.md` before drafting.
4. Replace the Totem-specific backlog, guardrails, evidence examples, paths, and
   commands with the new project's equivalents.
5. Create or update the project instruction files (`AGENTS.md`, `CLAUDE.md`, or
   similar) so agents know to read the adapted SEO goal file.
6. Write an HTML setup report at
   `plans/research/seo-project-setup-YYYY-MM-DD.html` showing what was found,
   what was missing, and the adapted paths/commands.

Do not assume this file works in another repo until that setup report exists.

## Goal Prompt

You are working on SEO for Totem, a local-first Chrome extension that turns X /
Twitter bookmarks into a searchable read-later queue on every new tab.

Execute one complete SEO cycle, then loop back if the requested goal is still
unfinished. A cycle can end in one of four useful outcomes:

- A new blog post or comparison page is published.
- An existing post is materially improved and republished.
- A product/tool opportunity is documented with enough evidence to build next.
- A topic is killed or deferred with a clear reason.

1. Read `plans/blog-pipeline.md`, `plans/seo-long-tail-gap-brief-2026-06-02.md`,
   and the current published posts in `apps/site/src/content/blog/`.
2. Build an opportunity inventory across three lanes: new pages, existing-page
   improvements, and new product/tool ideas.
3. Pick exactly one opportunity from that inventory, unless the user gave a
   different topic.
4. Validate the search intent with live SERP review or cached research. If using
   paid keyword tooling, cache raw JSON under `tmp/dataforseo/` and record spend.
5. If fresh user language, current tool sentiment, or competitor chatter would
   change the decision, run `$last30days` in subagents before choosing the angle.
6. Find the non-commodity angle: original evidence, firsthand product proof,
   public competitor details, screenshots, user complaints, official docs, cited
   transcripts, or repeated user language that makes the page more useful than a
   generic AI summary.
7. Decide whether the work should be a new page, a refresh to an existing page,
   a comparison page, an internal-link update, or a product/tool proposal.
8. Draft using the fragment -> beat map -> editorial pass workflow from
   `plans/blog-pipeline.md`.
9. Publish or update the page in `apps/site/src/content/blog/` with valid
   frontmatter, or write the tool proposal into the HTML report and backlog.
10. Add internal links in both directions: the new or refreshed page should link
    to at least two relevant older Totem pages, and at least one older page
    should link back when contextually appropriate.
11. Run the website build and fix content/schema/link errors.
12. Update `plans/blog-pipeline.md` with status, URL, canonical keyword, refresh
    actions, and useful volume, SERP, or last30days notes.
13. Write or update the HTML research report for this cycle under
    `plans/research/`.
14. Leave a short distribution plan: who to pitch, where to share, and which
    pages, roundups, communities, or listicles should link to this page.

Do not ship the work until the definition of done below is satisfied.

## Long-Running Loop

Use this loop when the user asks for ongoing SEO work, a long autonomous run, or
"keep going until the list is done."

```txt
while goal is not complete:
  1. Refresh context:
     - Read plans/blog-pipeline.md.
     - Read this file.
     - Check git status so unrelated user changes are not overwritten.
     - Check which backlog items are already published or in progress.
     - List current posts in apps/site/src/content/blog/ and compare them with
       the Published table in plans/blog-pipeline.md. If the table is stale,
       update it before deciding what to ship next.

  2. Build the opportunity inventory:
     - New keyword/page candidates from the backlog and live SERPs.
     - Existing posts that need refreshes, stronger answers, current screenshots,
       better internal links, clearer CTAs, or newer evidence.
     - New tool/product ideas suggested by repeated user pain.
     - Distribution and backlink opportunities for pages already published.
     - Put the inventory in the cycle HTML report before choosing.

  3. Run optional last30days fan-out:
     - If current community data could affect the choice, use subagents to run
       `$last30days` in agent mode for narrow topics.
     - Prefer many focused runs over one broad run. Default to 6-12 subagents for
       a normal SEO cycle and 12-24 for a deep opportunity scan, bounded only by
       time, rate limits, and relevance.
     - Each subagent owns one topic, follows the last30days skill exactly, saves
       raw output, and returns a short opportunity card.
     - If subagents are unavailable, run the topics sequentially and record that
       fallback in the HTML report.

  4. Choose the next item:
     - Prefer the highest-impact unfinished opportunity, not always the newest
       article idea.
     - If the user gave a specific topic, finish that topic first.
     - Prefer refreshes when an existing page can own the intent better than a
       new page.
     - Prefer a tool proposal when users want an action or workflow, not another
       explanation.
     - If a topic fails the fit check, move it to Killed in plans/blog-pipeline.md
       with the reason, then loop back to choose the next topic.

  5. Research:
     - Validate intent with live SERP review or cached keyword/SERP data.
     - Save useful notes and source links.
     - Write the research notes into an HTML report under plans/research/.
     - Cache paid-tool raw JSON under tmp/dataforseo/ and record spend.
     - Pull direct evidence from current posts, product UI, official docs,
       Chrome Web Store pages, competitor public pages, and last30days reports.
     - Do not continue if there is no real SERP gap or Totem fit.

  6. Create non-commodity evidence:
     - Collect at least two evidence types from the evidence menu below.
     - Prefer original Totem proof, public screenshots, official docs, and user
       language over generic summaries.
     - If the page is a listicle or comparison, verify public tool facts instead
       of copying claims from another roundup.

  7. Draft, refresh, or propose:
     - Use fragments -> beat map -> editorial pass.
     - Publish new pages to apps/site/src/content/blog/ when ready.
     - For refreshes, update the existing post instead of creating a thin
       duplicate.
     - For tool ideas, write the proposal into the HTML report and add the item
       to plans/blog-pipeline.md or the appropriate product plan.
     - Add internal links in both directions for any shipped content.

  8. Test:
     - Run pnpm build:website.
     - Fix build, content collection, schema, markdown, image, and link errors.
     - If UI or screenshots changed, verify visually before continuing.

  9. Track:
     - Update plans/blog-pipeline.md.
     - Update the HTML report with final URL, build result, open issues, and
       distribution targets.
     - Record which opportunities were published, refreshed, proposed, killed,
       or deferred.
     - Record distribution targets.
     - Summarize what shipped and what remains.

  10. Loop back:
     - If more backlog items remain and time/budget remains, return to step 1.
     - If blocked, record the exact blocker and the next unblocked action.
```

### Stop Conditions

Only stop the long-running loop when one of these is true:

- The user-specified topic or backlog is fully done.
- Every backlog item is published, killed with a reason, or explicitly deferred.
- The next step requires user approval, private credentials, paid spend approval,
  Search Console access, or a manual deployment action.
- The repo cannot pass `pnpm build:website` after reasonable fixes; record the
  failing command and error.
- Continuing would overwrite unrelated user changes.

Do not stop just because one article shipped. After a successful publish and
test, loop back to the highest-priority unfinished item.

## Opportunity Inventory

Before writing, build a small decision table in the HTML report. Do not assume
the next best action is a new post.

Use these lanes:

| Lane | Question | Good outcome |
|---|---|---|
| New page | Is there search demand, a SERP gap, and a Totem-specific answer? | Publish one focused post or comparison page. |
| Existing post improvement | Can a current page better satisfy the same intent with fresher evidence, stronger first screen, better internal links, or clearer CTA? | Refresh the existing URL and update tracking. |
| New tool/product idea | Are users asking for an action that content cannot satisfy? | Propose the smallest useful tool or feature with evidence. |
| Internal-link lift | Is a good page isolated from related pages? | Add contextual links and improve the cluster. |
| Distribution | Is the page already good but unseen? | Pitch roundups, communities, and posts where it solves an active question. |

Every inventory row should include: opportunity, lane, target URL or slug,
canonical keyword if known, evidence source, expected impact, effort, risk, and
the next action. Pick the highest-confidence row, not the easiest row.

## last30days Subagent Protocol

Use `$last30days` when fresh community data can reveal what people actually
want, which tools they mention, what words they use, or why a current page is
missing the point. It is especially useful for:

- Suggesting new tools or product surfaces Totem could add.
- Improving existing blog posts with current user language and objections.
- Finding new post, keyword, comparison, and distribution ideas.
- Checking whether a competitor or workflow is currently discussed enough to
  deserve a page.
- Finding communities where a published page answers an active question.

When invoking `$last30days`, use subagents wherever the runtime supports them.
Do not run one vague query like "Totem SEO ideas." Split the work into many
narrow research jobs.

Default fan-out:

- Normal cycle: 6-12 subagents.
- Deep scan: 12-24 subagents.
- Comparison/listicle refresh: one subagent per tool plus one category-level
  subagent.
- If more high-quality angles exist and time/rate limits allow it, continue the
  fan-out. Stop only when additional topics are repetitive or outside Totem's
  lane.

Each subagent must:

1. Read and follow the `$last30days` skill exactly.
2. Use agent mode so it does not pause for follow-up prompts.
3. Use focused topics, not broad SEO prompts.
4. Save raw output in the normal last30days memory location.
5. Return an opportunity card with:
   - Topic researched.
   - Top user pains and exact phrases.
   - Tools, competitors, or workflows mentioned.
   - New-post ideas.
   - Existing-post improvement ideas.
   - Product/tool ideas.
   - Distribution communities or people.
   - Evidence strength and whether the data is fresh enough to act on.

If no subagent tool is available, run the same list sequentially and record the
fallback. Do not skip `$last30days` just because parallelism is unavailable.

Useful Totem `$last30days` fan-out topics:

- `best Twitter bookmark managers`
- `X bookmark manager`
- `Twitter bookmark search`
- `export Twitter bookmarks`
- `clear all X bookmarks`
- `Twitter bookmarks not showing`
- `X bookmarks disappeared`
- `Chrome reading list`
- `new tab Chrome extensions`
- `read later Chrome extension`
- `Pocket alternatives`
- `Dewey bookmarks`
- `Twillot`
- `TweetSmash`
- `XBookmarks`
- `how people organize saved tweets`
- `what users want from read later apps`
- `local first bookmark manager`
- `copy Twitter bookmarks to AI`

For competitor/listicle work, add one subagent per named tool found in the SERP
or current post, then add one category-level query for the overall job. For
example, a Twitter bookmark manager refresh should run separate topics for
Dewey, Twillot, TweetSmash, XBookmarks, Circleboom, browser bookmark exporters,
and the category phrase `best Twitter bookmark managers`.

Suggested bundles:

| Cycle | Subagent topics |
|---|---|
| Bookmark manager listicle | `best Twitter bookmark managers`, `Dewey bookmarks`, `Twillot`, `TweetSmash`, `XBookmarks`, `Circleboom Twitter bookmarks`, `Twitter bookmark export tools`, `how people organize saved tweets` |
| Export/cleanup cluster | `export Twitter bookmarks`, `clear all X bookmarks`, `delete Twitter bookmarks`, `Twitter bookmarks not showing`, `X bookmarks disappeared`, `Twitter bookmarks not loading`, `copy Twitter bookmarks to AI`, `Markdown export saved tweets` |
| New-tab/reading cluster | `Chrome reading list`, `new tab Chrome extensions`, `read later Chrome extension`, `Pocket alternatives`, `what users want from read later apps`, `save articles to read later`, `reading queue browser extension` |
| Trust/local-first cluster | `local first bookmark manager`, `privacy Chrome extensions`, `browser extension analytics concerns`, `offline read later app`, `export data from read later apps`, `Pocket shutdown alternatives` |
| Tool discovery | `tools people want for saved tweets`, `Twitter bookmark cleanup workflow`, `AI workflows for saved tweets`, `Obsidian saved tweets`, `NotebookLM Twitter bookmarks`, `CSV export Twitter bookmarks` |

Synthesize subagent results into a single table before deciding what to ship:

| Signal | Evidence | SEO action | Product/tool action | Confidence |
|---|---|---|---|---|
| Repeated complaint or phrase | Link to raw report and quote | New section, FAQ, title wording, or new page | Feature/tool idea if content cannot solve it | High/Med/Low |

Do not paste raw `$last30days` reports into blog posts. Use them to extract
language, objections, tools, workflows, and distribution targets, then cite the
original public sources in the final page when appropriate.

## Reusable Prompt

Paste this with the file when starting a long SEO run:

```txt
Use plans/seo-agent-goal.md as your operating instructions. Keep running the
Long-Running Loop until the requested SEO backlog is done, blocked by a listed
stop condition, or all remaining opportunities are published, refreshed,
proposed, killed, or deferred with reasons. Start each cycle by building the
opportunity inventory across new pages, existing-post improvements, product/tool
ideas, internal-link lifts, and distribution opportunities. Use `$last30days` in
subagents whenever fresh community data could improve topic selection, blog
refreshes, new keyword discovery, tool suggestions, or competitor/listicle
coverage. After each shipped page or refresh, test with pnpm build:website,
update plans/blog-pipeline.md, record a readable HTML research/status report
under plans/research/, record distribution targets, then loop back.
```

## Backlog Priority

Prefer these before inventing new topics, but refresh an existing page first
when it can win the same intent without a new URL.

### Existing-Page Improvement Candidates

Audit these before creating adjacent posts:

1. `/blog/best-chrome-bookmark-managers-2026`
   - Check whether the page should mention Totem's export depth, AI-copy
     workflows, and new-tab reading more clearly.
   - Re-check Chrome Web Store ratings/user counts and screenshots.
   - Add links to Twitter-bookmark-specific pages where relevant.
2. `/blog/how-to-export-twitter-bookmarks`
   - Make sure it points to the newer Totem export pages and explains when to
     export before deleting bookmarks.
   - Add current X UI screenshots if the flow changed.
3. `/blog/what-gets-exported-twitter-bookmarks`
   - Strengthen examples of CSV vs Markdown vs PDF vs AI-ready output.
   - Link to the Totem export format guide and any clear/delete post.
4. `/blog/search-twitter-bookmarks-before-export`
   - Add current user language around finding old saved tweets, not just export
     prep.
5. `/blog/twitter-saver-what-saving-actually-does`
   - Re-check SERP intent so the post does not drift toward video downloader
     traffic.
6. `/blog/where-are-my-bookmarks-on-x`
   - Add troubleshooting links for not showing, not loading, disappeared, and
     deletion intent if those pages exist.
7. `/blog/copy-twitter-bookmarks-for-ai`
   - Use last30days to see whether people now ask for NotebookLM, ChatGPT,
     Claude, or Obsidian workflows.
8. `/blog/export-twitter-bookmarks-totem-csv-markdown-pdf-ai`
   - Treat as the conversion page for export-format intent. Strengthen product
     proof and internal links from all export articles.
9. `/blog/why-totem-has-no-analytics`
   - Use as a trust/internal-link support page for local-first and privacy
     claims, not as a generic SEO target.

### New Page Candidates

1. `How to clear all X / Twitter bookmarks, and what to export first`
2. `Best Twitter bookmark managers for search, export, and actually reading`
3. `Chrome's built-in reading list: why nobody uses it`
4. `What to put on your Chrome new tab page`
5. `Best new tab Chrome extensions 2026`
6. `Best Chrome extensions for reading: save it now vs save it for later`
7. `What most Twitter bookmark exporters actually give you, and what's missing`
8. `A read-later app is only as good as its restore button`

### Comparison Page Candidates

1. `/vs/twillot`
2. `/vs/tweetsmash`
3. `/vs/dewey`
4. `/vs/xbookmarks` only if current SERP or last30days evidence shows enough
   demand.

The comparison pages should be honest. Say where Totem loses, where it wins, and
who should choose each tool.

### Product/Tool Idea Candidates

These are not automatic build tasks. They are ideas to validate from SERP,
last30days, product fit, and implementation cost:

1. Export sample pack: downloadable CSV, Markdown, PDF, and AI-ready examples
   from a public dummy bookmark set.
2. X bookmark cleanup checklist: export first, verify file, delete/clear, keep
   a local backup.
3. Twitter bookmark manager comparison table: static data component reused in
   listicles and `/vs/*` pages.
4. Search/export demo: a lightweight public demo showing what local search and
   Markdown export look like without requiring install.
5. AI prompt/export helper: examples for sending saved tweets to ChatGPT,
   Claude, NotebookLM, or Obsidian without losing the source URL.
6. Local-first privacy explainer widget: show what stays in browser storage and
   what never leaves the device.

Only propose building a tool when the evidence shows repeated action intent.
Otherwise, capture it as a page section or FAQ.

## Content Guardrails

- Stay inside Totem's lane: X/Twitter bookmarks, read-later behavior, saved
  posts, export, search, privacy, new-tab reading, local-first ownership.
- Keep the existing voice: observational, specific, terse, and honest about
  scope.
- Do not write generic productivity, AI, or SEO content.
- Do not chase query variants with separate thin pages.
- Do not claim Totem is a full Pocket, Readwise Reader, Raindrop, Dewey, or
  browser bookmark replacement.
- Prefer one strong page over many weak ones. A useful default pace is one or
  two high-quality posts per week, not three commodity posts per day.
- Use AI for research pressure, sequencing, and cleanup. Preserve human
  judgment, sources, and specificity.
- Treat `$last30days` as evidence for current language and sentiment, not as a
  replacement for source links, official docs, or SERP validation.
- Do not create a separate page for every related phrase. If the intent is the
  same, refresh or expand the existing page.

## Decision Scoring

Score opportunities before choosing the next item. Use 1-5 for each axis, then
pick the highest total that is still inside Totem's lane.

| Axis | What a 5 means |
|---|---|
| Search demand | Clear direct or cluster demand from cached or live keyword data. |
| SERP gap | Current ranking pages are stale, thin, wrong intent, or missing Totem's answer. |
| Product fit | Totem can answer honestly without pretending to be a different tool. |
| Evidence edge | We can add product proof, public data, current user language, or original examples. |
| Conversion value | The reader is likely to install, compare, export, or trust Totem more afterward. |
| Refresh leverage | Existing URL can be improved instead of creating another page. |
| Distribution potential | Communities, roundups, and active conversations exist for sharing. |

Kill or defer any topic with product fit below 3, even if demand is high.

## Existing Post Audit

Run this before drafting a nearby new page:

1. Open the current post and identify the promise made by the title, H1,
   description, first screen, and CTA.
2. Compare that promise against the live SERP for the canonical keyword.
3. Check whether the page answers the dominant People Also Ask questions or
   visible forum complaints.
4. Check whether newer Totem pages should be linked from the post.
5. Check whether older related posts link back to it.
6. Verify external facts, competitor details, screenshots, pricing, user counts,
   extension permissions, and dates.
7. Look for places where `$last30days` language can sharpen headings, examples,
   objections, and FAQs.
8. Decide: no-op, refresh existing URL, split a genuinely different intent into
   a new page, or kill/defer the adjacent idea.

Record the audit in the HTML report as:

| URL | Canonical keyword | Current weakness | Evidence | Action | Internal links |
|---|---|---|---|---|---|
| `/blog/...` | `...` | Missing current competitor data | SERP + last30days | Refresh | From A to B |

## Non-Commodity Evidence Menu

Each SEO page should include at least two evidence types:

- Totem product proof: screenshots, export files, UI states, demo behavior, or
  exact implementation constraints from this repo.
- Official sources: X help/API docs, Chrome docs, Mozilla/Pocket notices, Google
  Search docs, Chrome Web Store listings.
- Live SERP observations: what currently ranks, what format dominates, and what
  the SERP fails to answer.
- Public competitor details: pricing, permissions, platform, account model,
  export depth, screenshots from public marketing or Chrome Web Store pages.
- User language: Reddit, Hacker News, X posts, forums, or CWS reviews that show
  the actual confusion or pain.
- Transcript-derived stories: public YouTube/podcast transcripts, cited and
  linked, when they reveal concrete workflows or founder/operator behavior not
  already written up elsewhere.
- `$last30days` user-language clusters: fresh Reddit, X, YouTube, TikTok,
  Hacker News, GitHub, Polymarket, and web evidence that shows how people talk
  about the problem right now.

For screenshots in listicles, follow the screenshot rules in
`plans/blog-pipeline.md`. If extension screenshots are involved, read
`docs/extension-screenshot-workflow.md` first.

## Research Depth Requirements

For each selected opportunity, collect enough evidence to answer these
questions before drafting:

- What exact intent is the searcher expressing?
- What does the current SERP answer well?
- What does the SERP fail to answer?
- What language do users use when they describe the pain?
- Which tools or workflows do users already try?
- What does Totem solve, and what does it not solve?
- Is this better handled as a new post, an existing-post refresh, a comparison
  page, a product/tool proposal, or distribution work?
- Which internal pages should this strengthen?

Minimum research set for a new or refreshed page:

1. One live SERP review or cached SERP review that is still current enough.
2. One keyword/source table from cached DataForSEO, live DataForSEO, Search
   Console, Google autocomplete/PAA, or manual SERP observations.
3. At least two non-commodity evidence types.
4. A current internal-link map.
5. A distribution hypothesis.

Minimum research set for listicles and comparison pages:

1. Public facts for every named tool: homepage/CWS URL, pricing if public,
   account requirement, supported platforms, export/search/read-later depth, and
   screenshots when ethically capturable.
2. One evidence-backed "who should choose this" sentence per tool.
3. `$last30days` or equivalent current user-language research when tool
   sentiment, active complaints, or new alternatives could change the ranking.
4. A clear statement of where Totem loses.

Minimum research set for tool/product proposals:

1. Repeated action intent from SERP, `$last30days`, support/forum language, or
   existing post gaps.
2. The smallest useful version of the tool.
3. The page or workflow where the tool would live.
4. Why content alone is insufficient.
5. Risks, implementation unknowns, and what evidence would invalidate it.

## HTML Research Reports

Every SEO cycle should produce a readable HTML report. Raw JSON is allowed for
caching paid tool output, but the human-facing artifact should be HTML.

Use this path pattern:

```txt
plans/research/seo-cycle-YYYY-MM-DD-<slug>.html
```

For project setup or migration into a different repo, use:

```txt
plans/research/seo-project-setup-YYYY-MM-DD.html
```

Each cycle report should include:

- Opportunity inventory with new-page, refresh, tool, internal-link, and
  distribution candidates.
- Page/topic name, canonical keyword, target URL or planned slug.
- Search intent summary.
- SERP table: ranking page, URL, format, strength, weakness, and gap.
- Keyword/source table, including cached file paths and paid spend if any.
- `$last30days` subagent summary table when used, including raw report paths.
- Existing post audit table when a refresh or adjacent-topic decision was made.
- Product/tool idea table when user pain suggests a tool instead of only
  content.
- Non-commodity evidence collected and how it will appear in the page.
- Internal link plan: old pages to link from, new page links out to old pages.
- Draft/publish status.
- Build/test result, including the exact command.
- Distribution targets.
- Open blockers and next loop action.

HTML reports should be easy to open in a browser. Use normal headings, tables,
short paragraphs, and source links. Do not bury the useful research in terminal
logs or raw JSON only.

## Publishing Checklist

- Frontmatter includes `title`, `slug`, `description`, `publishedAt`,
  `draft: false`, and `canonicalKeyword`.
- The H1 matches the searcher's language without sounding like keyword stuffing.
- The first screen answers the searcher's question or frames the comparison
  clearly.
- The chosen URL is correct: update an existing page when intent overlaps; only
  create a new page for a distinct intent.
- The page links to at least two relevant Totem posts or product pages.
- At least one older relevant post is updated to link back when appropriate.
- External factual claims have source links.
- Images have descriptive alt text.
- Any competitor comparison is fair, current, and scoped.
- User-language claims from `$last30days` are backed by the original public
  source or summarized as research notes, not invented as broad market claims.
- Tool/product suggestions are recorded when research reveals repeated action
  intent that the current product or content does not satisfy.
- `pnpm build:website` passes.
- `plans/blog-pipeline.md` is updated.
- A readable HTML report exists under `plans/research/`.
- New outreach targets or distribution notes are recorded.

## Distribution Checklist

After publishing, list the most relevant next actions:

- Existing listicles or roundups that should include Totem.
- Communities where the post answers an active question without spam.
- `$last30days` communities, threads, creators, or channels where the language
  suggests a non-spammy follow-up.
- Competitor-comparison pages that deserve outreach.
- X/LinkedIn/thread version, if the post has a strong narrative.
- Search Console action: inspect the URL after deploy and request indexing when
  it is strategically important.
