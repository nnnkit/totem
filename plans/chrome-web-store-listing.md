# Chrome Web Store Listing — Totem

Optimized for Chrome Web Store search (which is keyword-literal) plus the
keyword targets identified in the SEO research. Below are three pieces of copy
to update in the developer dashboard.

---

## 1. Extension name (max 75 chars)

**Current**: `Totem: X Bookmarks Reader` (25 chars)

**Recommended**:
```
Totem — X / Twitter Bookmarks on Your New Tab (Read Later)
```
(58 chars)

Rationale: includes both "X" and "Twitter" (CWS search matches them
separately), "bookmarks", "new tab", and "read later" — four of our highest-
intent keyword groups in a single title. Em-dash keeps it readable.

Alt (shorter): `Totem — X Bookmarks New Tab & Read Later` (41 chars)

---

## 2. Short description (max 132 chars)

**Current**: `Read your saved X (Twitter) bookmarks in a clean, distraction-free reader.`

**Recommended**:
```
Turn your X / Twitter bookmarks into a calm read-later queue on every new tab. Search, export, finish what you saved.
```
(116 chars)

Hits: *X*, *Twitter*, *bookmarks*, *read-later*, *new tab*, *search*, *export*.

---

## 3. Long description

```
Totem replaces your new tab with the X (Twitter) bookmarks you actually meant
to read.

Most people save tweets and never come back. Opening X to "check bookmarks"
ends in twenty minutes of scrolling. Totem fixes both: your bookmarks live
on every new tab page, in a calm reading view — no feed, no algorithm, no
distractions.

WHAT IT DOES
• Replaces your Chrome new tab with your X / Twitter bookmarks
• Distraction-free reader view for tweets and threads
• Search across every bookmark you've ever saved
• Export to Markdown, CSV, or Notion
• Works offline — bookmarks live in your browser, not on a server

WHY TOTEM (vs other Twitter / X bookmark managers)
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
• Bookmark Twitter threads to read later but never do
• Want a minimal, distraction-free new tab
• Are looking for a Pocket replacement after Mozilla shut it down
• Have ever searched for "twitter bookmarks disappeared"
• Want to export your X bookmarks to Markdown, CSV, or Notion

PRIVACY
Totem is local-first. Your bookmarks are stored in your browser's
IndexedDB. We don't run a server. We don't have an account system. We
can't see your data because we never receive it.

The extension reads from x.com only when you're on x.com (to capture new
bookmarks). It does not send any data anywhere else.

KEYWORDS
twitter bookmarks, x bookmarks, twitter bookmark manager, x bookmark
manager, bookmark organizer, read later chrome extension, pocket
alternative, instapaper alternative, new tab extension, custom new tab,
minimal new tab, tweet saver, twitter reader, x reader, distraction free
twitter, focus chrome extension, export twitter bookmarks, bookmark search

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
"description": "Turn your X / Twitter bookmarks into a calm read-later queue on every new tab. Search, export, finish what you saved.",
```

The manifest description is what shows under the extension name in the
Chrome menu and the install confirmation modal — it should match the CWS
short description for consistency.

---

## 5. Promotional tile / screenshot copy ideas

If you control the promotional tile and screenshots in the CWS listing,
each screenshot caption should reinforce one keyword group:

1. **Hero shot**: "Your X bookmarks on every new tab"
2. **Reader view**: "Read tweets and threads without the feed"
3. **Search**: "Search every bookmark you've ever saved"
4. **Export**: "Export to Markdown, CSV, or Notion"
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
