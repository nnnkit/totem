# PRD: Unified Sync Gateway and Request Budgeting

Last updated: 2026-03-03  
Owner: Totem extension team  
Status: Draft for implementation planning

## 1) Problem

Today, sync and detail fetches can be triggered from multiple places. As bookmark count grows (for example 10,000+), repeated manual clicks and uncontrolled backfills can generate too many requests, increase account risk, and waste API quota.

We need one controlled pipeline so every X API request goes through a single gateway with queueing, throttling, dedupe, and policy limits.

Important: this system can significantly reduce ban risk, but it cannot guarantee zero risk.

## 2) Goals

1. Route all X API requests through one gateway with consistent policy enforcement.
2. Prevent duplicate manual sync runs when users click multiple times.
3. Keep first sync fast by fetching a capped recent window first.
4. Limit how many bookmarks are shown by default for performance and readability.
5. Make limits configurable so premium tiers can be enabled later without architecture changes.

## 3) Non-Goals (v1)

1. Full historical backfill for every user on first sync.
2. Real-time background sync while the extension UI is fully closed.
3. Guaranteeing no account action by X.

## 4) Product Principles

1. User action should feel immediate, but network behavior should stay conservative.
2. One account gets one active sync job at a time.
3. Fresh recent bookmarks are more valuable than complete history on first load.
4. Interactive requests (open bookmark detail) are higher priority than background backfill.

## 5) Proposed Solution

### 5.1 Single Request Gateway (mandatory)

Create one gateway in the service worker: all GraphQL operations must call this gateway.

`UI/feature module -> Gateway -> Policy Engine -> Queue -> X API`

No module should call X API directly. Existing sync/detail/create/delete handlers become gateway clients.

### 5.2 Gateway Components

1. Admission Controller
- Validates auth/account context/capability.
- Applies per-operation allow/deny rules.

2. Idempotency + Dedupe
- Collapses duplicate manual sync clicks into the same active job.
- Returns existing `jobId` when a matching job is already queued/running.

3. Per-Account Queue (concurrency = 1)
- One active network task per account.
- Optional low global concurrency for safety.

4. Policy Engine (config driven)
- Applies cooldown, max pages, max bookmarks, and request cadence.
- Applies different policy profiles (`free`, `premium` later).

5. Budget Guard
- Tracks short-window request counts and 429s.
- Activates safety cooldown when thresholds are breached.

6. Progress + State Reporter
- Exposes sync status to UI (`queued`, `running`, `paused`, `blocked`, `done`, `failed`).

## 6) Sync Modes

### 6.1 Quick Sync (default manual and first-run)

Purpose: immediate usable data with low request volume.

- Fetch newest pages only.
- Stop at cap.
- Save cursor for optional future continuation.

Default free-tier cap:
- `PAGE_SIZE = 20`
- `MAX_PAGES_PER_JOB = 10`
- `MAX_BOOKMARKS_PER_JOB = 200`

Result: first run needs about 10 page requests instead of hundreds for very large accounts.

### 6.2 Incremental Sync (auto/stale refresh)

- Fetch only latest page(s) from head.
- Reconcile additions/removals conservatively.
- Respect backoff and freshness windows.

### 6.3 Deferred Backfill (low priority, optional)

- Continues from saved cursor in small chunks.
- Runs only when policy allows.
- Easy to disable for free tier.

## 7) Manual Sync UX Rules

1. If sync already running for account:
- Button is disabled.
- UI shows progress and last update time.
- Re-click returns active job info instead of starting new network run.

2. Manual cooldown:
- Free tier default: `15 minutes`.
- If clicked during cooldown: return `blocked: cooldown` with human message.

3. Advanced controls:
- Keep frequent/full-resync actions inside advanced settings, not primary CTA.

4. Recovery:
- Stale in-flight locks can be reclaimed after TTL (existing behavior retained).

## 8) Bookmark Display and Fetch Limits

We separate network limit from UI display limit.

1. Network fetch limit (v1 free)
- First manual sync fetches max 200 bookmarks.

2. UI display limit (v1 free)
- Show latest 200 bookmarks by default.
- Provide explicit “Load older from local cache” in chunks (for users already having more locally).
- No additional network call for local-only pagination.

3. Reason
- Keeps UI fast.
- Reduces temptation to over-sync.
- Gives predictable resource usage on low-end devices.

## 9) Policy Configuration (future-proof for premium)

Add account/profile-aware policy object:

```ts
type SyncPolicy = {
  manualCooldownMs: number;
  maxPagesPerJob: number;
  maxBookmarksPerJob: number;
  uiVisibleBookmarksLimit: number;
  minRequestDelayMs: number;
  maxRequestJitterMs: number;
  burstLimitPerMinute: number;
  emergencyPauseMs: number;
  allowDeferredBackfill: boolean;
};
```

Default profiles:

