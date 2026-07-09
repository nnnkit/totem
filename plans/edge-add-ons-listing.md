# Microsoft Edge Add-ons Listing — Totem

Copy + asset pack for the Microsoft Edge Add-ons submission (Partner Center).
Most of this is reused verbatim from `plans/chrome-web-store-listing.md`; the only
differences are Edge-specific fields (Single purpose, Search terms) and swapping
"Chrome" → "browser" per Edge policy §1.1 (listings must not reference or leave
another browser's branding).

The same `release/totem-v{version}.zip` you upload to the Chrome Web Store is the
package here — no separate build. Registration is free (Individual account, MSA
as Primary Owner). See `PUBLISH.md` → "Microsoft Edge Add-ons Publishing" for the
step-by-step submission flow.

---

## Extension Name

```
Twitter & X Bookmarks on New Tab — Totem
```

Read-only in Partner Center (comes from `public/manifest.json` `name`). Contains
no "Chrome" branding, so it passes Edge certification as-is.

## Short Description

```
Your Twitter & X bookmarks, waiting on every new tab — finally read what you saved. Search, highlight, export. Local-first.
```

Comes from `public/manifest.json` `description`. Matches the Chrome listing.

## Single Purpose (Edge-required field)

```
Totem shows your own Twitter/X bookmarks on the browser's new tab page as a calm reading queue, and lets you read, search, highlight, annotate, and export those saved posts.
```

## Category

```
Productivity
```

## Detailed Description

Paste exactly (min 250 / max 10,000 chars). This is the Chrome long description
with the single "Chrome new tab" reference changed to "browser new tab":

```text
Totem is a local-first bookmark manager for Twitter and X, built around the one thing the others skip: actually reading what you save. It turns your browser's new tab into a calm reading queue for your Twitter/X bookmarks — a read-it-later for tweets, threads, and X articles — so the posts you save come back to you instead of vanishing.

Most people bookmark tweets and never return. And opening X to "check your bookmarks" turns into twenty minutes of doom-scrolling. Totem fixes both: your saved posts wait for you on every new tab. No feed, no algorithm, no noise.


EVERY NEW TAB IS YOUR READING QUEUE
• Your Twitter/X bookmarks appear automatically each time you open a tab
• Today's Read — a small, finite set of saved posts sized to your time (5, 15, or 30 minutes a day) so you make progress instead of drowning
• Clear reading states — Unread, Reading, and Read — with your scroll position saved and restored, right where you left off
• Snooze a post for later, file one as a reference, flag one as "action needed," or pull in "two more" when you're on a roll
• Pin up to 6 favorites; sort by recent, oldest, or annotated
• Keyboard-friendly throughout (j/k to move, / to search, Space to open)


A CLEAN READER FOR TWEETS & THREADS
• Distraction-free reader for single tweets and full Twitter threads, rebuilt in order so you read the whole thing in one place
• Reads X long-form Articles in full — headings, lists, images, and video
• Rich link previews, quoted tweets, reposts, images, and video
• Jump to the next or previous bookmark, or hit "Surprise me" for a random unread
• Add an "Open in Totem" button right on X to send any tweet straight to the reader


SEARCH EVERY TWITTER BOOKMARK YOU'VE SAVED
Full-text search across your entire library, with fuzzy matching and did-you-mean. Narrow it with real operators:
• from: / to: — by author
• since: / until: / within: — by date
• has:image, has:video, has:link, has:thread, has:article — by content type
• min_faves:, min_retweets:, min_replies: — by engagement
• Combine with AND / OR / NOT, "quoted phrases," and ( ) groups


HIGHLIGHT & ANNOTATE
• Highlight any passage in a tweet or article, in four colors
• Add private notes to anything you save
• Send a highlight to Grok with one click
• Highlights and notes stay on your device


EXPORT TWITTER BOOKMARKS & OWN YOUR LIBRARY
Your bookmarks are yours to take. Export the whole library to a single ZIP with:
• Markdown — one clean file per bookmark, threads included
• CSV — opens in Excel, Google Sheets, and Notion
• JSON (JSONL) — complete, re-importable data
• A manifest with SHA-256 checksums so you can verify the archive
You can also copy any post as Markdown, copy it for an AI assistant, or Print to PDF — and back up and restore your full library anytime.


WORKS OFFLINE
Totem prefetches your saved posts so you can keep reading on a plane or a weak connection. Your library lives in your browser, not on a server.


A CALMER NEW TAB
• A quiet clock and an optional web-search box (Google, Bing, DuckDuckGo, Brave, Ecosia, Yahoo, or your browser default)
• Optional Quick Links to your most-visited sites
• Curated wallpapers or generated gradients
• Light, dark, and system themes
• A focus mode that dims everything but what you're reading


PRIVATE BY DESIGN
• Local-first: no Totem account, no login, no server
• Your bookmarks, highlights, and notes are stored in your browser's IndexedDB
• We can't see your data, because we never receive it
• Signed into more than one X account? Each gets its own separate local library
• Totem uses your existing X session only to sync your own bookmarks — no X Premium required


WHY TOTEM vs other Twitter bookmark managers
• It lives on your new tab. Other bookmark managers are websites you have to remember to open — Totem shows up on its own, every time you start browsing.
• It's built for reading, not just filing. Most tools help you store and export; Totem helps you actually finish what you saved.
• No bookmark limit, and no subscription to search your own saves.
• Local-first and private by default.


WHO IT'S FOR
• Heavy Twitter/X readers who save threads and never get back to them
• Anyone who wants a read-it-later for the posts they save on X
• People who want a calmer, more intentional new tab
• Privacy-conscious users who don't want a third-party server holding their saves

Open a new tab and start reading what you saved. That's Totem.
```

## Search Terms (Edge-only field)

Up to 7 terms, ≤30 chars each, ≤21 words total. Structured metadata field
(unlike the Chrome description) — safe to use real search phrases here:

```
twitter bookmarks
x bookmarks
bookmark manager
new tab
read it later
thread reader
export bookmarks
```

(7 terms, 15 words total — within limits.)

## Assets

All reusable from the Chrome set except the store logo, which is new.

| Asset | Requirement | File |
|---|---|---|
| Store logo | 300×300 (1:1) | `images-for-promotions/edge-add-ons/store-logo-300.png` ✅ new |
| Screenshot 1 | 1280×800 | `images-for-promotions/chrome-web-store/screenshots/01-twitter-bookmarks-on-every-new-tab.png` |
| Screenshot 2 | 1280×800 | `.../screenshots/02-read-twitter-threads-without-the-feed.png` |
| Screenshot 3 | 1280×800 | `.../screenshots/03-search-saved-posts-authors-links-threads.png` |
| Screenshot 4 | 1280×800 | `.../screenshots/04-export-twitter-bookmarks-markdown-csv-notion.png` |
| Screenshot 5 | 1280×800 | `.../screenshots/05-local-first-no-account-no-server.png` |
| Small promo tile (optional) | 440×280 | `images-for-promotions/chrome-web-store/small-promo-tile.png` |
| Large promo tile (optional) | 1400×560 | `images-for-promotions/chrome-web-store/marquee-promo-tile.png` |

Edge allows up to 6 screenshots; the 5 above are the same order used on Chrome.

## Store URLs

- Website: `https://usetotem.xyz/`
- Support contact: `https://usetotem.xyz/` (or `iankit17@gmail.com`)
- Privacy policy URL (required): `https://usetotem.xyz/privacy`

## Privacy / Data Use (Partner Center Privacy page)

Same disclosures as the Chrome submission:
1. Data handled locally: bookmarks, tweet detail cache, reading progress,
   highlights, notes, runtime state, user settings.
2. Auth data (x.com session headers/cookies) captured from the user's own
   session, used only to sync that user's bookmarks; never transmitted to any
   Totem server.
3. No remotely hosted code. `declarativeNetRequest` rules are bundled in the
   package (`public/rules.json`), not fetched remotely.
4. New tab override is disclosed above in the detailed description (Edge policy
   §1.1.8 — the takeover must be mentioned in the listing and is reversible).

## Permission Justifications (Privacy page — one box per permission)

Reused from the Chrome listing, with "Chrome" → "browser":

- `storage`: Stores bookmarks, tweet detail cache, reading progress, highlights,
  notes, runtime state, and user settings locally in the browser.
- `webRequest`: Observes x.com GraphQL requests from the user's own browser
  session to capture the auth headers required to sync that user's bookmarks.
  Totem does not block or modify requests with `webRequest`.
- `declarativeNetRequest`: Sets the required request header on Totem's own x.com
  GraphQL requests so they match the authenticated browser session. Rules are
  bundled in the extension, not fetched remotely.
- `scripting`: Registers or removes the optional `Open in Totem` content script
  on x.com when the user enables or disables that setting.
- `cookies`: Reads the x.com session/account cookie locally to identify the
  active X account, scope the local bookmark cache, and detect logout or account
  changes.
- `https://x.com/*`: Runs Totem's x.com content scripts and sync logic only on
  x.com so the extension can detect account context and keep the local bookmark
  library in sync.
- Optional `topSites`: Shows browser quick links on the new tab page only after
  the user enables Quick Links.
- Optional `favicon`: Shows favicons for Quick Links only after the user enables
  Quick Links.
- Optional `search`: Lets Totem submit a new-tab search to the browser's default
  search engine only after the user chooses `Browser default`.

## Do Not Include

Same rules as Chrome — no `KEYWORDS` block, no keyword-only comma lists, no
competitor/alternative terms except inside real sentences. (The keyword phrases
belong in the Search Terms field above, not in the description.)
