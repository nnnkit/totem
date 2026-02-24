# PRD: Offline-First Bookmarks

## Problem

When a user logs out of x.com (or their session expires), the extension breaks:

1. Home screen shows all bookmarks, but clicking any unfetched one triggers a TweetDetail API call
2. API call fails (no auth) → user is thrown to a login screen
3. All previously visible content disappears — reading progress, highlights, everything feels lost

The extension should feel like a local reading app that happens to sync with X, not a thin client that collapses without auth.

## Current State

- **Bookmarks list**: Fully cached in IndexedDB after sync. Survives logout.
- **Tweet details**: Only fetched on-demand when user clicks a bookmark. Cached 6h TTL, 30-day retention.
- **Auth detection**: Extension knows when user is logged out (`CHECK_AUTH` returns `hasAuth: false`).
- **Fetch queue**: Already has human-like delays (1.2s base + 1.3s jitter, random pauses).

The gap: most bookmarks only have metadata (text excerpt, author, metrics). Full thread/content is only fetched when you tap in. If auth is gone, those bookmarks are unreachable.

## Goal

Make the extension resilient to auth loss. A logged-out user should still browse and read the top 15 most recent bookmarks whose details have been prefetched.

## Design Constraint

**Max prefetch cap: 15 bookmarks** (stored as `OFFLINE_PREFETCH_MAX` in `src/lib/constants/ui.ts`). Only the 15 most recently bookmarked items get background-prefetched. This keeps storage low, avoids rate limit risk, and is enough to give a meaningful offline reading experience.

---

## Solution Overview

### 1. Background Detail Prefetcher

A scheduler that incrementally fetches tweet details for the top 15 bookmarks (by recency) that don't have cached details. Runs in the background while the user is authenticated.

