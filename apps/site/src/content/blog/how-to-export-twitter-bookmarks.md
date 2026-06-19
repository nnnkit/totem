---
title: "How to Export Your X / Twitter Bookmarks (Every Method, Ranked) - 2026"
slug: how-to-export-twitter-bookmarks
description: "The practical ways to export X / Twitter bookmarks, what each method gives you, and when you need a CSV, readable Markdown, or a restorable local backup."
publishedAt: 2026-04-27
draft: false
canonicalKeyword: export twitter bookmarks
---

# How to Export Your X / Twitter Bookmarks (Every Method, Ranked)

Most people who search this are not really asking for "an export."

They are asking for one of three things:

- a spreadsheet of saved posts
- a backup before something disappears
- a way to actually read the things they saved

Those are different jobs. A CSV can satisfy the first one. It is weak for the second. It does almost nothing for the third.

So the right export method depends on what you want the file to do after it lands in your Downloads folder.

## First: the official X archive is not the answer

X has an account archive. You can request it from your account settings, wait for the download, and get a ZIP of account data. X's help page lists things like profile information, posts, Direct Messages, media, followers, following, Lists, inferred interests, and ads data.[^x-archive]

It does not list bookmarks.

That is why the search results for "export twitter bookmarks" are full of Chrome extensions, userscripts, GitHub tools, Reddit threads, and bookmark managers. People try the official archive because it feels like the proper route. Then they open the ZIP and discover the thing they wanted is not there.

If you need a full account archive, request the X archive. If you need bookmarks, use one of the methods below.

## Second: every cold export has a ceiling

X's Bookmarks API returns the most recent 800 bookmarked posts.[^x-bookmarks-api]

That matters. A tool cannot magically fetch a ten-year bookmark library from a cold start if X only exposes the recent window to that route. Browser tools can capture what your browser loads. API tools can request what the endpoint returns. Local-first tools can have more only if they started saving your library earlier.

So "export all bookmarks" usually means:

> export every bookmark the tool can currently see

For a normal account, that may be enough. For a large old archive, it may not be. The honest fix is not a better button. It is continuous local capture before you need the export.

This is also the line tools fight over. `sytelus/xarchive`, an MIT extension created in April 2026, sells itself by naming the exact ceiling: "the API v2 caps at 800," so it reads X's internal GraphQL API instead "to export your complete bookmark collection -- every bookmark, every folder, unlimited."[^xarchive] That is the workaround in one sentence: the documented 800-post route has a cap; what your browser actually loads does not. It is the same distinction this section draws, restated by someone shipping against it.

If you want that capture and export path to live locally, [install Totem for Chrome](https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo?utm_source=blog&utm_medium=inline_cta&utm_campaign=how-to-export-twitter-bookmarks) before the next time you need a backup under pressure.

## Method 1: a userscript, if you want raw data

Use this if you are comfortable with Tampermonkey and want a local, technical export.

The strongest free option is `prinsss/twitter-web-exporter`.[^prinsss] It runs in your browser, watches the GraphQL responses X already sends while you scroll, and exports data formats like JSON, CSV, and HTML. It does not need an X API key. It does not need your password. It is also not a polished consumer app.

One reason to prefer it: it is still alive. As of this writing it carries 2,552 GitHub stars and was last pushed in May 2026.[^prinsss] That matters more than it sounds. An export tool is only as good as whether it still runs against today's X. Compare `nornagon/twitter-bookmark-archiver`, an older API-route archiver with 141 stars that has not been touched since November 2022.[^nornagon] When a tool depends on a specific X endpoint and the endpoint changes, the tool quietly stops working — so check the last commit date before you trust one with a backup. If your destination is specifically Obsidian, that survival question is the whole game: see [Twitter bookmarks to Obsidian, and what actually works in 2026](/blog/twitter-bookmarks-to-obsidian).

The flow is roughly:

1. Install a userscript manager.
2. Install the exporter script.
3. Open your X bookmarks page.
4. Scroll until the posts you care about have loaded.
5. Export the captured data.

The strength is control. The weakness is friction. If you know what a userscript is, this is probably the cleanest raw export. If you do not, you may hate the setup more than the problem.

## Method 2: a Chrome extension, if you just need a CSV

Use this if your goal is simple: get rows into Sheets, Excel, Notion, or a local file.

The current export SERP is dominated by Chrome Web Store and Edge listings: "Twitter Bookmarks Downloader - Export X Bookmarks," "Export Twitter Bookmarks," "X Bookmarks Exporter," and similar tools.[^serp-export]

Most of them work the same way:

1. Open your bookmarks page.
2. Click the extension.
3. Let it collect the loaded bookmarks.
4. Download CSV, JSON, XLSX, or a similar file.

This is the quickest path to a spreadsheet. It is also the easiest place to overestimate what you got. A CSV row is useful for sorting, filtering, and bulk inspection. It is not a reading experience. It is not a restorable app backup unless the tool explicitly supports import.

Two rules:

- Do not give your X password to an exporter.
- Check what the file contains before you trust it as a backup.

If the CSV only has URLs and text snippets, that may be fine. Just do not confuse it with a copy of your whole reading library.

## Method 3: a bookmark manager, if export is not the real job

Use this if "export" is really a proxy for "I want to find, organize, tag, or revisit things."

Tools like Dewey, Tweetsmash, Circleboom, Twillot, XBookmark, and newer one-off exporters show up because they wrap export inside another workflow: search, tagging, digests, Notion sync, folders, or a dashboard.[^dewey-export]

