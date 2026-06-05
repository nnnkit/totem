# Next Release Growth Checklist

Source: `plans/totem-seo-growth-report.html` and `plans/chrome-web-store-listing.md`.

Goal for this release: resubmit the Chrome Web Store draft with compliant metadata, keep the review flywheel, stop leaking existing blog traffic, and prepare the listing for a Featured badge request.

## P0 - Release Scope

### Extension

- [x] Update `public/manifest.json` `name` to `Totem - Twitter / X Bookmarks`.
- [x] Keep `short_name` as `Totem` so the product still has a compact brand in constrained Chrome UI.
- [x] Keep the manifest/CWS description aligned with: `Read your Twitter / X bookmarks on a calm new tab. Search, highlight, and export your library locally.`
- [x] Add an in-extension review prompt.
  - Trigger after a user opens 5 bookmarks in reader view across any sessions.
  - Placed as a reader-route banner after `recordReaderOpen()`.
  - Link directly to the Chrome Web Store reviews URL.
  - Persist state in `chrome.storage.local`.
  - Never show again after dismiss or review click.
  - Suggested copy: `Enjoying Totem? A quick review helps others find it.`
- [x] Add local activation tracking for the review prompt.
  - Track bookmarks opened in reader view.
  - Treat activation as 3 bookmarks opened in reader view within 7 days.
- [x] Add first-launch onboarding.
  - One setup step: `Visit x.com/bookmarks to sync your first bookmarks.`
  - Explain `cookies` and `webRequest` permissions in one plain-English sentence each.
  - Link to the privacy page.
- [x] Add a day-3 re-engagement nudge for users who synced bookmarks but never opened reader view.
  - Suggested copy: `You have unread Twitter bookmarks waiting.`
- [x] Add uninstall feedback with `chrome.runtime.setUninstallURL`.
  - Use a short 3-question form.
  - Capture confusing setup, missing feature, sync failure, and trust/privacy concerns.
- [x] Add GraphQL/sync breakage resilience.
  - Show a visible state when sync is interrupted.
  - Suggested copy: `Sync is temporarily interrupted. Your existing bookmarks are safe and available offline.`

### Website

- [x] Fix homepage JSON-LD in `apps/site/src/pages/index.astro`.
  - Added `downloadUrl` with the Chrome Web Store listing URL.
  - Added `softwareVersion: "1.2.1"`.
  - Added `applicationSubCategory: "Productivity"`.
  - Added `aggregateRating` from the live initial CWS rating.
- [x] Update homepage positioning around the 3-second claim: `Your Twitter bookmarks show up on every new tab, ready to read - locally, without opening X.`
- [x] Add a support/privacy explanation for permissions.
  - Explained `x.com` access.
  - Explained `cookies`.
  - Explained `webRequest`.
  - Made clear bookmarks are handled locally and not uploaded to a Totem server.
- [x] Add one contextual inline CTA to each existing blog post.
  - `apps/site/src/content/blog/are-x-twitter-bookmarks-private.md`
  - `apps/site/src/content/blog/best-chrome-bookmark-managers-2026.md`
  - `apps/site/src/content/blog/how-to-export-twitter-bookmarks.md`
  - `apps/site/src/content/blog/pocket-alternatives-2026.md`
  - `apps/site/src/content/blog/search-twitter-bookmarks-before-export.md`
  - `apps/site/src/content/blog/twitter-x-bookmark-limit-explained.md`
  - `apps/site/src/content/blog/what-gets-exported-twitter-bookmarks.md`
- [x] Use unique CTA copy per post instead of a generic repeated box.
- [x] Add UTM parameters to inline blog CTAs: `utm_source=blog&utm_medium=inline_cta&utm_campaign=[slug]`.
- [x] Add or schedule the new `twitter saver` article: `Twitter Saver: What Saving Actually Does`.
- [x] Add or schedule the new `Where Are My Bookmarks on X` article.
- [x] Add structured Q&A sections to new and refreshed SEO posts so AI search tools can extract concise answers.

### Chrome Web Store Listing

Repo status: resubmission-safe listing copy/assets are ready for the dashboard; public Chrome Web Store submission remains in `P0 - After Release`.

- [x] Rename the listing to `Totem - Twitter / X Bookmarks`.
- [x] Keep Totem visible in the listing title, publisher name, icon, screenshots, and product UI.
- [x] Update short description to match the manifest description.
- [x] Update long description so the first sentence explains the new-tab surface.
- [x] Remove the rejected keyword list and standalone SEO phrases from the long description.
- [x] Avoid `twitter saver`, `tweet saver`, `bookmark manager`, `pocket alternative`, `instapaper alternative`, and similar phrases as standalone metadata.
- [x] Keep `Twitter` first and `X` secondary in listing copy.
- [x] Avoid emoji, keyword blocks, repeated keyword phrases, and unsupported claims.
- [x] Add a concise permission explainer to the listing or support page: `x.com access is used only to sync bookmarks from your active X session.`
- [x] Re-check CWS privacy data categories against actual local-only behavior.
- [x] Confirm the CWS dashboard privacy policy URL is filled.

### Store Assets

- [x] Use exactly 5 Chrome Web Store screenshots in this order.
  - New tab: `Twitter bookmarks on every new tab`
  - Reader: `Read Twitter threads without the feed`
  - Search: `Search saved posts, authors, links, and threads`
  - Export: `Export Twitter bookmarks to Markdown, CSV, or Notion`
  - Privacy: `Local-first. No Totem account. No server.`
