# SEO Topic Ideas & Keyword Research

This file is the single home for all SEO/keyword research that informs Totem's
content strategy. Findings from /dataforseo runs (Apr 2026, US locale) are merged
inline. Update this file rather than starting a new one when re-running research.

**Strategic thesis:** shallow export is a feature, deep export is a moat, and
"bookmarks as a knowledge-base source" is the keyword cluster nobody owns yet —
*but* the highest existing volume is in defensive privacy + bookmark-management
queries, where competing pages are weak and beatable. Ship the defensive cluster
first to establish authority, then layer the offensive AI/second-brain posts on top.

---

## /dataforseo findings (Apr 2026, Google US, location_code 2840)

Raw responses are cached in `tmp/dataforseo/`. Re-run when refreshing.

### Cluster 1 — Privacy (HIGHEST VOLUME, weak competition)

| Keyword | Vol/mo | Comp |
|---|---:|---|
| can people see your bookmarks on x | **1,600** | LOW |
| are twitter bookmarks public | **1,000** | LOW |
| bookmarks twitter / twitter bookmarks | 880 | LOW |
| are bookmarks private on x | 880 | LOW |
| can people see your bookmarks on twitter | 720 | LOW |
| are bookmarks public on x | 720 | LOW |
| twitter bookmarks meme | 590 | LOW |
| are bookmarks public on twitter | 390 | LOW |
| are x bookmarks public | 480 | LOW |
| can people see your twitter bookmarks | 260 | LOW |
| are twitter bookmarks private | 260 | LOW |
| (long tail of ~25 more "can/are see/private" variants, 70–210 each) | | |

**Combined cluster volume: ~8,000+/mo across the privacy phrasings alone.**

