# F1: Persist & restore reading scroll position

Planned at: 1ea034a0

## Problem
`useReadingProgress` restores scroll from `progress.scrollY` / `progress.scrollHeight`
(src/hooks/useReadingProgress.ts:55-83), but no writer ever stores a non-zero
`scrollY`. `ensureReadingProgressExists` / `markReadingProgressCompleted` always
write `scrollY: 0, scrollHeight: 0` (src/db/index.ts:748,776). So reopening a long
thread/article always jumps to the top — the restore branch is effectively dead.

## Chosen approach (wire the writer)
1. db: add `saveReadingScrollPosition(tweetId, scrollY, scrollHeight)` that
   read-merges onto the existing row (preserving `completed`, `openedAt`,
   `reopenCount`, etc.) — same merge pattern as `markReadingProgressCompleted`.
   Do NOT reuse `upsertReadingProgress` (full `put` would clobber other fields).
   Skip writing while `completed` is true. Expose on `AccountDb` interface + handle.
2. hook: add a throttled `window` scroll listener (the restore already reads
   `document.documentElement.scrollHeight` + `window.scrollTo`, so window is the
   scroll owner). Only persist once `contentReady`, `loaded`, and restore has run,
   and not when completed. Cleanup (flush + remove listener) on unmount / tweetId
   change. Reuse `READING_HEIGHT_CHANGE_RATIO` constants module for a throttle ms.

Why simplest/lowest-risk: restore code is untouched; only adds a writer + a merge
helper. No behavior change for already-completed posts.

## Files touched
- src/db/index.ts (new merge writer + interface/handle wiring)
- src/hooks/useReadingProgress.ts (throttled scroll persistence + cleanup)
- src/db/__tests__/reading-scroll-position.test.ts (save→restore round-trip)

## Verify
- `pnpm typecheck`
- `pnpm test src/db/__tests__/reading-scroll-position.test.ts`
