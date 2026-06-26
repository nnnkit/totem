# F9: XSS regression guard + harden escapeHtml

Planned at: 1ea034a0

## Problem

Untrusted tweet/article HTML is built as strings in `src/components/reader/utils.ts`
(`linkifyText`, `renderBlockInlineContent`, `paragraphHtml`) and rendered via
`html-react-parser`'s `parse()` in `TweetText.tsx` and `TweetArticle.tsx`. Safety
rests entirely on hand-rolled escaping (`escapeHtml`) and URL allowlisting
(`sanitizeUrl` / `sanitizeUrlRelaxed`), with:

- no regression test asserting hostile content renders inert, and
- `escapeHtml` not escaping the single quote (`'`), leaving a defense-in-depth gap
  for any single-quoted-attribute context.

## Chosen approach (simplest correct, lowest risk)

1. Harden `escapeHtml` to also escape `'` -> `&#39;`. This is purely additive
   (it never un-escapes), so legitimate content is unaffected; the displayed text
   is identical because browsers decode `&#39;` back to `'`.
2. Add a regression test `__tests__/xss-guard.test.ts` that feeds hostile fixtures
   through the real render path (`RichTextBlock`/`TweetArticle` -> `parse()`,
   serialized via `renderToStaticMarkup`, the same harness the repo already uses)
   and asserts:
   - `<script>` does not survive as a script tag,
   - `<img onerror=...>` injection does not survive as an executable attribute,
   - a `javascript:` link is dropped (no `javascript:` href),
   - a single-quote attribute-breakout payload is neutralized.

## Files touched

- `src/components/reader/utils.ts` — `escapeHtml` (add single-quote escaping)
- NEW `src/components/reader/__tests__/xss-guard.test.ts`

## Verify

- `pnpm typecheck`
- `pnpm test src/components/reader/__tests__/xss-guard.test.ts`
