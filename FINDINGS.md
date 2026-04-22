# Totem — extension test findings (2026-04-22)

Observation-only session. Driven via Chrome DevTools Protocol (raw WS) against a dedicated user-data-dir Chrome (`--remote-debugging-port=9222`, user_id `1343429897218211840`, 339 bookmarks pre-test). **No fixes applied.**

## Summary of what works

| Feature | Status | Notes |
|---|---|---|
| Home render | ✅ | wallpaper, clock, search, recommendation, keyboard shortcuts |
| Search engine switcher | ✅ | persists in `chrome.storage.sync.totem_settings` |
| Keyboard shortcuts (L, S, Space) | ✅ | all fire as expected |
| Refresh rotates recommendation | ✅ | 3 reloads → 3 different picks |
| Sync — happy path | ✅ | completes in ~1s for incremental |
| Sync cooldown toast | ✅ | `"You can sync again in 14m 50s."` |
| Sync in-flight toast | ✅ | `"Sync is in progress. Try again in 1m 30s."` |
| Reader — Mark read ↔ unread | ✅ | 4 toggles, stable |
| Reader — Prev/Next chain | ✅ | anchor chain coherent |
| Reader — Shuffle related | ✅ | each click, new set of 3 |
| Reader — Theme toggle | ✅ | light ↔ dark flips reliably |
| Reader — Export menu | ✅ | `Copy Markdown` / `Download Markdown` / `Print / Save as PDF` |
| Settings — theme pill group | ✅ | Auto/Light/Dark, sets `data-theme` |
| Settings — switches | ✅ | persist to `totem_settings` |

## ❗ Load-bearing issues found (ordered by blast radius)

### 1. Reset is silently incomplete when any extension page is open — ✅ RESOLVED

Fixed by adding a `CS_RESET_EPOCH` broadcast. `reset.ts` writes the epoch first; the SW (`service-worker/index.ts`) and every page's `RuntimeProvider` drop their IDB handle on change; `handleResetSwState` (sync.ts:628) also calls `closeDb()` before acking. Reset waits 400 ms for listeners to drain, then `deleteDatabase` runs unblocked. Verified: on-disk `000003.log` (2.7 MB, 339 bookmarks) was replaced by fresh `000008.ldb`/`000009.log` after reset with a second reader tab open.

_Original finding below._



`src/lib/reset.ts:86` hard-codes `RESET_DB_DELETE_TIMEOUT_MS = 3000`. `deleteDatabaseWithTimeout` wires an `onblocked` handler that is **intentionally a no-op** — "Another tab may still hold the DB open; rely on the timeout fallback." (reset.ts:105–107).

**Observed:** clicked "Reset local data" with a newtab + reader tab open. Result:
- `chrome.storage.local`: 15 → 12 keys (preserved: auth_state, user_id, features, graphql_catalog, runtime_state_v2, account_context_id, db_cleanup_at, auth_diagnostics). Removed: `totem_last_sync`, `totem_sync_orchestrator_state`, `totem_last_light_sync`.
- `chrome.storage.sync`: 2 → 0 keys ✅ (`totem_settings`, `totem_theme` both cleared)
- IDBs: both `totem` and `totem_acct_…` **remained** on disk, with all 339 old bookmarks.

**Why it hurts:** User thinks they wiped their data; the database is still there. On the next sync the orchestrator and the DB disagree about what's been seen. The app behaves as if it starts fresh, but old records can resurface and state diverges.

**Architectural root:** reset uses one-shot `deleteDatabase` and falls back to an (already guaranteed) stale timeout. The SW itself holds a long-lived `idb` connection (no `closeDb()` equivalent sent to it via the `RESET_SW_STATE` message path — only runtime-side `closeDb()` is invoked). Until the SW releases its connection, every other holder blocks the delete.

**Fix surface (not applied):** make `RESET_SW_STATE` force-close the SW's DB handle before ack; fail loudly to the UI if `onblocked` fires instead of silently proceeding.

---

### 2. Post-reset sync picks `incremental` when user expects `full` — ✅ RESOLVED

