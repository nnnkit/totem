# Totem — Architecture

Chrome extension (Manifest V3, React 19 + TypeScript) that syncs X/Twitter bookmarks for offline reading.

No state management library — all state lives in hooks at the App level, backed by IndexedDB + chrome.storage.

```
                          ┌──────────────────────────────────────┐
                          │            YOUR BROWSER              │
                          │                                      │
  ┌─────────┐             │  ┌──────────────┐  ┌─────────────┐  │
  │         │  cookies,   │  │              │  │             │  │
  │  x.com  │──headers───▶│  │   Service    │◀─│  Totem App  │  │
  │  tabs   │  traffic    │  │   Worker     │  │  (New Tab)  │  │
  │         │◀────────────│  │              │  │             │  │
  └─────────┘  API calls  │  └──────┬───────┘  └──────┬──────┘  │
      │                   │         │                  │         │
      │                   │    chrome.storage     IndexedDB      │
      ▼                   │    (auth, events,     (bookmarks,    │
  ┌─────────┐             │     catalog, sync)    details,       │
  │ Content │             │                       progress,      │
  │ Script  │             │                       highlights)    │
  │ (twid)  │             │                                      │
  └─────────┘             └──────────────────────────────────────┘

  Content Script — reads twid cookie on x.com, detects logged-in user
  Service Worker — intercepts network traffic, captures auth, proxies API calls
  React App      — UI, state management via hooks, reads/writes IndexedDB
```

---

## 1. Authentication

Totem piggybacks on your existing Twitter session. It needs three things before it can work:

```
  ① USER ID          "Who are you?"                    ← content script reads twid cookie
  ② AUTH HEADERS      "Prove it to Twitter's API"      ← SW intercepts x.com requests
  ③ QUERY ID          "Which API endpoint to call"     ← SW resolves from cache/catalog/bundles

  All three ✓  →  phase: "ready"
  Missing any  →  phase: "connecting" or "need_login"
```

### How each piece is captured

```
  ┌─ USER ID ──────────────────────────────────────────────────────────────┐
  │                                                                        │
  │  x.com loads → detect-user.js runs at document_start                   │
  │       │                                                                │
  │       ▼                                                                │
  │  document.cookie → find "twid=u%3D123456789" → parse numeric ID        │
  │       │                                                                │
  │       ├── found ──► chrome.storage.local.set({ totem_user_id: "..." }) │
  │       └── not found ──► chrome.storage.local.remove("totem_user_id")   │
  └────────────────────────────────────────────────────────────────────────┘

  ┌─ AUTH HEADERS ─────────────────────────────────────────────────────────┐
  │                                                                        │
  │  You browse x.com → browser sends API requests → SW onSendHeaders      │
  │       │                                                                │
  │       ▼                                                                │
  │  Copy: authorization, cookie, x-csrf-token (+ 5 more headers)         │
  │       │                                                                │
  │       ▼                                                                │
  │  chrome.storage.local.set({ totem_auth_headers: {...} })               │
  └────────────────────────────────────────────────────────────────────────┘

  ┌─ QUERY ID (3-tier fallback) ───────────────────────────────────────────┐
  │                                                                        │
  │  Tier 1: Memory cache             instant, 10min TTL                   │
  │       │ miss                                                           │
  │       ▼                                                                │
  │  Tier 2: GraphQL catalog          passively captured from x.com        │
  │       │ miss                       traffic, persisted to storage       │
  │       ▼                                                                │
  │  Tier 3: Bundle discovery          fetch x.com HTML → parse JS         │
  │                                    bundles → regex extract IDs         │
  └────────────────────────────────────────────────────────────────────────┘
```

### Phase machine (useAuth)

```
                       ┌──────────┐
            app mounts │ loading  │ sends CHECK_AUTH to SW
                       └────┬─────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
        all three pieces?       missing something?
                 │                     │
                 ▼                     ▼
            ┌────────┐          ┌────────────┐
            │ ready  │◄─────┐  │ connecting │ opens x.com tab silently
            └────────┘      │  │            │ polls every 1s for 15s
                            │  └──┬─────┬───┘
                    auth ───┘     │     │
                    arrives       │     │ 15s timeout
                                  │     ▼
                                  │  ┌────────────┐
                                  │  │ need_login │ "Log in to X"
                                  │  └──────┬─────┘
                                  │         │
                                  │    user clicks Login
                                  │         │
                                  └─────────┘ resets to loading

  Recovery: even in need_login, storage listener watches for
  auth_headers changes → auto-recovers to ready when you log in elsewhere
```

