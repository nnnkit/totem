# Totem — Architecture

Chrome extension (Manifest V3, React 19 + TypeScript) that syncs X/Twitter bookmarks for offline reading.

Three layers: **service worker** (API proxy, auth capture), **content scripts** (cookie/user detection), **React app** (UI, state, IndexedDB).

No state management library — all state lives in hooks at the App level, backed by IndexedDB + chrome.storage.

---

## 1. Authentication

```
┌─────────────────────────────────────────────────────────────────────┐
│  useAuth (phase machine)                                            │
│                                                                     │
│  loading ──► checkAuth() ──► service worker                         │
│                │                  │                                  │
│                │    ┌─────────────┼──────────────────┐              │
│                │    │             ▼                   │              │
│                │    │  read storage: user_id,         │              │
│                │    │  auth_headers, auth_time        │              │
│                │    │         │                       │              │
│                │    │  syncAuthSessionFromCookie()    │              │
│                │    │         │                       │              │
│                │    │  resolveQueryId("Bookmarks")    │              │
│                │    │         │                       │              │
│                │    │    ┌────┴─────┐                 │              │
│                │    │    ▼          ▼                  │              │
│                │    │  hasAuth   no auth/user          │              │
│                │    │  hasQID                          │              │
│                │    └─────────────────────────────────┘              │
│                │                                                     │
│                ▼                                                     │
│  ┌─────────────────────────────────────────────────┐                │
│  │  CHECK_RESULT dispatch                          │                │
│  │                                                 │                │
│  │  no user ──► try one capture ──► still no user  │                │
│  │              (open x.com tab)    ──► need_login  │                │
│  │                                                 │                │
│  │  has user + auth + queryId ──► ready             │                │
│  │                                                 │                │
│  │  has user, missing auth/qid ──► connecting       │                │
│  │    │                                            │                │
│  │    ├── startAuthCapture() (open x.com tab)      │                │
│  │    ├── poll every 1s                            │                │
│  │    └── 15s timeout ──► need_login (gaveUp)      │                │
│  └─────────────────────────────────────────────────┘                │
│                                                                     │
│  Recovery: storage change with auth_headers ──► clear gaveUp        │
│            ──► re-check ──► ready                                   │
│                                                                     │
│  Login button: USER_LOGIN ──► reset to loading ──► re-check         │
└─────────────────────────────────────────────────────────────────────┘
```

**Files**: `src/hooks/useAuth.ts`, `src/api/core/auth.ts`

**Auth header capture** (service worker):
- `onSendHeaders` on `x.com/i/api/graphql/*` captures authorization, cookie, csrf token
- Stored in `chrome.storage.local` as `totem_auth_headers`
- Triggers `discoverAllMissingQueryIds()` on each capture

**User detection** (content script):
- `detect-user.js` runs at `document_start` on x.com
- Reads `twid` cookie → extracts numeric user ID
- Writes `totem_user_id` to `chrome.storage.local`

**Query ID resolution** (service worker, 3-tier fallback):
```
1. In-memory cache (10min TTL, lost on SW restart)
       │ miss
       ▼
2. GraphQL catalog (passively captured from x.com traffic, persisted)
       │ miss
       ▼
3. Bundle discovery (fetch x.com HTML → parse JS bundles → extract IDs)
```

---

## 2. Bookmark Sync Engine

