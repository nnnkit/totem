# Runtime Flows and Verification (Auth, Sync, Fetch, Offline)

Last validated: 2026-03-01

This is the canonical runtime analysis for current code in this repo. It traces real control flow for auth, sync, detail fetching, logout/login recovery, and offline behavior.

This document is intentionally implementation-first and is meant to prevent inconsistent state, impossible state, and state poisoning before refactor.

## 1. Scope and Verification Method

Analyzed code paths:

- `public/service-worker.js`
- `src/hooks/useAuth.ts`
- `src/hooks/useBookmarks.ts`
- `src/hooks/sync-state-machine.ts`
- `src/App.tsx`
- `src/components/NewTabHome.tsx`
- `src/components/BookmarksList.tsx`
- `src/components/BookmarkReader.tsx`
- `src/components/reader/TweetContent.tsx`
- `src/hooks/usePrefetchDetails.ts`
- `src/api/core/*.ts`
- `src/db/index.ts`
- `public/content/*.js`

Verification performed on current workspace:

- `pnpm test -- --run` passed (38 tests)
- `pnpm build` passed

Notes:

- This is a code-trace verification, not a production telemetry snapshot.
- Flow expectations here are tied to current source behavior, not intended PRD behavior.

Implementation progress in this pass:

- `CHECK_AUTH` now returns `sessionState` and `capability`.
- UI auth reducer now uses session truth separate from query-id capability.
- `connecting` has a watchdog timeout fallback.
- `NO_QUERY_ID` now maps to sync `error` (capability issue), not `reauthing`.
- Runtime derivation is centralized in `RuntimeProvider` (single source for mode/canSync/offline).

## 2. Current Runtime State Model

There are 5 layers, with runtime derivation now centralized through context.

## 2.0 Runtime Provider (centralized selector layer)

Source:

- `src/runtime/RuntimeProvider.tsx`

Responsibilities:

- Owns canonical runtime mode derivation (`booting`, `online_ready`, `online_degraded`, `offline_cached`, `offline_empty`).
- Centralizes sync eligibility (`canSync`) and disabled-reason logic.
- Exposes unified runtime state to UI via `useRuntime()`.
- Ensures `useBookmarks` receives `syncReady` (`phase=ready && bookmarksApi=ready`) so sync/event wiring does not run while capability is blocked.

## 2.1 Worker session/auth state (source of auth truth today)

Storage-backed keys (worker writes):

- `totem_auth_state`: `authenticated | stale | logged_out`
- `totem_auth_state_at`
- `totem_auth_state_reason`
- `totem_auth_headers`
- `totem_user_id`

Primary transitions (worker):

- `markAuthAuthenticated(...)` from successful protected traffic/probe/API calls
- `markAuthLoggedOut(...)` from repeated weak negative signals or 401/403
- `setAuthState(stale, ...)` when probe/network/query-id readiness is uncertain

Important implementation detail:

- Worker now returns:
  - `sessionState` (`unknown | logged_in | logged_out`)
  - `capability.bookmarksApi` (`unknown | ready | blocked`)
- `hasAuth` reflects logged-in session with headers, without requiring `authState=authenticated`.

## 2.2 UI auth phase (`useAuth`)

Reducer phase values:

- `loading`
- `connecting`
- `need_login`
- `ready`

Current mapping from `CHECK_AUTH` result:

- `sessionState === logged_out` -> `need_login`
- `sessionState === logged_in` -> `ready` (even if Bookmarks API is still capability-blocked)
- `sessionState === unknown` -> `connecting` with retry
- `connecting` is bounded by watchdog timeout -> `need_login`

Key behavior:

- Initial mount always calls `checkAuth({ probe: true })`.
- While `ready`, heartbeat probe every 45s.
- Relevant storage changes trigger `performCheck()`.

## 2.3 Sync state (`useBookmarks` + sync machine)

Sync status values:

- `loading | syncing | idle | reauthing | error`

Key mapping:

- Sync failure messages `AUTH_EXPIRED | NO_AUTH` -> `reauthing`
- `NO_QUERY_ID` and other failures -> `error`

Key behavior:

- Sync only runs when `isReady` (derived from auth phase).
- `refresh()` is full sync manual trigger.
- Soft sync is event-driven from worker (`totem_light_sync_needed`) while ready.
- Reauth poll loop runs only when `syncStatus === reauthing && isReady === true`.