### Timing constants

| Constant | Value | Purpose |
|---|---|---|
| `AUTH_TIMEOUT_MS` | 8s | Max wait for a single checkAuth() call |
| `AUTH_POLL_MS` | 1s | Polling interval while in "connecting" |
| `AUTH_CONNECTING_TIMEOUT_MS` | 15s | Max time in "connecting" before giving up |
| `AUTH_RECHECK_MS` | 1.2s | Retry delay after no-user capture attempt |
| `AUTH_QUICK_CHECK_MS` | 0.5s | Quick recheck when user exists but auth missing |

**Files**: `src/hooks/useAuth.ts`, `src/api/core/auth.ts`, `public/content/detect-user.js`

---

## 2. Bookmark Sync Engine

Three sync strategies work together to keep your local bookmark database current:

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                                                                        │
  │   HARD SYNC              SOFT SYNC             REAL-TIME EVENTS        │
  │   ───────────            ─────────             ────────────────        │
  │   Full download          Quick check           Instant reaction        │
  │   All pages              1 page (20)           Single bookmark         │
  │   Every 2h               Every 10min           As it happens           │
  │                                                                        │
  │   Triggered by:          Triggered by:         Triggered by:           │
  │   • First sync ever      • SW light sync       • You bookmark/         │
  │   • Stale cache (>2h)      signal                unbookmark on x.com  │
  │   • Manual refresh       • Manual refresh       (webRequest capture)   │
  │                                                                        │
  └────────────────────────────────────────────────────────────────────────┘
```

### Mount flow — what happens when you open a new tab

```
  useBookmarks mounts
       │
       ▼
  getAllBookmarks() from IndexedDB ← instant, local data
       │
  ┌────┴───────────────────┐
  ▼                        ▼
  has bookmarks            empty DB
  │                        │
  │  Show immediately!     │  Ever synced before?
  │  (< 100ms)            │  (check CS_LAST_SYNC)
  │       │                │       │
  │       ▼                │  ┌────┴────┐
  │  Last reconcile?       │  ▼         ▼
  │       │                │  never     yes (DB cleared)
  │  ┌────┴────┐           │  │         └─► show empty
  │  ▼         ▼           │  ▼
  │  > 2h      < 2h        │  runHardSync()
  │  │         └─► done    │  (first-time full download)
  │  ▼                     │
  │  runHardSync           │
  │  (fullReconcile)       │
  └────────────────────────┘
```

### Hard sync — the full download

```
  runHardSync()
       │
       ▼
  Create FetchQueue + set abort timeout
  Timeout = 3min + 30s per 1000 bookmarks (max 10min)
       │
       ▼
  ┌──── LOOP ──────────────────────────────────────────────────────┐
  │                                                                │
  │  fetchPage(cursor)                                             │
  │       │                                                        │
  │       │  FetchQueue adds human-like delay between requests:    │
  │       │  ┌──────────────────────────────────────────────────┐  │
  │       │  │  1.2s base + random jitter (0-800ms)            │  │
  │       │  │  + 20% chance of extra 2-5s "reading pause"     │  │
  │       │  └──────────────────────────────────────────────────┘  │
  │       ▼                                                        │
  │  SW → x.com GraphQL API → response                             │
  │       │                                                        │
  │       ▼                                                        │
  │  onPage(newBookmarks):                                         │
  │    dedup against current bookmarks                             │
  │    merge + sort by sortIndex desc                              │
  │    setState (UI updates live while syncing)                    │
  │    upsert to IndexedDB                                         │
  │       │                                                        │
  │  more pages? ─► continue                                       │
  │  no more?    ─► break                                          │
  └────────────────────────────────────────────────────────────────┘
       │
       ▼
  if fullReconcile:
    staleIds = local IDs not found in remote
    delete stale from DB + state in single transaction
       │
       ▼
  Save CS_LAST_SYNC + CS_LAST_RECONCILE timestamps
