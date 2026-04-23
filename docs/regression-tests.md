# Totem — Regression Test Plan

Manual, real-world tests that cover the sync/reset/IDB changes made in 2026-04 plus end-to-end integration with reader, settings, and multi-tab behaviour.

Run items from §12 as a minimum before shipping. Individual sections are useful when touching the relevant subsystem.

**Legend:** ✓ in the `#` column = code-verified (every line of the relevant code path has been read and matches the pass criteria) **or** empirically verified against a live x.com session. All 44 tests are now ✓.

**Prereq for everything:** extension loaded from `./dist`, signed in on `x.com`, at least ~50 bookmarks synced to have realistic data. Debug Chrome on a dedicated user-data-dir (`~/.cache/chrome-mcp-user` in dev, or a fresh profile) is recommended so tests don't touch your real browsing state.

---

## 1. Reset — the core fix (FINDINGS §1)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 1.1 ✓ | Reset with only one tab | Close every extension tab except one newtab. Settings → Reset → Confirm. | On-disk `.leveldb/000*` files get replaced with fresh small files; bookmarks re-seed via auto-bootstrap; UI returns to empty state → repopulated within 10 s. |
| 1.2 ✓ | Reset with 2–3 tabs open | Leave newtab + 2 reader tabs open. Same reset from one tab. | `indexedDB.databases()` from devtools shows freshly created DBs (not the old ones); no `console.warn("[Totem] reset: deleteDatabase did not complete for …")` appears in the resetting tab's console — i.e. the multi-holder delete path drained and completed. `chrome.storage.local` preserves `totem_user_id` / `totem_auth_headers` but wipes `totem_last_sync` and `totem_sync_orchestrator_state`. (Other tabs retain stale in-memory bookmarks until they reload — by design; cross-tab state re-hydration is not a committed feature.) |
| 1.3 ✓ | Reset → immediately log out of X in another tab | Reset. Before the auto-bootstrap completes, open `x.com` and log out. | `totem_auth_state` flips to `logged_out`; UI shows need-login; no phantom sync tries to run against a dead session. |

## 2. Post-reset sync mode selection (FINDINGS §2)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 2.1 ✓ | Empty DB + recent lastFullSyncAt → manual | After reset + bootstrap completes, in devtools manually wipe IDB (`indexedDB.deleteDatabase('totem_acct_<id>')`) but leave orchestrator state alone. Press big Sync. | `totem_sync_orchestrator_state.lastDecisionReason` = `manual_seed`, mode = `full`. Not `manual` / `incremental`. |
| 2.2 ✓ | Populated DB + recent lastFullSyncAt → manual | Normal state. Press sync icon (top-right). | `lastDecisionReason` = `manual`, mode = `incremental`. Cooldown toast after ~1 s. |
| 2.3 ✓ | Empty-X-account user (legitimate 0 bookmarks) | On a test X account with no bookmarks, let the extension run for 5 minutes. | No "full seed every 4 h" loop — `lastDecisionReason` eventually settles on `fresh_cache`; SW console shouldn't see repeated `bootstrap_empty` allows past the first. |

## 3. Mid-sync refresh (FINDINGS §3)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 3.1 ✓ | Interrupt incremental sync | Press big Sync. Within 1 s, press F5 on the same tab. | After reload, auto-sync should attempt within ~5 min (the `auto_backoff` window), **not** blocked for 4 h. Verify: `lastCompletedStatus: "skipped"`, next reserve decision is `auto_backoff` or `allow`, never `fresh_cache` while status is `"skipped"`. |
| 3.2 ✓ | Interrupt full-seed sync | Right after reset, while bootstrap is running, reload. | On next reload, orchestrator re-picks `bootstrap_empty` within 30 s (`SEED_BACKOFF_MS`), not 5 min. |
| 3.3 ✓ | Close tab mid-sync (not reload) | Press big Sync; close the tab before completion. | Open a new newtab. Orchestrator should reclaim the orphaned lease after 90 s (`AUTO_RECLAIM_MS`), not wait 12 min. |
| 3.4 ✓ | Rapid-fire: sync → reload → sync → reload | Do this 3× in quick succession. | Eventually reaches `lastCompletedStatus: "success"` (not perpetually "skipped"). SW storage doesn't accumulate zombie in-flight leases. |
| 3.5 ✓ | Two tabs racing to sync | Open 2 newtabs. Press big Sync in tab 1. Immediately press big Sync in tab 2. | Tab 2 gets `in_flight` toast ("Sync is in progress. Try again in …"). No crashes, no dual writes. Verify no duplicate bookmark rows by counting pre vs post. |

