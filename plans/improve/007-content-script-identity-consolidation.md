# 007 — Content-script identity consolidation (F7)

Planned at: 1ea034a0

## Problem

The shipped ISOLATED-world content script `public/content/detect-user.js` has two defects:

1. Its hand-rolled `parseTwidUserId` decodes the cookie value only **once** (single
   `decodeURIComponent`), while the tested canonical copy in `src/lib/sw-pure.ts`
   decodes up to **3×**. Double-encoded twid cookies (`u%253D…`) parse correctly in
   `sw-pure` but return `null` in the shipped script — a silent drift.
2. `handleBookmarkMutationMessage` accepts `window` messages without checking
   `event.origin`. The MAIN-world hook posts with `targetOrigin = window.location.origin`
   and the content script only runs on `https://x.com/*`, so requiring
   `https://x.com` is behavior-preserving and closes a spoofing gap.

A third issue: `src/content/detect-user.ts` is an orphaned TS duplicate. It is never
bundled (`vite.config.ts` only builds `open-in-totem`); the manifest loads the raw
`content/detect-user.js`. It misleads readers into thinking the TS file ships.

## Chosen approach (lowest-risk, behavior-preserving)

- In the **shipped** `public/content/detect-user.js`:
  - Align `parseTwidUserId` with `sw-pure` (multi-pass decode, up to 3×).
  - Add an `event.origin === "https://x.com"` guard at the top of
    `handleBookmarkMutationMessage` (in addition to the existing `event.source !== window`).
- **Delete** the orphaned `src/content/detect-user.ts`.
- Add a parser-parity unit test that reads the shipped JS as text, extracts the
  `parseTwidUserId` source, instantiates it via `new Function`, and asserts it matches
  `sw-pure.parseTwidUserId` on double-encoded input (`u%253D…`) and other cases. This
  pins the shipped parser to the canonical one and would fail if either drifts again.

Not doing the full vite-bundling migration — out of scope and higher risk.

## Files touched

- `public/content/detect-user.js` (multi-pass decode + origin guard)
- `src/content/detect-user.ts` (delete)
- `src/content/__tests__/detect-user-parser-parity.test.ts` (new)

## Verify

- `pnpm typecheck`
- `pnpm test src/content/__tests__/detect-user-parser-parity.test.ts src/lib/__tests__/sw-pure.test.ts`
- `pnpm build:extension`