```

### Real-time bookmark events — create vs delete asymmetry

```
  DELETE: we know the tweetId immediately       CREATE: must wait for confirmation
  ─────────────────────────────────────         ──────────────────────────────────

  onBeforeRequest                               onCompleted (2xx from x.com)
       │                                             │
       ▼                                             ▼
  extract tweetId from body                     push "CreateBookmark" event
  push "DeleteBookmark" event                        │
       │                                             ▼
       ▼                                        storage change triggers React
  storage change triggers React                      │
       │                                             ▼
       ▼                                        wait 1.5s (replication delay)
  remove from state + DB                             │
  ack immediately                                    ▼
                                                fetch 1 page (20 bookmarks)
                                                add anything missing
                                                ack only on success
                                                (retry on failure)
```

### Error recovery during sync

```
  API returns 401/403 mid-sync
       │
       ▼
  Show "reconnecting" → poll every 2s (max 15 attempts)
  "Is SW done re-authenticating?"
       │
  ┌────┴────┐
  ▼         ▼
  auth OK   timed out (30s)
  │         └── show error state
  ▼
  Retry the entire hard sync
```

**Files**: `src/hooks/useBookmarks.ts`, `src/lib/reconcile.ts`, `src/lib/fetch-queue.ts`, `src/lib/bookmark-event-plan.ts`

**Throttles**: Hard sync 2h, soft sync 10min, event dedup 1s window, light sync signal 60s debounce / 30min throttle.

---

## 3. Data Persistence (IndexedDB)

```
  ┌────────────────────────── IndexedDB "totem" v6 ──────────────────────────┐
  │                                                                          │
  │   bookmarks              tweet_details         reading_progress          │
  │   ─────────              ─────────────         ────────────────          │
  │   Your saved bookmarks   Full tweet content    Where you left off        │
  │   from Twitter           (HTML, media, thread) reading each bookmark     │
  │                                                                          │
  │   key: id                key: tweetId          key: tweetId              │
  │   idx: tweetId           idx: fetchedAt        idx: lastReadAt           │
  │   idx: sortIndex                                                         │
  │   idx: createdAt         30-day TTL            Fields: scrollY,          │
  │   idx: screenName        weekly cleanup        scrollHeight, completed   │
  │                                                                          │
  │   highlights                                                             │
  │   ──────────                                                             │
  │   Text you've highlighted + notes                                        │
  │                                                                          │
  │   key: id                                                                │
  │   idx: tweetId                                                           │
  │   idx: createdAt                                                         │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Data flow through the stores

```
  Bookmark synced from Twitter ──► bookmarks store (metadata only)
                                        │
  You open a bookmark to read ──────────┼──► tweet_details store (full HTML, 30-day cache)
                                        │
  You scroll through it ────────────────┼──► reading_progress store (scrollY, completed)
                                        │
  You highlight text ───────────────────┼──► highlights store (text, offsets, note)
```

### Database initialization

```
  Any DB operation
       │
       ▼
  getDb() ─── dbPromise exists? ─── yes ──► return cached connection
       │
       no (first call or after disconnect)
       │
       ▼
  createDb() → openDB("totem", 6) with upgrade handler
       │
       ▼
  migrateLegacyDatabaseIfNeeded()
       │
       ├── "xbt" DB exists + "totem" empty? → copy all 4 stores
       └── otherwise → skip
```

### Self-healing connection

```
  "blocking"   → another tab upgrading DB → dbPromise = null (reopen on next call)
  "terminated" → browser killed connection → dbPromise = null (reopen on next call)
  "blocked"    → we're upgrading, other tab open → keep running (no crash)
```

### Deletion cascade

`deleteBookmarksByTweetIds()` removes from all 4 stores in a single atomic transaction — no orphaned data possible.

**Files**: `src/db/index.ts`, `src/lib/constants/db.ts`

---

## 4. Service Worker (API Proxy)

The service worker runs independently of any tab. Three responsibilities: passive capture, on-demand API proxy, background maintenance.

### Web request listeners (passive capture)

