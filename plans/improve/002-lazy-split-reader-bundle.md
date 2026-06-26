# F2: Lazy-load the reader subsystem off the new-tab critical path

Planned at: 1ea034a0

## Problem
`newtab.html` and `reader.html` both load `src/main.tsx` -> `App`. `App.tsx`
statically imports `BookmarkReader` (which pulls in `html-react-parser`),
`NewTabHome`, and `BookmarksList`, then picks the route synchronously via
`isReaderRoute()` at `App.tsx:1041-1043`. Result: opening a new tab (the hot
path) downloads the entire article-reader code even though the reader is never
shown.

## Chosen approach
Split the two route apps into their own modules and `React.lazy()` them so the
reader subsystem lands in a separate chunk:

- Extract `ReaderRouteApp` (plus its reader-only collaborators:
  `ExternalReaderShell`, the reader reducer/state, `goToNewTab`,
  `openBookmarkInCurrentTab` is shared so it stays where used) into
  `src/ReaderRouteApp.tsx`.
- Extract `NewTabRouteApp` (plus `useDemoDataExporter`, the new-tab reducer/
  state, `DemoExportPayload`, `openReading` helpers) into
  `src/NewTabRouteApp.tsx`.
- In `App.tsx`, keep only `isReaderRoute()` + two `lazy()` imports wrapped in a
  single `<Suspense>`. The route is decided synchronously at mount, so only one
  chunk is ever requested — no flash, no wrong-route render.

Suspense fallback: `null` (the existing apps already render their own loading
states; the chunk fetch is local/instant from the packaged extension).

Why simplest/lowest-risk: behavior is preserved exactly (same components, same
route decision); the only change is *when* the code is fetched. `React.lazy` is
already a proven pattern in this repo (`components/reader/CodeBlock.tsx`).

## Files touched
- `src/App.tsx` — reduce to lazy route shell.
- `src/ReaderRouteApp.tsx` (new) — moved reader route + collaborators.
- `src/NewTabRouteApp.tsx` (new) — moved new-tab route + collaborators.

## Verify
- `pnpm typecheck` clean.
- `pnpm build:extension`, then grep build output: `html-react-parser` must
  appear only in the reader chunk, NOT in the newtab entry/its preloaded chunks.
- Confirm `newtab.html` modulepreloads do not pull the reader chunk.
