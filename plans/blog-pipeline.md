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
5. **Publish**: copy the markdown to `apps/site/src/content/blog/<slug>.md` with
   frontmatter (`title`, `slug`, `description`, `publishedAt`, `draft: false`,
   `canonicalKeyword`). Run `pnpm --filter @totem/site dev` (or build) —
   Astro's content collection renders md → static HTML, the per-post page and
   listing are generated automatically, and external `<a>` get UTM/`ref`
   decoration via `apps/site/src/lib/rehype-blog-links.mjs`. **No manual HTML step.**
6. **Track**: move the entry to **Published** with the live URL and date.
   Add the canonical keyword + monthly volume so we can revisit performance.

## Writing setup — fragments → beats → edit

Use this for every thesis, explainer, or launch-adjacent post. The goal is not
to make AI "write the post." The goal is to keep the human voice, judgement,
and specificity in the loop while using AI as pressure, sequencing, and cleanup.

Keep each phase in a separate context. For writing, shorter context is better:
one post packet, the voice notes above, and only the sources needed for that
phase. If a chat is carrying old drafts, old research, and unrelated repo
context, start a clean one before drafting.

### 1. Fragment pass

File: `plans/blog-drafts/NN-slug.md`, section `## Fragments`.

Capture loose material without forcing structure:

- real observations about how people save, forget, search, export, or re-read
- sharp lines that sound like Totem
- objections and caveats
- concrete facts, dates, screenshots, and source links
- competitor comparisons where we can be honest
- sentences we are not allowed to write because they overclaim

AI's job in this phase is to grill the idea, not draft prose. Ask it to find
the lazy angle, the missing reader pain, the sentence that sounds like a generic
SaaS blog, and the place where we are secretly making a bigger claim than the
product earns.

### 2. Beat pass

Same file, section `## Beat Map`.

Turn fragments into a path:

- one reader problem
- one thesis
- 5-8 beats, each with a job
- where Totem appears, usually late
- what the post explicitly does not cover
- sources needed per beat

Draft one beat at a time. After each beat, check: is it specific, true, terse,
and in the blog voice? If not, rewrite that beat before moving on.

### 3. Editorial pass

Same file, section `## Draft`.

Only after the post reads well, run the cleanup pass:

- add subheads that clarify the argument without sounding like SEO scaffolding
- add internal links to relevant Totem posts
- add source links and verify claims
- cut repeated points
- make the CTA honest and small
- write frontmatter

Final check before publish: if the post can be summarized as "Totem feature
announcement," it is too promotional. It should stand alone as a useful note
about bookmarks, reading, X, memory, or owning your saved material.

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
| 2026-04-27 | How to Export Your X / Twitter Bookmarks (Every Method, Ranked) - 2026 | [how-to-export-twitter-bookmarks](/blog/how-to-export-twitter-bookmarks) | export twitter bookmarks | ~250 |
| 2026-04-27 | Best Chrome Bookmark Managers in 2026 — Sorted by What You Actually Save | [best-chrome-bookmark-managers-2026](/blog/best-chrome-bookmark-managers-2026) | chrome bookmark manager | ~3,500 |
| 2026-05-28 | What Actually Gets Exported When You Export Twitter Bookmarks? | [what-gets-exported-twitter-bookmarks](/blog/what-gets-exported-twitter-bookmarks) | twitter bookmarks export | ~250 supported |
| 2026-05-28 | How to Search Your Twitter Bookmarks Before You Export Them | [search-twitter-bookmarks-before-export](/blog/search-twitter-bookmarks-before-export) | twitter bookmarks search | ~110 |
| 2026-06-02 | Twitter Saver: What Saving Actually Does | [twitter-saver-what-saving-actually-does](/blog/twitter-saver-what-saving-actually-does) | twitter saver | 5,400 |
| 2026-06-02 | Where Are My Bookmarks on X? | [where-are-my-bookmarks-on-x](/blog/where-are-my-bookmarks-on-x) | where are my bookmarks on x | ~640 |

---

## In progress

_(none yet)_

---

## Ideas

Ordered by editorial priority (voice fit × SERP gap × intent), not raw volume.
Split by post format: **Listicles** (ranked/segmented round-ups) and **Thesis & explainer** (single-argument or how-to with POV).

### Researched, fit-checked, ready to draft

### Remaining launch/export ideas — verified 2026-05-28

Raw pulls:
- `tmp/dataforseo/export-article-keywords-2026-05-28.json` — 69 keywords, US/en, cost $0.075.
- `tmp/dataforseo/serp-export-launch-*-2026-05-28.json` — 6 SERPs, US/en, cost $0.021.