```
  ┌─ onSendHeaders ─── fires on every x.com/i/api/graphql/* request ───────┐
  │                                                                         │
  │  1. Capture auth headers → chrome.storage.local                         │
  │     (triggers discoverAllMissingQueryIds on each capture)               │
  │                                                                         │
  │  2. Capture GraphQL catalog → in-memory + debounced flush to storage    │
  │     (operation name, queryId, params, features)                         │
  │                                                                         │
  │  3. Capture query IDs into memory cache                                 │
  │     /Bookmarks, /TweetDetail, /DeleteBookmark, /CreateBookmark          │
  │                                                                         │
  │  4. Capture ?features= param → persist for our own API calls            │
  │                                                                         │
  │  5. Detect delete mutations → push "DeleteBookmark" event               │
  │     (tweetId from referer header)                                       │
  │                                                                         │
  │  6. Signal light sync (debounced 60s, throttled 30min)                  │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌─ onBeforeRequest ─── fires on Create/Delete bookmark mutations ────────┐
  │                                                                         │
  │  Parse request body → extract tweetId                                   │
  │  Cache mutation query IDs (in-memory)                                   │
  │  DELETE: push event immediately   CREATE: don't push (not confirmed)    │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌─ onCompleted ─── fires after x.com returns 2xx for mutations ──────────┐
  │                                                                         │
  │  CREATE: push event now (x.com confirmed)   DELETE: already handled     │
  └─────────────────────────────────────────────────────────────────────────┘
```

### Message handler (API proxy for React app)

```
  React App                          Service Worker
  ─────────                          ──────────────

  CHECK_AUTH ───────────────────────► read storage, sync cookie, resolve query ID
                                ◄─── { hasUser, hasAuth, hasQueryId }

  FETCH_BOOKMARKS(cursor, count) ──► build headers, resolve QID, GET GraphQL
                                ◄─── { data: json }

  FETCH_TWEET_DETAIL(tweetId) ─────► same pattern, TweetDetail endpoint
  DELETE_BOOKMARK(tweetId) ─────────► POST to DeleteBookmark endpoint
  START_AUTH_CAPTURE ───────────────► open x.com tab silently
  CLOSE_AUTH_TAB ───────────────────► close the auth tab
  RESET_SW_STATE ───────────────────► clear all in-memory caches
```

### Self-healing API calls (double retry)

Every API call has two independent retry paths:

```
  fetch(x.com GraphQL API)
       │
  ┌────┴──────────────────────────────────────┐
  ▼                                            ▼
  200 OK                                   401/403
  │                                         │
  ▼                                         ▼
  Check JSON for                       already retried auth?
  GRAPHQL_VALIDATION_FAILED            no → reAuthSilently() → retry
  or HTTP 400                          yes → throw AUTH_EXPIRED
  │
  ▼
  already retried queryId?
  no → forceRediscoverQueryId() → retry
  yes → throw error
```

### In-memory state (lost on SW restart — Chrome can kill the SW at any time)

| Variable | Type | Purpose |
|---|---|---|
| `queryIdMemCache` | `Map<op, {id, ts}>` | Query IDs with 10min TTL |
| `graphqlCatalogCache` | object | Mirror of persisted catalog |
| `authTabId` | `number \| null` | Auth capture tab reference |
| `reauthInProgress` | boolean | Prevents concurrent reauth |
| `discoveryInProgress` | boolean | Prevents concurrent bundle fetches |
| `catalogDirty` / `catalogFlushTimer` | — | Debounced flush state |
| `lastLightSyncSignalAt` | timestamp | Light sync debounce |

All rebuilt from chrome.storage or bundle discovery on next SW wake.

### Startup sequence

```
  SW wakes up → migrateOldStorageKeys() (tw_/xbt_ → totem_)
             → runWeeklyServiceWorkerCleanup() (prune old events + catalog)
             → if auth exists: discoverAllMissingQueryIds() (pre-warm cache)
```

**Files**: `public/service-worker.js`

**GraphQL catalog**: Passively captured, debounced flush (600ms), max 300 endpoints, 30-day retention, weekly cleanup.

---

## 5. Reading Experience

Four cooperating hooks handle the reader, scroll restore, highlights, and offline prefetch.

### useReadingProgress — scroll restore

