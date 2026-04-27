# Blog Pipeline — Totem

The single source of truth for what we write, why, and where each post is in the
flow. Lives next to `plans/seo-blog-research.md` (the original keyword research)
and `plans/blog-drafts/` (working markdown).

---

## Voice — "Notes on bookmarks, reading, and the things you save"

This is the tagline already on the blog index. Every post on this list has to
sound like it belongs underneath it. If a topic doesn't, it's not ours — even
if the search volume is irresistible.

**How that voice shows up:**

- **Notes, not articles.** Short, observational, written like a smart friend
  thinking out loud. No "ultimate guide," no "10 best," no "in this post we'll
  explore."
- **Behavioral, not promotional.** Lead with what people *actually do* (save
  and forget), not what the product *does*. Totem shows up at the end, never
  the top.
- **Honest about scope.** Totem is for X bookmarks. We don't pretend it
  replaces Pocket, Notion, or your second brain. Saying "this isn't for you"
  to the wrong reader is how we earn trust from the right one.
- **Specific over sweeping.** Real dates ("March 16, 2023"), real numbers
  ("~800 visible bookmarks"), real quotes (X help docs, Mozilla announcements).
  No "studies show," no rounded vibes.
- **Terse.** If a sentence doesn't change the reader's understanding, cut it.
  Aim for the post to feel shorter than the topic deserves.

---

## Topic filter — does this idea fit the blog?

Use this before spending time drafting. A "yes" needs at least 3 of 4 ✅ and
zero ❌:

- ✅ Sits inside one of: **bookmarks · read-later · the save-vs-read gap ·
  X/Twitter as a reading surface · attention & memory online**
- ✅ Has a **real answer** that's currently confused, contradictory, or buried
  in the SERP (we can be the canonical reference)
- ✅ Lets us be **honest about scope** — we can recommend a competitor for the
  reader we're not right for, without losing the post
- ✅ Has a **behavioral hook** — there's something true about how people read
  online that we can lean into
- ❌ Pure navigational how-to with no point of view ("how to log in to X")
- ❌ Generic listicle without a thesis ("10 productivity hacks")
- ❌ Topics outside the reading/bookmarks lens (SEO, growth, AI in general)
- ❌ Anything where we'd have to overstate what Totem does

---

## Workflow for a new post

```
Idea  →  /dataforseo research  →  Fit check  →  Draft  →  Publish  →  Track
```

1. **Capture the idea** — add a one-liner to the **Ideas** section below.
   Don't research yet; lots of ideas die on the fit check, and research costs.
2. **Research with `/dataforseo`** — pull volume + competition for the keyword
   cluster, top-10 SERP, and People-Also-Ask. Cache JSON in
   `tmp/dataforseo/` (gitignored). Note total monthly volume and the **SERP
   gap** (what nobody is doing well).
3. **Fit check against the voice** above. If it doesn't pass, move it to the
   **Killed** section with one line on why — useful so we don't re-pitch the
   same idea in three months.
4. **Draft** in `plans/blog-drafts/NN-slug.md`. Outline first, then prose.
   Move the entry to **In progress**.
5. **Publish**: copy the markdown to `apps/site/content/blog/<slug>.md` with
   frontmatter (`title`, `slug`, `description`, `publishedAt`, `draft: false`,
   `canonicalKeyword`). Run `pnpm dev` (or build) — `build-blog.mjs` auto-
   converts md → HTML, generates the per-post page, updates the listing, and
   regenerates `src/generated/blog-posts.ts`. **No manual HTML step.**
6. **Track**: move the entry to **Published** with the live URL and date.
   Add the canonical keyword + monthly volume so we can revisit performance.

### Frontmatter template

```yaml
---
title: "..."
slug: ...
description: "..."
publishedAt: 2026-MM-DD
draft: false
canonicalKeyword: ...
---
```

### Screenshots — when, where, how to refresh