| Field | Free (v1 default) | Premium (future) |
|---|---:|---:|
| `manualCooldownMs` | 900,000 (15m) | 120,000 (2m) |
| `maxPagesPerJob` | 10 | 50 |
| `maxBookmarksPerJob` | 200 | 1,000 |
| `uiVisibleBookmarksLimit` | 200 | 1,000 |
| `allowDeferredBackfill` | false | true |

## 10) Internal Contracts

### 10.1 Request message

`REQUEST_SYNC`
- Input: `accountId`, `trigger`, `requestedMode`, `requestedLimit?`
- Output:
  - `accepted` with `jobId`
  - `deduped` with existing `jobId`
  - `blocked` with reason (`in_flight`, `cooldown`, `not_ready`, `no_account`, `budget_guard`)

### 10.2 Status message

`GET_SYNC_STATUS`
- Input: `accountId`
- Output: `jobId`, `state`, `fetchedCount`, `targetCount`, `startedAt`, `updatedAt`, `reason?`

### 10.3 Event stream (optional first pass via polling)

`SYNC_STATUS_CHANGED`
- Emitted on state transitions so UI progress is live.

## 11) Data Model

Add `sync_jobs` state (in `chrome.storage.local` or IndexedDB):

- `jobId`
- `accountId`
- `trigger` (`manual` | `auto`)
- `mode` (`quick` | `incremental` | `backfill`)
- `status` (`queued` | `running` | `paused` | `done` | `failed` | `blocked`)
- `requestedAt`, `startedAt`, `updatedAt`, `endedAt`
- `fetchedBookmarks`
- `targetBookmarks`
- `cursor`
- `blockedReason`
- `leaseId`

Retention:
- Keep latest 20 jobs/account for diagnostics.

## 12) Failure and Safety Handling

1. 429/Rate limit
- Exponential backoff.
- After N consecutive 429s, enter emergency pause for account.

2. 401/403
- Mark auth degraded.
- Stop queue for account.
- Require re-auth flow.

3. Network errors/timeouts
- Retry with capped attempts and jitter.
- Persist cursor/checkpoint to avoid restart from zero.

4. Multi-tab concurrency
- Queue ownership remains in service worker with lock + lease (existing orchestrator concepts retained).

## 13) Metrics

Primary metrics:
1. Requests per active user/day.
2. Average requests per manual sync.
3. Duplicate manual clicks collapsed (% deduped).
4. 429 incidence rate.
5. Median time to first usable bookmarks (TTFUB).
6. Sync success rate.

Guardrail metrics:
1. Auth-expiry errors after sync start.
2. Job timeout rate.
3. UI time-to-interactive with 10k local bookmarks.

## 14) Rollout Plan

### Phase 1: Gateway Foundation

1. Introduce gateway module and migrate all X API calls through it.
2. Add idempotent manual sync dedupe.
3. Keep existing sync behavior, but now policy enforced centrally.

Exit criteria:
- No direct API calls outside gateway.
- Repeated manual clicks return same `jobId`.

### Phase 2: Quick Sync Cap + UI States

1. Enforce `maxBookmarksPerJob=200` for free profile.
2. Add sync progress states in UI.
3. Add manual cooldown messaging.

Exit criteria:
- First manual sync does not exceed cap.
- Cooldown and in-flight states are visible and clear.

### Phase 3: Display Cap + Local Pagination

1. Default display to latest 200.
2. Add local “Load older” chunking.
3. Verify smooth performance on large local DB.

Exit criteria:
- No heavy render lag with large bookmark libraries.

### Phase 4: Premium Policy Toggle

1. Add policy profile resolver.
2. Enable larger caps/faster cadence behind plan flag.

Exit criteria:
- Same gateway code path for free and premium; only config differs.

## 15) Test Plan (minimum)

1. Unit tests:
- Dedupe/idempotency behavior.
- Cooldown decisions.
- Cap enforcement.
- Budget guard and emergency pause.

2. Integration tests:
- Multiple manual clicks while running.
- Resume after service worker restart.
- 429 burst handling.
- Account switch isolation.

3. E2E tests:
- First sync with simulated 10,000 bookmarks returns first 200 quickly.
- UI remains responsive while sync is active.
- No duplicate sync jobs created by rapid clicks.

## 16) Acceptance Criteria

1. All X API requests pass through gateway.
2. One in-flight sync per account at any point.
3. Repeated manual clicks do not multiply request volume.
4. Free tier first sync caps at 200 bookmarks by default.
5. UI default shows latest 200 bookmarks with clear state and local pagination.
6. Safety backoff is triggered on repeated rate-limit responses.
7. Config values can be changed per tier without rewriting sync flow.

## 17) Open Questions

1. Should deferred backfill be enabled for free users at a very slow cadence, or fully disabled?
2. Should “Load older” auto-trigger a backfill request when local cache has no older items?
3. Should manual cooldown start at request time or successful completion time?
4. What premium limits are acceptable from cost/risk perspective at launch?