**Behavior:**
- Starts after initial bookmark sync completes
- Picks up to 15 bookmarks that have no `tweet_details` entry, sorted by `sortIndex` desc (most recent first)
- Fetches one by one using the existing fetch queue
- Conservative timing: ~30-60s between fetches with jitter
- Pauses when user is actively reading (don't compete for API quota)
- Stops immediately on auth loss
- Resumes on next auth-ready state

**Scheduling strategy:**
- Base interval: 30-60 seconds between fetches
- Jitter: +0-30 seconds random
- Batch size: 1 at a time
- Cool-down: After every 5 fetches, pause for 2-3 minutes
- Session cap: 15 (the constant `OFFLINE_PREFETCH_MAX`)
- Priority: Most recently bookmarked first

### 2. Graceful Logged-Out Mode

When auth is lost, instead of showing a login wall, the extension degrades gracefully.

**Home screen:**
- Recommendation card only picks from bookmarks with cached details
- If none available: show a "Log in to start reading" card

**Bookmark list:**
- All bookmarks remain visible
- Bookmarks with cached details: fully tappable, open normally
- Bookmarks without cached details: visually dimmed, tappable but show limited metadata-only view
- Available bookmarks sorted to the top

**Reader:**
- Cached detail: render normally
- No cached detail: show bookmark metadata (text, author, metrics) with "Full thread not available offline. Log in to load."

### 3. Logged-Out Banner

A subtle, non-blocking info strip shown when auth is lost and user has local bookmarks:

> "You're browsing offline. Only your 15 most recent bookmarks are fully available. [Log in] for full access."

- Placed between nav and content
- Dismissable but reappears next session
- Not shown if user has no local bookmarks (show login screen instead)

### 4. Auth Loss Handling

**On logout detected:**
1. Stop the background prefetcher
2. Switch recommendation source to cached-only
3. Show logged-out banner
4. Keep all local data intact
5. Do NOT navigate to login screen (unless zero local bookmarks)

**On login restored:**
1. Resume prefetcher
2. Remove banner
3. Resume on-demand fetching
4. Trigger soft sync

---

## Research & Open Questions

### Rate Limiting

- What are X's actual rate limits for TweetDetail? 15 fetches at 30-60s intervals = ~8-15 minutes total. Low risk, but need to confirm.
- Does X fingerprint sustained background request patterns?
- What happens on 429? Exponential backoff? Auth invalidation?

### UX Decisions

- **Banner placement**: Below nav? Inside recommendation area? As a floating toast?
- **Dimmed bookmark styling**: Reduced opacity? Lock icon? "Offline unavailable" badge?
- **Show prefetch progress?** "5 of 15 available offline" — useful or noise?
- **Media**: Only prefetch text/thread structure? Or also cache images?

### Edge Cases

- Auth expires mid-prefetch: stop gracefully, resume later
- Tweet deleted between bookmark and prefetch: skip, mark unfetchable
- Multiple tabs: only one should run prefetcher (use storage lock)
- Storage pressure: request `navigator.storage.persist()` to prevent eviction

---

## Task Breakdown

### Phase 0: Foundation

- [ ] **T0**: Add `OFFLINE_PREFETCH_MAX = 15` constant to `src/lib/constants/ui.ts`

### Phase 1: Background Prefetcher

- [ ] **T1**: Create `PrefetchScheduler` module
  - State machine: `idle` → `running` → `paused` → `stopped`
  - Configurable interval, jitter, cool-down
  - Uses existing fetch queue for actual API calls
  - Respects `OFFLINE_PREFETCH_MAX` cap

- [ ] **T2**: Add "needs prefetch" query to DB layer
  - Query: top 15 bookmarks (by `sortIndex` desc) that have no `tweet_details` entry
  - Efficient: use index, return only `tweetId` list

- [ ] **T3**: Wire prefetcher to auth + sync lifecycle
  - Start when: auth `ready` AND initial sync done
  - Stop on: auth loss
  - Pause when: user opens BookmarkReader
  - Resume when: user returns to list/home

- [ ] **T4**: Error handling and backoff
  - 429 / network error: exponential backoff (2min, 5min, 15min)
  - Auth error: stop prefetcher, signal auth loss
  - Individual tweet error (deleted, etc.): skip it

### Phase 2: Graceful Logged-Out Mode

- [ ] **T5**: Add `hasDetail` flag to bookmark data
  - Efficient join: check `tweet_details` store for each bookmark
  - Expose via `useBookmarks` hook

- [ ] **T6**: Modify home recommendation to use cached-only when logged out
  - Only pick from `hasDetail === true` bookmarks
  - Fallback card if none available

- [ ] **T7**: Update bookmark list for logged-out state
  - Dim bookmarks without details
  - Sort available-first
  - Keep all visible

- [ ] **T8**: Add logged-out banner component
  - Shows when: auth lost + has local bookmarks
  - Contains: message + login CTA
  - Dismissable

- [ ] **T9**: Modify reader for missing details
  - Show metadata-only layout when detail not cached
  - "Log in to load full thread" message

- [ ] **T10**: Prevent login wall on auth loss
  - If local bookmarks exist: stay on current view, show banner
  - Only show login screen for true first-time users (no local data)

### Phase 3: Polish

- [ ] **T11**: Extend detail retention for prefetched content
  - Remove 6h TTL for offline reading (stale is better than nothing)
  - Only re-fetch if user manually refreshes AND is logged in

- [ ] **T12**: Request `navigator.storage.persist()` on first sync
  - Prevent Chrome from evicting IndexedDB

- [ ] **T13**: Dedup prefetch across tabs
  - `chrome.storage.local` lock with timestamp
  - Stale lock detection (>10 min = take over)

### Phase 4: Future (out of scope for v1)

- [ ] Media prefetching (images only)
- [ ] `chrome.alarms` background prefetch when popup is closed
- [ ] Manual "save offline" button per bookmark
- [ ] Raise cap beyond 15 based on rate limit findings