## 2.4 Derived UI mode (`App.tsx`)

Current derived flags:

- `runtimeMode` is sourced from `RuntimeProvider` (not ad-hoc in `App.tsx`)
- `offlineMode = runtimeMode === offline_cached`
- `displayBookmarks = offlineMode ? bookmarks filtered by cached-detail-id : bookmarks`
- `needsLogin = (runtimeMode === offline_empty OR phase === connecting) && displayBookmarks.length === 0`

Critical UI gate for stuck screen:

- Home card shows "Connecting to X..." iff `authPhase === connecting`.
- `authPhase` is set only when `needsLogin` is true.
- Therefore stuck connecting card means: phase connecting + no display bookmarks.

## 3. End-to-End Flow Traces (Current Behavior)

## 3.1 Extension opens, user logged in, query IDs available

1. `useAuth` calls `CHECK_AUTH(probe=true)`.
2. Worker probe succeeds (`runAuthProbeRequest` -> 200) and sets `authenticated`.
3. `useAuth` enters `ready`.
4. `useBookmarks(syncReady=true)` initializes local DB list and stays `idle` until user sync/soft-sync event.
5. Home shows sync button and normal content.

## 3.2 Extension opens, user logged in, query IDs not resolvable yet

1. Initial `CHECK_AUTH(probe=true)` runs.
2. Probe may mark auth state stale due `probe_no_query_id`.
3. Worker still reports `sessionState=logged_in` when headers/session are present.
4. `useAuth` stays `ready`, while `capability.bookmarksApi=blocked` until query IDs are available.
5. Runtime mode becomes `online_degraded`; sync stays disabled with capability message instead of trapping in connecting.

Why this is fragile:

- Query-id readiness can still delay sync capability, but no longer blocks session-ready UI.

## 3.3 Extension opens, logged out, cached bookmarks exist

1. Worker returns `logged_out`.
2. `useAuth` -> `need_login`.
3. `offlineMode` becomes true if local bookmarks exist.
4. `displayBookmarks` filters to items whose details already exist in DB.
5. Home hides top sync button in offline mode; offline banners appear in home/list/reader contexts.

## 3.4 Extension opens, logged out, no readable cache

1. `phase = need_login`.
2. `displayBookmarks` empty.
3. `needsLogin=true`.
4. Login card shown.

## 3.5 Login CTA from extension (current)

1. Login link opens `https://x.com/login` in a normal tab.
2. `startLogin()` only dispatches `USER_LOGIN` and triggers `performCheck(true)`.
3. No direct call to `START_AUTH_CAPTURE`.
4. Transition out of connecting depends on intercepted x.com traffic and/or successful probe.

Observed risk:

- If session signals remain ambiguous (`sessionState=unknown`) for too long, watchdog forces `need_login` to avoid infinite spinner.

## 3.6 Manual full sync

1. User presses sync (home) or sync action in list empty-state.
2. `refresh()` -> `sync({ mode: full })`.
3. `reconcileBookmarks(...)` pages through Bookmarks API.
4. New bookmarks merged into state + IndexedDB.
5. `CS_LAST_SYNC` updated, status -> `idle`.

Auth failures:

- `NO_AUTH`, `AUTH_EXPIRED`, `NO_QUERY_ID` enter `reauthing` sync status.

## 3.7 Soft sync from worker mutation activity

1. Worker sees non-extension GraphQL activity and sets `totem_light_sync_needed` with debounce/throttle.
2. `useBookmarks` storage listener runs only when `syncReady` (`ready + bookmarks capability ready`) and then performs incremental sync.

Constraint:

- If not ready, soft sync signal is ignored for now.

## 3.8 Bookmark mutation event reconciliation

1. Worker queues `CreateBookmark`/`DeleteBookmark` events.
2. `useBookmarks` reads event queue, derives plan (`resolveBookmarkEventPlan`).
3. Delete events remove local bookmark+detail+progress.
4. Create events trigger one small page fetch and merge new IDs.
5. Ack events.

## 3.9 Reader open with cached detail

1. `BookmarkReader` calls `fetchTweetDetail(tweetId)`.
2. API layer first checks IndexedDB detail cache.
3. Cached detail renders immediately.

## 3.10 Reader open without cached detail while authenticated

