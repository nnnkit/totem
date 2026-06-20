# Codebase Deep-Dive: Data, Sync & State Architecture (for Pro/entitlement design)

Scope: the IndexedDB schema, the end-to-end sync/interception flow, the durable-state writer-ownership model, the reactive SW→UI snapshot push, and the concrete integration points where a new `isPro`/license/entitlement fact would live. All file paths are absolute; line numbers cite the code as read.

---

## 0. TL;DR for the entitlement designer

- There are **two distinct durable substrates**: account-scoped **IndexedDB** (bookmark/detail/progress/highlight data, written by the runtime) and **chrome.storage** (auth + sync orchestrator + runtime snapshot, with a hard "single writer per fact" rule split across two key files).
- The architecture already has a purpose-built **reactive SW→UI broadcast channel**: the SW writes a `RuntimeSnapshot` to `chrome.storage.local[CS_RUNTIME_STATE_V2]`, and every open page picks it up via `chrome.storage.onChanged` (`src/runtime/RuntimeProvider.tsx:96-100`). An `isPro` field can ride this exact channel to be reactive everywhere (SW + every new-tab/reader page) with zero new plumbing.
- A license/entitlement is a **device-global, account-independent fact**. It does **not** belong in IndexedDB (which is wiped on reset and account-scoped) and it does **not** belong in the SW-owned sync orchestrator state (account-scoped, wiped on reset). The cleanest home is a **new dedicated chrome.storage key** with a single declared writer.

---

## 1. IndexedDB schema

### 1.1 Databases (account-scoped)

File: `src/db/index.ts`, names in `src/lib/storage-keys.ts:1-3` and `src/lib/constants/db.ts`.

- Default DB: `totem` (`IDB_DATABASE_NAME` / `DB_NAME`).
- Account DB: `totem_acct_<accountId>` (`IDB_ACCOUNT_DATABASE_PREFIX` = `"totem_acct_"`, joined in `getDbNameForAccount`, `src/db/index.ts:119-122`).
- Legacy DB: `xbt` (`LEGACY_IDB_DATABASE_NAME`), migrated forward on first open (`migrateLegacyDatabaseIfNeeded`, `src/db/index.ts:385-425`).
- `DB_VERSION = 9` (`src/lib/constants/db.ts:5`). The whole schema is created/upgraded in one `upgrade()` callback (`src/db/index.ts:135-277`).
- Account selection: `setActiveAccountId(accountId)` (`src/db/index.ts:124-133`) flips a module-level `activeDbName`; **every** read/write goes through `getDb()` which opens whatever `activeDbName` currently points at (`src/db/index.ts:443-463`). The runtime must call `setActiveAccountId` before any read (enforced convention; see `hydrateCurrentAccount`, `src/stores/runtime-store.ts:549-554`).

### 1.2 Object stores (9 total)

Schema interface `XBookmarksDbSchema`, `src/db/index.ts:31-101`:

| Store | keyPath | Indexes | Value type |
|---|---|---|---|
| `bookmarks` | `id` | `tweetId`, `sortIndex`, `createdAt`, `screenName` (= `author.screenName`) | `Bookmark` |
| `tweet_details` | `tweetId` | `fetchedAt` | `TweetDetailCache` |
| `reading_progress` | `tweetId` | `lastReadAt` | `ReadingProgress` |
| `highlights` | `id` | `tweetId`, `createdAt` | `Highlight` |
| `saved_searches` | `id` | `sortOrder`, `createdAt` | `SavedSearch` |
| `search_index` | `id` | — | `{ id, json, savedAt }` (serialized MiniSearch index, key `"minisearch-v1"`) |
| `today_queue_snapshots` | `key` | `localDate`, `generatedAt` | `TodayQueueSnapshot` |
| `bookmark_queue_metadata` | `tweetId` | `intent`, `updatedAt` | `BookmarkQueueMetadata` (intent + snooze) |
| `today_queue_exposures` | `id` | `tweetId`, `localDate`, `createdAt` | `TodayQueueExposure` |

Note: ARCHITECTURE.md §11 lists only the first four; the actual code has 9. The extra five (`saved_searches`, `search_index`, today-queue trio) are real and relevant to several Pro features (advanced search filters → `saved_searches`/`search_index`; queue intent → `bookmark_queue_metadata`).