Listicles get screenshots, one per pick. Thesis & explainer posts stay
text-first (it's the Totem voice). Honorable mentions are text-only.

- **Source**: capture from the tool's **public** marketing homepage or its
  **Chrome Web Store listing**. Avoid logged-in app UIs (license grey area
  + breaks the moment they redesign the dashboard).
- **Capture**: use the `chrome-devtools` MCP. Resize to **1440 × 900** before
  shooting so every image in a post is the same aspect ratio. Take a viewport
  shot (not full-page) — we want the hero, not the whole footer.
- **Storage**: `apps/site/public/blog/<post-slug-without-year>/<tool-slug>.png`.
  The folder name should be the post's topic slug (`best-chrome-bookmark-managers`),
  shared across yearly refreshes — a 2027 refresh of L1 reuses the same folder.
- **Reference in markdown**: `![alt text describing what's shown](/blog/<folder>/<tool>.png)`.
  Alt text describes the *content* of the screenshot, not the marketing claim
  (e.g. `"Bookmanize on the Chrome Web Store — 3.8 stars, 7,000 users"` not
  `"Best bookmark manager"`).
- **Placement**: directly under the pick's H2, before the prose intro.

**Refresh triggers** — re-shoot when any of these happen:

- The tool's marketing page is redesigned.
- The headline / hero copy changes meaningfully.
- Pricing changes (also update the post body).
- Star rating or user count on a CWS listing shifts by >25%.
- A linked screenshot returns 404 in the build.
- The yearly refresh of the post (e.g. "2026" → "2027" rewrite). At that
  point, re-shoot every screenshot in the post.

If a screenshot can't be captured ethically (logged-in UI only, or login wall
blocks the marketing site), make that pick text-only rather than reaching for
a third-party screenshot we don't have the right to use.

---

## Published

| Date | Title | Slug | Canonical kw | Vol/mo (cluster) |
|---|---|---|---|---|
| 2026-04-25 | Are X / Twitter Bookmarks Private? The Real Answer (2026) | [are-x-twitter-bookmarks-private](/blog/are-x-twitter-bookmarks-private) | are twitter bookmarks public | ~7,500 |
| 2026-04-25 | Pocket Alternatives 2026 — sorted by where your reading actually comes from | [pocket-alternatives-2026](/blog/pocket-alternatives-2026) | pocket alternative | ~3,500 |
| 2026-04-25 | The X / Twitter Bookmark Limit, Explained (and what to do when bookmarks disappear) | [twitter-x-bookmark-limit-explained](/blog/twitter-x-bookmark-limit-explained) | twitter bookmarks limit | ~1,300 |
| 2026-04-27 | How to Export Your X / Twitter Bookmarks (Every Method, Ranked) — 2026 | [how-to-export-twitter-bookmarks](/blog/how-to-export-twitter-bookmarks) | export twitter bookmarks | ~160 |
| 2026-04-27 | Best Chrome Bookmark Managers in 2026 — Sorted by What You Actually Save | [best-chrome-bookmark-managers-2026](/blog/best-chrome-bookmark-managers-2026) | chrome bookmark manager | ~3,500 |

---

## In progress

_(none yet)_

---

## Ideas — researched, fit-checked, ready to draft

Ordered by editorial priority (voice fit × SERP gap × intent), not raw volume.
Split by post format: **Listicles** (ranked/segmented round-ups) and **Thesis & explainer** (single-argument or how-to with POV).

### Listicles

#### L2. "Best Chrome extensions for reading — save it now vs. save it for later"
- **Cluster vol**: ~500/mo + long-tail (`chrome reading mode extension` 210, `read it later` 170, `save articles to read later` 50, `read later chrome extension` 40, `chrome reading extension` 30)
- **Competition**: LOW
- **SERP gap**: Big-DA listicles (Zapier, Wired, Medium "I tested 10+") dominate but **nobody splits reader-mode (read NOW) from read-later (save it).** They get conflated into one ranking, which is why every listicle feels off.
- **Voice fit**: ★★★★ — natural Totem thesis: saving and reading are different jobs.
- **Angle**: Two tables. **Read NOW** (Reader Mode, Reader View, Mercury Reader) for distraction-free in-page reading. **Save for later** (Totem, Raindrop, Instapaper, Readwise Reader) for stuff you'll come back to. Totem honest scope: only the second table.
- **Caveat**: don't pretend Totem is a reader-mode tool. The split is the post.

#### L3. "Best X / Twitter bookmark managers in 2026 (honest comparison)"
- **Cluster vol**: long tail across `twitter bookmarks manager`, `twitter bookmarks chrome extension`, `bookmark tweets` (30), `twitter bookmarks app` (10)
- **Competition**: LOW
- **SERP gap**: Top 10 is Play Store, App Store, twitterbookmarks.com, Twillot, Tweetsmash, Dewey + a **badly outdated 2023 Medium listicle**. No credible 2026 comparison.
- **Voice fit**: ★★★★ — only if we lead with "here's who each one is right for" instead of "here's our ranked top 10."
- **Angle**: Honest table (Dewey, Twillot, Tweetsmash, xBookmarks, Totem) on price, where it lives, account required, mobile, source-of-truth. Totem positioned for "lightweight + free + new tab + no login."

