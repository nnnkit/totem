# API Interaction Rules

Rules governing how the extension communicates with x.com's GraphQL API.

## 1. Auth Separation

The auth gate (`handleCheckAuth`) checks only `xbt_auth_headers` + `xbt_query_id`.
Mutation and detail query IDs (`xbt_delete_query_id`, `xbt_create_query_id`, `xbt_detail_query_id`) are operational concerns resolved lazily by their respective handlers.

## 2. Self-Healing Query ID Resolution

Every handler uses `resolveQueryId(operationName, storageKey)` with a three-step fallback chain:

1. **Storage** — `chrome.storage.local` (instant)
2. **Catalog** — GraphQL catalog via `loadGraphqlCatalog()` (in-memory)
3. **Bundles** — `discoverQueryIdFromBundles(operationName)` (network, 2-5s)

Results are cached in `chrome.storage.local` for subsequent calls.

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

Three complementary mechanisms, whichever finishes first wins:

- **Proactive** — After auth capture (`onSendHeaders`) and on service worker startup, `discoverAllMissingQueryIds()` runs non-blocking, batch-fetching bundles for all missing ops.
- **Lazy** — Per-request via `resolveQueryId()`, blocking until resolved or failed.
- **Passive** — `onSendHeaders` captures query IDs from normal x.com browsing.

## 8. Reset Contract

`resetLocalData()` produces a state identical to fresh install:
1. Clears IndexedDB + deletes database
2. Removes all known localStorage keys
3. Clears `chrome.storage.local` (all keys)
4. Sends `RESET_SW_STATE` to reset service worker in-memory caches
5. Clears `chrome.storage.sync`

No special flags, no separate code paths.