```
  Open bookmark → load progress from IndexedDB
       │
       ▼
  Wait for contentReady (HTML fully rendered)
       │
       ▼
  ┌──────────────────────────────────────────────┐
  │  completed?                                   │
  │  └── yes → scroll to top (read it fresh)      │
  │                                               │
  │  not completed:                               │
  │    saved height vs current height             │
  │         │                                     │
  │    ┌────┴──────────┐                          │
  │    ▼               ▼                          │
  │  changed > 15%    similar                     │
  │    │               │                          │
  │    ▼               ▼                          │
  │  ratio-based      absolute                    │
  │  scroll restore   scroll restore              │
  │  (adapts to       (pixel-perfect)             │
  │   new height)                                 │
  └──────────────────────────────────────────────┘
```

### useHighlights — persistent text highlighting

```
  LOADING                                 KEEPING ALIVE
  ───────                                 ────────────

  contentReady → load from IndexedDB      MutationObserver watches container
       │                                       │
       ▼                                       ▼
  For each highlight:                     DOM changed? (ignores own <mark>s)
    find section by CSS ID                     │
    verify text at offsets matches             ▼
    wrap in <mark class="totem-highlight">  1. pause observer
       │                                    2. strip ALL existing <mark>s
       ▼                                    3. re-apply ALL highlights
  Retry up to 10x at 60ms                  4. resume observer
  if DOM not ready yet
                                          (nuclear rebuild — simple, reliable)


  ADDING                                  REMOVING
  ──────                                  ────────

  User selects text                       removeHighlight(id)
       │                                       │
       ▼                                       ▼
  Create Highlight object                 Delete from IndexedDB
  Save to IndexedDB                       Remove from highlightsRef
  Add to highlightsRef                    Increment revision → re-render
  Flash animation
  Increment revision → re-render
```

### useContinueReading — reading list organizer

```
  bookmarks + getAllReadingProgress() from IndexedDB
       │
       ▼
  JOIN by tweetId:
       │
       ├── bookmark HAS progress ──► continueReading[]   (started reading)
       └── bookmark NO progress  ──► allUnread[]          (never opened)

  UI tabs: [Unread] [Continue Reading] [Read]
```

### usePrefetchDetails — offline readiness

```
  isReady + has bookmarks + reader closed
       │
       ▼
  Build pool: top N bookmarks without cached details
  Prioritize: read bookmarks first, then unread (capped)
       │
       ▼
  Fetch one detail at a time, 45s pause between each
  Cancel immediately if: reader opens or bookmarks change
```

**Files**: `src/hooks/useReadingProgress.ts`, `src/hooks/useHighlights.ts`, `src/hooks/useContinueReading.ts`, `src/hooks/usePrefetchDetails.ts`

---

## 6. Settings & Theme

Both hooks follow the same pattern:

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   React State  ◄───── load on mount ─────  chrome.storage.sync      │
  │   (instant UI) ─── write on change ─────►  (persisted, cross-device)│
  │                ◄── storage change event ──  (syncs from other device)│
  │                                                                     │
  │   All values normalized on load — invalid values fall to defaults   │
  └─────────────────────────────────────────────────────────────────────┘
```

### useSettings

Race condition guard: `userPatchedRef` — if user changes a setting before async load completes, the stale load won't overwrite their change.

| Field | Type | Default |
|---|---|---|
| `showTopSites` | boolean | false |
| `showSearchBar` | boolean | true |
| `topSitesLimit` | 1-10 | 5 |
| `backgroundMode` | `"gradient" \| "images"` | `"images"` |
| `searchEngine` | `"google" \| "bing" \| "duckduckgo" \| ...` | `"google"` |

### useTheme

```
  themePreference ── "light" ──► apply "light"
                  ── "dark"  ──► apply "dark"
                  ── "system" ─► query prefers-color-scheme
                                 + live mediaQuery listener
                                      │
                                      ▼
                                 apply resolved theme to:
                                   document.documentElement.dataset.theme
                                   document.documentElement.style.colorScheme
