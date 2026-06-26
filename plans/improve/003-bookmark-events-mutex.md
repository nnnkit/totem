# F3: Serialize bookmark-events read-modify-write

Planned at: 1ea034a0

## Problem

`pushBookmarkEvent` (events.ts:30-69) and `handleAckBookmarkEvents` (events.ts:96-132)
both do `storage.get(CS_BOOKMARK_EVENTS)` -> mutate -> `storage.set(...)` with awaits
between, and no mutex. If a push interleaves with an ack (each reads the same snapshot
then writes), the second write clobbers the first — a captured bookmark change can be
silently dropped (lost update).

## Chosen approach

Copy the existing in-repo pattern from `sync.ts:200-210` (`withSyncOrchestratorLock`):
a module-level promise-chain mutex in events.ts. Route both the push read-modify-write
and the ack read-modify-write through it so they run sequentially. This is the simplest
correct option, mirrors a proven repo pattern, and preserves all existing behavior
(serialization only, no semantic change).

- `pushBookmarkEvent`: wrap its get->mutate->set body in the lock.
- `handleAckBookmarkEvents`: wrap its get->mutate->set body in the lock (after the
  early-return for empty ack, which touches no storage).
- `handleGetBookmarkEvents` is a pure read; routing it through the lock keeps reads
  consistent with the latest committed write (low cost, avoids reading mid-flight).

## Files touched

- src/service-worker/events.ts — add `withBookmarkEventsLock`, route push + ack (+ get).
- src/service-worker/__tests__/events.test.ts — add an interleaving regression test.

## Verify

- New test: a controllable storage whose `get` can be deferred. Start an ack (holding
  its read), fire a push concurrently, release. Without the lock the push is lost;
  with the lock both the ack result and the pushed event survive.
- `pnpm typecheck`
- `pnpm test src/service-worker/__tests__/events.test.ts`