Fixed at `service-worker/sync.ts:408`: the `needsFullSync` derivation now OR's `localCount <= 0` into the check. An empty DB + non-zero `lastFullSyncAt` (the post-reset shape) now flows into the `manual_seed` / `bootstrap_empty` path and fetches the whole account. Verified live: forced state `lastFullSyncAt=now-60s`, called `REQUEST_SYNC` with `localCount:0` → got `mode: full, reason: manual_seed`. Pre-fix this returned `incremental`. New test: `src/service-worker/__tests__/sync.test.ts` "forces full mode for manual sync when localCount is zero even after a prior full sync".

_Original finding below._



Sequence observed:
1. Reset wipes orchestrator state → `lastFullSyncAt: 0` ✅
2. Page reload → `maybeStartAutomaticSync` fires
3. On the **first** auto-sync, orchestrator grants `mode: "full", reason: "bootstrap_empty"` ✅
4. That completes at `lastFullSyncAt = T1` (but see §3 for whether it actually wrote).
5. User presses the big "Sync bookmarks" button in the empty state.
6. Orchestrator at `service-worker/sync.ts:408` reads `needsFullSync = lastFullSyncAt <= 0` → false → `mode: "incremental"`.

So the UX-level "Sync" after a reset does not re-seed; it asks for bookmarks *since T1*. If the intervening full-sync was wedged (§3), the incremental has nothing to fetch. User sees "synced" but empty list.

**Architectural root:** the "is this account seeded?" signal lives only in orchestrator state (`lastFullSyncAt`). The runtime UI never checks whether the DB actually contains bookmarks. Orchestrator state and DB state can diverge and there's no reconciliation on boot.

---

### 3. Mid-sync refresh: inconsistent state, silent drop, 4-hour lockout — ✅ RESOLVED

Fixed at `service-worker/sync.ts` (else branch of mode decision): the `fresh_cache` gate now requires `lastCompletedStatus === "success"`. A mid-sync reload sets `lastCompletedStatus: "skipped"` (unchanged behavior), but subsequent auto-syncs now fall through to `auto_backoff` (5 min) instead of being held in `fresh_cache` for 4 h. Live-verified: with `lastCompletedStatus: "skipped"` + `lastSuccessAt` 30 min ago, `REQUEST_SYNC trigger=auto` returns `mode: incremental, reason: background_stale` (pre-fix returned `blocked/fresh_cache`). New test: `src/service-worker/__tests__/sync.test.ts` "bypasses fresh_cache on auto sync when last completion was a skip".

Pre-existing worktree changes (`SYNC_ORCHESTRATOR_SEED_BACKOFF_MS=30s`, `SYNC_ORCHESTRATOR_AUTO_RECLAIM_MS=90s`) also attack the lockout by shortening seed backoff and reclaiming orphaned leases — both landed in the previous commit.

_Original finding below._



Reproducer: full sync running → user reloads newtab.

Observed state *after* reload:
```
lastCompletedStatus: "skipped"
lastIncrementalSyncAt: 0       // never advanced
lastFullSyncAt: <earlier>      // unchanged
lastSuccessAt = lastFullSyncAt
lastDecisionReason: "fresh_cache"
```

Consequence — any subsequent **auto** sync is blocked by `fresh_cache` for the `SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000` (4 hours) window (`sync.ts:34` + `sync.ts:427–430`). The user's data is gone/partial, the system says "fresh", no auto re-fetch happens for 4 hours.

**Architectural root:**
- "skipped" is a terminal success-shaped state. Reload → SW lease expires → orchestrator writes completion without distinguishing "interrupted by client" from "nothing to do."
- The 4-hour cache window is derived from `lastSuccessAt`, which is overwritten even when no new data was fetched. So a half-finished sync sets a 4-hour block.

**Fix surface (not applied):**
- Interrupted leases should complete with `lastCompletedStatus: "interrupted"` and NOT update `lastSuccessAt` / `lastFullSyncAt`.
- `fresh_cache` should gate on *both* a recent success **and** non-empty local state.

---

### 4. Sync completes successfully but IDB is never populated — ❌ WITHDRAWN (CDP artifact)

This was not a real bug. The "can't read IDB after sync" symptom traced to a CDP-held phantom target (`type: "other"` at `reader.html?read=…`) that persisted across tab close and blocked `indexedDB.open()` from my test harness. Once the phantom was navigated to `about:blank`, the IDB opened in 1 ms and contained 339 bookmarks. The SW write path works. Production users don't have debugger-held phantom targets, so this doesn't reproduce outside a CDP session.

