# Chrome Web Store Listing - Totem

This is the resubmission-safe Chrome Web Store copy for the `1.2.1` draft.

Note: title, short description, and category changes are deferred while the
current Chrome Web Store growth spike is active. Revisit after the listing has
7-10 days of stable impression, install, active-user, uninstall, and review
data.

The `1.2.0` draft was rejected on June 3, 2026 for `Spam and Placement in the Store` because the detailed description contained an excessive keyword list. Do not paste a `KEYWORDS` block, SEO keyword list, competitor alternatives list, or repeated search phrases into the dashboard description.

## Extension Name

```
Twitter & X Bookmarks on New Tab — Totem
```

Why: keyword-first for Chrome Web Store search — the title is the #1 ranking lever, and "Twitter / X Bookmarks" is the phrase people actually search, so it leads; the brand rides at the end ("Totem" has no search volume yet to defend). Drop "Saver" entirely — it reads as a video downloader. Keep it a natural phrase, not a keyword list. The brand-first variant "Totem — Twitter & X Bookmarks on New Tab" is the swap only when submitting for the Featured badge. See plans/research/totem-cws-listing-positioning-2026-06-26.html.

## Short Description

```
Your Twitter & X bookmarks, waiting on every new tab — finally read what you saved. Search, highlight, export. Local-first.
```

This should match `public/manifest.json`.

## Detailed Description

Paste this exactly into the Chrome Web Store dashboard:

```text
Totem is a local-first bookmark manager for Twitter and X, built around the one thing the others skip: actually reading what you save. It turns your Chrome new tab into a calm reading queue for your Twitter/X bookmarks — a read-it-later for tweets, threads, and X articles — so the posts you save come back to you instead of vanishing.

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

## Screenshot Order

Use exactly five screenshots:

1. New tab reading queue
2. Thread reader
3. Search
4. Export
5. Local-first privacy

Keep screenshot captions descriptive and feature-specific. Do not use search-keyword captions such as "pocket alternative", "instapaper alternative", "bookmark manager chrome extension", or "custom new tab".

## Promo Tile Copy

Small promo tile:

```text
Read your saved posts from a calm new tab.
```

## Privacy And Permissions Checklist

1. Privacy policy URL is filled in the dashboard.
2. Data disclosures match the local-first behavior: bookmarks, notes, highlights, reading progress, and auth data are handled locally.
3. Permission explanation uses this plain-language sentence: `x.com access is used only to sync bookmarks from your active X session.`
4. Do not claim "no data" if the dashboard category asks whether the extension handles user content locally.
5. Do not claim mobile sync, cross-device library sync, or service-side backup.

## Permission Justifications

Use these in the dashboard permission fields:

- `storage`: Stores bookmarks, tweet detail cache, reading progress,
  highlights, notes, runtime state, and user settings locally in the browser.
- `webRequest`: Observes x.com GraphQL requests from the user's own browser
  session to capture the auth headers required to sync that user's bookmarks.
  Totem does not block or modify requests with `webRequest`.
- `declarativeNetRequest`: Sets the required request header on Totem's own
  x.com GraphQL requests so they match the authenticated browser session.
- `scripting`: Registers or removes the optional `Open in Totem` content script
  on x.com when the user enables or disables that setting.
- `cookies`: Reads the x.com session/account cookie locally to identify the
  active X account, scope the local bookmark cache, and detect logout or account
  changes.
- `https://x.com/*`: Runs Totem's x.com content scripts and sync logic only on
  x.com so the extension can detect account context and keep the local bookmark
  library in sync.
- Optional `topSites`: Shows Chrome quick links on the new tab page only after
  the user enables Quick Links.
- Optional `favicon`: Shows favicons for Quick Links only after the user enables
  Quick Links.
- Optional `search`: Lets Totem submit a new-tab search to Chrome's default
  search engine only after the user chooses `Browser default`.

## Do Not Include

- A literal `KEYWORDS` block.
- Keyword-only comma-separated phrases.
- Competitor or alternative terms unless they are part of a real sentence about Totem's actual scope.
- More than one mention of "Twitter / X bookmarks" in the opening section.
- "Twitter saver", "tweet saver", "bookmark manager", "Pocket alternative", "Instapaper alternative", "new tab chrome extension", or similar search phrases as standalone metadata.
