---
title: "What Actually Gets Exported When You Export Twitter Bookmarks?"
slug: what-gets-exported-twitter-bookmarks
description: "A practical guide to what bookmark exports contain: URLs, CSV rows, Markdown files, local JSONL data, highlights, reading progress, and what can be imported back later."
publishedAt: 2026-05-28
draft: false
canonicalKeyword: twitter bookmarks export
---

# What Actually Gets Exported When You Export Twitter Bookmarks?

"Export my bookmarks" sounds like one request.

It is not.

One person wants a CSV. Another wants a backup. Another wants a folder of Markdown files they can read in Obsidian. Another wants to move Chrome installs without losing reading progress.

Those are not the same export. They are different depths of ownership.

## The weakest export is a list of links

The smallest possible bookmark export is:

```txt
https://x.com/someone/status/123
https://x.com/someone/status/456
https://x.com/someone/status/789
```

That is better than nothing. It proves you saved a thing. It gives you a way back to X.

It is also fragile.

If the post is deleted, protected, rate-limited, or hard to recognize from the URL alone, the export has very little memory. You still have to open each link to remember why you saved it.

A URL list is an index card. It is not the library.

## The next layer is a spreadsheet

Most one-click bookmark exporters aim here. They give you CSV, XLSX, or JSON. A useful CSV usually has one row per bookmark and columns like:

| Field | Why it matters |
|---|---|
| Tweet ID | Stable identifier for the post |
| Tweet URL | Lets you open the post on X |
| Author handle | Useful for sorting by person |
| Author name | Human-readable context |
| Text | The saved post body |
| Created date | When the post was written |
| Bookmarked date | Approximate save/order signal when available |
| Media URLs | Images or videos attached to the post |
| Quoted tweet URL | Context from the quoted post |
| Thread flag | Whether this was likely part of a thread |
| Full thread flag | Whether the export has richer thread data |

This is the first export that becomes useful outside X. You can filter by author. You can sort old saves. You can search text in a spreadsheet. You can import rows into another database.

But it still reads like data.

A CSV is good for triage. It is not good for sitting down and reading a thread.

## The readable layer is Markdown

Markdown is where an export starts to feel like saved reading instead of saved metadata.

In Totem, the ZIP includes:

- `readme.md`, an index of the exported bookmarks
- `bookmarks/*.md`, one Markdown file per bookmark

Each bookmark file is rendered from the same export path as Totem's reader. If Totem has full detail for that bookmark, the Markdown can include the fuller reading copy: the post, thread context, article text where available, media references, and source metadata.

This matters because Markdown is boring in the useful way.

You can open it in a text editor. You can put it in Obsidian. You can search it with local tools. You can keep it after an app shuts down. You can read it without turning the export into a dashboard.

If CSV is for sorting, Markdown is for reading.

## The restore layer is JSONL

The part humans usually ignore is the part that makes restore possible.

In Totem, the importable data lives under `data/*.jsonl`:

| File | What it stores |
|---|---|
| `data/bookmarks-YYYY.jsonl` | Saved bookmark rows, sharded by year |
| `data/details.jsonl` | Full fetched details and thread data where available |
| `data/highlights.jsonl` | Highlights and notes |
| `data/reading-progress.jsonl` | Opened/read state and scroll position |

JSONL means "one JSON object per line." It is not pretty, but it is durable. It can be streamed, inspected, split, and imported without loading one giant JSON object into memory.

Totem's importer reads these JSONL files only. It ignores CSV and Markdown because those are derived views. The JSONL files are the source of truth for restore.[^totem-format]

This is the difference between "I exported a nice file" and "I can rebuild the library."

## The manifest is the receipt

A serious export should tell you what it is.

Totem writes a `manifest.json` file with:

- export format version
- Totem data schema version
- generation time
- app version
- redacted account handle
- hashed account ID
- counts for bookmarks, details, highlights, and reading progress
- paths to each JSONL shard
- SHA-256 checksums for exported files

That sounds technical because it is. It exists so the importer can answer boring but important questions:

- Is this a Totem export?
- Was it created by a newer version I cannot safely import?
- Did any data file get damaged?
- Does this export appear to come from the current X account?
- How many rows should I expect?

The best backup work is invisible when everything goes fine. You only notice it when something goes wrong.

## Basic export vs full export

Totem has two export modes because not every bookmark has the same amount of cached content.

**Basic export** downloads the ZIP from what Totem already has locally. Every bookmark gets a summary row. Bookmarks with cached detail get fuller Markdown and thread/article content.

**Full export** prepares the missing detail first. Totem walks the local library, fetches missing full content at a conservative pace, marks deleted or protected posts as unavailable, then lets you download a fuller ZIP.

That distinction is important.

If you need a file right now, basic export is the honest answer. If you are making a backup you expect to trust later, full export is the better answer. It takes longer because it is trying to turn more bookmark IDs into readable material.

## What does not get exported

A good export should also say what it does not promise.

Totem export does not include your X password, session cookies, or a Totem server account. Totem does not have a server account system.

It does not replace the official X account archive. If you need your posts, DMs, media uploads, ads data, or account-level history, request the X archive separately.[^x-archive]

It does not magically recover bookmarks Totem never saw. If X only exposes a recent window and Totem did not already capture older items, a later export cannot invent them.

It does not bundle every remote media file as an offline media archive. CSV and Markdown can include media URLs and image references, but the ZIP is primarily a bookmark and reading-data export, not a full media mirror.

It does not overwrite existing data on import. Totem's importer is additive: existing rows are counted as already present and skipped.

## Match the export to the job

| If you want... | You need... |
|---|---|
| A quick inventory | CSV |
| A folder you can read | Markdown |
| A backup you can import later | JSONL plus manifest |
| Proof the file was not damaged | Checksums |
| A full X account archive | X archive, not just a bookmark export |
| A complete media mirror | A different archival tool |

This is why "does it export bookmarks?" is too vague.

Ask the next question:

> What should I be able to do with the export tomorrow?

If the answer is "open it in Sheets," CSV is enough. If the answer is "read through saved threads," you want Markdown. If the answer is "restore my library on another Chrome install," you need a real import path.

The deeper the use case, the more the export needs to preserve.

## The useful standard

A bookmark export should be judged by four questions:

1. Can I inspect it without the original app?
2. Can I read the saved material without rebuilding context manually?
3. Can I import it back without losing highlights, notes, and progress?
4. Does the file say enough about itself to be trusted later?

Most exports pass the first question. Fewer pass the second. Very few pass the third.

That is the line Totem is trying to draw: not just "get my bookmarks out," but "keep my reading library portable."

For the method-by-method comparison, start with [how to export your X / Twitter bookmarks](/blog/how-to-export-twitter-bookmarks). For the field-level spec, the boring version is public at [Totem Export Format v1](/export-format/v1).

[^totem-format]: Totem, [Export Format v1](/export-format/v1), documents the ZIP layout, JSONL stores, CSV columns, Markdown files, and import contract.
[^x-archive]: X Help Center, ["How to download your X archive and Posts"](https://help.x.com/managing-your-account/how-to-download-your-twitter-archive).