```
┌───────────────────────────────────────────────────────────────────┐
│  useBookmarks(isReady, loadCacheOnly)                             │
│                                                                   │
│  Mount ──► getAllBookmarks() from IndexedDB                       │
│                │                                                  │
│    ┌───────────┴───────────┐                                      │
│    ▼                       ▼                                      │
│  has bookmarks           empty DB                                 │
│    │                       │                                      │
│    │  show cached          │  check CS_LAST_SYNC                  │
│    │  check reconcile      │     │                                │
│    │  throttle (2h)        │  ┌──┴──┐                             │
│    │     │                 │  ▼     ▼                              │
│    │  ┌──┴──┐              │ never  has synced                    │
│    │  ▼     ▼              │  │     └─► done (0)                  │
│    │ stale  fresh          │  ▼                                   │
│    │  │     └─► done       │ runHardSync()                        │
│    │  ▼                    │                                      │
│    │ runHardSync           │                                      │
│    │ (fullReconcile)       │                                      │
│    │                       │                                      │
│    └───────────────────────┘                                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Hard Sync                                                  │  │
│  │                                                             │  │
│  │  FetchQueue (human-like delays: 1.2s + jitter)              │  │
│  │       │                                                     │  │
│  │       ▼                                                     │  │
│  │  reconcileBookmarks()                                       │  │
│  │    while (pages remain):                                    │  │
│  │      fetchPage(cursor) ──► SW ──► x.com GraphQL API         │  │
│  │           │                                                 │  │
│  │           ▼                                                 │  │
│  │      onPage(newBookmarks):                                  │  │
│  │        dedup vs bookmarksRef.current                        │  │
│  │        merge + sort by sortIndex desc                       │  │
│  │        upsert to IndexedDB                                  │  │
│  │           │                                                 │  │
│  │      if fullReconcile:                                      │  │
│  │        collect all remote IDs                               │  │
│  │        staleIds = local - remote                            │  │
│  │        delete stale from DB + state                         │  │
│  │                                                             │  │
│  │  Abort: dynamic timeout based on bookmark count             │  │
│  │         (3min base + 30s per 1000 bookmarks, max 10min)     │  │
│  │                                                             │  │
│  │  Auth error ──► reauth polling (2s × 15 attempts max)       │  │
│  │                 ──► retry on success                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Soft Sync (incremental, 10min throttle)                    │  │
│  │                                                             │  │
│  │  fetch 1 page (20 bookmarks) ──► add missing ──► done       │  │
│  │  triggered by: SW light sync signal, manual refresh         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Real-time Bookmark Events                                  │  │
│  │                                                             │  │
│  │  x.com user action ──► webRequest listeners ──► SW queue    │  │
│  │                                                             │  │
│  │  Delete flow:                                               │  │
│  │    onBeforeRequest (body) ──► pushBookmarkEvent              │  │
│  │    onSendHeaders (referer) ──► pushBookmarkEvent (deduped)   │  │
│  │    ──► storage change ──► applyBookmarkEvents()              │  │
│  │    ──► remove from state + DB ──► ack immediately            │  │
│  │                                                             │  │
│  │  Create flow:                                               │  │
│  │    onCompleted (2xx) ──► pushBookmarkEvent                   │  │
│  │    ──► storage change ──► applyBookmarkEvents()              │  │
│  │    ──► wait 1.5s (replication delay)                         │  │
│  │    ──► fetch 1 page (20) ──► add missing ──► ack on success  │  │
│  │    (on fetch failure: don't ack, retry on next trigger)      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

**Files**: `src/hooks/useBookmarks.ts`, `src/lib/reconcile.ts`, `src/lib/fetch-queue.ts`, `src/lib/bookmark-event-plan.ts`

**Throttles**: Hard sync 2h, soft sync 10min, event dedup 1s window.

---

## 3. Data Persistence (IndexedDB)

```
┌─────────────────────────────────────────────────────────────────┐
│  IndexedDB "totem" (version 6)                                  │
│                                                                 │
│  ┌───────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  bookmarks    │  │  tweet_details   │  │  reading_       │  │
│  │               │  │                  │  │  progress        │  │
│  │  key: id      │  │  key: tweetId    │  │                 │  │
│  │  idx: tweetId │  │  idx: fetchedAt  │  │  key: tweetId   │  │
│  │  idx: sort    │  │                  │  │  idx: lastRead  │  │
│  │  idx: created │  │  30-day TTL      │  │                 │  │
│  │  idx: screen  │  │  weekly cleanup  │  │  scrollY        │  │
│  │               │  │                  │  │  scrollHeight   │  │
│  └───────────────┘  └──────────────────┘  │  completed      │  │
│                                           └─────────────────┘  │
│  ┌───────────────┐                                              │
│  │  highlights   │                                              │
│  │               │                                              │
│  │  key: id      │                                              │
│  │  idx: tweetId │                                              │
│  │  idx: created │                                              │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

```
Initialization:
  getDb() ──► createDb() (lazy, cached promise)
         ──► migrateLegacyDatabaseIfNeeded()
               │
               ▼
         check for "xbt" DB ──► if exists + "totem" empty
                                  ──► copy all 4 stores
                                  ──► close legacy DB

Connection lifecycle:
  blocked  → (other tab upgrading, keep running)
  blocking → dbPromise = null (re-open on next call)
  terminated → dbPromise = null (re-open on next call)
```

**Files**: `src/db/index.ts`, `src/lib/constants/db.ts`

**Deletion cascade**: `deleteBookmarksByTweetIds()` removes from all 4 stores (bookmarks + details + progress + highlights) in a single transaction.

---

## 4. Service Worker (API Proxy)

