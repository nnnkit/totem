# Totem SEO Long-Tail Gap Brief — 2026-06-02

Source: existing repo notes plus cached DataForSEO pulls in `tmp/dataforseo/`.
Paid gap-fill calls were made after approval:

- Google Ads search volume batch: `$0.075`
- Google regular SERP follow-up: `$0.028`
- Total new DataForSEO spend: `$0.103`

## Research Scope

- Product: Totem, a local-first Chrome extension for X / Twitter bookmarks.
- Geo/language: United States, English (`location_code: 2840`, `language_code: en`).
- Business goal: install growth through Chrome Web Store search, Google long-tail pages, and comparison pages.
- Best fit queries: X/Twitter bookmarks, saved tweets, bookmark search/export/privacy/location, read-later/new-tab behavior, and competitor comparisons.

## Existing Paid Data We Should Reuse

Do not rerun these unless we are doing a quarterly refresh or checking a published-page ranking shift:

- `tmp/dataforseo/suggestions-twitter-bookmarks.json`
- `tmp/dataforseo/suggestions-x-bookmarks.json`
- `tmp/dataforseo/sv-twitter-bookmarks.json`
- `tmp/dataforseo/sv-newtab-readlater.json`
- `tmp/dataforseo/export-article-keywords-2026-05-28.json`
- `tmp/dataforseo/cws-gaps-2026-06-02.json`
- `tmp/dataforseo/cws-keyword-volumes.json`
- `tmp/dataforseo/cws-keyword-volumes-2.json`
- `tmp/dataforseo/serp-tw-bookmarks-chrome-ext.json`
- `tmp/dataforseo/serp-export-launch-twitter-bookmark-manager-2026-05-28.json`
- `tmp/dataforseo/serp-export-launch-twitter-bookmarks-search-2026-05-28.json`
- `tmp/dataforseo/serp-listicle-reading-list-chrome.json`
- `tmp/dataforseo/serp-newtab.json`

## Already Covered

These clusters already have published pages or release work in place:

| Cluster | Existing page / surface | Cached demand |
|---|---|---:|
| Privacy: are/can people see X bookmarks | `/blog/are-x-twitter-bookmarks-private` | ~8,000+ cluster |
| X bookmark limit/disappeared | `/blog/twitter-x-bookmark-limit-explained` | ~250+ cluster |
| Export Twitter bookmarks | `/blog/how-to-export-twitter-bookmarks` plus export guides | ~50 direct; CWS-dominated |
| What export contains | `/blog/what-gets-exported-twitter-bookmarks` | ~250 supported |
| Search Twitter bookmarks | `/blog/search-twitter-bookmarks-before-export` | 70-110 direct |
| Twitter saver | `/blog/twitter-saver-what-saving-actually-does`; CWS rename | 5,400 |
| Where bookmarks are on X | `/blog/where-are-my-bookmarks-on-x` | ~640 cluster |
| Twitter bookmark manager | `/blog/best-twitter-bookmark-managers-2026` | ~120 cluster |
| Chrome Reading List | `/blog/chrome-reading-list-why-nobody-uses-it` | ~1,000 |
| Chrome bookmark manager | `/blog/best-chrome-bookmark-managers-2026` | 2,400-3,500 cluster |
| Pocket alternative | `/blog/pocket-alternatives-2026` | ~3,500 cluster |

## Highest-Confidence Remaining Pages

### Paid Stage-1 Update

Executed 2026-06-02 against `keywords_data/google_ads/search_volume/live`.

- Cache: `tmp/dataforseo/totem-gap-volume-2026-06-02.json`
- Actual cost: `$0.075`
- Rows requested/returned: 92/92
- Rows with nonzero volume: 20
- Rows kept for planning: 13

Most useful new rows:

| Keyword | Vol/mo | Comp | Read |
|---|---:|---|---|
| `twillot` | 390 | LOW | Strongest comparison/profile target. |
| `tweetsmash` | 260 | LOW | Stronger than expected; compare against digest/workflow tools. |
| `dewey bookmarks` | 90 | LOW | Better target than exact `dewey alternative`. |
| `dewey twitter bookmarks` | 70 | LOW | Supports Dewey comparison page. |
| `dewey bookmark manager` | 50 | LOW | Supports Dewey comparison page. |
| `x bookmarks not showing` | 40 | LOW | Add to disappeared/not-showing cluster. |
| `twitter bookmarks not loading` | 30 | LOW | Add to troubleshooting cluster. |
| `x bookmarks disappeared` | 30 | LOW | Add to troubleshooting cluster. |
| `how to delete all x bookmarks` | 20 | LOW | Supports clear/delete post. |
| `twitter bookmarks not showing` | 20 | LOW | Add to troubleshooting cluster. |
| `twitter bookmarks app` | 10 | LOW | Supports bookmark-manager comparison. |
| `xbookmark` / `xbookmarks` | 10 each | LOW | Too small for a standalone page now. |

