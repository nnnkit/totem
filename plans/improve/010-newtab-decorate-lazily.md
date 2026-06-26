# F10: Stop decorating the whole library to render one hero card

Planned at: 1ea034a0

## Problem
`useNewTabHomeModel` maps EVERY bookmark through `decorateBookmark` (NewTabHome.tsx:798-804)
to produce `items`/`unreadItems`, but only a single `currentItem` hero is rendered. The
full decoration re-runs whenever `bookmarks`, `detailedTweetIds`, or `openedTweetIds` change.

## Usages of the decorated `items`/`unreadItems` (enumerated)
- `currentItem` (:814-841): pinned lookup map over `items`; otherwise random pick from
  `unread.length ? unread : items`.
- `surpriseMe` (:937-942): random pick from `unread.length ? unread : items` + empty guard.
That is the only consumption — nothing renders the whole decorated list.

## Chosen approach (simplest, behavior-preserving)
Work on RAW bookmarks, decorate lazily:
- Replace the all-decoration memo with a raw memo: `{ allBookmarks, unreadBookmarks }`
  where `unreadBookmarks = bookmarks.filter(b => !openedTweetIds.has(b.tweetId))`
  (same order/predicate `decorateBookmark` used for `isRead`).
- Add a pure `pickHeroBookmark({ recommendationSource, allBookmarks, unreadBookmarks,
  pinnedIds, seed })` that returns the single raw `Bookmark | null` to feature, preserving
  the exact index math (`floor(seed * pool.length)`) and the pinned→fallback ordering.
- `currentItem` decorates ONLY the picked hero (today path unchanged — already lazy).
- `surpriseMe` picks from raw pools and decorates only the opened item.

## Files
- src/components/NewTabHome.tsx (edit)
- src/components/__tests__/new-tab-home-progress.test.tsx (add focused `pickHeroBookmark` tests)

## Verify
- `pnpm typecheck`
- `pnpm test src/components/__tests__/new-tab-home-progress.test.tsx`
- New tests assert: pinned selection by seed; unread-preferred pool; fallback to all when no
  unread; empty → null; pinned fallthrough when no pinned bookmark present.