```
┌─────────────────────────────────────────────────────────────────────┐
│  service-worker.js                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────┐                        │
│  │  Web Request Listeners                  │                        │
│  │                                         │                        │
│  │  onSendHeaders (x.com/i/api/graphql/*): │                        │
│  │    • capture auth headers → storage     │                        │
│  │    • capture query IDs → memcache       │                        │
│  │    • capture features → storage         │                        │
│  │    • capture GraphQL catalog            │                        │
│  │    • detect delete mutations            │                        │
│  │    • signal light sync                  │                        │
│  │                                         │                        │
│  │  onBeforeRequest (Create/Delete):       │                        │
│  │    • extract tweetId from request body  │                        │
│  │    • push delete events                 │                        │
│  │    • cache mutation query IDs           │                        │
│  │                                         │                        │
│  │  onCompleted (Create/Delete):           │                        │
│  │    • push create events (after x.com    │                        │
│  │      confirms success)                  │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                     │
│  ┌─────────────────────────────────────────┐                        │
│  │  Message Handlers                       │                        │
│  │                                         │                        │
│  │  CHECK_AUTH         → read storage,     │                        │
│  │                       sync cookie,      │                        │
│  │                       resolve query ID  │                        │
│  │                                         │                        │
│  │  FETCH_BOOKMARKS    → build headers,    │                        │
│  │                       resolve query ID, │                        │
│  │                       GET GraphQL,      │                        │
│  │                       auto-reauth on    │                        │
│  │                       401/403           │                        │
│  │                                         │                        │
│  │  FETCH_TWEET_DETAIL → same pattern      │                        │
│  │  DELETE_BOOKMARK    → same pattern      │                        │
│  │                                         │                        │
│  │  START_AUTH_CAPTURE → open x.com tab    │                        │
│  │  CLOSE_AUTH_TAB     → close tab         │                        │
│  │  RESET_SW_STATE     → clear all         │                        │
│  │                       in-memory caches  │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                     │
│  ┌─────────────────────────────────────────┐                        │
│  │  In-memory State (lost on SW restart)   │                        │
│  │                                         │                        │
│  │  queryIdMemCache    Map<op, {id, ts}>   │                        │
│  │  graphqlCatalogCache  object            │                        │
│  │  authTabId          number | null       │                        │
│  │  reauthInProgress   boolean             │                        │
│  │  discoveryInProgress boolean            │                        │
│  │  catalogDirty/Timer flush state         │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                     │
│  Auto-reauth on 401/403:                                            │
│    remove auth headers → open x.com tab silently                    │
│    → wait for auth_headers storage change (15s timeout)             │
│    → retry original request                                         │
│                                                                     │
│  Query ID staleness recovery:                                       │
│    GRAPHQL_VALIDATION_FAILED or HTTP 400                            │
│    → forceRediscoverQueryId() from bundles                          │
│    → retry with fresh ID                                            │
│                                                                     │
│  Startup:                                                           │
│    migrateOldStorageKeys() (tw_/xbt_ → totem_)                      │
│    runWeeklyServiceWorkerCleanup()                                  │
│    discoverAllMissingQueryIds() (if auth exists)                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Files**: `public/service-worker.js`

**GraphQL catalog**: Passively captured from real x.com requests. Persisted to storage with debounced flush (600ms). Max 300 endpoints, 30-day retention. Weekly cleanup prunes old entries.

---

## 5. Reading Experience

```
┌─────────────────────────────────────────────────────────────────┐
│  BookmarkReader                                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  useReadingProgress                                       │  │
│  │                                                           │  │
│  │  on tweetId change:                                       │  │
│  │    load progress from IndexedDB                           │  │
│  │                                                           │  │
│  │  on contentReady:                                         │  │
│  │    if completed → scroll to top                           │  │
│  │    if not completed:                                      │  │
│  │      height changed >15% → ratio-based scroll restore     │  │
│  │      height similar → absolute scroll restore             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  useHighlights                                            │  │
│  │                                                           │  │
│  │  on contentReady + tweetId:                               │  │
│  │    load highlights from IndexedDB                         │  │
│  │    apply to DOM (wrap text in <mark> elements)            │  │
│  │    retry up to 10× if DOM not ready (60ms intervals)      │  │
│  │                                                           │  │
│  │  MutationObserver on container:                           │  │
│  │    re-apply highlights when DOM changes                   │  │
│  │    (strip old marks → reapply all → resume observing)     │  │
│  │                                                           │  │
│  │  addHighlight:                                            │  │
│  │    save to IndexedDB → update ref → flash animation       │  │
│  │  removeHighlight:                                         │  │
│  │    delete from IndexedDB → update ref → re-render         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  useContinueReading                                       │  │
│  │                                                           │  │
│  │  getAllReadingProgress() + bookmarks                       │  │
│  │       │                                                   │  │
│  │       ▼                                                   │  │
│  │  join progress with bookmarks by tweetId                  │  │
│  │       │                                                   │  │
│  │       ├─► continueReading: bookmarks with progress        │  │
│  │       └─► allUnread: bookmarks without any progress       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  usePrefetchDetails                                       │  │
│  │                                                           │  │
│  │  when: isReady + has bookmarks + reader closed            │  │
│  │                                                           │  │
│  │  pool = top N bookmarks without cached details            │  │
│  │  prioritize: read bookmarks first, then unread (capped)   │  │
│  │  fetch one at a time, 45s between each                    │  │
│  │  cancel on: reader opens, bookmarks change                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Files**: `src/hooks/useReadingProgress.ts`, `src/hooks/useHighlights.ts`, `src/hooks/useContinueReading.ts`, `src/hooks/usePrefetchDetails.ts`