Zero-volume rows that should not drive pages yet: exact `dewey vs *`,
`twillot alternative`, `xbookmarks alternative`, most NotebookLM/Obsidian/AI
export terms, `twitter bookmarks chrome extension`, `twitter bookmarks on new
tab`, and most exact "copy for AI" phrases.

### 1. Clear / Delete All X Bookmarks

- Canonical keyword: `how to clear bookmarks on x`
- Cached volume: 390/mo direct.
- Supporting terms: `how to delete all bookmarks on twitter` 170, `how to clear twitter bookmarks` 140, `how to delete bookmarks on x` 140, `how to clear all bookmarks on x` 90, `clear bookmarks on x` 70, `how to delete all x bookmarks` 20, `delete all x bookmarks` 10.
- SERP signal: cached SERP shows Reddit, help.x.com, x.com posts, Chrome Web Store, HardReset, and YouTube. No strong canonical page.
- Fit: good if framed as "export before deleting" and not as a pure delete tutorial.
- Page angle: "How to clear all X / Twitter bookmarks, and what to export before you do."
- CTA: Totem is the local backup/export step before destructive cleanup.

### 2. Best Twitter Bookmark Managers 2026

- Status 2026-06-10: published as `/blog/best-twitter-bookmark-managers-2026`.
- Canonical keyword: `twitter bookmark manager`.
- Cached volume: 40/mo direct, ~120+ cluster.
- Supporting terms: `twitter bookmarks manager`, `x bookmark manager`, `x bookmarks manager`, `twitter bookmarks app`, `how to organize twitter bookmarks`.
- SERP signal: Reddit, X profiles, app stores, Dewey, Circleboom, outdated 2023 Medium, xBookmarks, TweetSmash.
- Fit: high because Totem can honestly compare by job: search, export, read, organize, backup.
- Page angle: "Best Twitter bookmark managers for search, export, and actually reading."
- CTA: Totem wins "new tab reading + local-first export"; do not pretend it wins cloud multi-device management.

### 3. Chrome Reading List: Why Nobody Uses It

- Status 2026-06-10: published as `/blog/chrome-reading-list-why-nobody-uses-it`.
- Canonical keyword: `reading list chrome`.
- Cached volume: 1,000/mo.
- SERP signal: Chrome Web Store, Google Help, Reddit "Reading list tab disappeared", Chrome developer docs, 9to5Google, PopSci.
- Fit: very high. It directly supports Totem's thesis that hidden save surfaces fail.
- Page angle: explain where Chrome Reading List is, then why it does not solve the save-vs-read gap.
- CTA: Totem puts saved X bookmarks on the new tab instead of behind a hidden menu.

### 4. What To Put On Your Chrome New Tab Page

- Status 2026-06-10: published as `/blog/what-to-put-on-your-chrome-new-tab-page`.
- Canonical keyword: `chrome new tab page`.
- Cached volume: 880/mo direct; related `new tab page` 1,600, `chrome new tab` 4,400.
- SERP signal: Google Help, CWS listings, Reddit, support threads, SuperUser. Most pages answer how to change it, not what belongs there.
- Fit: high if positioned as a habit surface, not generic productivity content.
- Page angle: blank, launcher, reading queue, or dashboard. Pick based on the job of the next tab.
- CTA: Totem owns the "reading queue from saved X bookmarks" branch.

### 5. Best New Tab Chrome Extensions 2026

- Canonical keyword: `new tab extension` or `best new tab chrome extension`.
- Cached volume: 320 direct; cluster includes `chrome new tab extension` 260, `custom new tab` 210, `best new tab chrome extension` 70.
- SERP signal: Chrome Web Store and generic listicles.
- Fit: medium-high. Useful if it is segmented by purpose, not a generic top-10.
- Page angle: reading/saved content, focus/calm, launcher/dashboard, aesthetic.
- CTA: Totem owns reading/saved content, not focus or wallpaper.

### 6. Competitor Comparison Pages

