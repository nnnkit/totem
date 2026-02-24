# API Interaction Rules

Rules governing how the extension communicates with x.com's GraphQL API.

## 1. Auth Separation

The auth gate (`handleCheckAuth`) checks `xbt_auth_headers` and resolves the Bookmarks query ID on-demand.
All query IDs (Bookmarks, DeleteBookmark, CreateBookmark, TweetDetail) are resolved lazily by their respective handlers — nothing is persisted to storage.

## 2. Self-Healing Query ID Resolution

Every handler uses `resolveQueryId(operationName)` with a three-step fallback chain:

1. **In-memory cache** — `queryIdMemCache` (10min TTL, reset each SW session)
2. **Catalog** — GraphQL catalog via `loadGraphqlCatalog()` (persisted, passively captured)
3. **Bundles** — `discoverQueryIdFromBundles(operationName)` (network, 2-5s)

Results are cached in-memory only. On HTTP 400 (wrong query ID), `forceRediscoverQueryId()` clears the cache and re-fetches from bundles.

## 3. Auth Expiry

On 401/403 responses:
1. Remove `xbt_auth_headers` + `xbt_auth_time`
2. Call `reAuthSilently()` (opens hidden `x.com/i/bookmarks` tab, 15s timeout)
3. Retry the original request once
4. Throw `AUTH_EXPIRED` if retry also fails

## 4. Error Prefixes

| Error | Meaning |
|-------|---------|
| `NO_AUTH` | No auth headers in storage |
| `NO_QUERY_ID` | Query ID not found via any resolution step |
| `AUTH_EXPIRED` | Auth expired and silent re-auth failed |
| `MISSING_TWEET_ID` | Handler called without a tweet ID |
| `API_ERROR_{status}` | Non-auth API failure with HTTP status |

## 5. Rate Limiting

- **Fetch queue**: 1200ms base + 1300ms jitter between API calls
- **Reconcile throttle**: 4 hours
- **Light sync**: 30 minutes
- **Sync abort**: 3 minutes

## 6. Storage Keys

All keys use `xbt_` prefix + snake_case. Declared in `src/lib/storage-keys.ts`, mirrored as string literals in `public/service-worker.js`.

## 7. Discovery

Three complementary mechanisms feed the in-memory cache:

- **Proactive** — After auth capture (`onSendHeaders`) and on service worker startup, `discoverAllMissingQueryIds()` runs non-blocking, batch-fetching bundles for all uncached ops.
- **Lazy** — Per-request via `resolveQueryId()`, blocking until resolved or failed.
- **Passive** — `onSendHeaders` captures query IDs from normal x.com browsing into in-memory cache.
- **Content script** — `mutation-hook.js` discovers IDs from page script bundles and relays via `STORE_QUERY_IDS` message.

## 8. Reset Contract

`resetLocalData()` produces a state identical to fresh install:
1. Clears IndexedDB + deletes database
2. Removes all known localStorage keys
3. Clears `chrome.storage.local` (all keys)
4. Sends `RESET_SW_STATE` to reset service worker in-memory caches
5. Clears `chrome.storage.sync`

No special flags, no separate code paths.