```

**Files**: `src/hooks/useSettings.ts`, `src/hooks/useTheme.ts`

---

## 7. Reset Logic

Careful sequence that clears everything except auth:

```
  resetLocalData()
       │
  ─────┼──────────────────────────────────────────────────────────────────
  0.   │  RESET_SW_STATE → service worker
       │  Clears: catalog cache, auth tab, reauth flag, discovery flag
       │
  ─────┼──────────────────────────────────────────────────────────────────
  1.   │  IndexedDB
       │  clearAllLocalData() → empty all 4 stores
       │  closeDb() → release connection
       │  deleteDatabase("totem") + deleteDatabase("xbt")
       │
  ─────┼──────────────────────────────────────────────────────────────────
  2.   │  localStorage
       │  Remove: has_bookmarks, reading_tab, + all legacy keys
       │
  ─────┼──────────────────────────────────────────────────────────────────
  3.   │  chrome.storage.local (NON-AUTH ONLY)
       │  Remove: cleanup_at, last_reconcile, last_sync, events, soft_sync
       │  PRESERVED: auth_headers, auth_time, user_id, graphql_catalog
       │
  ─────┼──────────────────────────────────────────────────────────────────
  4.   │  chrome.storage.sync
       │  Remove: settings, theme
       │
  ─────┼──────────────────────────────────────────────────────────────────
       ▼
  window.location.reload()
  → empty state, auth still valid
  → hard sync triggers (no CS_LAST_SYNC) → full re-fetch from Twitter
```

Auth preserved intentionally — avoids opening a disruptive background tab to re-capture headers.

**Files**: `src/lib/reset.ts`, `src/App.tsx`

---

## 8. Page Reload & State Recovery

```
  SURVIVES RELOAD                            REBUILT ON MOUNT
  ───────────────                            ────────────────

  chrome.storage.local                       bookmarksRef ← from IndexedDB
    auth, sync timestamps, events            selectedBookmark ← null (reader closes)
  chrome.storage.sync                        fetch queues ← new on next sync
    settings, theme                          sync-in-progress flags ← reset
  IndexedDB                                  reauth polling ← re-triggered if needed
    bookmarks, details, progress,            SW in-memory caches ← from storage/bundles
    highlights
  localStorage
    has_bookmarks, reading_tab
```

### Recovery flow on mount

```
  t=0      useAuth starts (loading) + useBookmarks loads from IndexedDB
  t<100ms  cached bookmarks visible (instant)
  t=?      checkAuth() resolves → isReady = true
           │
           ├── cache stale (>2h) → hard sync in background
           └── cache fresh → done, show cached data
```

### Deep linking

`?read=tweetId` → find bookmark → openBookmark() → remove query param. One-time use, not restored on reload.

---

## Storage Map

| Layer | Key | What | Survives reload |
|---|---|---|---|
| `chrome.storage.local` | `totem_auth_headers` | Captured auth headers | Yes |
| `chrome.storage.local` | `totem_auth_time` | When auth was captured | Yes |
| `chrome.storage.local` | `totem_user_id` | X user ID from cookie | Yes |
| `chrome.storage.local` | `totem_last_reconcile` | Last full reconcile time | Yes |
| `chrome.storage.local` | `totem_last_sync` | Last hard sync time | Yes |
| `chrome.storage.local` | `totem_last_light_sync` | Last soft sync time | Yes |
| `chrome.storage.local` | `totem_bookmark_events` | Pending mutation events | Yes |
| `chrome.storage.local` | `totem_graphql_catalog` | Captured GraphQL endpoints | Yes |
| `chrome.storage.local` | `totem_features` | Captured API feature flags | Yes |
| `chrome.storage.sync` | `totem_settings` | User preferences | Yes (cross-device) |
| `chrome.storage.sync` | `totem_theme` | Theme preference | Yes (cross-device) |
| `localStorage` | `totem_has_bookmarks` | Quick check for splash screen | Yes |
| `localStorage` | `totem_reading_tab` | Active reading tab | Yes |
| `IndexedDB` | `bookmarks` store | All synced bookmarks | Yes |
| `IndexedDB` | `tweet_details` store | Cached full tweet content | Yes (30-day TTL) |
| `IndexedDB` | `reading_progress` store | Scroll position + completion | Yes |
| `IndexedDB` | `highlights` store | Text highlights + notes | Yes |
| In-memory (SW) | `queryIdMemCache` | Query IDs (10min TTL) | No |
| In-memory (SW) | `graphqlCatalogCache` | Catalog mirror | No |
| In-memory (SW) | `authTabId` | Auth capture tab reference | No |
