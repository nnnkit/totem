# Chrome Web Store Publishing Checklist

Everything needed to get Totem published on the Chrome Web Store.

---

## Developer Account Setup

- [ ] Create Chrome Web Store developer account at https://chrome.google.com/webstore/devconsole
- [ ] Pay one-time $5 registration fee
- [ ] Verify email on the Google account
- [ ] Complete identity verification (likely required given sensitive permissions)

---

## Store Listing Assets

- [ ] **Detailed description** — use the compliant copy in `plans/chrome-web-store-listing.md`; keep it concise, natural, and free of keyword lists.
- [ ] **Screenshots** — at least 1, ideally 5 (1280x800 or 640x400)
  - New tab home page (with wallpaper, top sites, search)
  - Bookmark list view (unread / continue / read tabs)
  - Reader view (thread reading experience)
  - Highlight/annotation in action
  - Settings modal
- [ ] **Small promo tile** (440x280) — recommended for discoverability
- [ ] **Large promo tile** (920x680) — optional, for featured placement
- [ ] **Marquee promo tile** (1400x560) — optional, for top banner
- [ ] **Category** — select "Productivity"
- [ ] **Language** — set primary language to English
- [ ] **Short demo video** (YouTube, 30-60s) — optional but helps with review

---

## Required Legal & Policy Pages

### Privacy Policy Page

A public privacy policy URL is **mandatory** given the permissions we request. Must cover:

- [ ] What data is collected:
  - Twitter auth headers (authorization, cookies, CSRF token) — captured passively from existing x.com sessions
  - Twitter user ID (derived from twid value inside captured auth cookie header)
  - Bookmarked tweets and their content
  - Reading progress, highlights, and notes
  - User settings and theme preferences
- [ ] Where data is stored:
  - All data stored locally on-device (IndexedDB + chrome.storage.local)
  - Settings synced via Chrome's built-in chrome.storage.sync (encrypted by browser)
  - No data sent to any external server besides x.com itself
- [ ] What data is NOT collected:
  - No analytics or telemetry
  - No third-party tracking
  - No data shared with any party other than x.com (for bookmark operations)
- [ ] Data retention:
  - Tweet detail cache: 30-day TTL, auto-cleaned
  - Bookmark events: 14-day retention
  - Auth headers: refreshed on each x.com visit, no long-term archival
- [ ] User control:
  - User can clear all data by removing the extension
  - All bookmarks are the user's own bookmarks, fetched from their own account
- [ ] Host this at a public URL (e.g., on the Totem website at website/)

### Support Page

- [ ] Create a support/contact page or link to GitHub issues
- [ ] Add URL to manifest as homepage_url

---

## Manifest Changes

### Add missing fields

```json
{
  "homepage_url": "https://usetotem.xyz/",
  "offline_enabled": true
}
```

### Permission justifications to prepare

For the Web Store submission form, write a justification for each permission:

- [ ] **storage** — "Stores bookmark data, reading progress, highlights, and user settings locally. Uses chrome.storage.sync for cross-device settings only."
- [ ] **webRequest** — "Passively observes x.com API requests to capture authentication headers needed to fetch the user's own bookmarks. No requests are blocked or modified via webRequest."
- [ ] **declarativeNetRequest** — "Adds required headers to API requests made to x.com so bookmark fetch requests are properly authenticated."
- [ ] **scripting** — "Registers or removes the optional Open in Totem content script on x.com when the user enables or disables that setting."
- [ ] **cookies** — "Reads the x.com session/account cookie locally to identify the active X account, scope the local bookmark cache, and detect logout/account changes."
- [ ] **https://x.com/*** — "Needed to run content scripts that detect the logged-in user and capture bookmark create/delete events in real-time. The extension only interacts with x.com."
- [ ] **topSites (optional)** — "Displays the user's most visited sites on the new tab page, only when the user enables this feature."
- [ ] **favicon (optional)** — "Shows website favicons next to top sites and links in the new tab page."
- [ ] **search (optional)** — "Allows the new tab search bar to use the user's default search engine."

---

## Chrome Web Store Data Disclosures

The "Privacy practices" tab on the developer dashboard requires declaring data handling. Fill out:

- [ ] **Authentication info** — "Stored locally, used to authenticate API requests to x.com on behalf of the user"
- [ ] **Web browsing activity** — declare that we observe x.com network traffic (for header capture and bookmark events)
- [ ] **User content** — bookmarks, highlights, notes stored locally
- [ ] **Certify**: data is not sold, not used for purposes unrelated to the extension, not used for creditworthiness

---

## Code Changes — Review Risk Mitigation

These are changes to reduce the chance of rejection and address likely reviewer concerns.

### HIGH PRIORITY

#### 1. Reframe fetch-queue delay logic

