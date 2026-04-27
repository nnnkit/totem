---
title: "How to Export Your X / Twitter Bookmarks (Every Method, Ranked) — 2026"
slug: how-to-export-twitter-bookmarks
description: "Four ways to get your X bookmarks out — a userscript, a Chrome extension, a paid SaaS, or the official X data archive. Ranked by who you are, with the one method that doesn't actually work flagged up front."
publishedAt: 2026-04-27
draft: false
canonicalKeyword: export twitter bookmarks
---

# How to Export Your X / Twitter Bookmarks (Every Method, Ranked)

Four methods exist. One of them — the one most people try first — doesn't actually work. The other three are good for very different people. This post sorts them by who you are, not by which tool we like most, and ends on a question the entire SERP avoids: *why* you're trying to export.

## The honest first fact

**The official X data archive does not include your bookmarks.** If you go to *Settings → Your account → Download an archive of your data* and wait the 24+ hours, what arrives in the zip is your tweets, replies, likes, DMs, and media — not your bookmarks.[^archive] The Reddit answer that ranks #2 for this query[^reddit] suggests requesting the archive; the comment thread underneath it is mostly people discovering, often days later, that the archive came back without bookmarks in it.

This is the one thing every other guide buries on page 3. Lead with it: do not start here. The Bookmarks endpoint shipped in March 2022[^bookmarks-launch], two years after the data-archive feature, and the archive has never been updated to include them.

The reason every workaround below exists is that one missing zip entry.

## A second honest fact, before we rank tools

Every tool listed below is constrained by the same ceiling: **X's Bookmarks API only returns your most recent 800 bookmarks.**[^xapi] This is documented. If you have ten thousand bookmarks, no extension on earth can reach back to bookmark #9,999 from a cold start. The tools that *do* show users with 200,000+ bookmarks intact (Twillot, Dewey, [Totem](https://usetotem.xyz)) got there by indexing incrementally as the user scrolled, before old bookmarks fell off the visible window — not by exporting them after the fact.

So when you read "export your bookmarks," what you can actually export is **what's currently in your bookmarks tab.** For most people that's enough. If it isn't, exporting is the wrong tool entirely; you needed to start capturing months ago.

With that out of the way:

---

## Method 1 — Userscript: prinsss/twitter-web-exporter

**For you if:** you're comfortable installing Tampermonkey, you want raw data in JSON / CSV / HTML, and you don't want your bookmarks routed through someone else's server.

`prinsss/twitter-web-exporter`[^prinsss] is the cleanest free option. It's a userscript (MIT-licensed, actively maintained — v1.4.0 was published February 25, 2026[^prinsss-release]) that installs a network interceptor in your browser. As you scroll through your bookmarks tab, it captures the GraphQL responses X's web app is already fetching, then lets you export to JSON, CSV, or HTML. No API keys, no developer account, no data leaving your machine.

