# Chrome Web Store Featured Badge Plan

Last checked: 2026-06-15.

## Official Criteria

Sources:

- Badges overview: https://support.google.com/chrome_webstore/answer/1050673
- Discovery and badge criteria: https://developer.chrome.com/docs/webstore/discovery
- One Stop Support nomination form: https://support.google.com/chrome_webstore/contact/one_stop_support
- Extension best practices: https://developer.chrome.com/docs/webstore/best-practices
- Listing best practices: https://developer.chrome.com/docs/webstore/best-listing
- Image requirements: https://developer.chrome.com/docs/webstore/images
- User privacy guidance: https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy
- Program policies: https://developer.chrome.com/docs/webstore/program-policies

Google does not sell badges. The Featured badge is manually reviewed by the
Chrome Web Store team. Review focuses on technical best practices, latest
platform APIs, privacy, intuitive UX, and a clear store listing with quality
images.

The self-nomination form currently requires:

- Extension is published and public.
- Extension is relevant to a broad set of users.
- Publisher account has no active violations on Chrome Web Store or other
  Google services.
- Extension meets compliance, Manifest V3, security, privacy, performance, UX,
  and listing best-practice confirmations.
- Listing lists all main functionality.
- Summary, description, images, screenshots, and privacy fields are accurate.
- The extension can only be nominated once every 6 months.

## Current Totem State

Live Chrome Web Store page checked on 2026-06-15:

- Public listing: https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo
- Visible title: `Twitter Saver: Bookmarks on New Tab, Search & Export`
- Version: `1.2.3`
- Updated: `June 12, 2026`
- Rating: `5.0` from `7 ratings`
- Users: `22`
- Language: English
- Privacy policy and support links are present.
- No Featured badge is visible.

Repo readiness:

- `public/manifest.json` now uses the keyword-first title
  `Twitter & X Bookmarks on New Tab — Totem` (updated 2026-06-26; the live store
  push is deferred until the install spike settles).
- `public/manifest.json` now uses the short description:
  `Your Twitter & X bookmarks, waiting on every new tab — finally read what you saved. Search, highlight, export. Local-first.`
- `public/manifest.json` now declares `https://usetotem.xyz/` as the homepage
  and `offline_enabled: true`.
- Chrome Web Store asset folder has exactly five screenshots plus marquee and
  small promo tiles.
- Screenshot dimensions are correct: five `1280x800` screenshots, one
  `1400x560` marquee, one `440x280` small tile.
- Onboarding explains setup, `cookies`, `webRequest`, and privacy.
- Privacy page explains storage, `webRequest`, `cookies`,
  `declarativeNetRequest`, `https://x.com/*`, and optional permissions.

## Main Risks Before Nomination

1. Title, short description, and category changes are deferred while the recent
   install spike is active. Avoid metadata churn until there is 7-10 days of
   stable funnel data.
2. Do not nominate while the dashboard listing differs from the submitted
   package or has active policy warnings; the form asks you to certify the
   published version is already compliant.
3. Sensitive implementation details need a clean reviewer story:
   `webRequest`, `cookies`, MAIN-world mutation observation, and x.com bundle
   query-ID discovery are all justifiable only if framed as local, user-session
   bookmark sync with no Totem backend.
4. Broad relevance is the weakest eligibility point. Position Totem as a
   productivity/new-tab reading tool for Chrome users who save Twitter / X
   content, not as a narrow scraper/export utility.
5. Usage and review count are early. Google does not publish a minimum, but
   discovery docs say ratings and usage statistics factor into ranking.

## Best Path

1. Use `plans/chrome-web-store-dashboard-update-packet.md` as the dashboard
   copy-paste packet for the listing, assets, privacy practices, and permission
   justifications.
2. Publish a CWS update with the keyword-first manifest title and short
   description (see `plans/research/totem-cws-listing-positioning-2026-06-26.html`).
3. In the dashboard, paste the exact long description from
   `plans/chrome-web-store-listing.md`.
4. Keep the category as `Productivity` during the growth-observation window.
5. Upload the five screenshots and promo tiles from
   `images-for-promotions/chrome-web-store/`.
6. Confirm the privacy policy URL is `https://usetotem.xyz/privacy/` and the
   privacy categories still match local-only handling.
7. Wait for the public listing to show the current screenshots and no active
   policy warnings.
8. Run `pnpm cws:featured:preflight` before upload and again before nomination.
9. After the listing update is approved, run `pnpm cws:featured:live`. Do not
   nominate until this passes against the public Chrome Web Store page.
10. Run the extension smoke flow from `docs/phase-2-release-qa.md`.
11. Submit the Featured badge nomination through One Stop Support. Do this once
   the live listing is correct because resubmission is limited to once every 6
   months.
12. While waiting, keep improving trust signals: reply to support email,
   encourage real reviews only after users get value, and reduce day-1
   uninstall causes from onboarding/sync confusion.

## Dashboard Permission Notes

Use the exact permission justifications from `plans/chrome-web-store-listing.md`.
The short reviewer story is:

```text
Totem is local-first and uses the user's existing x.com browser session only to
sync that user's own bookmarks. It stores bookmarks, notes, highlights, reading
progress, and runtime metadata locally in the browser. It does not operate a
Totem bookmark backend, does not collect extension analytics, does not sell or
share user data, and sends bookmark requests only to x.com.
```

## Nomination Draft

Use the One Stop Support path:

1. `My item (extensions, app, or theme)`
2. `I want to nominate my extension to receive a Featured badge and be eligible for merchandising`

Form fields:

- Publisher email address: use the Chrome Web Store publisher account email.
- Extension ID: `acpkgdfhoaalmnhjifhneghcgfnjkglo`
- Related domain: `https://usetotem.xyz/`
- Published to all public users: `Yes`
- Relevant to a broad set of users: `Yes`
- Publisher account clear from active violations: answer `Yes` only after
  checking the dashboard.
- Best-practice confirmations: check all only after the live listing and
  package match this plan.
- Main functionalities listed on the listing page: `Yes`

Purpose answer:

```text
Totem helps Chrome users actually return to the Twitter / X posts they save.
It replaces the new tab with a calm local reading queue for the user's own
bookmarks, with a focused thread reader, local search, highlights, notes,
reading progress, and export to Markdown/CSV/Notion-ready files.

The value is that saved posts appear at the moment users open a new tab, instead
of requiring them to reopen the X feed and get distracted. Totem is local-first:
there is no Totem account, no Totem backend bookmark library, no extension
analytics pipeline, and no ad tracking. The extension uses the user's existing
x.com browser session only to sync that user's own bookmarks.
```

Use-cases answer:

```text
Typical use cases:

- Open a new tab and continue reading saved Twitter / X posts without opening
  the X feed.
- Read long threads in a cleaner reader view with reading progress.
- Search saved posts by text, author, links, and thread content.
- Highlight or note useful passages and keep that data locally in the browser.
- Export a local archive to Markdown, CSV, or Notion-ready files.
- Keep reading already-synced posts offline.

First-time use is simple: the user installs Totem, signs in to x.com in the same
browser if they are not already signed in, visits x.com/bookmarks once, and
syncs. After that, their bookmarks are available from the Chrome new tab page.
```

Restricted access answer:

```text
Totem's bookmark sync depends on the user's own x.com account because the
extension's purpose is to organize that user's Twitter / X bookmarks. It does
not require a Totem account, payment, enterprise account, private domain, or
separate credentials. The extension uses the active x.com browser session and
sends bookmark requests only to x.com from the user's browser.
```