**File:** src/lib/fetch-queue.ts

The "human-like" delay language in comments suggests evasion of platform rate limits. Rename and reframe as "rate-limited request queue" or "polite request throttling."

- [ ] Remove comments/naming referencing "human-like," "reading pause," or behavioral mimicry
- [ ] Rename to frame as respectful rate limiting (which it is — spacing out requests to avoid hammering the API)
- [ ] Keep the actual delay logic the same, just change the framing

#### 2. Justify or rearchitect MAIN-world content script

**File:** public/content/mutation-hook.js

This is the **single highest rejection risk**. Running in MAIN world and monkey-patching XMLHttpRequest.prototype.open and fetch is extremely aggressive.

- [ ] Option A (lower risk): Write a detailed justification explaining this is the only reliable way to detect real-time bookmark create/delete events before they appear in the API
- [ ] Option B (lower risk, more work): Explore replacing with declarativeNetRequest rules that observe bookmark mutation endpoints passively, combined with response body inspection in the service worker
- [ ] Option C (safest, most work): Remove real-time detection entirely, rely on polling (soft sync every 10 min already exists)
- [ ] Whichever option: add clear code comments explaining WHY this approach is necessary

#### 3. Justify auth header capture

**File:** public/service-worker.js (the webRequest.onSendHeaders listener)