The trade is the install:

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome / Firefox / Edge).
2. Install the userscript from [GreasyFork](https://greasyfork.org/en/scripts/) or directly from the repo.
3. Open `x.com/i/bookmarks`.
4. Click the floating exporter icon.
5. Scroll to the bottom of your bookmarks (this is what loads them into the interceptor's buffer).
6. Click *Export Data* → pick a format.

If you've never used Tampermonkey before, this is more friction than the average "click a button" extension. If you have, it's the obvious right answer — open source, no account, and the same author also exports tweets, likes, and media.

## Method 2 — Chrome / Edge extension (the one-click route)

**For you if:** you want a CSV in two minutes and you're fine running an extension someone else maintains.

Search the Chrome Web Store for "twitter bookmarks export" and you'll find half a dozen near-identical wrappers around the same scrape. The ones currently in the SERP top 10:

- **Export Twitter Bookmarks** (OneClick Twitter Bookmarks Exporter)[^onclick] — ranks #1 organically. Free, exports CSV.
- **Twitter Bookmarks Downloader — Export X Bookmarks**[^tbd] — CSV, JSON, XLSX.
- **X Bookmarks Exporter** (Microsoft Edge add-on)[^edge] — same idea, Edge variant.

They all work the same way: open your bookmarks tab, click the extension icon, scroll, get a file. Pick whichever has the highest review count and the most recent update date in your store of choice; there is no meaningfully better one.

Two caveats nobody mentions:

- **You still have to scroll.** The extension can only capture what your browser actually loads. There's no "give me everything" button — you scroll to the bottom of your bookmarks and the extension siphons what passes through.
- **Some ask for your X login.** Don't. Anything that can be done with the user's session cookie shouldn't need your password. The reputable extensions (and the userscript above) never ask.

## Method 3 — Paid SaaS / bookmark manager (Dewey, Circleboom, Tweetsmash, exportxbookmarks.com)

**For you if:** the export isn't really the point — you want to *do something* with your bookmarks once they're out. Search them, tag them, share collections, sync to Notion.

These tools all bundle the export step inside a wider product:

- **Dewey** — paid. Cloud-hosted dashboard for tagging, search, collections, export. Has its own [how-to-export guide](https://getdewey.co/how-to-use/export-bookmarks/) and ranks for this query because of it.[^dewey]
- **Circleboom** — paid. The Onurdan / Medium tutorial that ranks #3 for "export twitter bookmarks" walks you through their flow.[^onurdan]
- **Tweetsmash** — freemium. Similar pitch, syncs to Notion / Sheets.
- **exportxbookmarks.com**[^exportxbookmarks] and a recent [Hacker News launch](https://news.ycombinator.com/item?id=47697679)[^hn] in the same space — the HN poster makes the export free and charges $4.69/year for the viewer that lets you organize them. A commenter on that thread sums up the whole category in one sentence: *"plenty of extensions will do this, but they give you a JSON/CSV file that's not very useful."*

Pick one of these if "I want them in a CSV" was a stand-in for "I want to actually be able to find things again." Don't pick one if you genuinely just want a backup file — you'd be paying a subscription for what Method 1 does for free.

## Method 4 — The official X data archive (the one that doesn't work)

Listed last because it's the first thing most people try, and it doesn't work for this:

1. *Settings → Your account → Download an archive of your data*
2. Re-enter password, wait 24 hours to several days for X to email you the link.
3. Download the zip. Open `data/`.
4. Scan the file list. **No `bookmarks.js`.** There is `tweets.js`, `like.js`, `direct-messages.js`, `account.js`, plus media folders — but bookmarks have never been included.[^archive]

Worth knowing exists, mostly so you don't waste a day waiting on it. If you want a full account backup for portability or compliance reasons, request the archive *and* run one of Methods 1–3 alongside it.

---

## So which one should you actually use?

| You are | Use |
|---|---|
| A developer / data-hoarder who wants raw JSON | Method 1 (prinsss/twitter-web-exporter) |
| Someone who just wants a CSV in two minutes | Method 2 (a Chrome extension) |
| Someone who wants to read, search, or tag what you saved | Method 3 (Dewey, Tweetsmash, Twillot, etc.) |
| Someone who only wants the official X-blessed route | Method 4 — and accept that bookmarks won't be in it |

That table is the post most of the SERP isn't writing.

## The question the SERP avoids

If you scroll back up and re-read why you opened this tab, there's a reasonable chance the actual answer wasn't "I need a CSV." It was something closer to:

> *"I bookmarked something useful three months ago and I want to read it before it disappears."*

Exporting solves the backup problem. It doesn't solve the reading problem. A CSV of 1,400 tweet URLs sitting in your Downloads folder is, for almost everyone, the same thing as not having them — a different graveyard, slightly more portable.

The reason saved tweets stay unread is structural: the X bookmarks tab is buried four taps deep inside the app, the bookmarks page is a single chronological list with no search on free accounts, and you have to *decide* to go look at it. The save was passive; the retrieval is active. That asymmetry is why ~85% of saved tweets are never re-read.[^reread]

If your real problem is reading what you saved, the export gets you a file but not the habit. What changes the habit is putting the bookmarks somewhere you already are — your new tab, your home screen, the next surface your eyes land on without you choosing.

That's the reason we built [Totem](https://usetotem.xyz). Disclosure: it's our product. It's free, runs locally in your browser (your bookmarks live in IndexedDB, not on a server we run), captures incrementally as you scroll past tweets in your bookmarks tab, and replaces your new tab page so the things you saved are in front of you instead of buried four taps deep. If you're trying to *read* your bookmarks, it's the right shape. If you're trying to back them up, use Method 1.

## The takeaways

- The official X data archive does **not** include bookmarks. Don't start there.
- Every export tool is capped by the same 800-most-recent ceiling on the X side.
- For raw data, `prinsss/twitter-web-exporter` is the cleanest free option.
- For a one-click CSV, any reputable Chrome / Edge extension does the job — they're nearly interchangeable.
- For "export *and* something to do with them," a paid manager (Dewey, Tweetsmash, Twillot) bundles it.
- Most people Googling this don't actually need an export. They need their bookmarks somewhere they'll actually see them. That's a different tool.

[^archive]: X Help Center, ["How to download your X archive"](https://help.x.com/en/managing-your-account/how-to-download-your-x-archive). The documented archive contents include tweets, replies, likes, DMs, and media — bookmarks are not listed. The recurring discovery that bookmarks aren't included is the entire premise of every guide in this SERP.
[^reddit]: r/DataHoarder, ["How Do I Download All Of My Twitter Bookmarks?"](https://www.reddit.com/r/DataHoarder/comments/1iga2wd/how_do_i_download_all_of_my_twitter_bookmarks/) — currently the #2 organic result for "export twitter bookmarks."
[^bookmarks-launch]: X Developer announcement, March 24, 2022: [Build with Bookmarks on the Twitter API v2](https://devcommunity.x.com/t/build-with-bookmarks-on-the-twitter-api-v2/168804). The data-archive feature predates this by years and has never been updated to include bookmarks.
[^xapi]: X Developer documentation, [Bookmarks integration guide](https://developer.twitter.com/en/docs/twitter-api/tweets/bookmarks/integrate): "With the GET method of the Bookmarks lookup endpoint you will get back 800 of your most recent Bookmarked Posts."
[^prinsss]: [prinsss/twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter) — MIT-licensed userscript that exports tweets, replies, likes, bookmarks, follower lists, DMs, and media via in-browser GraphQL interception. No API key or developer account required.
[^prinsss-release]: Latest release (v1.4.0) published February 25, 2026 per the repository's releases page.
[^onclick]: [Export Twitter Bookmarks (OneClick) — Chrome Web Store](https://chromewebstore.google.com/detail/export-twitter-bookmarks/fondehlfbfbcegdjhoefhfbkaeengcgd) — currently #1 organic for "export twitter bookmarks."
[^tbd]: [Twitter Bookmarks Downloader — Chrome Web Store](https://chromewebstore.google.com/detail/twitter-bookmarks-downloa/nfkbcnohjlfnclnhhblgjafldimikcdb).
[^edge]: [X Bookmarks Exporter — Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/fgkihcenfieelgkhjnglhlnacejnmckl).
[^dewey]: Dewey, ["How To Export Twitter Bookmarks"](https://getdewey.co/how-to-use/export-bookmarks/) — and the product page at [getdewey.co](https://getdewey.co/).
[^onurdan]: Onurdan, ["How I Finally Exported All My Twitter Bookmarks"](https://onurdan.medium.com/how-i-finally-exported-all-my-twitter-bookmarks-11ae887b8b0a) — walks the Circleboom flow.
[^exportxbookmarks]: [exportxbookmarks.com](https://www.exportxbookmarks.com/) — "Organize and Analyze Your X (Twitter) bookmarks."
[^hn]: Hacker News, ["I built a tool to let you export your X bookmarks"](https://news.ycombinator.com/item?id=47697679), April 2026 — free Chrome extension export, paid viewer at $4.69/year.
[^reread]: We've cited this stat in our [pocket-alternatives roundup](/blog/pocket-alternatives-2026); the underlying behavioral pattern (saved-but-never-revisited content) is well-documented across read-later tools. The exact number varies by source; the order of magnitude does not.