#### L4. "The 10 best new tab Chrome extensions for productivity (2026)"
- **Cluster vol**: ~910/mo (`new tab extension` 320, `chrome new tab extension` 260, `custom new tab` 210, `best new tab chrome extension` 70, `aesthetic new tab` 20)
- **Competition**: LOW
- **SERP gap**: Top 10 is Chrome Web Store listings + Dashy listicle + Momentum + a 2026 web-highlights listicle. Every one of them mixes wallpapers, todos, and dashboards into one undifferentiated soup. **Nobody segments by what the new tab is actually *for*.**
- **Voice fit**: ★★★★ — the format is a top-10 (the SERP demands it), but the **thesis** is ours: your new tab is the most-loaded page in your browser, so what it shows decides what you read all day. That framing turns a generic listicle into a Totem post.
- **Angle**:
  - Open with the thesis: *the new tab page is opened ~50× a day. It's not décor — it's a reading surface, a focus surface, or a launcher. Pick on purpose.*
  - Group the 10 picks by intent: **Reading & saved content** (Totem, Tab for a Cause), **Focus & calm** (Momentum, Dream Afar, blank tab), **Launcher / dashboard** (Tabby, Toby, Workona), **Aesthetic** (Muzli, Unsplash). Honest sentence each.
  - Pick a winner per category, not overall — that's the differentiator vs every listicle currently ranking.
  - Totem owns the "Reading & saved content" slot; we recommend Momentum if the reader's real problem is focus, not reading.
- **Caveat to watch**: don't drift into a wallpaper review. Every pick has to be defended on a productivity dimension. Aesthetic/minimalist new tab keywords (~160/mo cluster) fold in here as the "Calm" category — not a separate post.

### Thesis & explainer

#### T1. "Where are my bookmarks on X — and why you keep forgetting them"
- **Cluster vol**: ~640/mo (`how to see bookmarks on x` 260, `how to find bookmarks on x` 210, `how to check bookmarks on twitter` 170)
- **Competition**: LOW
- **SERP gap**: Top is help.x.com + thin third-party "click here, click there" walkthroughs. Nobody connects "the bookmark tab is buried four taps deep" to "that's why you never read what you saved."
- **Voice fit**: ★★★★★ — this is *literally* the save-vs-read gap, in one post.
- **Angle**: 30-second how-to, then pivot to the behavioral point. Soft CTA: Totem puts the tab on every new tab.

#### T2. "Tweet saver — what 'save a tweet' actually does (and why you never re-read them)"
- **Cluster vol**: ~450/mo (`tweet saver` 320, `tweet reader` 50, `twitter reader app` 40, `bookmark tweets` 30, `save tweets` 10)
- **Competition**: LOW
- **SERP gap**: Untested top-10, but keyword phrasing is product-shopping with no obvious winner.
- **Voice fit**: ★★★★★ — pure behavioral hook ("85% of saved tweets are never re-read").
- **Angle**: What "save" technically does (X server-side bookmark vs browser bookmark vs screenshots vs DM-to-self), then the honest behavioral truth. Recommend tools by intent — Totem for "I want to actually read these."

#### T3. "Chrome's built-in reading list — why nobody uses it"
- **Cluster vol**: ~1,000/mo (`reading list chrome`)
- **Competition**: LOW
- **SERP gap**: Top is Chrome Web Store, Google Help, Reddit "Reading list tab disappeared", popsci, 9to5google. Pure tutorial coverage. No one names the actual reason — it lives behind a hover that you never trigger.
- **Voice fit**: ★★★★★ — pure save-vs-read gap, in Chrome's own UI.
- **Angle**: Quick tour (where it is, how to use it), then the honest point: Chrome shipped a reading list four years ago and ~no one has it pinned. The save-vs-read pattern explains why a tab tucked under a star icon dies on the vine. Soft CTA: Totem puts saved stuff on the new tab — same idea, different surface.

#### T4. "What to put on your Chrome new tab page (and why it matters)"
- **Cluster vol**: ~880/mo (`chrome new tab page`)
- **Competition**: LOW
- **SERP gap**: Top is Google Help, Chrome Web Store, Reddit, superuser, homenewtab.com. Every result is "here's how to change it." None of them argue *what to put there.*
- **Voice fit**: ★★★★ — companion explainer to L4. Could share traffic / internal-link with the listicle.
- **Angle**: ~50 opens/day means the new tab is a habit-forming surface. Three honest options — blank (focus), feed (reading), launcher (speed). Pick by what your last hour of browsing actually was. Mini-list inside the explainer; full picks live in L4.

---

## Killed ideas

_(empty — log here when an idea fails the fit check, with one line on why,
so we don't re-pitch it.)_
