# Sync Rethink: Findings, Gaps, and What to Actually Build

Last updated: 2026-03-03

This document captures a codebase-grounded analysis of the current sync system, what's working, what's broken, and what's worth building next. Written as a counterpoint to `prd-unified-sync-gateway.md`.

## 1) Current Architecture (What Exists Today)

### The gateway already exists

The service worker (`public/service-worker.js`, 2326 lines) is the sole API proxy. React never calls x.com directly. All communication goes through `chrome.runtime.sendMessage()`:

- `src/api/core/auth.ts` — `CHECK_AUTH`, `GET_RUNTIME_SNAPSHOT`, etc.
- `src/api/core/bookmarks.ts` — `FETCH_BOOKMARKS`, `DELETE_BOOKMARK`, events
- `src/api/core/posts.ts` — `FETCH_TWEET_DETAIL`
- `src/api/core/sync.ts` — `REQUEST_SYNC`, `COMPLETE_SYNC`

The SW handles these messages and makes `fetch()` calls to `https://x.com/i/api/graphql/...`. This IS the gateway. It doesn't need a new name or a new layer.

### Sync orchestrator is well-built

Implemented in `src/lib/sync-orchestrator.ts` (pure logic, 400 lines) and duplicated in `public/service-worker.js` (lines 200-837). Uses lease-based locking in `chrome.storage.local` under `totem_sync_orchestrator_state`.

Reserve/Complete pattern:
1. React calls `REQUEST_SYNC` -> SW evaluates policy -> returns `{allow, mode, leaseId}`
2. React runs the sync loop
3. React calls `COMPLETE_SYNC` to release the lease

Existing protections:
- One sync per account at a time (lease lock)
- Manual cooldown: 4 seconds (`SYNC_ORCHESTRATOR_MANUAL_COOLDOWN_MS`)
- Auto backoff: 5 minutes between attempts
- Auto interval: 4 hours between successes
- Lock TTL: 12 minutes (stale lease auto-expires)
- Manual reclaim: after 90 seconds, a manual trigger can override a stuck lease
- Cross-tab safety: orchestrator state in `chrome.storage.local` (shared)
- Runtime audit log: last 60 decisions persisted to `totem_runtime_audit`

### FetchQueue handles pacing

`src/lib/fetch-queue.ts`: serial queue (concurrency=1) with human-like delays between tasks:
- Base delay: 1200ms + random jitter 0-1300ms
- 15% chance of extra "reading pause": 1000-3000ms
- Abort support via `abort()` method

Constants defined in `src/lib/constants/timing.ts` (lines 35-39).

### Deduplication works at multiple levels

- Sync orchestrator `inFlight` lease prevents concurrent syncs
- `SyncMachineState.syncing` boolean prevents re-entry in React state machine
- `activeSyncRef` tracks active controller, aborts on account switch
- `autoSyncAttemptRef` prevents re-triggering auto-sync on re-render
- Bookmark event dedup: 1-second window in SW (`pushBookmarkEvent`, line 1340)
- User-facing feedback: toast messages when sync is blocked ("already running", "wait a few seconds")

### Auto-sync is conservative by default

- Disabled by default (`DEFAULT_SYNC_AUTO_ENABLED = false`, `useBookmarks.ts:67`)
- When enabled: incremental mode (not full), 4-hour minimum interval
- Only triggers on new tab open, not in background
- No alarm-based periodic sync

## 2) What's Actually Broken

### Gap 1: No 429/rate-limit handling

This is the most dangerous gap.

**Current behavior:** A 429 response in `handleFetchBookmarks()` (SW line ~1780) throws `Error("API_ERROR_429: <body>")`. This propagates through:
1. SW message handler catches it, sends `{ error: err.message }` to React
2. `src/api/core/bookmarks.ts:58` throws the error
3. `FetchQueue` rejects the task, error escapes `reconcileBookmarks`
4. `useBookmarks.ts:299-303` catch block sets `SYNC_FAILURE`
5. `sync-state-machine.ts:33-37` maps it to generic `"error"` status
6. UI shows "Something went wrong - Could not sync your bookmarks"

**What's missing:**
- No detection of 429 vs other errors
- No exponential backoff
- No emergency pause after repeated 429s
- No distinct user messaging ("rate limited" vs "network error")
- 4-second cooldown means user can immediately retry into another 429

**Existing error handling that does work:**
- 401/403: triggers silent re-auth (SW opens background x.com tab, waits 15s for headers)
- 400: retries once with force-rediscovered query ID
- `GRAPHQL_VALIDATION_FAILED`: retries once with rediscovered query ID

### Gap 2: Full reconcile has no page cap

`reconcileBookmarks()` in `src/lib/reconcile.ts` — the `while(true)` loop (line 28) has no max-pages guard. When `fullReconcile=true`, it walks every page to build the complete `remoteIds` set.