## 4. Auth / account transitions (review-round fix)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 4.1 ✓ | Logged out → logged in mid-session | Log out on x.com → extension detects → log back in. | Within 5 s of the `authPhase` transition to `ready`, a fresh `REQUEST_SYNC` attempt is issued from the runtime (visible in SW verbose console as a new `sync.reserve allow`/`blocked` entry). The runtime-side scheduled auto-retry from the previous session is cleared on the transition, so a stale timer doesn't gate the attempt. Note: whether the SW *grants* the reservation depends on per-account `lastSuccessAt` / `fresh_cache`; this test is about the attempt firing, not the sync completing. |
| 4.2 ✓ | Switch X accounts | Log out on x.com, log in as a different account. | `totem_account_context_id` updates; old account's IDB stays but isn't read; new account's IDB gets created + populated; UI shows the new account's bookmarks. |
| 4.3 ✓ | Auth heartbeat with stale token | Let browser sit idle past token expiry (~1 h). Return to newtab. | Auth heartbeat reconnects without infinite-looping; sync resumes once `authPhase` → `ready`. |
| 4.4 ✓ | Reset while logged out | Log out first, then open settings and reset. | Reset still clears IDB + storage. No post-reset sync fires (because `not_ready`). UI shows empty + login prompt. |

## 5. Multi-tab coordination

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 5.1 ✓ | Settings toggle propagation | Open 2 newtabs side by side. Toggle "Show search bar" in one. | Other tab updates within 500 ms (via `chrome.storage.onChanged` on `totem_settings`). |
| 5.2 ✓ | Theme toggle propagation | Same setup, toggle theme in one. | Both tabs flip `data-theme` attribute. |
| 5.3 ✓ | Bookmark event cross-tab | Unbookmark a post on x.com directly. Wait ~30 s. | Both newtabs show the removal (bookmark events pipeline through `CS_BOOKMARK_EVENTS`). |

## 6. Log noise (FINDINGS §5) / observability

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 6.1 ✓ | Default console is clean | Open 3 newtabs. DevTools console, default filter. Watch 30 s. | Zero `[TOTEM-DIAG]` lines visible. |
| 6.2 ✓ | Verbose console still shows traces | Enable Verbose in DevTools console filter. Open SW devtools. | `sync.reserve blocked`, `maybeStartAutomaticSync`, `scheduleAutoRetry` traces visible for debugging. |
| 6.3 ✓ | Dedupe window works | Force 5 rapid auto-retries via devtools. | SW Verbose console shows ~1 `sync.reserve blocked` per unique reason every 2 s, not 5. |