_Original finding below (kept for the diagnostic trail)._



Most alarming observation. After a manual post-reset full sync:

- `totem_last_sync = <new>` ✅
- `totem_auth_state_reason = "bookmarks_ok"` ✅
- `lastFullSyncAt = <new>` ✅
- Runtime V2: `pendingBookmarkEventCount: 0`, `capability.bookmarksApi: "ready"`
- UI: `0 bookmark links`, "Your reading list is quiet" empty state
- On disk: `chrome-extension_<id>_0.indexeddb.leveldb/000003.log` size unchanged since the original pre-reset sync (`09:30` per `ls -la`)

So the API call succeeded (SW says so) but no rows landed in the DB. Meanwhile every external connection attempt I made to the IDB via `indexedDB.open()` timed out at 3–5 seconds (blocked, not errored).

**Hypothesis:** the SW holds a long-lived IDB connection that becomes inconsistent after reset (version change pending, transaction open, etc.), so the post-reset sync's write transactions queue behind it and never commit.

**Evidence for the hypothesis:**
- `idb` (the library) is typically used with a cached connection. grep showed the SW uses the same `db/index.ts` module as the runtime.
- `closeDb()` is called *on the runtime side* during reset (reset.ts:134) but the `RESET_SW_STATE` message path in the SW is presumed symmetric — **not verified**, worth auditing `service-worker/sync.ts` / `service-worker/index.ts` for `closeDb()`.
- Tests in `runtime-store.test.ts:211` cover the "still reads IDB on boot after a reset so cached bookmarks resurface when the user is logged out" case — which is an *intentional* feature relying on the IDB surviving reset. So the codebase assumes the IDB persists across reset by design; but the orchestrator is wiped. The two assumptions conflict.

---

### 5. Continuous `[TOTEM-DIAG] sync.reserve blocked` log (the spinner-always-on signal)

Observed: ~6 `sync.reserve blocked` messages in a 10-second window, equivalent to one every 1.5–2s.

Trace:
- Every page that boots calls `maybeStartAutomaticSync` (`runtime-store.ts:510`).
- With `fresh_cache` as the block reason, `sync.ts:430` returns blocked with `retryAfterMs = lastSuccessAt + 4h - now`.
- **That's still a positive number**, so runtime `scheduleAutoRetry(retryAfterMs)` is called (`runtime-store.ts:763–765`), but `retryAfterMs ≈ 4h` → timer fires in 4h, not immediately.

So the `sync.reserve blocked` cadence can't come from auto-retry scheduling. It must come from:
- **Multiple pages** (newtab + reader tabs) each calling `maybeStartAutomaticSync` on mount. Observed 4+ extension pages during testing.
- **Focus / visibility / auth-event triggers** re-firing `maybeStartAutomaticSync` on state transitions (1030+ in runtime-store.ts has a call).

**Why the spinner never stops:** the UI's sync affordance (top-right icon) reflects the runtime's `syncStatus`. Not inspected directly, but likely the state machine starts in some "checking" state and the rapid, overlapping block events keep UI transient markers alive.

**Architectural root:** `maybeStartAutomaticSync` is idempotent-ish (guards on `syncStatus !== "syncing"`) but not debounced. It freely fires on every hydration event from any subscriber, and the orchestrator logs aggressively even when the answer is "no." The log asymmetry — `blocked` always logs, `allow` also logs, there's no "silent no-op" — means diagnostics proliferate whenever policy says no.

---

### 6. Unverified (no way to test in current state — write up code-derived answers)

Due to issue #4 (UI shows no bookmarks, IDB reads blocked), I couldn't empirically exercise the three remaining questions. Code review answers:

**Q: Does reading count increase when you open a bookmark?**
Code: `App.tsx:542` calls `ensureReadingProgressExists(readTweetId)` on mount of the reader route when a bookmark is opened. This writes a `reading_progress` row with `completed: false`. The "Continue reading" tab counts these rows. So **opening → +1 in Continue tab**, even if user never scrolls. That may or may not be desired UX (pressing Back immediately still counts as "started reading").

