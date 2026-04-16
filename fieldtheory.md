# fieldtheory-cli — Research Notes

Reference for implementing bulk bookmark export in Totem.

## What fieldtheory-cli is

A local-first CLI tool (`npm install -g fieldtheory`) that syncs X/Twitter bookmarks to a local SQLite + JSONL store. No API keys needed — uses session cookies extracted from your browser.

## What it actually stores

Only tweet metadata from the X GraphQL bookmark list API. Per bookmark:

- Tweet text (truncated at ~280 chars for regular tweets)
- Author (handle, name, profile image, bio, follower count)
- Engagement metrics (likes, reposts, replies, quotes, bookmarks, views)
- Media URLs (photos, videos with bitrate variants)
- Links extracted from tweet entities (URL strings only, not content)
- Timestamps (posted, bookmarked, synced)

**It does NOT fetch:**
- External article content (no scraping of linked URLs)
- Full X native article body
- Thread replies or conversation context

No HTTP clients beyond fetch to x.com and cdn.syndication.twimg.com. No readability/article extraction.

## What we saw in practice

Running `ft sync --browser brave` on the same bookmarks as Totem revealed three classes of data quality:

### Regular tweets
Text truncated at ~280 chars. Example — Karpathy's tweet ends mid-sentence: *"...into manipulating"*. No body, no continuation.

### X native articles (long-form posts)
`text` field is just the t.co shortlink. `links` contains `http://x.com/i/article/...`. No title, no body. Example: sonofalli, ashpreetbedi, nvidia bookmarks all came back as empty shells.

### Tweets with external links
URL strings stored in `links` array, but content of those URLs never fetched. Example: `"links": ["https://github.com/getcompanion-ai/feynman"]` — just the URL.

## Markdown export format (fieldtheory)

```markdown
---
author: "@handle"
author_name: "Name"
posted_at: 2024-01-15
bookmarked_at: 2024-01-16
source_url: https://x.com/handle/status/id
tweet_id: "..."
likes: 1290
reposts: 176
---

# @handle

[tweet text, possibly truncated]

## Links
- https://some-url.com

[Original tweet](https://x.com/...)
```

No article body. No full text. Just metadata + whatever was in the tweet.

## How Totem compares

| | fieldtheory-cli | Totem (list sync) | Totem (after opening in reader) |
|---|---|---|---|
| Tweet text | Truncated ~280 chars | Full | Full |
| X native article body | Not fetched | Preview only (`plainText`) | Full `contentBlocks` — all paragraphs, headings |
| External article content | Not fetched | Not fetched | Not fetched |
| Thread context | Not fetched | Not fetched | Full thread via `TweetDetail` |

Totem already does more than fieldtheory-cli at list-sync time (gets `plainText` preview for articles). And it does significantly more once a bookmark is opened — the `TweetDetail` response contains full `contentBlocks` for X native articles, which gets cached in IndexedDB.

## What this means for bulk export

The current "Export all" button (added on feat/add-download-copy) exports from `getAllBookmarks()` — same data level as fieldtheory-cli, plus article previews. The result looks like fieldtheory output.

### Three tiers of possible export quality

**Tier 1 — List sync data only (current)**
Zero extra requests. Same as fieldtheory. Misses full article body for anything not opened in reader.

**Tier 2 — List sync + detail cache**
Check IndexedDB `TweetDetailCache` for each bookmark. If detail was previously fetched (user opened it in reader or prefetch ran), use full `contentBlocks` for the export. Still zero extra requests. Best quality for already-read bookmarks.

**Tier 3 — Fetch all detail**
Make a `TweetDetail` request per uncached bookmark. Full quality for everything, but: 1 request per bookmark, ~1.5–2.5s throttle each, 429 risk for large collections.

## Recommendation for implementation

**Start with Tier 2.** It's:
- Zero additional X.com requests
- Significantly richer than fieldtheory for read bookmarks
- Honest about what's cached vs. not (can mark "preview only" in the export for uncached ones)
- Lays the groundwork for Tier 3 as an opt-in "fetch missing" step

The detail cache lives in IndexedDB under `DETAIL_STORE_NAME`. Key is `tweetId`. The `focalTweet` field has `article.contentBlocks` when available.