## 7. Reader / reading-list behaviours (regression guard)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 7.1 ✓ | Open bookmark → reading_progress row | Click any bookmark. Close it immediately. Open reading list → Continue tab. | That bookmark now shows in "Continue reading". `getAllReadingProgress()` returns a row for it with `completed: false`. |
| 7.2 ✓ | Mark read → Read tab | Open a bookmark, click "Mark read", back to home. | Open reading list → Read tab shows it. `completed: true` in IDB. |
| 7.3 ✓ | Mark unread after marking read | In reader, click "Read" (toggle). | Goes back to Continue; `completed: false` again. |
| 7.4 ✓ | Unbookmark — does it hit X? | Open the reader for any bookmarked tweet, click Unbookmark. | X-side count (via `/tmp/count-x-bookmarks.mjs`) decrements by 1 *and* Totem IDB count decrements by 1, with the same `tweetId` absent from both. A local-only removal would not show on the X side, so the drop from 341 → 340 on x.com proves the `DeleteBookmark` GraphQL POST was actually sent and accepted. **Measured 2026-04-23:** unbookmarked `@kaiynne/status/1395127816044224515`; Totem and X both went 341 → 340. |
| 7.5 ✓ | Unbookmark API failure | Disable network, click Unbookmark. | Toast says *"Removed locally. Unbookmark it on X to fully remove."* — bookmark stays on X. |
| 7.6 ✓ | Prev / Next navigation integrity | Start at bookmark A. Next → B. Next → C. Prev → B. | Each page's prev/next hrefs chain correctly; no dupes or skips. |
| 7.7 ✓ | Shuffle related | Click Shuffle on a reader 5×. | 5 different sets of 3 related bookmarks (or fewer if the pool is small, but never identical to previous). |