- Initial pages: `/vs/twillot`, `/vs/tweetsmash`, `/vs/dewey`.
- Cached signal: `twillot` 390/mo, `tweetsmash` 260/mo, `dewey bookmarks` 90/mo, `dewey twitter bookmarks` 70/mo, `dewey bookmark manager` 50/mo.
- SERP value: branded product research, bottom-of-funnel comparison intent, and internal linking to the Twitter bookmark manager post.
- Fit: high if each page is honest: where Totem loses, where Totem wins, who should pick each tool.
- Note: exact `dewey vs *`, `twillot alternative`, and `xbookmarks alternative` returned zero volume. The page titles should lead with the brand/job, not exact "vs" phrasing only.
- Needs SERP gap-fill before build: branded SERP shape for Twillot, TweetSmash, Dewey bookmark queries, and maybe XBookmarks if it appears in the SERPs.

## Opportunities To Defer

- `twitter thread reader`: 260/mo cached, but SERP intent is thread unrolling, not saved-bookmark reading. Defer until there is a tighter "saved threads" angle or side-panel/thread-reader feature.
- NotebookLM / Obsidian / AI workflows: current cached volume is low (`notebooklm twitter` 20; most Twitter-to-Obsidian/NotebookLM/AI terms returned zero). Keep as community/distribution content, not the next SEO sprint.
- Generic `bookmark manager`: 6,600/mo but broad and backlink-heavy. Use existing Chrome bookmark manager post; do not chase the head term yet.
- `x reader`: 4,400/mo but wrong intent in cached SERP. Do not target.

## Suggested 8-Week Publishing Order

Agent handoff: use [`plans/seo-agent-goal.md`](seo-agent-goal.md) as the
execution checklist for turning any item below into a researched, published,
internally linked, tested, and tracked page. Its long-running loop tells an
agent to come back to this order after each completed page.

1. Clear / delete all X bookmarks.
2. Best Twitter bookmark managers 2026. Published 2026-06-10.
3. Chrome Reading List: why nobody uses it. Published 2026-06-10.
4. What to put on your Chrome new tab page. Published 2026-06-10.
5. Best new tab Chrome extensions 2026.
6. `/vs/twillot`.
7. `/vs/tweetsmash`.
8. `/vs/dewey`.

This is intentionally fewer than the tweet-style "hundreds of pages." Totem's current edge is credible, specific pages with product proof, not generic programmatic volume.

## Paid DataForSEO Gap-Fill Request

Purpose: verify missing comparison/workflow/long-tail terms without redoing existing research.

Recommended stage 1 only: one batched Google Ads search-volume call. No Labs discovery. No SERP calls yet.

Estimated cost: approximately $0.05-$0.10 total for the whole batch.

Endpoint:

```txt
POST /v3/keywords_data/google_ads/search_volume/live
```

Cache target:

```txt
tmp/dataforseo/totem-gap-volume-2026-06-02.json
```

Request body:

```json
[
  {
    "location_code": 2840,
    "language_code": "en",
    "keywords": [
      "best twitter bookmark manager",
      "best twitter bookmark manager chrome extension",
      "twitter bookmarks chrome extension",
      "twitter bookmark manager extension",
      "twitter bookmarks manager chrome",
      "twitter bookmarks app",
      "x bookmark manager extension",
      "x bookmarks chrome extension",
      "x bookmarks app",
      "dewey twitter bookmarks",
      "dewey bookmark manager",
      "dewey bookmarks",
      "dewey alternative",
      "getdewey alternative",
      "dewey vs twillot",
      "dewey vs tweetsmash",
      "dewey vs readwise",
      "twillot",
      "twillot alternative",
      "twillot twitter bookmarks",
      "twitter bookmarks search by twillot",
      "xbookmarks",
      "xbookmark",
      "xbookmarks alternative",
      "xbookmark twitter bookmark manager",
      "tweetsmash",
      "tweet smash",
      "tweetsmash alternative",
      "tweet smash bookmarks",
      "tweet bookmark manager",
      "tweet bookmarks manager",
      "twitter bookmark search extension",
      "search twitter bookmarks extension",
      "twitter bookmarks new tab",
      "twitter bookmarks on new tab",
      "twitter bookmark reader",
      "twitter bookmarks reader",
      "x bookmark reader",
      "x bookmarks reader",
      "saved tweets reader",
      "read saved tweets",
      "read twitter bookmarks",
      "read x bookmarks",
      "twitter read later",
      "x read later",
      "twitter reading list",
      "x reading list",
      "saved twitter threads",
      "read saved twitter threads",
      "twitter thread reader for bookmarks",
      "twitter saver chrome extension",
      "twitter saver extension",
      "tweet saver chrome extension",
      "tweet saver extension",
      "x saver extension",
      "x bookmarks not showing",
      "x bookmarks disappeared",
      "twitter bookmarks not showing",
      "twitter bookmarks not loading",
      "where are bookmarks on x app",
      "where are bookmarks on twitter app",
      "where are my bookmarks on twitter",
      "x app bookmarks location",
      "how to access bookmarks on x app",
      "how to access bookmarks on x app and web",
      "export twitter bookmarks to markdown",
      "export twitter bookmarks to csv",
      "export twitter bookmarks to pdf",
      "export twitter bookmarks to notion",
      "export twitter bookmarks to obsidian",
      "twitter bookmarks to notion",
      "twitter bookmarks to obsidian",
      "twitter bookmarks markdown",
      "twitter bookmarks csv",
      "twitter bookmarks pdf",
      "twitter bookmarks notebooklm",
      "notebooklm twitter bookmarks",
      "twitter bookmarks to notebooklm",
      "x bookmarks notebooklm",
      "copy twitter bookmark for ai",
      "copy twitter bookmarks for ai",
      "twitter bookmarks ai",
      "saved tweets ai",
      "how to clear bookmarks on x app",
      "how to clear all bookmarks on x app",
      "how to delete all x bookmarks",
      "delete all x bookmarks",
      "remove all x bookmarks",
      "bulk delete x bookmarks",
      "bulk delete twitter bookmarks",
      "twitter bookmarks bulk delete",
      "x bookmarks bulk delete"
    ]
  }
]
```

