# Chrome Web Store Listing — Totem

Optimized for Chrome Web Store search (which is keyword-literal) plus the
keyword targets identified in the SEO research. Below are three pieces of copy
to update in the developer dashboard.

> **Verified against DataForSEO (US, Apr 2026).** Cached JSON in
> `tmp/dataforseo/cws-keyword-volumes*.json` and `serp-tw-bookmarks-chrome-ext.json`.
> Key learnings that shaped the copy below:
> - "twitter bookmarks" (880/mo) > "x bookmarks" (320/mo). Lead with "Twitter".
>   Every top CWS competitor (Export Twitter Bookmarks, Twitter Bookmarks Search
>   by Twillot, xBookmarks) leads with "Twitter", not "X".
> - "twitter saver" is the surprise hit: **5,400/mo, LOW competition.** Worth
>   surfacing explicitly.
> - "x reader" looks tempting (4,400/mo) but the SERP is 100% fanfiction
>   ("[character] x reader" on Wattpad/Tumblr/AO3). **Do not target.**
> - "twitter bookmark manager" / "x bookmark manager" combined are only ~50/mo.
>   Don't over-rely on this framing — use "twitter bookmark tools" instead.

---

## 1. Extension name (max 75 chars)

**Current**: `Totem: X Bookmarks Reader` (25 chars)

**Recommended**:
```
Totem — Twitter / X Bookmarks on New Tab, Read Later & Export
```
(60 chars)

Rationale: leads with "Twitter" (880/mo) before "X" (320/mo) — Google demand
and the CWS competitor pattern both favor this order. Includes "bookmarks",
"new tab", "read later", and "export" (the #1 ranking competitor is literally
named "Export Twitter Bookmarks" — proven verb).

Alt (shorter): `Totem — Twitter / X Bookmarks: New Tab Reader & Export` (54 chars)

---

## 2. Short description (max 132 chars)

**Current**: `Read your saved X (Twitter) bookmarks in a clean, distraction-free reader.`

**Recommended**:
```
Turn your Twitter / X bookmarks into a searchable read-later queue on every new tab. Save, search, export — finish what you saved.
```
(129 chars)

Hits: *Twitter*, *X*, *bookmarks*, *searchable* (covers "bookmark search" — 880/mo),
*read-later*, *new tab*, *save*, *export*. "Twitter" leads "X" to match search-volume
weight.

---

## 3. Long description

```
Totem is the Twitter / X bookmark tool that lives on your new tab — the
tweets and threads you actually meant to read, in front of you every time
you open Chrome.

Most people save tweets and never come back. Opening X to "check bookmarks"
ends in twenty minutes of scrolling. Totem fixes both: your Twitter bookmarks
live on every new tab page, in a calm reading view — no feed, no algorithm,
no distractions.

WHAT IT DOES
• Replaces your Chrome new tab with your Twitter / X bookmarks
• Distraction-free reader for tweets and Twitter threads
• Search across every bookmark you've ever saved
• Export Twitter bookmarks to Markdown, CSV, or Notion
• Works offline — bookmarks live in your browser, not on a server

WHY TOTEM (vs other Twitter bookmark tools)
• Local-first. No login. No account. No server.
  Your bookmarks never leave your browser.
• Free. Forever. No paywall, no premium tier.
• Lives on your new tab. Other bookmark managers are sites you have to
  remember to open. Totem shows up automatically every time you start
  browsing.
• No bookmark limit. The X app only displays your most recent ~800 bookmarks.
  Totem indexes locally and keeps everything searchable.

WHO IT'S FOR
• Heavy Twitter / X readers who save threads they never finish
• People looking for a Pocket alternative for tweets
• Anyone who wants a calmer, more intentional new tab page
• Privacy-conscious users who don't want a third-party server holding
  their saved content

PERFECT IF YOU
• Bookmark a Twitter thread to read later but never do
• Want a minimal, distraction-free new tab
• Are looking for a Pocket replacement after Mozilla shut it down
• Have ever searched for "twitter bookmarks disappeared"
• Want to export your Twitter bookmarks to Markdown, CSV, or Notion

PRIVACY
Totem is local-first. Your bookmarks are stored in your browser's
IndexedDB. We don't run a server. We don't have an account system. We
can't see your data because we never receive it.

The extension reads from x.com only when you're on x.com (to capture new
bookmarks). It does not send any data anywhere else.

KEYWORDS
twitter bookmarks, twitter bookmark, x bookmarks, twitter saver, tweet
saver, bookmark manager, twitter bookmark manager, twitter reader, twitter
thread reader, tweet reader, bookmark organizer, bookmark search, read
later chrome extension, pocket alternative, instapaper alternative, new
tab extension, new tab chrome extension, custom new tab, minimal new tab,
focus chrome extension, distraction free twitter, export twitter bookmarks

FREE & OPEN
Totem is free to install and use. No premium tier, no upsell.
```

---

## 4. Update the manifest.json description

In `public/manifest.json`, change line 5 from:
```
"description": "Read your saved X (Twitter) bookmarks in a clean, distraction-free reader.",
```
to:
```
"description": "Turn your Twitter / X bookmarks into a searchable read-later queue on every new tab. Save, search, export — finish what you saved.",
```

The manifest description is what shows under the extension name in the
Chrome menu and the install confirmation modal — it should match the CWS
short description for consistency.

---

## 5. Promotional tile / screenshot copy ideas

If you control the promotional tile and screenshots in the CWS listing,
each screenshot caption should reinforce one keyword group:

1. **Hero shot**: "Your Twitter / X bookmarks on every new tab"
2. **Reader view**: "Read tweets and Twitter threads without the feed"
3. **Search**: "Search every bookmark you've ever saved"
4. **Export**: "Export Twitter bookmarks to Markdown, CSV, or Notion"
5. **Privacy**: "Local-first. No login. No server. No tracking."
6. **Pocket angle** (if there's room): "A calm read-later home for tweets"

---

## What NOT to put in the listing

- Don't list every CSS detail or feature — CWS rewards keyword-relevant
  benefits, not feature dumps.
- Don't promise mobile / cross-device sync (we don't have it; would invite
  bad reviews).
- Don't claim to be a 1:1 Pocket replacement (only honest about Twitter scope).
- Don't use emoji in body copy — looks spammy on CWS, hurts trust signals.
