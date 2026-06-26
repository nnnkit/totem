# F5: Only mark a tweet detail cached after the DB write actually succeeds

Planned at: 1ea034a0

## Problem

`fetchTweetDetail` writes the detail to IndexedDB via
`upsertTweetDetailCache(...).catch(() => {})` (src/api/core/posts.ts) — unawaited,
errors swallowed. Meanwhile `loadReaderDetail` (runtime-store.ts) awaits the fetch
and then calls `detailCached(tweetId)` unconditionally, and the prefetch
controller's `onSuccess` does the same. So a failed cache write still flips the
session into believing the tweet is offline-ready.

`subscribeTweetDetailCache` (db/index.ts) only notifies listeners AFTER `tx.done`
resolves, so it is the correct authority for "this id is now cached".

## Chosen approach

Rely solely on the post-write subscription. Remove the two optimistic
`detailCached(tweetId)` calls:
- in `loadReaderDetail` (keep the `prefetchController.reconcile()` + return)
- in `prefetchController.onSuccess`

The subscription wired at store construction (`subscribeTweetDetailCache`) already
calls `detailCached` + `reconcile` only after the write commits, which preserves
the happy-path behavior and fixes the false-cached case.

Lowest risk: no signature changes, no new awaits, no change to the swallowing
write itself (out-of-scope error path untouched).

## Files touched

- src/stores/runtime-store.ts — remove the two optimistic `detailCached` calls
- src/stores/__tests__/runtime-store.test.ts — regression test: when the cache
  write rejects (no listener fires), `loadReaderDetail` must NOT add the id to
  `detailedTweetIds`; when the write succeeds (listener fires), it must.

(src/api/core/posts.ts was in scope but needs no change — the write authority
already lives in the subscription.)

## Verify

- `pnpm typecheck`
- `pnpm test src/stores/__tests__/runtime-store.test.ts`