**Q: Does reading count increase on Mark Read?**
Code: `App.tsx:663` wires `markReadingProgressCompleted` to the Mark Read button → flips `reading_progress.completed = true`. The "Read" tab counts completed rows. **Yes**, moves from Continue → Read.

**Q: Is state update happening properly?**
Verified in test: Mark Read toggles the button label reliably (`Read` ↔ `Mark read` on 4 successive clicks). But I couldn't verify the newtab counters update **live** while the reader is open (would require a store subscription / cross-tab sync via chrome.storage events — `useSettings.ts:109` does it for settings; didn't grep reading_progress path).

**Q: Does Unbookmark actually remove from Twitter?**
Code: `App.tsx:595` calls `actions.unbookmark(tweetId)` which routes through runtime → SW. The SW has access to the X session via its auth headers (`totem_auth_headers` in chrome.storage.local, 8 keys visible). `declarativeNetRequest` rules rewrite requests to bypass CORS. `App.tsx:602` handles the `apiError` case by toasting *"Removed locally. Unbookmark it on X to fully remove."* — so **there is a documented failure mode** where local-only removal succeeds and X-side fails. Whether X-side succeeds needs an actual call + verification against `https://x.com/i/bookmarks`. Not run.

## Architectural observations (no fixes)

1. **State ownership is split between SW (orchestrator) and runtime (IDB via hooks)**, and they don't reconcile on boot. Issues #2 and #4 both trace back to this: "did we actually seed this account?" is answered by the orchestrator clock, not by the DB contents.

2. **Reset is a partial teardown with too many preserved items.** Auth, user_id, account_context_id, features, graphql_catalog, runtime_state_v2, db_cleanup_at — all survive reset. That's intentional (don't re-prompt login) but means the app boots into a hybrid state: "I know who I am, I know my quota, but I have no orchestrator history." This is the exact soil for issues #2, #3, #4.

3. **IDB connection lifecycle is implicit.** The `db/index.ts` module is imported by both SW and runtime. Neither side has a clear contract on "who holds the connection when." Reset closes the runtime's handle (`closeDb()`) but the SW's is assumed but not proven to close. When the SW is dormant → woken → sync → tries to write, it re-opens; reset already ran; whatever connection state it had is stale.

4. **Observability imbalance:** `[TOTEM-DIAG] sync.reserve blocked` fires on every policy-deny, but nothing logs the **read path** of the runtime loading bookmarks from IDB. When a sync completes but nothing reaches the UI, there's no breadcrumb showing whether the IDB write succeeded or whether the runtime read it back. This is why "sync succeeded + UI empty" is observable-invisible from the SW console.

5. **`scheduleAutoRetry` has a 1s floor** (`runtime-store.ts:489`: `Math.max(1_000, delayMs + 500)`) that clamps short delays up, but no **ceiling** for pathological long ones (e.g., 4h `fresh_cache`). The timer is technically correct, but combined with multi-page fan-out (§5) it produces a lot of pending timers.

## What to look at first (suggested reading order, no code changes)

1. `src/service-worker/sync.ts:253` (`handleSyncPolicyReserve`) — the heart of the policy machine. Look specifically at the invariant `lastSuccessAt is advanced only on real data fetch`.
2. `src/service-worker/sync.ts:474` (`handleSyncPolicyComplete`) — confirm what happens when status = "skipped" vs "success" vs "failure".
3. `src/lib/reset.ts` — in particular the `RESET_SW_STATE` message handler on the SW side (not shown; grep `RESET_SW_STATE` in `service-worker/`).
4. `src/db/index.ts` — the shared IDB module. Find `openDb` / `getDb` / `closeDb`; determine whether SW ever closes.
5. `src/stores/runtime-store.ts:510` (`maybeStartAutomaticSync`) — trace every caller; see if a debounce would be defensible.

## Appendix — session artifacts

- Screenshots: `/tmp/totem-test/*.png` (newtab, reader, settings, post-reset, interrupt, error states)
- SW logs snapshot: `/tmp/sw-logs-10s.json`, `/tmp/sw-logs-detailed.json`
- CDP driver: `/tmp/cdp.mjs`
- Debug Chrome: PID 17773, user-data-dir `~/.cache/chrome-mcp-user`, port 9222