1. `fetchTweetDetail` runtime request to worker.
2. Worker calls TweetDetail API.
3. On success, cache detail in DB and render.

## 3.11 Reader open without cached detail while not authenticated

1. Worker returns `NO_AUTH` or `AUTH_EXPIRED`.
2. Reader catches error and displays `OfflineBanner`.

Important detail:

- Reader currently treats all `detailError` values as offline banner, including non-auth API failures.

## 3.12 Logout while extension is open

Detection channels:

- Protected request 401/403 -> worker marks logged out and clears auth headers.
- Missing auth-trio weak negatives (thresholded) -> logged out.

Propagation:

- Storage change triggers `useAuth` re-check.
- UI degrades to offline mode if cache exists.

## 3.13 Query ID loss/staleness during sync/detail/delete

1. Handlers throw `NO_QUERY_ID` when resolution fails.
2. Sync machine maps `NO_QUERY_ID` to `error` (capability failure).
3. User can retry once capability is restored; auth reauth loop is reserved for auth failures only.

Mismatch:

- Previously misclassified as auth expiry; now correctly treated as capability/readiness failure.

## 3.14 Worker silent reauth path (still active)

- On 401/403 in fetch handlers, worker may call `reAuthSilently()`.
- It opens hidden `https://x.com/i/bookmarks` tab (`active:false`) and waits up to 15s.

This is independent of `startLogin` UI flow.

## 4. Invariants We Need (Current vs Reality)

Required invariants for predictable runtime:

1. Session truth must not depend on query-id availability.
2. UI "connecting" must have a bounded timeout and deterministic fallback.
3. `offlineMode` must be derived from session/auth capability cleanly, not mixed with sync transient status.
4. Sync blocked-by-auth and sync blocked-by-capability should be distinct.
5. Reader error UX must distinguish auth/offline vs API/server vs parsing errors.
6. Cached-detail index used for offline filtering must be fresh after any successful detail fetch.

Current violations and risks are listed below.

## 5. Inconsistent or Poisoned State Findings

Severity legend:

- P0: hard-stuck / user blocked
- P1: frequent wrong mode or major UX break
- P2: correctness drift / recoverable
- P3: maintainability risk

| ID | Severity | State pattern | Evidence | Why it is problematic |
|---|---|---|---|---|
| F1 | P0 | `authState=stale` + valid session + unresolved query ID -> UI `connecting` indefinitely | `runAuthProbeRequest` returns stale on `probe_no_query_id`; `useAuth` maps stale -> connecting | Query-id readiness is treated as login truth, causing false "not ready" lock |
| F2 | P0 | `hasAuthHeader=true` but `hasAuth=false` while stale | `handleCheckAuth` computes `hasAuth` only when authenticated | Session may exist but UI cannot become ready due strict coupling |
| F3 | P1 | `NO_QUERY_ID` mapped to `reauthing` | `sync-state-machine.errorToStatus` | Capability failure is misclassified as auth failure, triggering wrong recovery messaging/path |
| F4 | P1 | `connecting` has no watchdog fallback | `useAuth` retries stale forever every 15s | Impossible-state recovery is unbounded; user can remain on "Connecting..." |
| F5 | P1 | hidden tab reauth side effect from worker | `reAuthSilently` on 401/403 in handlers | Causes unexpected tab behavior and noisy UX under auth instability |
| F6 | P1 | reader displays offline banner for all detail errors | `TweetContent` shows `OfflineBanner` on any `detailError` | Misdiagnosis hides actual failure class and recovery action |
| F7 | P2 | offline display list can become stale after reader-fetched detail | `useDetailedTweetIds` only refreshes on `prefetchedCount` change | Newly fetched details may not be reflected in offline filter immediately |
| F8 | P2 | prefetch loop stops entirely on first fetch error | `usePrefetchDetails` catches and `return` from loop | Single transient failure can poison prefetch progress for session |
| F9 | P3 | dead/unused auth capture and onboarding paths | `startAuthCapture`/`CLOSE_AUTH_TAB` API not used in app; `Onboarding` unused | Increases confusion; docs and runtime diverge |
| F10 | P3 | documentation drift around sync model | `src/lib/api-rules.md` describes old throttled auto-sync model | Operational assumptions become incorrect during debugging |

### Findings status after this pass