Published from this batch:
- Refreshed `/blog/how-to-export-twitter-bookmarks` for `export twitter bookmarks`.
- Published `/blog/what-gets-exported-twitter-bookmarks` for `twitter bookmarks export`.
- Published `/blog/search-twitter-bookmarks-before-export` for `twitter bookmarks search`.
- Published `/blog/twitter-saver-what-saving-actually-does` for `twitter saver`.
- Published `/blog/where-are-my-bookmarks-on-x` for the X bookmark location cluster.

#### LX4. "Best Twitter bookmark managers for search, export, and actually reading"
- **Canonical kw**: `twitter bookmark manager`
- **Cluster vol**: ~120/mo (`twitter bookmark manager` 40, `twitter bookmarks manager` 40, `x bookmark manager` 10, `x bookmarks manager` 10, `twitter bookmarks app` 10, plus adjacent `how to organize twitter bookmarks` 20).
- **Competition**: LOW.
- **SERP gap**: SERP is Reddit, X profiles, app stores, Dewey, Circleboom, an outdated 2023 Medium post, XBookmark, TweetSmash, and Firefox add-ons. There is room for a 2026 comparison that ranks tools by job: search, export, read, organize, backup.
- **Angle**: Honest comparison table. Totem wins "new tab reading + local export"; Dewey wins cloud multi-platform; TweetSmash wins digest/workflows; Twillot wins lightweight search; exporter extensions win one-time CSV.
- **Fit**: ★★★★ — close to existing L3, but the export/search frame makes it launch-relevant.

#### LX5. "A read-later app is only as good as its restore button"
- **Canonical kw**: `pocket alternative` or internal-link essay, not an export keyword.
- **Cluster vol**: no meaningful direct volume for `read later backup`, `read later export`, or `restore twitter bookmarks`.
- **Competition**: Not worth SERP-first targeting.
- **SERP gap**: This is a brand/trust essay, not a search-led post.
- **Angle**: Use Pocket/Omnivore shutdown anxiety as the reader pain. A saved queue is not trustworthy unless saved items, reading progress, highlights, notes, and enough readable content can leave and come back.
- **Fit**: ★★★ — good launch narrative, but publish after the search-led pieces.

#### LX6. "What most Twitter bookmark exporters actually give you (and what's missing)"
- **Canonical kw**: `export twitter bookmarks` (50/mo) — low volume but high intent; the real value is trust/conversion for people already evaluating Totem.
- **Cluster vol**: ~50/mo direct + long-tail from "download twitter bookmarks," "save twitter threads," "backup twitter bookmarks."
- **Competition**: LOW. Existing posts are how-to walkthroughs. None explain the depth difference between export types.
- **SERP gap**: No post in the top 10 explains WHY exports from different tools look different — URL list vs. metadata CSV vs. full thread content. This is a gap Totem is uniquely qualified to fill honestly.
- **Angle**: Most one-click exporters scrape X's API response which gives tweet metadata (URL, truncated text, author, date). For threads, you get disconnected fragments — individual tweets with no thread context. Totem exports what the reader view already parsed: the full thread as a coherent document (all tweets in order, full text, inline formatting, linked article content where available, YAML frontmatter). The Markdown file you get from Totem is the reading experience, not the raw data. Honest scope: this only applies to bookmarks that Totem has synced and rendered in reader view — exports of un-read bookmarks are metadata only.
- **Tracking goal**: Install CTA click-through from people already searching "export twitter bookmarks." This post exists to convert comparison-stage readers, not top-of-funnel searchers.
- **Fit**: ★★★ — not a volume play, a conversion and trust play. Publish after LX4.

#### Deprioritized: "Tweet saver — what 'save a tweet' actually does"
- **Canonical kw tested**: `tweet saver`
- **Volume**: 320/mo, LOW.
- **Problem**: SERP intent is almost entirely Twitter/X video downloader tools, not bookmark/read-later intent. Targeting it would attract the wrong reader.
- **Use instead**: Mention "save tweets" language inside LX3/LX4, but do not make `tweet saver` the primary keyword.
- **Update 2026-06-02**: Published the adjacent `twitter saver` version as `/blog/twitter-saver-what-saving-actually-does` because the SEO growth report identified `twitter saver` as the higher-volume, better-fit query.

#### Deprioritized: "Twitter thread reader"
- **Canonical kw tested**: `twitter thread reader`
- **Volume**: 260/mo, LOW.
- **Problem**: SERP intent is thread unrolling/PDF tools. Totem can participate only if the article is about reading saved threads, not export.
- **Use instead**: Keep for a later "best Chrome extensions for reading" or "saved threads" post, not this export launch.

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
- **Status 2026-06-02**: Published as `/blog/where-are-my-bookmarks-on-x`.
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
