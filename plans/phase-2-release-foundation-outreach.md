# Phase 2 Release Foundation - External Action Pack

Source: `plans/totem-seo-growth-report.html`, Phase 2.

This pack contains the external actions that cannot be completed from the repo
alone: Chrome Web Store Featured badge submission, bookmarksave.com outreach,
Show HN, and r/SideProject. Use it after the release package with onboarding,
review prompt, screenshots, privacy copy, and CWS listing copy has been submitted
and is live.

## Featured Badge Request

### Pre-flight

- Listing title: `Twitter Saver: Bookmarks on New Tab, Search & Export`
- Short description matches `public/manifest.json`.
- Five screenshots are uploaded in this order: new tab, reader, search, export, privacy.
- Privacy policy URL points to `https://usetotem.xyz/privacy`.
- Onboarding is live in the Chrome Web Store release: first launch explains setup,
  `cookies`, `webRequest`, and privacy.
- Review prompt is live in the Chrome Web Store release after 5 reader opens and
  persists dismiss/review state.
- Uninstall feedback URL is deployed and reachable:
  `https://usetotem.xyz/uninstall-feedback`.

### Request Copy

Totem is a local-first Chrome extension for Twitter / X bookmarks. It replaces
the new tab with a calm reading queue for saved posts, threads, and links, with
local search, offline reading, and export to Markdown/CSV.

The extension uses the user's existing X browser session. It has no Totem
account system, no backend bookmark library, and no extension analytics
pipeline. Bookmarks, highlights, notes, reading progress, and exports remain in
the browser unless the user chooses to download or share an export.

Why it fits the Featured badge:

- Clear single-purpose UX: Twitter bookmarks on every new tab.
- Privacy-forward implementation: local-first, no tracking, no server-side
  bookmark collection.
- Plain-language onboarding for sensitive permissions.
- Current Chrome Web Store screenshots and listing copy.
- Support/privacy pages explain `x.com`, `cookies`, and `webRequest` access.

## bookmarksave.com Outreach

Subject: Suggesting Totem for your Twitter bookmark manager guide

Hi,

I found your Twitter bookmark manager guide while researching the tools people
use after X's native bookmark tab stops being enough.

I built Totem, a Chrome extension that takes a different angle: it puts Twitter
bookmarks on the new tab instead of sending them to another cloud dashboard.
It is local-first, uses the user's existing X session, has no Totem account, no
backend bookmark library, and exports to Markdown/CSV when users want a local
copy.

Chrome Web Store:
https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo

Website:
https://usetotem.xyz/

The short positioning is: Twitter bookmarks on every new tab, ready to read
locally, without opening X first.

If you update the guide, Totem is a good fit for the privacy/local-first/new-tab
category rather than the cloud tagging-dashboard category.

Thanks,
Ankit

## Show HN Draft

Title:

Show HN: Totem - Twitter bookmarks on every new tab, local-first

Body:

I kept saving useful X/Twitter threads and almost never returning to them. The
native bookmark tab was technically there, but opening it meant opening X again,
which usually meant getting pulled back into the feed.

So I built Totem. It is a Chrome extension that replaces the new tab with a
calm reading queue for your Twitter bookmarks.

The technical shape:

- It reads from your existing X browser session.
- It passively uses the GraphQL responses your browser already receives.
- It stores bookmarks, notes, highlights, and reading progress in local
  IndexedDB.
- It has no Totem account, no backend bookmark library, and no extension
  analytics pipeline.
- It exports the local library to Markdown, CSV, and importable JSONL.

The product shape:

- New tab shows a saved post instead of another empty dashboard.
- Reader view removes the feed.
- Search runs locally across saved posts, authors, links, and threads.
- Review/export/onboarding are built around the local-first boundary.

Chrome Web Store:
https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo

Site:
https://usetotem.xyz/

I am especially interested in feedback on the architecture and privacy boundary:
whether a local-first browser extension is the right shape for this kind of
personal reading data.

## r/SideProject Draft

Title:

I saved 200 tweets and read 3. So I built this.

Body:

I use X/Twitter bookmarks like a fake memory system.

I save a thread because it seems useful. Then I open X later, get pulled into
the feed, and never read the thing I saved.

So I built Totem: a Chrome extension that puts Twitter bookmarks on every new
tab.

The idea is deliberately small:

- save posts on X like normal
- open a new tab
- see one saved post before opening the feed
- read it in a cleaner reader
- search/export the local library when needed

The privacy line was the hard part. Bookmarks are personal, so I did not want a
cloud bookmark backend. Totem stores the library locally in the browser, uses
your existing X session, has no Totem account, and has no extension analytics
pipeline.

It can export Markdown/CSV/JSONL, and it explains the permissions on first
launch because `cookies` and `webRequest` look scary if the product does not
say exactly why they exist.

Chrome Web Store:
https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo

Website:
https://usetotem.xyz/

I would like feedback from people who save a lot of posts: would putting them
on the new tab actually change whether you read them, or is your saved queue
doomed regardless of surface?