- Mitigated: F1, F2, F3, F4 (session/capability split, `NO_QUERY_ID` classification, connecting watchdog, centralized runtime selector layer).
- Still open: F5, F6, F7, F8, F9, F10.

## 6. Root Cause of "Connecting to X..." Stuck Screen (Pre-Fix)

Primary cause chain:

1. Auth probe requires Bookmarks query ID in `runAuthProbeRequest`.
2. If query ID cannot be resolved quickly, worker sets `authState=stale` (`probe_no_query_id`).
3. `CHECK_AUTH` returns `hasAuth=false` unless `authState=authenticated`.
4. `useAuth` maps stale to `phase=connecting` with repeat retries.
5. If no cached readable bookmarks exist, home shows only connecting card.
6. No deterministic timeout fallback, so this can persist.

That stuck condition was primarily a state-model coupling bug, not only a network glitch.

## 7. Verification Matrix (Manual + Storage Assertions)

For each scenario, verify both UI and key storage state.

### 7.1 First open while logged in (clean install)

- Setup: logged in to X, clear extension data, open new tab.
- Expected UI: should not remain in connecting longer than fallback window.
- Expected storage: `totem_auth_state` should converge to authenticated; query-id readiness should not block session truth.

### 7.2 First open logged out with no cache

- Setup: logged out, no bookmarks DB.
- Expected UI: login card.
- Expected storage: `totem_auth_state=logged_out`, `totem_auth_headers` absent.

### 7.3 Logged out with cache

- Setup: populate cache, then logout.
- Expected UI: offline mode; only readable/cached items shown in home card source.
- Expected storage: auth state logged_out; bookmarks remain in IndexedDB.

### 7.4 Login from login card while already logged in on x.com

- Setup: extension shows login/connecting, x.com session already active.
- Action: click login CTA.
- Expected: transition to usable mode without indefinite connecting.
- Observe: `totem_auth_state_reason`, query-id discovery behavior.

### 7.5 Manual sync happy path

- Action: click sync while ready.
- Expected: `syncStatus syncing -> idle`, `totem_last_sync` updates.

### 7.6 Manual sync with `NO_QUERY_ID`

- Setup: force no query IDs.
- Expected (target architecture): capability-blocked state, not auth-reauth state.
- Current: enters `reauthing` and may degrade incorrectly.

### 7.7 Soft sync after x.com bookmark create/delete

- Action: mutate bookmarks on x.com.
- Expected: event queue populated then drained/acked; local list converges.

### 7.8 Reader open cached detail offline

- Expected: content renders from DB without network.

### 7.9 Reader open uncached detail offline

- Expected: explicit auth/capability error state.
- Current: generic offline banner for all failures.

### 7.10 Logout mid-session with active x.com traffic

- Expected: auth state transitions to logged_out quickly; UI degrades to offline without data loss.

### 7.11 Logout with no x.com traffic afterwards

- Expected with no cookie permission: detection may be delayed.
- Ensure UI still recovers on next probe/request.

### 7.12 Query ID recovered after prior stale

- Setup: start stale/no query ID, then browse x.com to seed IDs.
- Expected: auth phase exits connecting without manual reload.

## 8. Better Architecture (Predictable + Recoverable)

Goal: separate concerns so session truth, API readiness, and UI mode do not poison each other.

## 8.1 Proposed canonical state contract

```ts
type SessionState = "unknown" | "logged_in" | "logged_out";

type CapabilityState = {
  bookmarksApi: "unknown" | "ready" | "blocked";
  detailApi: "unknown" | "ready" | "blocked";
};

type DataState = {
  bookmarkCount: number;
  readableCount: number;
};

type RuntimeMode =
  | "booting"
  | "online_ready"
  | "online_degraded"
  | "offline_cached"
  | "offline_empty";
```

Mapping principles:

1. `SessionState` must not depend on query IDs.
2. `CapabilityState` carries query-id/API readiness separately.
3. `RuntimeMode` is derived from `(session, capability, data)` deterministically.
4. Any impossible tuple is repaired by a single `normalizeRuntimeState()` guard.

## 8.2 Event model

Use one reducer/event stream for runtime-level transitions:

- `AUTH_SIGNAL_SEEN`
- `AUTH_PROBE_OK`
- `AUTH_PROBE_LOGGED_OUT`
- `AUTH_PROBE_UNCERTAIN`
- `CAPABILITY_READY(op)`
- `CAPABILITY_BLOCKED(op, reason)`
- `DATA_LOADED(count, readableCount)`
- `SYNC_STARTED | SYNC_DONE | SYNC_FAILED(kind)`
- `WATCHDOG_TIMEOUT(mode, elapsed)`

## 8.3 Watchdog and fallback recovery

Add deterministic escape from impossible connecting:

- If `mode=booting/connecting` exceeds N seconds:
- if `readableCount > 0` -> force `offline_cached` with non-blocking warning.
- if `readableCount === 0` and session uncertain -> show actionable degraded screen with retry + open x.com.
- Never remain in spinner-only mode forever.

## 8.4 No-cookie-permission strategy (seamless)

Do not require cookie permission for baseline behavior.

Use these signals in priority order:

1. webRequest protected-operation success/401/403
2. content script `twid` parse on x.com pages
3. bounded worker probe checks (without opening hidden auth tabs)

Policy:

- Treat "no signal" as `unknown`, not `logged_out`.
- Degrade gracefully to cached reading when unknown and local data exists.
- Only show strict login wall when confidently logged out and no readable cache.

## 8.5 Reauth behavior change

- Remove hidden-tab `reAuthSilently()` from normal fetch failure path.
- Replace with explicit capability/session transitions and user-initiated recovery CTA.
- Keep background tab open as optional debug fallback only behind explicit action.

## 9. Refactor Plan (Step-by-Step, Low Risk)

## Phase 1: Instrument and lock contract

1. Add structured runtime debug snapshot (`session`, `capability`, `mode`, `reason`).
2. Add reducer tests for impossible-state normalization and watchdog fallback.
3. Add flow tests for: stale+query-id-missing, logout while cached, reader uncached offline.

## Phase 2: Decouple auth from query-id readiness

1. Worker `CHECK_AUTH` should return independent fields:
- `sessionState`
- `capability.bookmarksApi`
- `capability.detailApi`
2. `hasAuth` should reflect session confidence, not `authenticated` enum only.

## Phase 3: Runtime-mode derivation in app

1. Replace ad-hoc `offlineMode/needsLogin` composition with single `runtimeMode` selector.
2. Gate UI screens by `runtimeMode`.
3. Add connecting watchdog fallback.

## Phase 4: Sync and fetch error taxonomy

1. Split `reauthing` into `auth_blocked` and `capability_blocked`.
2. Map `NO_QUERY_ID` to capability-blocked, not auth-blocked.
3. Reader error UI by class: auth, capability, network/server, parse.

## Phase 5: Cache-readability consistency

1. Refresh detailed-id index after every successful detail fetch (reader + prefetch).
2. Make prefetch resilient: continue after transient errors with backoff.
3. Ensure offline filtered list is eventually consistent within one session.

## Phase 6: Cleanup and docs

1. Remove unused auth-capture/onboarding dead paths if no longer needed.
2. Update `src/lib/api-rules.md` to match actual sync/runtime behavior.
3. Keep this file as source-of-truth runtime reference.

## 10. Definition of Done for Refactor

The refactor is complete only if all conditions hold:

1. No infinite connecting spinner; watchdog fallback always exits.
2. Logged-in session can reach usable state even if query-id discovery is delayed.
3. `NO_QUERY_ID` does not show auth-reauth messaging.
4. Offline mode always shows only readable items when session unavailable.
5. Login/logout transitions do not open hidden tabs automatically.
6. Reader shows precise error messaging per error class.
7. Verification matrix scenarios 7.1-7.12 pass.

## 11. Immediate Next Work (next implementation slice)

Done in current code:

1. Typed runtime contract (`sessionState`, `capability`) added.
2. Worker `CHECK_AUTH` payload split by session/capability.
3. `useAuth` reducer updated with connecting watchdog.
4. `NO_QUERY_ID` sync classification adjusted.
5. Runtime selector centralized in `RuntimeProvider`.

Next items:

1. Replace hidden-tab worker `reAuthSilently()` with explicit user-driven recovery path.
2. Add reader-level error taxonomy (`auth` vs `capability` vs `network/server`) and precise UX states.
3. Make detailed-id index refresh deterministic after any successful detail fetch.
4. Make prefetch resilient (continue after transient failures with bounded backoff).
5. Update `src/lib/api-rules.md` to remove stale/legacy behavior notes.