## Paid SERP Follow-Up

Executed 2026-06-02 against `serp/google/organic/live/regular`.

- Cache:
  - `tmp/dataforseo/totem-gap-serp-2026-06-02.json` (`twillot`; first batched task succeeded, remaining batched tasks failed with "You can set only one task at a time.")
  - `tmp/dataforseo/totem-gap-serp-tweetsmash-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-dewey-bookmarks-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-dewey-twitter-bookmarks-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-x-bookmarks-not-showing-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-twitter-bookmarks-not-loading-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-x-bookmarks-disappeared-2026-06-02.json`
  - `tmp/dataforseo/totem-gap-serp-twitter-bookmarks-not-showing-2026-06-02.json`
- Actual cost: `$0.028`
- Rows requested/succeeded: 8/8 after retrying single-task requests.

Endpoint used:

```txt
POST /v3/serp/google/organic/live/regular
```

SERP findings:

| Keyword | Top SERP shape | Strategy read |
|---|---|---|
| `twillot` | Twillot site, CWS listing, GitHub, X profile, second CWS listing. | Build `/vs/twillot` as a comparison/review page. SERP is branded, not editorially saturated. |
| `tweetsmash` | Tweetsmash site, CWS listing, X profile, Dewey comparison, Circleboom listicle. | Build `/vs/tweetsmash`; Dewey already ranks a comparison page, proving the comparison format is valid. |
| `dewey bookmarks` | Dewey site, X profile, CWS, Reddit, YouTube, Product Hunt. | Build `/vs/dewey`; exact Dewey-owned results dominate, but third-party pages exist below them. |
| `dewey twitter bookmarks` | Dewey site, X profile, CWS, Reddit, YouTube, reviews, old Medium/listicles. | Use this as the Dewey page's secondary keyword. |
| `x bookmarks not showing` | Reddit, X posts, X developer forum, Dewey, Medium, X Help, Circleboom, Archivlyx. | Merge with disappeared/not-loading into one troubleshooting page or major refresh section. |
| `twitter bookmarks not loading` | X/Circleboom, Reddit, Dewey, Circleboom, X developer forum, YouTube, Help. | Same troubleshooting cluster; SERP is weak and inconsistent. |
| `x bookmarks disappeared` | Reddit, X post, X developer forum, Dewey, YouTube, Medium, X Help, Archivlyx. | Same troubleshooting cluster; page should separate UI bug, deleted/protected posts, and 800-window behavior. |
| `twitter bookmarks not showing` | Reddit, Dewey, X post, X developer forum, YouTube, Circleboom, Help. | Strong support for a canonical Totem troubleshooting explainer. |

## Stop Conditions

- Do not run Labs expansion until after the stage-1 batch proves a cluster has demand.
- Do not run SERPs for keywords already covered by cached SERPs unless the page is about to be written.
- Do not create a page if the intent is wrong, even if volume is high.
- Do not split near-identical exact questions into separate posts unless Search Console later shows enough impressions to justify it.