---

## 6. Settings & Theme

```
useSettings                              useTheme
┌──────────────────────────┐             ┌────────────────────────────┐
│                          │             │                            │
│  chrome.storage.sync     │             │  chrome.storage.sync       │
│  key: totem_settings     │             │  key: totem_theme          │
│                          │             │                            │
│  load on mount           │             │  load on mount             │
│  listen for sync changes │             │  listen for sync changes   │
│  (cross-device)          │             │  (cross-device)            │
│                          │             │                            │
│  normalize invalid       │             │  system | light | dark     │
│  values to defaults      │             │                            │
│                          │             │  mediaQuery listener for   │
│  guard: updateSettings   │             │  system theme changes      │
│  before load won't be    │             │                            │
│  overwritten by stale    │             │  applies to:               │
│  async load              │             │    document.documentElement │
│                          │             │      .dataset.theme        │
│  Fields:                 │             │      .style.colorScheme    │
│    showTopSites          │             │                            │
│    showSearchBar         │             │  resolved: system pref     │
│    topSitesLimit         │             │  maps to actual light/dark │
│    backgroundMode        │             │                            │
│    searchEngine          │             └────────────────────────────┘
└──────────────────────────┘
```

**Files**: `src/hooks/useSettings.ts`, `src/hooks/useTheme.ts`

---

## 7. Reset Logic

```
resetLocalData()
       │
       ▼
  0. chrome.runtime.sendMessage({ type: "RESET_SW_STATE" })
     → clears SW in-memory: catalog cache, auth tab, reauth flag
       │
       ▼
  1. clearAllLocalData() → clear all 4 IndexedDB stores
     closeDb() → release connection
     indexedDB.deleteDatabase("totem")
     indexedDB.deleteDatabase("xbt")     ← legacy
       │
       ▼
  2. localStorage.removeItem() for all known keys
     (tour, reading tab, wallpaper, has_bookmarks)
       │
       ▼
  3. chrome.storage.local.remove() for non-auth keys
     (cleanup_at, last_reconcile, last_sync, events, soft_sync)
     ※ Auth keys preserved intentionally — avoids re-triggering
       auth flow and opening background tab
       │
       ▼
  4. chrome.storage.sync.remove() for settings + theme
       │
       ▼
  window.location.reload()
       │
       ▼
  Post-reload: empty state, auth still valid
  → hard sync triggers (no CS_LAST_SYNC) → full re-fetch
```

**Files**: `src/lib/reset.ts`, `src/App.tsx:125-128`

---

## 8. Page Reload & State Recovery

```
What survives reload:
  ✓ chrome.storage.local  (auth headers, sync timestamps, events)
  ✓ chrome.storage.sync   (settings, theme preference)
  ✓ IndexedDB             (bookmarks, details, progress, highlights)
  ✓ localStorage          (tour, reading tab, wallpaper, has_bookmarks)

What doesn't survive:
  ✗ bookmarksRef.current   → rebuilt from IndexedDB on mount
  ✗ selectedBookmark       → null (reader closes)
  ✗ fetch queues           → new queue created on next sync
  ✗ sync-in-progress flags → reset (hardSyncingRef, softSyncingRef)
  ✗ reauth polling         → re-triggered if auth fails
  ✗ SW in-memory caches    → rebuilt from storage / bundle discovery

Recovery flow:
  mount → useAuth (loading) → checkAuth()
       → useBookmarks → getAllBookmarks() from IndexedDB
            │
            ├─ has bookmarks → show immediately → check reconcile age
            └─ empty → wait for isReady → runHardSync()

Deep linking:
  ?read=tweetId → find bookmark → openBookmark() → remove param
  (one-time use, not restored on reload)
```

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
