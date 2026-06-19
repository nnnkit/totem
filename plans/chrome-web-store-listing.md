# Chrome Web Store Listing - Totem

This is the resubmission-safe Chrome Web Store copy for the `1.2.1` draft.

Note: title, short description, and category changes are deferred while the
current Chrome Web Store growth spike is active. Revisit after the listing has
7-10 days of stable impression, install, active-user, uninstall, and review
data.

The `1.2.0` draft was rejected on June 3, 2026 for `Spam and Placement in the Store` because the detailed description contained an excessive keyword list. Do not paste a `KEYWORDS` block, SEO keyword list, competitor alternatives list, or repeated search phrases into the dashboard description.

## Extension Name

```
Totem - Twitter / X Bookmarks
```

Why: brand-first, short, and limited to the one necessary product category. Avoid adding extra feature terms such as "saver", "manager", "reader", "search", "export", "new tab extension", or alternatives in the title.

## Short Description

```
Read your Twitter / X bookmarks on a calm new tab. Search, highlight, and export your library locally.
```

This should match `public/manifest.json`.

## Detailed Description

Paste this exactly into the Chrome Web Store dashboard:

```text
Totem helps you come back to the posts you saved on Twitter / X.

It replaces Chrome's new tab page with a quiet reading queue. Open a new tab to see saved posts, read threads without the feed, search your library, and export what you need.

Core features:
- Shows saved posts on every new tab
- Clean reader for posts and threads
- Search across text, authors, links, and notes
- Highlights, notes, and reading progress
- Export to Markdown, CSV, and Notion-ready files
- Offline access after sync

Privacy:
Totem stores your library, notes, highlights, and reading progress in your browser. There is no Totem account, backend server, analytics pipeline, or ad tracking.

Permissions:
Totem uses access to x.com only to sync bookmarks from your active X session. Optional Chrome permissions are used for new-tab conveniences, such as top sites and favicons, when enabled.
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
