# F6: Characterization tests for tweet-detail / thread parser

Planned at: 1ea034a0

## Problem
`parseTweetDetailPayload` (src/api/parsers.ts) is the X GraphQL parsing boundary most
likely to break on API changes, but only one happy-path test exists
(`parsers.bookmarks.test.ts` — direct `data.tweetResult.result`). Thread assembly, reply
ordering, focal selection, dedup, article extraction, and malformed-input handling are
untested.

## Chosen approach
ADD TESTS ONLY — no source change. New file `src/api/__tests__/parsers.detail.test.ts`
exercising the public entry `parseTweetDetailPayload(payload, tweetId)`:

- Thread ordering: self-thread replies (`SelfThread` displayType, same author +
  conversation; the focal tweet itself is excluded from `thread`) ordered by the reply
  chain rooted at focal; createdAt fallback when no reply links.
- Focal selection: focal found via timeline tweetId; via `entryId.includes(tweetId)`;
  direct vs timeline disagreement (direct fallback when no timeline).
- Dedup: repeated tweet ids in timeline collapse to one thread entry.
- ~5 malformed/partial payloads return `{focalTweet:null, thread:[]}` without throwing:
  null/undefined data, missing `tweetResult.result`, truncated/empty instructions,
  `TweetTombstone` wrapper, non-array instructions.
- `TweetWithVisibilityResults` wrapper unwrapped correctly (focal parsed).
- Malformed article / parseTweetRecord cases routed through the public entry
  (e.g. malformed `article` value does not throw; missing legacy/core yields null focal).

Fixtures defined locally in the new file (the bookmarks-test `makeTweetResult` is not
exported; duplicating a small focused builder keeps tests independent and touches no
existing file). No new exports in parsers.ts — every case is reachable via the public entry.

## Files touched
- NEW `src/api/__tests__/parsers.detail.test.ts`

## Verify
- `pnpm typecheck`
- `pnpm test src/api/__tests__/parsers.detail.test.ts`