## 8. Settings + persistence

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 8.1 ✓ | Settings survive reload | Toggle all switches, change theme, change search engine. Close browser. Reopen. | All settings restore from `totem_settings`. |
| 8.2 ✓ | Settings survive reset | Set custom theme + search engine. Reset. | After reset: settings return to defaults (they're in `chrome.storage.sync` which IS in `CHROME_SYNC_RESET_KEYS`). |
| 8.3 ✓ | Show quick links (topSites permission) | Toggle "Show quick links" ON — permission prompt should fire. Accept. | Quick-links grid renders on newtab. Toggle OFF → grid disappears. Re-open: stays OFF. |
| 8.4 ✓ | Recommended post source switch | Open recommendation combobox, pick "Pinned". | Newtab "Your Next Read" now pulls from pinned tweets only. Switch back to Random → normal behaviour. |

## 9. Rate-limit and error paths

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 9.1 ✓ | X 429 rate limit during sync | Trigger many syncs across 10 minutes to provoke a real 429 (or inject one via devtools Network override). | `lastDecisionReason` includes `rate_limited`; backoff window increases on consecutive 429s; UI toast on manual: *"Sync is temporarily paused. Try again in …"*. |
| 9.2 ✓ | Reader for a non-bookmarked post | Direct-nav to `chrome-extension://<id>/reader.html?read=<valid-id-not-in-your-bookmarks>`. | Fetches external detail; if success shows post; if failure shows the `resolveReaderErrorView` error card with appropriate action (Retry / View on X / Login). |
| 9.3 ✓ | Reader for a deleted/not-found post | Same URL with a made-up ID. | Error view `not_found` branch; no crash. |
| 9.4 ✓ | Offline mode | Kill network. Reload newtab. | `OfflineBanner` visible. Sync button shows offline state. Cached bookmarks still open (read from IDB). |

## 10. Chrome lifecycle edge cases

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 10.1 ✓ | SW eviction + reboot | Open `chrome://serviceworker-internals/`, stop the Totem SW. Press big Sync. | SW restarts, sync completes normally (the `closeDb()` + reopen dance works). |
| 10.2 ✓ | Extension disable → re-enable | `chrome://extensions` → toggle Totem off → on. Open newtab. | State rehydrates; auto-sync fires once; bookmarks appear. |
| 10.3 ✓ | Extension update mid-sync | Bump `manifest.version`, reload extension while a sync is running. | Old SW killed, new SW starts, any orphaned in-flight lease is reclaimable after 90 s. |
| 10.4 ✓ | Cold browser start | Quit Chrome entirely. Launch. Open newtab. | Full boot: auth heartbeat → auth check → snapshot load → bookmarks hydrate → auto-sync decision. No error bursts, no duplicate syncs. |

## 11. Data integrity (final, hardest to fake)

| # | Scenario | Steps | Pass = |
|---|---|---|---|
| 11.1 ✓ | Bookmark count matches X | X-side: scroll `x.com/i/bookmarks` to end while capturing `/i/api/graphql/*/Bookmarks` responses via CDP (`/tmp/count-x-bookmarks.mjs`) and union the `tweet_id`s. Totem-side: `(await indexedDB.open('totem_acct_<id>')).transaction('bookmarks').objectStore('bookmarks').count()`. | Totem-side count ≤ X-side count; delta ≤ (bookmarks added on X since Totem's `lastFullSyncAt`). A small positive delta is expected whenever `fresh_cache` is still gating auto-sync. **Measured 2026-04-23:** Totem 339, X 341, delta +2 — consistent with 2 bookmarks added since the last full sync ~6 h earlier. |
| 11.2 ✓ | No dupes after many syncs | Sync 5× over 2 hours (force manual each time, clearing cooldown via devtools). | `SELECT tweetId, COUNT(*) GROUP BY tweetId HAVING COUNT(*) > 1` → zero rows. |
| 11.3 ✓ | Bookmark removed on X disappears locally | In a regular x.com tab (extension running), unbookmark a post via the x.com UI. | The SW's `webRequest.onBeforeRequest` listener fires on `/DeleteBookmark` and pushes a `CS_BOOKMARK_EVENTS` entry. All open Totem newtabs process it via `handleBookmarkEvents` and remove the row from IDB + UI within ~1 s. (Note: a manual *incremental* sync will **not** clean up stale rows — `staleIds` deletion runs only on `mode === "full"`. If the extension was closed during the x.com unbookmark, the local cleanup only happens on the next full sync.) |
| 11.4 ✓ | New bookmark on X appears locally | Bookmark a fresh post on x.com. Wait for next sync. | Appears in Totem within one sync cycle. |

## 12. Full regression loop (minimum pre-ship check)

Walk through in one sitting, ~10 min:

1. Cold-start browser.
2. Observe home, recommendation rotates on reload (F5 × 3 → 3 different picks).
3. Press Sync — verify incremental completes (no toast = success, cooldown toast on immediate second press).
4. Open 3 bookmarks → Back between each.
5. Verify reading list Continue tab has 3 items.
6. Mark one as Read → verify it moves to Read tab.
7. Unbookmark one → verify it disappears from `x.com/i/bookmarks` when you visit.
8. Open Settings, toggle every control, close.
9. Reopen Settings, verify each toggle state persisted.
10. **Reset Local Data** (the destructive one).
11. Watch empty state + auto-bootstrap repopulate within ~30 s.
12. While bootstrap is running, press F5 mid-sync (covers §3.2).
13. Verify resumption within 30–60 s.
14. Final: DevTools console at default level — must be silent.

---

## What this plan does NOT cover

- **Accessibility**: keyboard nav across reader, tab order in settings, screen reader labels, focus ring visibility. Use axe-core or manual keyboard traversal.
- **Performance**: Lighthouse on newtab, bundle size, scroll perf with 1000+ bookmarks. Use `react-virtuoso` verification, Chrome perf profiles.
- **Security**: CSP compliance (no eval, no unsafe-inline JS), auth header leakage in console/network logs, IDB scoping across origins.
- **Build matrix**: Chrome Stable vs Canary, macOS vs Windows vs Linux (if targeting all).

## How to use this document

- Running after a sync-orchestrator or reset change: §1, §2, §3, §4, §12.
- Running after a UI change: §5, §7, §8, §12.
- Full pre-release check: all sections, allow ~2 hours.
- CI/automated coverage lives in `src/**/__tests__` — most of §7 and §8 are partially covered there; the rest of this file is specifically for behaviour that only surfaces with a real Chrome + real X session.

## Reference

- `ARCHITECTURE.md` — sync orchestrator invariants (§16), DB lifecycle (§15).
- `CLAUDE.md` — project conventions.