Exit conditions:
1. Cursor repeats (line 30) — protection against infinite API loops
2. `stopOnEmptyResponse` + empty page (line 46) — terminal API signal
3. No next cursor / same cursor (lines 57-58)

Page count math: API returns ~100 bookmarks per page (SW line 1744: `count: 100`).
- 5,000 bookmarks = 50 API calls
- 10,000 bookmarks = 100 API calls

There IS a timeout cap: `syncAbortTimeout()` in `useBookmarks.ts:77-81` maxes at 12 minutes. With ~2s average inter-page delay (FetchQueue), that's ~360 pages max. But 360 API calls is still far too many.

### Gap 3: Manual sync defaults to "full" mode

Every manual sync click triggers `mode: "full"`:
```typescript
// useBookmarks.ts:532-534
const refresh = useCallback(async (): Promise<SyncRequestResult> => {
  return sync({ trigger: "manual", mode: "full" });
}, [sync]);
```

And in the sync function (line 169-170):
```typescript
const requestedMode = options.mode ?? (trigger === "manual" ? "full" : undefined);
```

Full mode walks ALL pages. Users who just want their recent bookmarks are paying for a complete reconciliation every time.

### Gap 4: Sync loop lives in React, not the service worker

The pagination loop runs in `useBookmarks.ts`. The service worker only does admission control (`REQUEST_SYNC` -> allow/deny) and proxies individual `FETCH_BOOKMARKS` calls. This means:
- If the React component unmounts, the sync aborts (`AbortController` at line 354)
- The SW can't enforce `maxPagesPerJob` because it doesn't see the loop — it sees individual page requests
- Progressive streaming (showing results as pages arrive) is harder because the loop and the UI are in the same component

For the 250-bookmark cap and progressive streaming to work properly, the fetch loop should eventually move to the SW. But this is a bigger refactor and not needed for the immediate fixes.

### Gap 5: No progressive page streaming to UI

Currently, `reconcileBookmarks` has an `onPage` callback (line 14, 53) that fires after each page. But `useBookmarks.ts` only refreshes the full bookmark list from IndexedDB at specific points — after sync completes or via explicit `refreshBookmarks()`. There's no incremental append as pages arrive.

## 3) What Doesn't Need Changing

| Component | Why it's fine |
|---|---|
| Service worker as API proxy | Already the sole gateway. No direct x.com calls from React. |
| Sync orchestrator lease system | Prevents concurrent syncs. Cross-tab safe. Manual reclaim works. |
| FetchQueue with human delays | Effective pacing. Jitter + reading pauses mimic natural behavior. |
| Dedup at multiple layers | Orchestrator + state machine + refs. Belt and suspenders. |
| Auto-sync defaults | Off by default, incremental when on, 4h interval. Conservative. |
| Message passing architecture | Clean separation. Works reliably. |

## 4) Hardcoded Values That Should Be Configurable

These values are scattered across `src/lib/constants/timing.ts`, `src/lib/sync-orchestrator.ts`, `public/service-worker.js`, and `src/hooks/useBookmarks.ts`. They should be centralized in a sync policy config.

### Currently in `src/lib/constants/timing.ts`
| Constant | Value | Purpose |
|---|---|---|
| `FETCH_BASE_DELAY_MS` | 1200 | Base delay between page fetches |
| `FETCH_JITTER_MS` | 1300 | Random jitter added to base delay |
| `FETCH_READ_PAUSE_CHANCE` | 0.15 (15%) | Chance of extra "reading" pause |
| `FETCH_READ_PAUSE_MIN_MS` | 1000 | Min extra pause duration |
| `FETCH_READ_PAUSE_JITTER_MS` | 2000 | Jitter on extra pause |
| `PAGE_FETCH_TIMEOUT_MS` | 45,000 | Per-page fetch timeout |
| `BACKGROUND_SYNC_MIN_INTERVAL_MS` | 14,400,000 (4h) | Min interval between auto syncs |

### Currently in `src/lib/sync-orchestrator.ts`
| Constant | Value | Purpose |
|---|---|---|
| `SYNC_ORCHESTRATOR_LOCK_TTL_MS` | 720,000 (12min) | Stale lease expiry |
| `SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS` | 300,000 (5min) | Auto-sync backoff after attempt |
| `SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS` | 90,000 (90s) | Manual override threshold for stuck leases |
| `SYNC_ORCHESTRATOR_MANUAL_COOLDOWN_MS` | 4,000 (4s) | Cooldown between manual sync clicks |

### Currently in `public/service-worker.js` (duplicated from above + extras)
| Constant | Value | Purpose |
|---|---|---|
| `SYNC_ORCHESTRATOR_*` | (same as above) | Duplicated — these are redefined in the SW |
| Default `pageCount` in `handleFetchBookmarks` | 100 | Bookmarks per API page |
| `LIGHT_SYNC_DEBOUNCE_MS` | 60,000 (1min) | Debounce for light sync signal |
| `LIGHT_SYNC_THROTTLE_MS` | 1,800,000 (30min) | Throttle for light sync signal |

