# Phase 2 Release QA

Use this runbook after `pnpm package:extension` and `pnpm --filter @totem/site build` pass.

## Local Extension QA

1. Open `chrome://extensions`, enable Developer mode, and load the unpacked `dist/` folder.
2. Confirm the installed extension name is `Twitter Saver: Bookmarks on New Tab, Search & Export`.
3. Open a new tab with a fresh profile or after clearing Totem local storage.
   - Expected: no setup modal opens.
   - Expected copy: the login card shows `Log in to start reading`, `Sign in to your X account`, and `Log in to X`.
4. Click `Log in to X`.
   - Expected: opens the normal X login/bookmarks flow for the current browser profile.
5. Return to Totem and sync bookmarks once X is ready.
   - Expected: sync starts or shows the normal auth/sync state for the current profile.
6. Open three distinct bookmarks in reader view within one test session.
   - Expected: activation state records three reader opens within seven days in `chrome.storage.local.totem_growth_state`.
7. Open five distinct bookmarks in reader view.
   - Expected: review prompt appears with `Enjoying Totem? A quick review helps others find it.`
   - Expected: Review link points to `https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo/reviews`.
8. Dismiss the review prompt, then reload reader view.
   - Expected: prompt stays dismissed in `chrome.storage.local.totem_growth_state`.
9. Seed or wait for a synced-user/no-reader-open day-3 state.
   - Expected: new tab shows `You have N unread Twitter bookmarks waiting.`
   - Expected: `Open` switches to the reading view; dismiss persists.
10. Simulate sync interruption with cached bookmarks still present.
    - Expected: footer says `Sync is interrupted`.
    - Expected: copy says existing bookmarks are safe and available offline.
11. Update over the previous release in the same Chrome profile.
    - Expected: existing local bookmarks, highlights, notes, and reading progress remain available.
12. Remove the extension.
    - Expected: Chrome opens the configured uninstall URL after removal.

## Website Deployment QA

1. Deploy the site update.
2. Verify `https://usetotem.xyz/uninstall-feedback` returns `200`.
3. Verify these article URLs return `200`:
   - `https://usetotem.xyz/blog/twitter-saver-what-saving-actually-does`
   - `https://usetotem.xyz/blog/where-are-my-bookmarks-on-x`
4. Check desktop and mobile screenshots for:
   - Homepage hero text and Chrome Web Store CTA.
   - Both new article pages.
   - Uninstall feedback form.
5. Confirm homepage JSON-LD still includes `downloadUrl`, `softwareVersion`, `applicationSubCategory`, and `aggregateRating`.

## Chrome Web Store QA

1. Upload `release/totem-v1.2.1.zip`.
2. Update listing title, short description, long description, screenshots, promo tiles, privacy policy URL, and privacy disclosures from `plans/chrome-web-store-listing.md`.
3. Confirm the public listing shows the new title after approval.
4. Confirm the `/reviews` URL works for the public listing.
5. Submit the Featured badge request using `plans/phase-2-release-foundation-outreach.md` only after the approved listing and deployed website are live.
