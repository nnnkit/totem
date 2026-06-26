# F8: Dead search-index persistence + floating writes

Planned at: 1ea034a0

## Problem
`src/lib/search.ts` loads the persisted MiniSearch index on cold start
(`tryHydrate`) and then deliberately discards it (comment at the end of
`tryHydrate`): the freshly-built engine is already serving, so the hydrated
index is never swapped in. Every session therefore rebuilds from scratch and
all the persistence I/O is dead weight. Two of the writes float as uncaught
promises: `void saveSearchIndexJson(json)` in `schedulePersist` and
`void clearSearchIndexJson()` in `tryHydrate`.

## Chosen approach — option (b), minimal scope
Remove the dead persistence machinery from `src/lib/search.ts` entirely:
`schedulePersist`, `tryHydrate`, the `persistTimer`/`dirty` state, the
`PERSIST_DEBOUNCE_MS` constant, and the imports of `tryLoadFromJSON`,
`loadSearchIndexJson`, `saveSearchIndexJson`, `clearSearchIndexJson`.

Why not "make persistence real" (option a): adopting the hydrated index needs
an id-set comparison, but the engine wrapper only exposes `size()` and adding
id-enumeration is engine-internals (out of scope). The hydrate is also async
while the fresh engine is returned synchronously, so a clean swap is awkward.

Why not also delete the db helpers: `loadSearchIndexJson` /
`saveSearchIndexJson` / `clearSearchIndexJson` are wired into the public
`AccountDb` facade interface and its binding, plus the search-index store /
key / schema and `reset.ts`. Deleting them is a large, high-risk cross-file
change for no behavioral gain. They stay; the search module simply stops
calling them. This kills the dead I/O and both floating writes with a
single-file change, and search results are byte-for-byte identical.

## Files touched
- `src/lib/search.ts` — remove persistence machinery + unused imports.
- `src/lib/search/__tests__/search.test.ts` — add a regression test that the
  module performs no search-index persistence I/O across queries.

## Verification
- `pnpm typecheck`
- `pnpm test src/lib/search/__tests__/search.test.ts`