- [x] Update the hero screenshot text to say `Twitter bookmarks on every new tab`.
- [x] Update promo tile copy to `Read, search, and export Twitter bookmarks.`
- [ ] Prepare a short GIF/video for r/SideProject and Show HN showing bookmarks appearing on the new tab.

### Release Validation

- [x] Confirm the extension name is under Chrome's 75-character limit.
- [x] Build the extension package.
  - Created `release/totem-v1.2.1.zip` with `pnpm package:extension`.
- [ ] Test install/update flow locally.
- [x] Test first-launch onboarding.
  - Covered install hook with `src/service-worker/__tests__/release-foundation.test.ts`.
  - Covered rendered setup/permission/privacy copy with `src/components/__tests__/growth-ui.test.tsx`.
- [x] Test review prompt trigger, dismiss, and persistence.
  - Covered with `src/lib/__tests__/growth-state.test.ts`.
  - Covered rendered CWS review URL/copy with `src/components/__tests__/growth-ui.test.tsx`.
- [x] Test day-3 re-engagement nudge copy.
  - Covered state trigger with `src/lib/__tests__/growth-state.test.ts`.
  - Covered rendered singular/plural copy with `src/components/__tests__/growth-ui.test.tsx`.
- [ ] Test sync interruption state.
- [x] Test uninstall URL.
  - Covered with `src/service-worker/__tests__/release-foundation.test.ts`.
- [x] Build the website.
  - Created `release/totem-website-v1.2.1.zip` with `pnpm package:website`.
- [x] Verify homepage JSON-LD.
- [x] Verify blog CTA links and UTM values.
- [ ] Check desktop and mobile website screenshots before deploy.
  - Manual runbook: `docs/phase-2-release-qa.md`.

## P0 - After Release

- [ ] Deploy the website update.
  - Deployable artifact: `release/totem-website-v1.2.1.zip`.
  - Verify `/uninstall-feedback/` is public before shipping the extension uninstall URL.
  - Verify both new Phase 2 article URLs are public.
- [ ] Submit the Chrome Web Store listing update.
- [ ] Submit for Featured badge after listing, screenshots, privacy page, and onboarding are aligned.
  - Request copy prepared in `plans/phase-2-release-foundation-outreach.md`.
- [ ] Email bookmarksave.com for inclusion in their Twitter bookmark manager listicle.
  - Email draft prepared in `plans/phase-2-release-foundation-outreach.md`.
- [ ] Post Show HN after Actions 1-3 are live.
  - Draft prepared in `plans/phase-2-release-foundation-outreach.md`.
  - Lead with the passive GraphQL interception/local-first architecture angle.
  - Post Tue/Wed, 9-11am Eastern.
  - Reply to comments for 3 hours.
- [ ] Post r/SideProject founder story after the listing is live.
  - Draft prepared in `plans/phase-2-release-foundation-outreach.md`.
  - Lead with: `I saved 200 tweets and read 3. So I built this.`
  - Put the CWS link at the end.
- [ ] Start r/productivity helpful comments with no cold promotion.
- [ ] Add Totem to AlternativeTo under Pocket, Instapaper, Dewey, Readwise, and Export Twitter Bookmarks alternatives.

## P1 - Next 90 Days

- [ ] Ship omnibox integration: type `t [query]` in the Chrome address bar to search saved Twitter bookmarks.
- [ ] Ship side panel variant with `chrome.sidePanel` for Chrome 114+.
- [ ] Ship reading stats: saved, read, exported, and optional share text.
- [ ] Publish `10 Best New Tab Chrome Extensions 2026`.
- [ ] Publish `What to Put on Your Chrome New Tab Page`.
- [ ] Publish `Chrome's Built-In Reading List - Why Nobody Uses It`.
- [ ] Publish `Best Twitter Bookmark Managers 2026 - Honest Comparison`.
- [ ] Build `/vs/dewey`.
- [ ] Plan `/vs/twillot` and `/vs/xbookmarks`.
- [ ] Post technical Twitter/X thread about the GraphQL interception architecture.
- [ ] Post the Obsidian/PKM workflow after Markdown export positioning is ready.
- [ ] Launch Product Hunt only after Featured badge submitted, onboarding live, and at least 20 reviews.

## P2 - Later Backlog

- [ ] Add opt-in `Made with Totem` attribution on exports.
- [ ] Add Firefox extension support.
- [ ] Add Edge extension support.
- [ ] Add shareable reading snapshots at `/snap/[slug]`.
- [ ] Localize the CWS listing first, then the UI.
  - Hindi
  - Spanish
  - Portuguese
  - Japanese
  - Korean
  - German
  - French
  - Indonesian
- [ ] Add Obsidian export preset or plugin integration.
- [ ] Add Readwise export compatibility.
- [ ] Add subtle reading streak counter.
- [ ] Create a YouTube video for the architecture story.
- [ ] Create a YouTube video for the user workflow.
- [ ] Create a YouTube video for exporting Twitter bookmarks to Obsidian.
- [ ] Pitch privacy/dev/productivity newsletters.
- [ ] Apply for CWS Editor's Pick after Featured badge and 4.5+ star rating.
- [ ] Open-source an export spec for developer credibility and backlinks.
- [ ] Add a referral program after 500 users.

## Recurring Growth Loops

- [ ] Iterate the CWS listing monthly.
  - Rotate the weakest screenshot.
  - Test one short-description variant.
- [ ] Interview 5 active users monthly.
- [ ] Mine 1-star and 3-star competitor reviews quarterly.
  - Export Twitter Bookmarks
  - Twillot
  - Tweet Copier
  - xBookmarks
- [ ] Track CWS reviews, review velocity, install rate, uninstall rate, Featured badge status, blog CTA clicks, and CWS backlinks.
