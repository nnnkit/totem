# Auth + Sync Source of Truth

Last updated: 2026-03-01
Scope: New Tab runtime behavior for auth, sync, offline cache, account context, and reset.

This document is the canonical rule set. Behavior should be implemented from these rules, not guessed from symptoms.

## 1) Core Concepts

`sessionState`
- `logged_in`: valid X session/auth headers are available.
- `logged_out`: no usable X session.
- `unknown`: startup/transition uncertainty.

`authPhase` (UI auth reducer)
- `loading`: boot.
- `connecting`: session is being verified/recovered.
- `need_login`: user action required.
- `ready`: session is usable for runtime.

`capability.bookmarksApi`
- `ready`: Bookmarks API query id resolved and callable.
- `blocked`: session exists but query id not ready yet.
- `unknown`: session not ready.

`activeAccountId`
- Account context used to select account-scoped IndexedDB.
- While logged out, we preserve account context for offline cache reading.
- Persisted in `chrome.storage.local["totem_account_context_id"]` so logout does not erase cache routing.

`displayBookmarks`
- In online mode: all bookmarks from active account DB.
- In offline mode: only bookmarks that also have `tweet_details` cached.

`runtime state v2` (`chrome.storage.local["totem_runtime_state_v2"]`)
- Backward-compatible top-level snapshot plus normalized slices:
  `auth`, `accountContext`, `sync`, `cacheSummary`, `jobs`, `auditLog`.

## 2) Non-Negotiable Invariants

1. `CHECK_AUTH` must not trigger Bookmarks network fetch.
2. Sync decisions must be worker-owned and account-scoped.
3. At most one sync in-flight per account at a time.
4. Logout must not destroy offline account context if cached data exists.
5. Refresh must not cause repeated fetch loops.
6. Manual sync must be recoverable from stale in-flight locks.

## 3) Runtime Mode Rules

`offline_cached`
- Condition: user is not effectively online for sync, but cached displayable bookmarks exist.
- Result: show offline UI and cached reading experience.

`offline_empty`
- Condition: user is not online for sync and no displayable cached bookmarks.
- Result: show login CTA.

`online_ready`
- Condition: `authPhase=ready` and `bookmarksApi=ready`.
- Result: sync is enabled.

`online_degraded`
- Condition: `authPhase=ready` but `bookmarksApi=blocked`.
- Result: show disabled sync with “preparing API” behavior.

`booting`
- Condition: `authPhase=loading` or `connecting`.

## 4) Login / Logout Rules

Login CTA target
- Always open `https://x.com/i/bookmarks` (not `/login`) so protected traffic is guaranteed after login.

On successful login
1. Worker captures auth headers from protected requests.
2. Worker marks auth state `authenticated`.
3. `CHECK_AUTH` returns `sessionState=logged_in`, `userId`, and capability.
4. UI transitions to `ready`.

On logout
1. Worker marks `logged_out` from 401/403 or strong negative auth signals.
2. `CHECK_AUTH` returns `userId=null` but keeps `accountContextId` if known.
3. UI enters `need_login`.
4. If cached details exist for account DB, UI remains usable in offline cached mode.

`SESSION_USER_MISSING` handling
- Missing `twid` on `x.com` is treated as a strong logout signal.
- Runtime moves to `logged_out` even if stale auth headers are still present (headers are kept only as diagnostics until next valid capture).

## 5) Sync Policy Rules (Worker Orchestrator)

State key
- `chrome.storage.local["toreview each line of copy used on the home page, each line, review it, make it in a table. What would you do to optimize it for better and subtle readability for humans to just tell them, okay, this is what it is, period, simple. tem_sync_orchestrator_state"]`

Reservation inputs
- `accountId`, `trigger` (`auto` or `manual`), `localCount`, `requestedMode`.

Decisions
- `manual`:
  - Allowed by default.
  - May reclaim stale in-flight lock after 90s.
- `auto` with `localCount=0`:
  - `full` sync (`bootstrap_empty`) when allowed.
- `auto` with `localCount>0`:
  - `incremental` sync (`background_stale`) only when stale.

Guards
- In-flight lock TTL: 12 minutes.
- Auto backoff between attempts: 5 minutes.
- Auto stale interval after success: 4 hours.
- Manual stale-lock reclaim: 90 seconds.

Completion
- Every reserved sync must send completion status:
  - `success`, `failure`, `timeout`, or `skipped`.
- Completion updates account cooldown and clears in-flight lock.

## 6) UI Sync Triggers

Mount/refresh trigger
- Load bookmarks from account DB only.
- Do not send implicit sync reservations on mount/refresh.
- Refresh must cause zero bookmark fetches unless user explicitly clicks sync.

Phase 2 optional auto refresh
- Controlled by `chrome.storage.local["totem_sync_auto_enabled"]` (default `false` in current build).
- When new tab opens and runtime is ready, app sends one `trigger="auto"` reservation with local count hint.
- Worker policy decides whether to run network fetch (`bootstrap_empty`, `background_stale`) or block (`fresh_cache`, `auto_backoff`, etc.).
- No `chrome.alarms`; no background sync while new tab is closed.

Manual sync button
- Sends `trigger="manual"` + `mode="full"`.
- Must never silently no-op (worker returns explicit blocked reason when denied).
- Block reasons surfaced in UI: `in_flight`, `cooldown`, `no_account`, `not_ready`.

## 7) First-Time / Refresh / Reset Scenarios

First-time user, logged in
1. No local DB data.
2. App becomes `online_ready`.
3. If `totem_sync_auto_enabled=true`, mount sends one auto reservation and worker may run `bootstrap_empty` full sync.
4. If auto is disabled, user clicks Sync manually.
5. Full sync fetches bookmarks and caches details over time.

First-time user, logged out
1. No local DB data.
2. App shows login card.

Logged out with cached details
1. App uses preserved account context DB.
2. Offline cached UI is shown.
3. Only bookmarks with cached `tweet_details` are displayed.

Refresh while logged out with cache
1. `accountContextId` restores account DB selection.
2. Offline cached mode must persist.
3. Must not collapse to login-empty unless no displayable cache exists.

Reset data from settings
1. Clears all known local DBs and sync metadata.
2. Preserves auth/session keys where intended.
3. Sets `LS_MANUAL_SYNC_REQUIRED=1` to avoid immediate auto-fetch after reset.
4. After reset:
  - Logged in: show sync-ready empty state, sync on user action.
  - Logged out: show login state.

## 8) Account Switching Rules

1. Account DB name is `totem_acct_<accountId>`.
2. Switching account changes active DB context.
3. Existing DB connections are not force-closed mid-flight (avoid `database connection is closing` race).
4. Sync lock/cooldown are isolated per account in orchestrator state.
5. Explicit switch intent uses runtime message `SET_ACCOUNT_CONTEXT` (Phase 4 scaffold).

## 9) Failure Handling Rules

`NO_AUTH` and auth expiry
- Move sync state to reauth/error path as appropriate.

`NO_QUERY_ID`
- Treat as capability issue, not logout truth.

Timeout
- Mark sync timeout and release orchestrator lock via completion.

Stale in-flight lock
- Manual sync reclaims after 90s.

## 10) Operational Verification Checklist

1. Clicking sync always causes either a reservation or a clear blocked reason, never silent no-op.
2. Repeated refresh does not repeatedly refetch if lock/cooldown says no.
3. Logout + refresh with cached details still shows offline cached content.
4. Reset + logged out shows login.
5. Reset + logged in shows syncable empty state.
6. Multi-tab open does not spawn duplicate full sync for same account.
