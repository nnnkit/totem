# Chrome Web Store Dashboard Update Packet

Use this packet for the Chrome Web Store dashboard update that should happen
before the Featured badge nomination. Do not submit the nomination until the
public listing passes `pnpm cws:featured:live`.

Title, short description, and category changes are intentionally deferred while
the current Chrome Web Store growth spike is active. Keep those fields as-is for
now and revisit after 7-10 days of stable funnel data.

## Item

- Extension ID: `acpkgdfhoaalmnhjifhneghcgfnjkglo`
- Public listing: `https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo`
- Related domain: `https://usetotem.xyz/`
- Homepage URL: `https://usetotem.xyz/`
- Privacy policy URL: `https://usetotem.xyz/privacy/`
- Support email: `iankit17@gmail.com`
- Package to upload: `release/totem-v1.2.3.zip`

## Store Listing

Name:

```text
Twitter Saver: Bookmarks on New Tab, Search & Export
```

Short description:

```text
Read, search, and export Twitter / X bookmarks from your new tab. Local-first, no Totem account, no server.
```

Category:

```text
Productivity
```

Detailed description:

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

Small promo tile copy:

```text
Read your saved posts from a calm new tab.
```

Do not paste keyword lists, competitor alternatives, or standalone SEO phrases
into any dashboard field. Metadata experiments should wait until the current
growth spike has enough funnel data to judge safely.

## Assets

Upload these screenshots in this order:

1. `images-for-promotions/chrome-web-store/screenshots/01-twitter-bookmarks-on-every-new-tab.png`
2. `images-for-promotions/chrome-web-store/screenshots/02-read-twitter-threads-without-the-feed.png`
3. `images-for-promotions/chrome-web-store/screenshots/03-search-saved-posts-authors-links-threads.png`
4. `images-for-promotions/chrome-web-store/screenshots/04-export-twitter-bookmarks-markdown-csv-notion.png`
5. `images-for-promotions/chrome-web-store/screenshots/05-local-first-no-account-no-server.png`

Promo tiles:

- Small promo tile: `images-for-promotions/chrome-web-store/small-promo-tile.png`
- Marquee promo tile: `images-for-promotions/chrome-web-store/marquee-promo-tile.png`

## Privacy Practices

Use the local-first story consistently:

```text
Totem stores bookmarks, notes, highlights, reading progress, settings, and
runtime metadata locally in the browser. It does not operate a Totem bookmark
backend, does not collect extension analytics, does not sell or share user data,
and sends bookmark requests only to x.com from the user's browser.
```

Dashboard disclosures should match:

- Authentication information: stored locally, used only to authenticate x.com
  bookmark requests from the user's browser session.
- Web browsing activity: limited to observing x.com requests needed for header
  capture and bookmark sync.
- User content: bookmarks, tweet content, highlights, notes, and reading
  progress stored locally.
- Certification: data is not sold, not used for unrelated purposes, and not
  used for creditworthiness.

Do not claim "no data" in a dashboard section that asks whether the extension
handles local user content.

## Permission Justifications

Paste these into the dashboard permission fields:

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

## Upload Sequence

1. Run `pnpm cws:featured:preflight`.
2. Upload `release/totem-v1.2.3.zip`.
3. Paste the store listing, privacy, asset, and permission fields above.
4. Submit the CWS update for review.
5. Wait for the public listing to show the uploaded package and updated
   non-metadata fields.
6. Run `pnpm cws:featured:live`.
7. Submit the Featured badge nomination only after the live check passes.

## Featured Nomination

Use the One Stop Support path after the listing update is live:

1. `My item (extensions, app, or theme)`
2. `I want to nominate my extension to receive a Featured badge and be eligible for merchandising`

Use `plans/chrome-web-store-featured-badge-plan.md` for the purpose, use-cases,
restricted-access, and eligibility answers. The nomination can only be submitted
once every 6 months, so do not submit until the live listing passes the
readiness checks.