**SERP intent (top 10 for "are twitter bookmarks public" and "can people see your
bookmarks on x"):** Reddit + an x.com tweet at the top, then a chain of small
competitor SEO blogs — tweetarchivist, tweetdelete, circleboom, postel,
sidesmedia, bulkoid, getdewey, linkedin republished. **No major publisher
ranks. help.x.com appears but usually below the fold.** This is the most
beatable high-volume cluster Totem has access to.

**"twitter bookmarks meme" (590) is NOT the audience** — it's the
"horny-jail / save-for-later" joke crowd. Skip.

### Cluster 2 — Bookmark management / clearing (high intent, news-pegged)

| Keyword | Vol/mo | Comp |
|---|---:|---|
| how to clear bookmarks on x | 390 | LOW |
| how to delete all bookmarks on twitter | 170 | LOW |
| how to delete bookmarks on x | 140 | LOW |
| how to clear twitter bookmarks | 140 | LOW |
| how to clear all bookmarks on x | 90 | LOW |
| how to delete all bookmarks on x | 90 | LOW |
| how to clear all bookmarks on twitter 2025 | 70 | LOW |
| clear bookmarks on x | 70 | LOW |

**SERP intent ("how to clear all bookmarks on x"):** Reddit thread *titled*
"Twitter removed Remove All Bookmarks option" sits at #2 — confirms the
Oct 2025 desktop regression is the active live news angle. help.x.com #5,
then x.com posts, Chrome extensions (Twitter Remove All Bookmarks, $4.99/mo),
hardreset, YouTube. **Beatable; no authoritative how-to with the regression
addressed.**

### Cluster 3 — "Bookmarks disappeared" / 800-limit pain

| Keyword | Vol/mo | Comp |
|---|---:|---|
| twitter bookmarks disappeared | 90 | LOW |
| twitter bookmarks limit | 70 | LOW |
| twitter bookmark limit | 40 | LOW |
| twitter bookmarks search | 70 | LOW |

**SERP intent ("twitter bookmarks disappeared"):** Reddit r/Twitter thread,
getdewey, an x.com user complaint, Julia Colen's Medium post, devcommunity
bug threads, archivlyx. **Beatable.**

**SERP intent ("twitter bookmarks limit"):** Reddit "How it actually works"
thread, tweetarchivist, the Twillot 200k-stored tweet, circleboom,
devcommunity, saverything, Carmel Heydarian's Medium piece, xbase.so,
metricool, *plus a Chrome Web Store listing for "Export Twitter
Bookmarks"*. **Beatable, and the limit-post.md research already has the
killer X-dev-docs verbatim quote nobody else surfaces.**

### Cluster 4 — Export / backup (low volume, very high intent)

| Keyword | Vol/mo | Comp |
|---|---:|---|
| export twitter bookmarks | 50 | LOW |
| download twitter bookmarks | 40 | LOW |
| export x bookmarks / x bookmarks export | 10–20 | LOW |
| save twitter bookmarks | 10 | LOW |
| export twitter bookmarks free / extension / firefox / to notion / reddit | 10 each | LOW |

**SERP intent ("export twitter bookmarks"):** Chrome Web Store listing #1,
Reddit, Onurdan's Medium piece, GitHub repos (prinsss, nornagon),
Chrome Web Store again ("Twitter Bookmarks Downloader"), getdewey, Edge
addon. **The keyword is dominated by store listings — the play here is
to optimize Totem's Chrome Web Store title/description/screenshots
directly, not write a post that competes with extension listings.** The
*blog* angle is to rank for the long tail ("how to export twitter
bookmarks free", "export twitter bookmarks to notion", "export twitter
bookmarks reddit") with comparison/howto content.

### Cluster 5 — Pocket (medium volume, hard SERP)

| Keyword | Vol/mo | Comp |
|---|---:|---|
| pocket alternatives | 720 | LOW |
| pocket shutdown | 480 | LOW |

**SERP intent ("pocket alternatives"):** Reddit, Chris Huerta blog, twit.tv,
xda-developers, beemind, Zapier, G2, Raindrop's own blog, Medium, Apple
Discussions, Toolness Substack, Product Hunt, OpenSourceAlternative.to.
**This is a publisher-tier SERP. Totem will not outrank Zapier or G2 head-on.**

The play is *not* "best Pocket alternatives." The play is the
**Twitter-shaped sub-cluster nobody covers** — see Tier 1B below.

### Cluster 6 — AI / NotebookLM / Obsidian / Notion / second-brain (LOW VOLUME TODAY)

| Keyword | Vol/mo | Comp |
|---|---:|---|
| how many sources can you add to notebooklm | 140 | LOW |
| notebooklm sources | 40 | LOW |
| notebooklm download / export sources | 20–40 | LOW |
| notebooklm twitter | 20 | LOW |
| building a second brain | 1,300 | MEDIUM |
| obsidian twitter bookmarks | 0 (no Ads data) | n/a |
| export twitter to obsidian | 0 | n/a |
| twitter bookmarks notion / markdown / ai | 0 | n/a |
| export twitter bookmarks to notion | 10 | n/a |

**Honest read:** the Twitter→AI-tool keyword cluster doesn't have
Google-Ads-detectable volume *yet*. "Building a second brain" has volume but
it's a book-buyer audience, not a product-buyer audience.

**These posts are still worth writing**, but as **plays for the next 12
months**, not for current traffic. Cheap to write, durable, and they catch
the wave when these queries scale up. Treat as Tier 2.

### Cluster 7 — Branded / category SERPs Totem already plays in

| Keyword | Vol/mo | Comp |
|---|---:|---|
| twitter bookmarks chrome extension (estimated from SERP) | low-mid | LOW |
| twitter bookmarks manager | low-mid | LOW |

**SERP intent ("twitter bookmarks chrome extension"):** Chrome Web Store
listings dominate (Export Twitter Bookmarks, Twillot, xBookmarks, Dewey,
Reddit "I built", bookmarksave.com, xbase.so). **Totem's wedge here is the
Chrome Web Store listing itself + a comparison post.**

---

## Re-tiered post priorities (replaces previous Tier 1/2/3 ordering)

The original tiering put offensive AI posts first. Data flips this:
**ship the defensive cluster first** — that's where the volume is, and the
SERPs are unusually weak.

### Tier 1 — Ship first (high volume × low SERP difficulty × already-researched)

#### 1. "Are X / Twitter bookmarks public? Who can actually see them in 2026"
- **Targets:** privacy cluster (~8,000/mo combined)
- **Source material:** `privacy-post-sources.md` (already done)
- **Critical SEO note:** must rank for **both** "twitter bookmarks" and
  "x bookmarks" phrasings. Use H2/H3 headers carrying both. The X variants
  have *higher* volume than Twitter ones — don't accidentally optimize only
  for the legacy name.
- **Slug:** `/are-twitter-bookmarks-public` (target the largest single keyword)
- **Must-include sub-questions** (each is its own ranked query):
  - "can people see your bookmarks on x" — direct H2
  - "are bookmarks private on x" — direct H2
  - "can the author see who bookmarked their tweet" — answers "no"
    citation from privacy-post-sources.md:34
  - "do you get notified when someone bookmarks your post" — answers "no"
- **Differentiator vs the 10 competitor blogs:** lead with the
  @slvppy panic tweet, debunk the recurring "bookmarks going public"
  rumor with the SochFactCheck citation, and quote primary X sources verbatim.

#### 2. "Why your X bookmarks 'disappear' — the real bookmark limit, explained"
- **Targets:** disappeared/limit cluster (~250/mo combined, very high intent)
- **Source material:** `limit-post-sources.md` (already done)
- **SEO move:** verbatim quote of the X dev docs 800-cap line. **No
  competitor has it.** Google rewards primary-source quoting.
- **Slug:** `/twitter-bookmarks-limit-explained` or
  `/why-twitter-bookmarks-disappear`
- **Bundle the Oct 2025 desktop regression** (Tier 3 H below) as a
  sidebar in this post — same keyword cluster, same searcher.

#### 3. "How to clear all your X / Twitter bookmarks (and what to do when the button is gone)"
- **Targets:** clear/delete cluster (~1,000/mo combined)
- **Why now:** the Reddit "Twitter removed Remove All Bookmarks option"
  thread is the #2 result — there is *zero* up-to-date how-to with the
  regression addressed. Totem can own this fast.
- **Source material:** `limit-post-sources.md:88-118` already has it
- **Differentiator:** include the workaround tools (Sajjad-s extension,
  Archivlyx, x-cleanup-tool) honestly, *and* pitch Totem as the
  "if you're going to nuke 800 bookmarks, export them deep first"
  exit ramp. Conversion lever.

### Tier 2 — Ship after Tier 1 ranks (medium volume, the AI/knowledge-base wave)

#### 4. "How to turn your X / Twitter bookmarks into a NotebookLM source"
- **Targets:** notebooklm + twitter (low today, growing)
- **Source material:** new — needs separate research file
- **Why write despite low volume:** NotebookLM source-import is a
  *product feature trend*. Volume will come. Cheap insurance, and
  Totem's selected-deep-export is genuinely the cleanest way to do
  this — it's a true differentiator, not just SEO bait.
- **Hook this to a real shipped feature.** Don't publish before the
  "Export selected → Markdown zip" UX exists.

#### 5. "Export Twitter bookmarks to Obsidian (the right way)"
- **Targets:** obsidian + twitter (no current Ads volume; durable evergreen
  in Obsidian community)
- **Source material:** new — Obsidian community forum + Reddit r/ObsidianMD
  research needed
- **Distribution:** more than the SEO, this is a Reddit-and-forum-shareable
  post. Lower SEO ceiling, higher direct-traffic ceiling.

#### 6. "How to search through your X bookmarks (when X's own search fails)"
- **Targets:** "twitter bookmarks search" (70/mo) + long tail
- **Differentiator:** Totem's local search indexes the full thread text of
  whatever's been opened. X's own search (Premium-only) only matches the
  bookmarked tweet. Real product-truth wedge.

### Tier 3 — Topical / news-pegged + thought-leadership

#### 7. "X removed 'Clear all bookmarks' from desktop — what to do"
- **Bundle into Tier 1 #3** as the lead section, don't write separately.

#### 8. "Pocket is gone. Now what about your Twitter saves?"
- **Targets:** "pocket shutdown" + "what to do after pocket" long tail.
  Don't try to outrank "pocket alternatives" head-on — Zapier/G2 own it.
- **Source material:** `pocket-post-sources.md` (already done)
- **Hook:** Pocket migration tools handle articles. None handle the
  Twitter half of your saved content. Totem is the missing half, not a
  Pocket replacement.

#### 9. "Are bookmarks the new likes? What X's privacy moves tell us about 2026"
- Opinion piece. Cross-link target for the privacy post. Avoid invented
  X roadmap claims (timeline-and-facts.md:71).

#### 10. "I exported 12,000 X bookmarks. Here's what I learned."
- Narrative / link-bait. Write only after Totem usage data supports a
  real story. The Onurdan post format proves it works.

---

## Competitor map (who Totem keeps colliding with on every SERP)

The same ~10 competitor SEO blogs cycle through almost every Totem-relevant
SERP. None of them are publisher-tier. Beating them is mostly about being
more honest, citing primary sources, and having the product as proof.

| Competitor | Domain | Strength | Weakness Totem can exploit |
|---|---|---|---|
| Tweet Archivist | tweetarchivist.com | Ranks broad | Generic SEO, light on primary sources |
| TweetDelete | tweetdelete.net | Brand recognition | Tool-pitch heavy; thin info |
| Circleboom | circleboom.com | Scale of content | Listicle/template feel |
| Postel | postel.app | Newer | Light citations |
| SidesMedia / Bulkoid | sidesmedia.com / bulkoid.com | SEO farm-shaped | Low E-E-A-T |
| Dewey | getdewey.co | Multi-platform | Cross-network distraction |
| Saverything | saverything.com | Has the 800-cap quote | Single-purpose tool |
| Xbase | xbase.so | Recent | Light on volume |
| Archivlyx | archivlyx.com | News-fresh | Niche tool |
| Tweetsmash | tweetsmash.com | Good product | Lean blog |

**Pattern:** every one of these is a *small SaaS* doing SEO for their
own tool. Totem's edge: real product + better-cited writing + a
genuinely different architecture (local-first, deep cache).

---

## Voice / framing rules carried over from the other research files

- Lead with the user's pain in their own words (HN, Medium quotes — see
  `pocket-post-sources.md` and `limit-post-sources.md`).
- Quote primary sources verbatim where possible. Avoid the "DO NOT PUBLISH"
  claims catalogued in `timeline-and-facts.md:71`.
- Don't overclaim Totem's capabilities. The honest pitch is:
  *shallow-export-everything + deep-export-what-you-opened*.
- "Export what you've actually read" is a stronger frame than "we can't
  export everything deeply." Same constraint, opposite emotional valence.
- Always write for **both** "twitter bookmarks" *and* "x bookmarks"
  phrasings. The X variants now carry equal-or-higher volume.
- Year-stamp where relevant ("in 2026") — searchers add the year, and
  Google rewards freshness signals on Twitter/X content.

---

## Chrome Web Store listing optimization (separate from blog SEO)

The "export twitter bookmarks" SERP is dominated by Chrome Web Store
listings, not blog posts. Totem's *listing* should target this directly:

- Title should include "X / Twitter Bookmarks" + a deep-export verb
  (Export, Save, Backup, or Markdown).
- First line of description must answer the search query in 1 sentence.
- Screenshots: at least one labelled "Export selected → Markdown zip" and
  one labelled "Survives source deletion."
- Long description: include the phrases "twitter bookmarks chrome
  extension", "twitter bookmarks manager", "export twitter bookmarks to
  notion / obsidian / notebooklm", "twitter bookmark search."

This is a product/marketing task, not a blog task. File it accordingly.

---

## Open questions to resolve before writing Tier 2

1. Does Totem's cache survive across browser reinstalls / sync across
   devices? (Affects how aggressively we can pitch "second brain.")
2. What's the realistic batch size for selected deep export before X
   rate-limits the user's session? (Affects the cap we promise in the UI
   and in posts.)
3. Is there a "export everything I've opened in the last N days" surface?
   Worth shipping before Tier 2 #4 goes live — the post should describe a
   feature that exists.

---

## When to re-run /dataforseo

- After publishing 3+ posts (check ranking + new related queries)
- Quarterly, to track NotebookLM / AI-knowledge-base cluster growth
- Whenever an X product change creates a new query (e.g., a future
  "X likes" → "X bookmarks" privacy regression would spawn a fresh cluster)

Cached responses live in `tmp/dataforseo/`. If they're missing, re-run
the curl commands from this conversation; the requests are simple
single-array POSTs.