Twillot describes itself this way: "Effortlessly search, organize, and export your X/Twitter bookmarks with AI-powered categorization - no Premium account required," with export to CSV and JSON.[^twillot] Notice the export is the last verb in the sentence, after search and organize — the file is a side effect of the workflow, not the product. One caveat that proves the freshness point above: Twillot's public changelog stops at late 2024, so verify it still works before relying on it.[^twillot]

That can be worth paying for if the ongoing workflow is the point.

It is not worth paying for if you only need a file. In that case, a free userscript or one-click extension is usually enough.

The useful question is:

> Do I want a file, or do I want a place to work with the saved posts?

If you want a place, compare bookmark managers by job: search, export, reading, digests, AI context, or cleanup. The practical comparison is here: [best Twitter bookmark managers for search, export, and actually reading](/blog/best-twitter-bookmark-managers-2026).

If you want a file, compare export formats.

## Method 4: Totem export, if you want a local reading backup

Use this if your bookmarks are already in Totem and you want a portable local copy you can read, inspect, and import back later.

Totem's export is a ZIP. It includes:

- `bookmarks.csv` for spreadsheets
- `readme.md` as an index
- `bookmarks/*.md`, one Markdown file per bookmark
- `data/*.jsonl`, the canonical data Totem imports back
- `manifest.json` with counts, schema version, account hash, and checksums

The CSV and Markdown are there for humans. The JSONL files are there for Totem. On import, Totem reads the JSONL data, verifies checksums, checks the export schema, warns if the account does not match, and adds rows it does not already have.[^totem-format]

There are two export modes:

| Mode | What it is for |
|---|---|
| Basic export | Download what Totem already has now. Every bookmark gets a summary; bookmarks with cached details also get fuller content. |
| Full export | Let Totem prepare missing full content first: tweets, threads, and articles where available. Then download the ZIP. |

This does not make Totem an official X archive. It does not recover old bookmarks that Totem never saw. It does not bundle your X password or turn into a cloud account.

It is a local copy of your Totem library: bookmarks, details, highlights, notes, and reading progress.

That is the difference between "I exported a list" and "I can restore my reading queue."

## What kind of export do you actually need?

| You want | Use |
|---|---|
| Raw local data and you are technical | Userscript |
| Spreadsheet in two minutes | Chrome / Edge exporter |
| Search, tags, folders, or a cloud dashboard | Bookmark manager |
| Local reading backup you can import back into Totem | Totem ZIP |
| Full X account archive | X archive, plus one bookmark-specific method |

The trap is asking for "export" without naming the next action.

If the next action is "sort rows," get CSV. If it is "read later," get Markdown or a reader. If it is "restore this library on another Chrome install," make sure the export has an import path. If it is "prove I own a copy," make sure the data is local and documented.

## A good bookmark export has three layers

The weakest export is a URL list. Useful, but thin.

A better export has a spreadsheet view. You can filter by author, date, media, links, and thread status.

The best export has a restorable data layer. That is what keeps the boring but important things: which account the export came from, which rows belong in which store, whether the file is corrupted, what schema version produced it, and what should happen when you import it again.

Most people do not care about this until the day they need it.

That is why export is not a feature you judge by the button. You judge it by the file you get after the button.

One more trap: a raw CSV or JSON blob is not a reading system. If your next action is "actually read this pile," a bookmark manager with a return path may matter more than another export button.

## The short version

- The official X archive is useful, but not for bookmark export.
- X's bookmark endpoint exposes a recent window, so cold exports have limits.
- Use a userscript for raw local data.
- Use a browser extension for a quick CSV.
- Use a bookmark manager when you want search or organization.
- Use Totem export when your goal is a local, readable, restorable bookmark library.

Exporting is not the end of the job. It is the moment you find out whether the things you saved can survive outside the app where you saved them.

[^x-archive]: X Help Center, ["How to download your X archive and Posts"](https://help.x.com/managing-your-account/how-to-download-your-twitter-archive). X lists the archive categories it considers relevant and useful; bookmarks are not listed there.
[^x-bookmarks-api]: X Developer Platform, ["Bookmarks introduction"](https://developer.x.com/en/docs/x-api/tweets/bookmarks/introduction). X documents that the Bookmarks endpoint returns the most recent 800 bookmarked posts.
[^prinsss]: [prinsss/twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter), an MIT-licensed userscript for exporting X/Twitter web data from the browser.
[^serp-export]: DataForSEO SERP pull, US/en, May 28, 2026: `tmp/dataforseo/serp-export-launch-export-twitter-bookmarks-2026-05-28.json`.
[^dewey-export]: Dewey, ["How To Export Twitter Bookmarks"](https://getdewey.co/how-to-use/export-bookmarks/), one example of the bookmark-manager route.
[^totem-format]: Totem, [Export Format v1](/export-format/v1), documents the ZIP layout, JSONL stores, CSV columns, Markdown files, and import contract.
[^xarchive]: [sytelus/xarchive](https://github.com/sytelus/xarchive), MIT-licensed Chrome extension (created April 2026) that reads X's internal GraphQL API to export bookmarks past the public API's 800-post cap; quote from its README, accessed June 19, 2026.
[^nornagon]: [nornagon/twitter-bookmark-archiver](https://github.com/nornagon/twitter-bookmark-archiver), an older bookmark-archiver tool, 141 stars, last pushed November 2022, accessed June 19, 2026.
[^twillot]: [twillot-app/twillot](https://github.com/twillot-app/twillot), 133 stars; description and CSV/JSON export from its README, accessed June 19, 2026.