### Currently in `src/hooks/useBookmarks.ts`
| Constant | Value | Purpose |
|---|---|---|
| `syncAbortTimeout` base (full) | 480,000 (8min) | Base timeout for full sync |
| `syncAbortTimeout` base (incremental) | 180,000 (3min) | Base timeout for incremental sync |
| `syncAbortTimeout` max | 720,000 (12min) | Maximum sync timeout |
| `syncAbortTimeout` extra per 1000 bookmarks | 30,000 (30s) | Scaling factor for timeout |

### Missing (need to add)
| Constant | Proposed value | Purpose |
|---|---|---|
| `MAX_PAGES_PER_JOB` | 3 | Page cap for quick sync |
| `MAX_BOOKMARKS_PER_JOB` | 250 | Bookmark cap for quick sync |
| `RATE_LIMIT_BACKOFF_BASE_MS` | 60,000 (1min) | Initial backoff after 429 |
| `RATE_LIMIT_MAX_BACKOFF_MS` | 900,000 (15min) | Max backoff after repeated 429s |
| `RATE_LIMIT_EMERGENCY_THRESHOLD` | 3 | Consecutive 429s before emergency pause |

## 5) What to Build (Priority Order)

### Immediate (50-80 lines, fixes real risk)

1. **Add `MAX_PAGES_PER_JOB` to `reconcileBookmarks()`** — break the while loop when page cap is hit. ~5 lines in `reconcile.ts`.

2. **Handle 429 responses in the SW** — detect `response.status === 429`, throw `RATE_LIMITED` error, set backoff in orchestrator state. ~20 lines in `service-worker.js`.

3. **Surface rate-limit errors distinctly in UI** — add `"rate_limited"` to `errorToStatus()` in `sync-state-machine.ts`, show specific message. ~15 lines.

4. **Create sync policy config** — centralize all the values from Section 4 above into `src/lib/constants/sync-policy.ts`. Other files import from there. ~40 lines.

### Short-term (progressive streaming)

5. **Wire `onPage` callback to trigger UI updates** — each page writes to IDB (already happens), then triggers a state update so the UI appends new bookmarks. Moderate effort in `useBookmarks.ts`.

6. **Change default manual sync to incremental** — change `useBookmarks.ts:532` from `mode: "full"` to `mode: "incremental"`. Offer full sync as explicit option. 1 line change + UI for the option.

### Later (when needed)

7. **Move sync loop to service worker** — so it survives component unmounts and the SW can enforce caps server-side. Bigger refactor.

8. **Virtual scrolling** — when users report render lag with large collections. Orthogonal to sync safety.

9. **Premium policy profiles** — when premium exists.

10. **Metrics/telemetry** — needs its own infrastructure plan.

## 6) What the PRD Gets Wrong

### Over-engineering what exists
The PRD proposes 6 named gateway components (Admission Controller, Idempotency Layer, Per-Account Queue, Policy Engine, Budget Guard, Progress Reporter). These are labels for things the sync orchestrator and SW already do. Building them as separate modules creates parallel infrastructure.

### Separate display cap is the wrong abstraction
The original PRD proposed `uiVisibleBookmarksLimit` separate from the fetch cap. This was updated to drop the display cap, which is correct. The fetch budget is the throttle; the UI should handle any count via virtual scrolling.

### `sync_jobs` data model duplicates existing state
The orchestrator state already tracks `inFlight`, `leaseId`, `lastAttempt`, `lastSuccess`. The runtime audit log keeps the last 60 decisions. Adding a parallel `sync_jobs` store creates two sources of truth.

### Metrics section has no implementation path
No telemetry infrastructure exists. "Requests per active user/day" requires a backend. These metrics are good ideas but belong in a separate initiative, not gating sync safety work.

### Sync orchestrator duplication is unacknowledged
The orchestrator logic exists in both `src/lib/sync-orchestrator.ts` AND `public/service-worker.js` (lines 200-837). The PRD doesn't mention this. Any gateway work should start by eliminating this duplication.

## 7) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 429 rate limit with no backoff | Medium | High (account risk) | Gap 1: add 429 handling |
| Unbounded full sync for large accounts | Medium | Medium (excessive API calls) | Gap 2: page cap |
| User retries into rate limit | Medium | High | Gap 1 + distinct error message |
| Sync aborts on component unmount | Low | Low (user just re-syncs) | Gap 4: move loop to SW (later) |
| Query ID resolution breaks | Medium | High (all sync fails) | Not addressed by PRD either |
| Service worker dies mid-sync | Low | Low (lease expires, retry works) | Already handled |

## 8) Decision

Focus on the surgical fixes (Section 5, items 1-4) before considering any architectural changes. The sync system is fundamentally sound — it needs bounds and error handling, not a rewrite.