### 1.3 What a saved-post ("bookmark") record contains

`Bookmark` interface, `src/types/index.ts:151-174`. This is rich and is the single biggest asset for the "deleted-tweet preservation" Pro feature — the full text and metadata are already persisted locally:

- Identity/order: `id`, `tweetId`, `sortIndex` (X's opaque cursor string), `createdAt` (ms epoch), `bookmarked` (boolean — stays `true` until unbookmarked; never deleted on unbookmark, just flipped).
- Content: `text` (full tweet text), `tweetKind` (`tweet|reply|quote|repost|thread|article`), `tweetDisplayType`, `inReplyToTweetId`, `inReplyToScreenName`, `isThread`.
- **Author** (`Author`, `src/types/index.ts:44-56`): `name`, `screenName`, `profileImageUrl`, `verified`, optional `bio`, `followersCount`, `followingCount`, `website`, `createdAt`, `bannerUrl`, `affiliate`.
- **Metrics** (`Metrics`, lines 58-64): `likes`, `retweets`, `replies`, `views`, `bookmarks`.
- **Media** (`Media[]`, lines 66-73): `type` (`photo|video|animated_gif`), `url` (image), `videoUrl`, `width`, `height`, `altText`. URLs point at `*.twimg.com` (CSP `img-src`/`media-src` in `public/manifest.json` allow only twimg + self — so media is hot-linked, not blobbed locally; see §2.5).
- **URLs / cards** (`TweetUrl[]`, lines 84-89): `url`, `displayUrl`, `expandedUrl`, optional `card` (`LinkCard`: title/description/imageUrl/domain/cardType).
- **Quote / repost / article**: `quotedTweet` (`QuotedTweet`), `retweetedTweet`, `article` (`ArticleContent`: full `plainText`, `title`, `coverImageUrl`, `contentBlocks`, `entityMap` — i.e. the entire long-form X Article body).
- Convenience flags: `hasImage`, `hasVideo`, `hasLink`.

### 1.4 Detail cache — the reader payload (most important for "deleted-tweet preservation")

`TweetDetailCache`, `src/types/index.ts:176-183`:

```ts
interface TweetDetailCache {
  tweetId: string;
  fetchedAt: number;
  focalTweet: Bookmark | null;
  thread: ThreadTweet[];              // thread-aware capture already exists
  detailsStatus?: "ok" | "unavailable";
  unavailableReason?: "deleted" | "protected" | "parse_failed" | "unknown";
}
```

- `thread: ThreadTweet[]` (`src/types/index.ts:134-149`) is the **already-captured thread structure** — each thread tweet carries its own author/media/urls/article/quoted/retweeted + `inReplyToTweetId`. So "thread-aware capture" as a Pro feature is, at the data layer, **already done**; it is fetched and cached whenever a tweet is opened in the reader or warmed by the prefetch controller.
- `detailsStatus` / `unavailableReason` fields **exist in the type** but the parser (`parseTweetDetailPayload`, `src/api/parsers.ts:1231-1265`) does **not currently set them** — it returns `{ focalTweet, thread }` only. `unwrapTweet` returns `null` for `TweetTombstone`/`TweetUnavailable` (`src/api/parsers.ts:111-120`) but the surrounding code doesn't yet stamp `unavailableReason: "deleted"`. This is the natural seam for the Pro "preserve deleted tweets" feature: when a future `FETCH_TWEET_DETAIL` returns a tombstone, **keep the previously-cached `focalTweet`** instead of overwriting, and set `detailsStatus: "unavailable"`. The cache retention sweep already exists (`cleanupOldTweetDetails`, `src/db/index.ts:1206-1226`, default `DETAIL_CACHE_RETENTION_MS`) and would need to *exempt* Pro-preserved rows.

### 1.5 Other store value shapes

- `ReadingProgress` (`src/types/index.ts:193-205`): `tweetId`, `openedAt`, `lastReadAt`, `scrollY`, `scrollHeight`, `completed`, `reopenCount`.
- `Highlight` (`src/types/index.ts:207-218`): `id`, `tweetId`, `sectionId`, `startOffset`, `endOffset`, `selectedText`, `note` (annotations Pro feature lives here), `color`, `createdAt`, `type` (`highlight|note`).
- `SavedSearch` (`src/types/index.ts:227-233`): `id`, `name`, `query`, `createdAt`, `sortOrder`.
- `BookmarkQueueMetadata` (lines 259-264): `tweetId`, `intent` (`unset|read_soon|reference|act`), `snoozedUntil`, `updatedAt`.

### 1.6 Important: IDB is wiped on reset and is account-scoped

`clearAllLocalData` / `clearTransientStores` / `deleteBookmarksByTweetIds` (`src/db/index.ts:537-632`) and the full `resetLocalData` (`src/lib/reset.ts:135-210`, deletes the default DB + every `totem_acct_*` DB). **Conclusion: do not store the license here.** A user who hits "Reset app" or switches accounts must not lose their lifetime unlock.

---

## 2. Sync flow end-to-end (and what already passes through that *could* be cached)

### 2.1 Two content scripts (manifest)

`public/manifest.json` registers two content scripts on `https://x.com/*` at `document_start`:

1. `content/detect-user.js` (ISOLATED world) — source `src/content/detect-user.ts`. Reads the `twid` cookie → writes `totem_user_id` + `totem_account_context_id` to `chrome.storage.local` (`src/content/detect-user.ts:21-44`); relays MAIN-world `postMessage` bookmark-mutation + query-id messages to the SW (lines 56-85).
2. `content/mutation-hook.js` (**MAIN world**) — `public/content/mutation-hook.js`. This is hand-written JS (not built from TS). It monkey-patches `XMLHttpRequest.prototype.open/send` and `window.fetch` (lines 98-133) to detect `CreateBookmark`/`DeleteBookmark` calls and `postMessage`s `{operation, tweetId}` to the ISOLATED script. It also scrapes X's JS bundles for GraphQL `queryId`s (`discoverQueryIds`, lines 135-202) and posts `{type:"query_ids", ids}`.

**Key nuance:** the MAIN-world hook only observes *mutations* (create/delete), not the bookmark/timeline GraphQL *responses*. The actual bookmark/detail data is fetched by the **service worker itself**, replaying captured auth headers (see §2.3). So "intercepting GraphQL responses" in this codebase means: SW captures *auth headers* from real browsing (webRequest), then the SW makes its own authenticated GraphQL fetches.

### 2.2 Auth-header capture (the real interception)

`src/service-worker/index.ts:320-391`, `chrome.webRequest.onSendHeaders` on `https://x.com/i/api/graphql/*`:

- Captures `authorization`, `cookie`, `x-csrf-token`, `x-client-uuid`, `x-client-transaction-id`, `x-twitter-*` (`CAPTURED_HEADERS`, lines 45-55).
- Requires the full "auth trio" + a valid `twid` before arming `totem_auth_headers` (lines 351-372) — this prevents stale-JWT re-login after logout.
- Also harvests X's `features` query param into `totem_features` (lines 378-387), reused when the SW builds its own requests.
- Mutation capture: `onBeforeRequest` (deletes → immediate event) and `onCompleted` (creates → confirmed event) at `src/service-worker/index.ts:395-438`.
- Auth state also tracked from response status (401/403 → logged out) at lines 442-456, and from `twid` cookie removal at lines 463-467.

### 2.3 SW → GraphQL fetch → parse → persist

The SW is the API boundary. `src/service-worker/api-proxy.ts`:

- `FETCH_BOOKMARKS` (`handleFetchBookmarks`, lines 153-222): `withQueryId("Bookmarks", …)` builds the URL, `buildHeaders(storage)` replays captured headers (lines 78-105), fetches `https://x.com/i/api/graphql/<queryId>/Bookmarks`, returns `{ data: json }`. On 401/403 it does one silent re-auth retry then `markAuthLoggedOut`.
- `FETCH_TWEET_DETAIL` (`handleFetchTweetDetail`, lines 281-365): same pattern for `TweetDetail`. **This is the call that returns the full thread + author + media + article** that becomes `TweetDetailCache`.
- `DELETE_BOOKMARK`, `FETCH_VIEWER_PROFILE` also here.

Parsing happens **runtime-side**, not in the SW. The runtime RPC wrappers live in `src/api/core/` (`bookmarks.ts`, `posts.ts`). `fetchTweetDetail` (`src/api/core/posts.ts:66-90+`) sends `FETCH_TWEET_DETAIL`, then `parseTweetDetailPayload` (`src/api/parsers.ts:1231`) turns raw JSON into `TweetDetailContent`, and **upserts it into IDB** via `upsertTweetDetailCache` (`src/api/core/posts.ts:1` imports it). Bookmark pages are parsed by the bookmark parsers and persisted via `upsertBookmarks` in the sync loop.

### 2.4 The sync loop (runtime side)

`src/stores/runtime-store.ts` `sync()` (lines 775-1031):

1. `reserveSyncRun({accountId, trigger, localCount})` → SW decides allow + mode (§3/§6 of ARCHITECTURE).
2. On allow: `reconcileBookmarks` (`src/lib/reconcile.ts`) walks pages via `fetchBookmarkPage`, `onPage` merges each page into in-memory `bookmarks` and calls `upsertBookmarks(deduped)` (lines 887-907).
3. On `full` completion with `staleIds`, deletes locally-removed bookmarks.
4. `releaseActiveLease(status, errorCode)` → SW `COMPLETE_SYNC` stamps `lastFullSyncAt`/cache-summary keys.

### 2.5 Data that already flows through and is cacheable (relevance to "deleted-tweet preservation")

Everything needed to preserve a deleted tweet is **already in the local stores before the tweet is deleted upstream**:

- The `bookmarks` store holds full text/author/media-URLs/article/quote for every saved post.
- The `tweet_details` store holds the full reader payload + thread once a post has been opened or prefetched (the prefetch controller warms a top-of-list pool — `src/stores/prefetch-controller.ts`).
- Media is referenced by `*.twimg.com` URL, **not** stored as blobs. True "preservation" against X deleting the media would require downloading bytes (a new capability); but text/metadata/thread preservation needs **no new fetch** — only a policy change: on a later detail fetch that returns a tombstone, *don't overwrite* the existing cache row, and stamp `detailsStatus:"unavailable"`/`unavailableReason:"deleted"` (the fields already exist; see §1.4). This is the smallest possible Pro hook.

---

## 3. State model: where durable user state lives + writer ownership

ARCHITECTURE §11/§16 Invariant #1 ("single writer per persisted fact") is enforced at test time (`src/lib/__tests__/storage-invariants.test.ts`). Three substrates:

### 3.1 chrome.storage.local — split by writer across two files

**Shared keys** `src/lib/storage-keys.ts` (read by anyone, written by their owner):
- SW-written: `CS_AUTH_HEADERS` (`totem_auth_headers`), `CS_AUTH_STATE`, `CS_AUTH_TIME`, `CS_USER_ID`, `CS_ACCOUNT_CONTEXT_ID`, `CS_VIEWER_PROFILE`, `CS_BOOKMARK_EVENTS`, plus undeclared SW-only strings (`totem_graphql_catalog`, `totem_features`, `totem_auth_state_at/_reason`, `totem_auth_diagnostics`).
- Runtime-written: `CS_DB_CLEANUP_AT`, `CS_RUNTIME_AUDIT`, `CS_HYDRATION_SNAPSHOT`, `CS_GROWTH_STATE`.
- Either: `CS_BOOKMARK_EVENTS` (SW enqueues, runtime acks via `ACK_BOOKMARK_EVENTS`).
- Broadcast: `CS_RESET_EPOCH` (`reset.ts` writes; SW + every page drop IDB handles).

**SW-exclusive keys** `src/service-worker/storage-keys-sw.ts` (non-SW imports forbidden except `reset.ts` + `RuntimeProvider.tsx`):
- `CS_SYNC_ORCHESTRATOR_STATE` (`totem_sync_orchestrator_state`) — leases, cooldowns, **`lastFullSyncAt`**, per-account map.
- `CS_RUNTIME_STATE_V2` (`totem_runtime_state_v2`) — the full `RuntimeSnapshot` (see §4).
- `CS_LAST_SYNC`, `CS_LAST_SOFT_SYNC`, `CS_SOFT_SYNC_NEEDED` — cache-summary timestamps.

Enforcement: `ALLOWED_WRITERS = ["service-worker/"]` for SW-owned keys; `ALLOWED_IMPORTERS = ["service-worker/", "lib/reset.ts", "runtime/RuntimeProvider.tsx"]` for the SW key file (`src/lib/__tests__/storage-invariants.test.ts:98-149`).

### 3.2 chrome.storage.sync — cross-device, survives reinstall on the same Google profile

`src/lib/storage-keys.ts:70-76`: `SYNC_SETTINGS` (`totem_settings`) and `SYNC_THEME` (`totem_theme`). Read/written by `useSettings` (`src/hooks/useSettings.ts:104-145`) and `useTheme`. This is the **only substrate that survives a reinstall and propagates across the user's devices**. Relevant tradeoff for licensing: convenient for "unlock follows the user," but it is also the easiest for a user to read/edit, and a full reset wipes it (`reset.ts:204-205`, only on non-`keepUserContent`).

### 3.3 Zustand runtime store — ephemeral, never persisted

`src/stores/runtime-store.ts`. Holds `authPhase`, `capability`, `bookmarks`, `detailedTweetIds`, `syncStatus`, generations, etc. (`RuntimeState`, lines 154-174). It is a **mirror** of SW-owned facts + IDB contents; it writes IDB and reads everything else. It would be the place an `isPro` value is **exposed to React**, but never the **owner** of the persisted bit.

### 3.4 localStorage — app-local UI prefs only

`LOCAL_STORAGE_KEYS` (`src/lib/storage-keys.ts:16-28`): reading tab, sorts, wallpaper, pinned tweets, reader activity, recent searches, export-ready dismissal. Per-device, not synced, wiped on reset. Wrong home for a license (trivially editable, per-device, lost on reset).

### 3.5 Who should own a new `isPro` / license fact, and where it physically lives

Per "single writer per persisted fact," `isPro` needs exactly one writer. The candidates and the recommendation:

- **Recommended owner: the service worker**, writing a new dedicated key, e.g. `CS_ENTITLEMENT` (`totem_entitlement`), declared in `src/service-worker/storage-keys-sw.ts` so the existing import-boundary test makes the SW the sole writer for free. The value is a small record: `{ isPro: boolean, plan: "lifetime"|"founders"|null, licenseKey?: string, source: "gumroad"|"manual"|…, verifiedAt: number, signature?: string }`.
  - Why the SW: it is the trust boundary, it already owns the snapshot, and (critically) license *verification* (a network call to the licensing vendor / a signature check) is naturally a SW responsibility — the SW already makes authenticated network calls and is the only context that should hold any secret-ish verification logic. Putting the writer in the SW also means the entitlement is **account-independent and reset-surviving by policy**: keep `CS_ENTITLEMENT` out of `CHROME_LOCAL_RESET_KEYS` in `src/lib/reset.ts` (mirror how auth headers are deliberately *preserved* across reset, `reset.ts:30-32` comment) so "Reset app" never revokes a paid unlock.
- **Physical location: `chrome.storage.local`** (device-local). If you want the unlock to follow the user across devices, *additionally* mirror a verification token into `chrome.storage.sync` under a new key — but treat `chrome.storage.local[CS_ENTITLEMENT]`, written by the SW after verification, as the authoritative readable fact.
- **Do NOT** put it in IDB (account-scoped + wiped) or in the sync orchestrator account map (account-scoped + wiped). It is not a per-account fact.

Because the SW already builds and persists `RuntimeSnapshot`, the entitlement should also be **stamped into the snapshot** (one new field) so it propagates reactively (see §4).

---

## 4. Reactive SW → UI snapshot push (can `isPro` ride it? — yes)

### 4.1 How the push works today

`RuntimeSnapshotData` (`src/types/messages.ts:174-182`) is the snapshot shape: `sessionState`, `authPhase`, `accountContextId`, `capability`, `syncPolicy`, `blockedReason`, `cacheSummary`.

- The SW **builds** it in `buildRuntimeSnapshot` (`src/service-worker/auth.ts:364-427`) and **persists** it via `persistRuntimeStateV2` (`src/service-worker/auth.ts:429-471`) → writes `chrome.storage.local[CS_RUNTIME_STATE_V2]`. This persist is called after **every** reservation/completion (`src/service-worker/sync.ts:368-371, 509-512, 668-679`) and on `GET_RUNTIME_SNAPSHOT`/`SET_ACCOUNT_CONTEXT` (`src/service-worker/auth.ts:810-815, 843-848`).
- Every open page subscribes in `src/runtime/RuntimeProvider.tsx:64-105`. On a `CS_RUNTIME_STATE_V2` change (and no concurrent auth-key change), it calls `actions.applyRuntimeSnapshot(snapshot)` (lines 96-100).
- `applyRuntimeSnapshot` (`src/stores/runtime-store.ts:1186-1192`) normalizes via `normalizeAuthPayloadFromSnapshot` and calls `applyAuthPayload(..., { allowHydration:false, allowAutoSync:false })` — it only updates auth/capability/session mirrors; never re-reads IDB, never starts a sync (the guardrail described in ARCHITECTURE §11.5).

### 4.2 Riding `isPro` on this channel

Yes — this is the intended mechanism and the cleanest gating path:

1. Add `isPro` (or a small `entitlement` object) to `RuntimeSnapshotData` (`src/types/messages.ts:174-182`).
2. Populate it in `buildRuntimeSnapshot` (`src/service-worker/auth.ts:394-426`) by reading `CS_ENTITLEMENT`, and include it in the safe-defaults in `persistRuntimeStateV2` (`src/service-worker/auth.ts:459-470`).
3. Mirror it into the Zustand store: add an `isPro` field to `RuntimeState` (`src/stores/runtime-store.ts:154-174`), set it inside `applyAuthPayload` (lines 695-724) from the normalized payload, and read it in `normalizeAuthPayloadFromSnapshot` (lines 202-222).
4. Expose a `useIsPro()` selector in `src/stores/selectors.ts` (alongside `useAuthPhase`, etc.).

Result: when the SW verifies a purchase and writes `CS_ENTITLEMENT` + re-persists the snapshot, **every open new-tab and reader page flips to Pro on the same event-loop tick**, exactly like a capability upgrade does today — no heartbeat wait, no reload. The SW, the UI, and (if a content script ever needs it) any `chrome.storage.onChanged` listener all see the same single fact.

One caveat to respect: `applyRuntimeSnapshot` deliberately uses `allowHydration:false`. An `isPro` flip must **not** trigger a re-hydration or sync — it is purely a capability mirror, so adding it as a snapshot field is safe and consistent with the existing guardrails.

---

## 5. Concrete integration points (file paths)

### (a) Where a license/entitlement value would be **stored** (the single writer)

- **Declare the key:** `src/service-worker/storage-keys-sw.ts` — add `export const CS_ENTITLEMENT = "totem_entitlement";`. This automatically makes the SW the only allowed writer and keeps runtime code from writing it (enforced by `src/lib/__tests__/storage-invariants.test.ts`).
- **Write it:** a new SW handler module, e.g. `src/service-worker/entitlement.ts`, exporting a `HandlerMap` merged in `src/service-worker/index.ts:133-141` (alongside `authHandlers`, `syncHandlers`, …). Handlers like `ACTIVATE_LICENSE` / `VERIFY_LICENSE` / `GET_ENTITLEMENT` call `chrome.storage.local.set({ [CS_ENTITLEMENT]: … })` after verification. Add the new message types to `src/types/messages.ts` (`MessageRequest` union, lines 147-167).
- **Reset policy:** in `src/lib/reset.ts`, keep `CS_ENTITLEMENT` **out of** `CHROME_LOCAL_RESET_KEYS` (lines 33-45) so a reset never revokes a paid unlock — and if you ever do want a "deactivate license" path, make it explicit, not a side effect of reset.
- **Optional cross-device mirror:** add a sync key to `CHROME_SYNC_KEYS` (`src/lib/storage-keys.ts:73-76`) if the unlock should follow the user; written by the SW too.

### (b) Where it is **read by the service worker**

- `src/service-worker/auth.ts` — `buildRuntimeSnapshot` (lines 364-427) reads `CS_ENTITLEMENT` and adds it to the returned snapshot; `persistRuntimeStateV2` (lines 429-471) includes it with safe defaults.
- Any Pro-gated SW capability (e.g. a future bulk-export proxy, or "don't overwrite cache on tombstone") reads `CS_ENTITLEMENT` directly in the relevant handler in `src/service-worker/api-proxy.ts`.
- `src/api/core/auth.ts` `getRuntimeSnapshot()` (lines 21-33) already returns `response.data` verbatim, so the new field reaches the runtime with no wrapper change.

### (c) Where it is **exposed to React components**

- `src/stores/runtime-store.ts`: add `isPro` to `RuntimeState` (lines 154-174) and to `createInitialState` (lines 355-380); set it in `applyAuthPayload` (lines 695-724) and read it from the snapshot in `normalizeAuthPayloadFromSnapshot` (lines 202-222) and from the `CHECK_AUTH` path in `normalizeAuthPayloadFromStatus` (lines 224-250) if you also surface it via `CHECK_AUTH`.
- `src/runtime/RuntimeProvider.tsx`: **no change needed** — the existing `CS_RUNTIME_STATE_V2` `onChanged` branch (lines 96-100) already delivers the snapshot reactively.
- `src/stores/selectors.ts`: add `export function useIsPro(): boolean { return useRuntimeStoreBase((s) => s.isPro); }` (mirrors `useAuthPhase`, lines 53-55). Components (`ExportModal.tsx`, `SettingsModal.tsx`, reader `ArticleExportMenu.tsx`, `BookmarksList.tsx` bulk-ops, etc.) gate on `useIsPro()`.
- For non-React surfaces (the reader route, the export library in `src/lib/export/*`): read the store directly via `runtimeStore.getState().isPro` (`src/stores/runtime-store.ts:1347-1351`) or pass the flag in.

### (d) Supporting reference points already in place

- Settings precedent for a sync-stored, reactively-updated boolean: `src/hooks/useSettings.ts` (showOpenInTotem etc. over `chrome.storage.sync` with an `onChanged` listener).
- Capability-mirror precedent (the exact pattern `isPro` should copy): `ApiCapability` in `src/types/auth.ts:11-14`, flowing snapshot → store → selector.

---

## 6. Risks / sharp edges for the entitlement design

1. **Local-first means client-trusted.** Every substrate here (`chrome.storage.local/.sync`, IDB, localStorage) is user-readable/editable in DevTools. A purely local `isPro:true` is trivially forgeable. To match the "no Totem server" ethos while resisting casual piracy, the realistic option is a **signed license token** verified by the SW (vendor-issued signature over the license + a public key shipped in the extension). The SW is the right place for that verification (§3.5). True server-side enforcement contradicts the no-server ethos; design for "honest-majority + raise the effort," not DRM.
2. **Reset must not revoke.** Default reset wipes `chrome.storage.sync` and all of IDB. Keep the entitlement key off both reset lists (§5a). Document it next to the auth-preservation comment in `reset.ts`.
3. **Account switching.** The entitlement is device/user-global, not per-account — keep it out of the per-account orchestrator map (`SyncAccountState`, `src/service-worker/sync.ts:65-86`) and out of account-scoped IDB.
4. **Snapshot guardrail.** When adding `isPro` to the snapshot, ensure the `applyRuntimeSnapshot` path keeps `allowHydration:false`/`allowAutoSync:false` (it already does) so an entitlement change never triggers IDB re-reads or syncs.
5. **The MAIN-world hook is plain JS** (`public/content/mutation-hook.js`) and is **not** a place to read entitlements — it has no access to the verified fact and shouldn't.

---

## 7. One-paragraph mental model for the entitlement

The license is a **device-global, account-independent, reset-surviving fact** whose single writer is the **service worker** (after verifying a signed token), physically stored in a new `chrome.storage.local` key (`CS_ENTITLEMENT`, declared in `src/service-worker/storage-keys-sw.ts`), stamped into the existing `RuntimeSnapshot`, and pushed reactively to every UI surface through the already-built `CS_RUNTIME_STATE_V2` → `chrome.storage.onChanged` → `applyRuntimeSnapshot` → Zustand → `useIsPro()` channel. IndexedDB stores the *content* a Pro feature acts on (full bookmark/detail/thread payloads — already enough to preserve deleted tweets' text and structure with only a cache-overwrite policy change), but never the entitlement itself.
