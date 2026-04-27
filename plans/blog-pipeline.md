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

---

## Published

| Date | Title | Slug | Canonical kw | Vol/mo (cluster) |
|---|---|---|---|---|
| 2026-04-25 | Are X / Twitter Bookmarks Private? The Real Answer (2026) | [are-x-twitter-bookmarks-private](/blog/are-x-twitter-bookmarks-private) | are twitter bookmarks public | ~7,500 |
| 2026-04-25 | Pocket Alternatives 2026 — sorted by where your reading actually comes from | [pocket-alternatives-2026](/blog/pocket-alternatives-2026) | pocket alternative | ~3,500 |
| 2026-04-25 | The X / Twitter Bookmark Limit, Explained (and what to do when bookmarks disappear) | [twitter-x-bookmark-limit-explained](/blog/twitter-x-bookmark-limit-explained) | twitter bookmarks limit | ~1,300 |

---

## In progress

_(none yet)_

---

## Ideas — researched, fit-checked, ready to draft

Ordered by editorial priority (voice fit × SERP gap × intent), not raw volume.

### 1. "Where are my bookmarks on X — and why you keep forgetting them"
- **Cluster vol**: ~640/mo (`how to see bookmarks on x` 260, `how to find bookmarks on x` 210, `how to check bookmarks on twitter` 170)
- **Competition**: LOW
- **SERP gap**: Top is help.x.com + thin third-party "click here, click there" walkthroughs. Nobody connects "the bookmark tab is buried four taps deep" to "that's why you never read what you saved."
- **Voice fit**: ★★★★★ — this is *literally* the save-vs-read gap, in one post.
- **Angle**: 30-second how-to, then pivot to the behavioral point. Soft CTA: Totem puts the tab on every new tab.

### 2. "Tweet saver — what 'save a tweet' actually does (and why you never re-read them)"
- **Cluster vol**: ~450/mo (`tweet saver` 320, `tweet reader` 50, `twitter reader app` 40, `bookmark tweets` 30, `save tweets` 10)
- **Competition**: LOW
- **SERP gap**: Untested top-10, but keyword phrasing is product-shopping with no obvious winner.
- **Voice fit**: ★★★★★ — pure behavioral hook ("85% of saved tweets are never re-read").
- **Angle**: What "save" technically does (X server-side bookmark vs browser bookmark vs screenshots vs DM-to-self), then the honest behavioral truth. Recommend tools by intent — Totem for "I want to actually read these."

### 3. "How to export your X / Twitter bookmarks (every method, ranked)"
- **Cluster vol**: ~130/mo (`export twitter bookmarks` 50 + 8 long-tail at 10 each)
- **Competition**: LOW
- **SERP gap**: Chrome Web Store listing, two GitHub repos, a 2023 Medium tutorial, getdewey.co. No canonical "all 4 ways, ranked by who you are" guide.
- **Voice fit**: ★★★★ — utility piece, but with a clear POV (most people don't actually need to export, they need to *read*).
- **Angle**: Walk every method (Twitter data archive, prinsss/twitter-web-exporter, browser extensions, paid SaaS), tell the reader which one fits, end with: "if you wanted to export so you could finally read them, you don't need an export — you need them in front of you." Tiny volume, **highest purchase intent in the niche**.

### 4. "Best X / Twitter bookmark managers in 2026 (honest comparison)"
- **Cluster vol**: long tail across `twitter bookmarks manager`, `twitter bookmarks chrome extension`, `bookmark tweets` (30), `twitter bookmarks app` (10)
- **Competition**: LOW
- **SERP gap**: Top 10 is Play Store, App Store, twitterbookmarks.com, Twillot, Tweetsmash, Dewey + a **badly outdated 2023 Medium listicle**. No credible 2026 comparison.
- **Voice fit**: ★★★★ — only if we lead with "here's who each one is right for" instead of "here's our ranked top 10."
- **Angle**: Honest table (Dewey, Twillot, Tweetsmash, xBookmarks, Totem) on price, where it lives, account required, mobile, source-of-truth. Totem positioned for "lightweight + free + new tab + no login."

### 5. "The 10 best new tab Chrome extensions for productivity (2026)"
- **Cluster vol**: ~910/mo (`new tab extension` 320, `chrome new tab extension` 260, `custom new tab` 210, `best new tab chrome extension` 70, `aesthetic new tab` 20)
- **Competition**: LOW
- **SERP gap**: Top 10 is Chrome Web Store listings + Dashy listicle + Momentum + a 2026 web-highlights listicle. Every one of them mixes wallpapers, todos, and dashboards into one undifferentiated soup. **Nobody segments by what the new tab is actually *for*.**
- **Voice fit**: ★★★★ — the format is a top-10 (the SERP demands it), but the **thesis** is ours: your new tab is the most-loaded page in your browser, so what it shows decides what you read all day. That framing turns a generic listicle into a Totem post.
- **Angle**:
  - Open with the thesis: *the new tab page is opened ~50× a day. It's not décor — it's a reading surface, a focus surface, or a launcher. Pick on purpose.*
  - Group the 10 picks by intent: **Reading & saved content** (Totem, Tab for a Cause), **Focus & calm** (Momentum, Dream Afar, blank tab), **Launcher / dashboard** (Tabby, Toby, Workona), **Aesthetic** (Muzli, Unsplash). Honest sentence each.
  - Pick a winner per category, not overall — that's the differentiator vs every listicle currently ranking.
  - Totem owns the "Reading & saved content" slot; we recommend Momentum if the reader's real problem is focus, not reading.
- **Caveat to watch**: don't drift into a wallpaper review. Every pick has to be defended on a productivity dimension.

---

## Killed ideas

_(empty — log here when an idea fails the fit check, with one line on why,
so we don't re-pitch it.)_
