# Chrome Web Store Listing — Totem

Optimized for Chrome Web Store search (which is keyword-literal), install-page
conversion, and the keyword targets identified in the SEO research. Below are
the dashboard copy, asset, and trust changes to make.

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
>
> **Competitor read, Jun 2 2026.** Tweet Copier is the closest proof of how CWS
> momentum compounds: it has 1,000 users, 59 ratings, Featured and recommended
> practices badges, 56 locales, and a "no data collection" privacy surface. The
> bigger Twitter bookmark competitors tell the same story: Export Twitter
> Bookmarks leads with one-click export and has 8,000 users; Twillot leads with
> "search, organize and export" and has 2,000 users. Totem should copy the
> pattern, not the exact product: one clear job, Twitter first, fewer words,
> no keyword tail, and a much stronger privacy/trust surface.

---

## 1. Extension name (max 75 chars)

**Current**: `Totem — Twitter Bookmarks on New Tab, Search & Export` (54 chars)

**Recommended**:
```
Twitter Saver: Bookmarks on New Tab, Search & Export
```
(52 chars)

Rationale: leads with the exact "twitter saver" phrase (5,400/mo) and names
Totem's actual differentiator - the new tab surface. Keep Totem as the
publisher, logo, short name, and in-product brand, but do not spend the first
characters of the CWS name on a brand term with little search demand.

Alt (if we want the X term in the title): `Twitter / X Saver: New Tab Bookmarks, Search & Export` (55 chars)

---

## 2. Short description (max 132 chars)

**Current**: `Turn your Twitter / X bookmarks into a searchable read-later queue on every new tab. Save, search, export — finish what you saved.`

**Recommended**:
```
Read, search, and export Twitter / X bookmarks from your new tab. Local-first, no Totem account, no server.
```
(105 chars)

Hits the install decision faster: what it does, where it lives, and why it is
safe enough to try. The current version is warmer, but the competitor pattern is
more direct and trust-led.

---

## 3. Long description

```
Totem turns your Twitter / X bookmarks into a calm reading queue on every new
tab. Instead of reopening X and getting pulled back into the feed, you get the
posts, threads, and links you already saved — ready to read, search, and export.

What Totem does
• Shows your Twitter / X bookmarks on your Chrome new tab
• Gives tweets and Twitter threads a clean reading view
• Searches across saved bookmarks, authors, links, and thread text
• Exports Twitter bookmarks to Markdown, CSV, and Notion-ready files
• Keeps bookmarks available offline after sync
• Works with your existing X session — no Totem account required

Why people install it
• Twitter bookmarks are easy to save and hard to revisit
• X bookmark search is limited
• Older bookmarks can disappear from the X interface
• Exporting bookmarks should not mean giving a third-party service your data
• A new tab reminder makes saved threads harder to forget

Privacy-first by design
Totem is local-first. Your bookmarks, notes, highlights, and reading progress
are stored in your browser. Totem has no backend server, no account system, and
no analytics pipeline.

The extension reads from x.com only to capture the bookmarks you are syncing.
It does not sell your data, use it for ads, or send your bookmark library to a
Totem server.

Best for
• Anyone searching for a twitter saver that lives in Chrome
• People who need a tweet saver for threads they actually mean to read
• People who save Twitter threads to read later
• Researchers and writers who need to search old saved posts
• People who want to export Twitter bookmarks to Markdown or CSV
• Privacy-conscious users who prefer a local browser extension
• Anyone who wants a calmer new tab than another dashboard or wallpaper
```

---

## 4. Update the manifest.json description

In `public/manifest.json`, change line 5 from:
```
"description": "Read your saved X (Twitter) bookmarks in a clean, distraction-free reader.",
```
to:
```
"description": "Read, search, and export Twitter / X bookmarks from your new tab. Local-first, no Totem account, no server.",
```

The manifest description is what shows under the extension name in the
Chrome menu and the install confirmation modal — it should match the CWS
short description for consistency.

---

## 5. Promotional tile / screenshot copy ideas

If you control the promotional tile and screenshots in the CWS listing,
each screenshot caption should reinforce one keyword group:

1. **Hero shot**: "Twitter bookmarks on every new tab"
2. **Reader view**: "Read Twitter threads without the feed"
3. **Search**: "Search saved posts, authors, links, and threads"
4. **Export**: "Export Twitter bookmarks to Markdown, CSV, or Notion"
5. **Privacy**: "Local-first. No Totem account. No server."

Use five screenshots, not eight. Chrome's listing guidance prefers clear,
current screenshots focused on core features, without too much text. The first
asset should say "Twitter bookmarks", not "X bookmarks", because the demand and
competitor pattern both favor Twitter-first wording.

Update the small promo tile copy from:
`A calm reader for your saved X bookmarks.`

to:
`Read, search, and export Twitter bookmarks.`

This makes the tile match the current search wedge and removes the weaker
X-first phrasing.

---

## 6. Privacy / trust checklist

The biggest conversion gap is not copy. It is trust.

1. Re-check the CWS privacy data categories against actual behavior. If Totem
   handles data locally but does not collect or use it on Totem servers, the
   privacy policy and dashboard wording must make that distinction explicit.
2. Keep the disclosure accurate. Google's policy treats local handling of
   sensitive data as still requiring a privacy policy, so don't claim "no data"
   unless the dashboard category semantics allow it for local-only storage.
3. Add a concise permission explanation to the listing or support page:
   `x.com access is used only to sync bookmarks from the user's active X session`.
4. Submit for the Featured badge after the listing, screenshots, privacy policy,
   and onboarding are aligned. The competitor advantage here is real because the
   badge is visible in search and listing headers.
5. Localize the listing after the English version is stable. Tweet Copier's 56
   locales are likely helping discovery; start with Hindi, Spanish, Portuguese,
   Japanese, Korean, German, French, Indonesian, and Chinese if support load is
   acceptable.

---

## What NOT to put in the listing

- Don't list every CSS detail or feature — CWS rewards keyword-relevant
  benefits, not feature dumps.
- Don't promise mobile / cross-device sync (we don't have it; would invite
  bad reviews).
- Don't claim to be a 1:1 Pocket replacement (only honest about Twitter scope).
- Don't use emoji in body copy — looks spammy on CWS, hurts trust signals.
- Don't add a literal `KEYWORDS` block. It reads as keyword stuffing, and
  Chrome's own listing guidance warns against unnecessary keywords.