- [ ] Add prominent code comments explaining: headers are captured from the user's own authenticated session, stored only locally, never transmitted to any external server, used only to make API calls on behalf of the same user to the same service (x.com)
- [ ] Consider: is there any way to authenticate without capturing raw headers? (Likely no, since Twitter doesn't offer an official extension API)

#### 4. Justify or remove bundle-fetching for query IDs

**File:** public/service-worker.js (Tier 3 query ID discovery)

Fetching x.com JavaScript bundles and regex-extracting query IDs looks like scraping/reverse engineering.

- [ ] Add code comments explaining the 3-tier fallback system and that this is a last resort
- [ ] Consider: how often does Tier 3 actually fire in practice? If rarely, document that. If never, consider removing it.
- [ ] Prepare justification: "Query IDs change with each x.com deployment. We passively capture them from normal browsing (Tier 1-2). Bundle fetching (Tier 3) is a fallback used only when the passive catalog is stale."

### MEDIUM PRIORITY

#### 5. Add privacy policy URL to manifest

**File:** public/manifest.json

- [ ] Keep `homepage_url` pointed at `https://usetotem.xyz/`

#### 6. Review all permissions — remove anything unnecessary

**File:** public/manifest.json

- [ ] Audit whether webRequest can be fully replaced by declarativeNetRequest for header capture
- [ ] Confirm tabs is only used for the re-auth flow — if so, document it
- [ ] Ensure no permission is requested but unused

#### 7. Validate CSP and remote resource loading

**File:** public/manifest.json

Current CSP loads fonts from Google Fonts (fonts.googleapis.com, fonts.gstatic.com) and images from twimg.com. These are fine but:

- [ ] Confirm no other remote resources are loaded at runtime
- [ ] Ensure all image/media URLs come from Twitter CDN only (already the case)

### LOW PRIORITY

#### 8. innerHTML audit

**Files:** src/components/reader/TweetText.tsx, src/components/reader/CodeBlock.tsx

- [ ] Verify escapeHtml() covers all edge cases (currently escapes &, <, >, ", ' — this is correct)
- [ ] Verify sanitizeUrl() only allows http:// and https:// schemes (already does)
- [ ] Add a brief code comment near each usage explaining the sanitization chain
- [ ] Consider: could any user-generated content (tweet text, display names) bypass the escaping? (Current analysis: no, all paths go through escapeHtml)

#### 9. Add offline_enabled to manifest

**File:** public/manifest.json

- [ ] The extension works offline with cached data — declare this

---

## Privacy Policy Page — Build It

Needs to be a publicly accessible page. Options:

- [ ] Add a /privacy route to the existing Astro website (website/)
- [ ] Content must cover everything listed in the "Required Legal & Policy Pages" section above
- [ ] Must be live and accessible before submitting to the Web Store

---

## Submission Checklist (Final)

Once all the above is done:

- [ ] Run `pnpm cws:featured:preflight` to verify the manifest, release ZIP, CWS assets, and dashboard copy plan.
- [ ] Use `plans/chrome-web-store-dashboard-update-packet.md` as the source for dashboard fields, assets, privacy practices, and permission justifications.
- [ ] Run pnpm build and verify clean build
- [ ] Test the dist/ output as an unpacked extension in Chrome
- [ ] Test all core flows: auth, sync, reading, highlights, settings
- [ ] Zip the dist/ folder (or use existing release script)
- [ ] Upload to Chrome Web Store developer console
- [ ] Fill in all store listing fields (description, screenshots, category, language)
- [ ] Fill in privacy practices disclosures
- [ ] Paste permission justifications in the submission notes
- [ ] Link privacy policy URL
- [ ] Submit for review
- [ ] Expected review time: 1-3 business days (can be longer for extensions with sensitive permissions — ours will likely take longer)
- [ ] After approval, run `pnpm cws:featured:live` and only submit the Featured badge nomination after it passes.

---

# Microsoft Edge Add-ons Publishing

Edge is Chromium-based, so **the same `release/totem-v{version}.zip` you upload to
the Chrome Web Store is the package here** — no separate build, no separate
manifest. A single manifest + `check-version-sync.mjs` keeps the Chrome and Edge
versions aligned automatically. All listing copy, screenshots, tiles, and legal
URLs live in `plans/edge-add-ons-listing.md`.

## Already satisfied (no action)

- Microsoft's two required cert changes — strip `update_url` and remove "Chrome"
  from the manifest `name`/`description` — are already met: the manifest has
  neither.
- The in-extension "Review" button auto-switches to the Edge Add-ons listing at
  runtime on Edge (`getStoreReviewUrl()` in `src/lib/constants/growth.ts`). After
  the first Edge submission, fill `EDGE_ADDONS_PRODUCT_ID` there with the product
  GUID from Partner Center → Overview, then ship the next release. Until then it
  safely falls back to the Chrome reviews URL.

## Developer Account Setup

- [ ] Register at Partner Center: https://partner.microsoft.com/dashboard/microsoftedge/public/login
- [ ] Use a **Microsoft account (MSA)** as Primary Owner (personal Outlook/Live/Hotmail or GitHub account; work/school Entra accounts can't register).
- [ ] Choose an **Individual** account (free, light verification). Do NOT choose Company unless needed — that adds days-to-weeks of business verification and is irreversible.
- [ ] Registration fee: **$0** (vs Chrome's $5).
- [ ] Accept the Microsoft Store App Developer Agreement (the Edge extension program waives the fee).

## Assets & Copy

Everything is prepared in `plans/edge-add-ons-listing.md`:

- [ ] **Store logo 300×300** — `images-for-promotions/edge-add-ons/store-logo-300.png` (already generated).
- [ ] **5 screenshots @ 1280×800** — reuse from `images-for-promotions/chrome-web-store/screenshots/`.
- [ ] **Small promo tile 440×280** and **large promo tile 1400×560** — reuse from `images-for-promotions/chrome-web-store/`.
- [ ] **Detailed description** — "Chrome new tab" → "browser new tab" swap already done in the Edge doc.
- [ ] **Search terms** (Edge-only, max 7 / ≤30 chars each) — 7 terms listed in the Edge doc.
- [ ] **Single purpose** statement — in the Edge doc.
- [ ] **Privacy policy URL** — `https://usetotem.xyz/privacy` (live, reused).
- [ ] **Permission justifications** — one box per permission, in the Edge doc (Chrome→browser swaps applied).

## Submission (manual, in Partner Center)

1. [ ] Extensions → **Create new extension** → upload `release/totem-v{version}.zip`.
2. [ ] **Availability**: Visibility = Public, Markets = all.
3. [ ] **Properties**: Category = Productivity; Website + Support URL.
4. [ ] **Privacy** page: Single purpose, per-permission justifications, remote-code = none, data-use disclosures + certifications, Privacy policy URL.
5. [ ] **Store listing**: paste name (read-only from manifest), detailed description, upload logo + screenshots + tiles, add the 7 search terms.
6. [ ] **Certification notes**: reuse the Chrome review-risk justifications (MAIN-world `mutation-hook.js`, `webRequest` auth-header capture, x.com bundle-fetch for GraphQL query IDs) — Edge review is comparable-to-slightly-stricter on aggressive host behavior.
7. [ ] Publish. Expected certification: **up to 7 business days** (often faster; expedited queue for high-quality extensions).
8. [ ] After approval: copy the product GUID (Overview page) into `EDGE_ADDONS_PRODUCT_ID` in `src/lib/constants/growth.ts`, and add the live Edge listing URL to the website (`apps/site/src/react/site-content.ts`, JSON-LD `sameAs`) if you add an Edge CTA.

## Later (optional automation)

The Edge **Update REST API** (v1.1, base `https://api.addons.microsoftedge.microsoft.com`;
API key + Client ID from Partner Center → Publish API; keys expire every 72 days)
can automate **package updates** in CI — but NOT the initial submission or any
metadata. Mirror the GitHub Release step in `.github/workflows/release-extension.yml`
with an opt-in `edge:publish` step (secrets: client ID, API key, product ID) that
POSTs `release/*.zip` after the release is cut.
