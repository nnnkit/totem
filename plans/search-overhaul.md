# PRD — Bookmark search overhaul (BM25, highlighting, operators, semantic)

**Status:** Draft
**Author:** Ankit
**Last updated:** 2026-04-27
**Scope:** New-tab bookmarks list (`src/components/BookmarksList.tsx`) and the underlying search library (`src/lib/search.ts`). Reader and onboarding flows untouched. Web app and the X.com content-script "Open in Totem" button are out of scope.

---

## 1. Summary

Replace the custom in-memory substring matcher in `src/lib/search.ts` with a BM25-backed search engine (MiniSearch) that ranks fields explicitly (`screenName` > `displayName` > `title` > `description` > `excerpt` > `tweetText` > `articleText` > `cardDescription`), highlights matches per-field with snippet windowing, supports a Twitter-compatible operator grammar (`from:`, `has:image`, `min_faves:`, `since:`, `OR`, `-`, `"phrase"`, `( )`), and persists a serialized index to IndexedDB so the search experience is fast and offline. Ships in five phases. Phase 1 alone covers the three asks that triggered this work — match-highlighting, excerpt-as-a-searchable-field, and the explicit `username/name > title > description` priority.

The product story: **bookmark search that's better than Twitter's own**. Twitter's bookmark search is a documented mess — substring on tweet text only, no operators, no filters, no highlighting, breaks past ~1k records, [`@Lymedlym — "the bookmark search just straight up doesn't work"`](https://x.com/Lymedlym/status/1810899750431940682). We bring Twitter's *advanced search* syntax (which already exists at `/search-advanced` but is never inherited by bookmarks) plus the modern affordances Twitter never built.

---

## 2. Goals / Non-goals

**Goals**

- Find what you saved, fast — sub-50 ms queries on corpora up to 100k bookmarks.
- Make field priority explicit and tunable: handle and name dominate; title beats body; excerpt and description are searchable but ranked below title.
- Highlight matched terms inside each result so users know *why* a result matched without clicking.
- Bring Twitter's familiar advanced-search operators to bookmarks.
- Survive disappearing tweets — index captures content at save-time so deleted source tweets remain findable in our local index (data-loss mitigation is a side effect, not the primary aim of this PRD).
- Keep the existing one-keystroke flow (`/` to focus, instant filtering) for users who don't want to learn operators.

**Non-goals**

- Server-side search. Everything stays in the browser/extension; no backend fan-out.
- Cross-device sync of saved searches in v1 (local only; cloud sync deferred).
- Tag CRUD UI / migration. Tags are referenced by the operator grammar (`tag:react`) so the index is tag-ready, but shipping the tag data model and editing UI is a separate PRD.
- AI auto-tagging or auto-categorization. Hallucinated keywords are worse than none.
- Full hybrid semantic search at launch. Stubbed in Phase 5 behind a flag — we want lexical recall to work first.
- Mobile-share-sheet save flow, MCP endpoint, daily digest emails. All cited in research as differentiators but out of scope for the search overhaul.

---

## 3. Current state (what's there today)

- **Algorithm:** custom in-memory weighted substring matcher (`src/lib/search.ts:32-56`). Six fields scored: `screenName` exact (10), `screenName`/`authorName` substring (8), `title` (6), `text` (3), `articleText` (2), `cardTexts` (1). Phrase bonuses for `title` (5) and `text` (3) on multi-term queries (`src/lib/constants/scoring.ts:1-11`). No fuzzy, no prefix, no stemming.
- **Tokenization:** `query.trim().toLowerCase().split(/\s+/).map(t => t.replace(/^@/, ""))` (`src/lib/search.ts:65-66`). Strips leading `@`; loses `#hashtag`, `$cashtag`, mid-token URLs.
- **Hook:** `useBookmarkSearch(bookmarks)` returns `{ query, setQuery, results, isSearching }`, debounced 150 ms via `SEARCH_DEBOUNCE_MS` (`src/hooks/useBookmarkSearch.ts:10-13`, `src/lib/constants/timing.ts:20`). Re-scores the entire corpus on every keystroke.
- **UI:** `<Input>` (`src/components/ui/Input.tsx`) with magnifier icon and `/` hotkey (`src/components/BookmarksList.tsx:171-177`). List virtualized with `@tanstack/react-virtual` at 64 px row height (`src/components/BookmarksList.tsx:362-380`).
- **Data model (`src/types/index.ts:151-174`):** `Bookmark` has `id`, `tweetId`, `text`, `createdAt`, `author { name, screenName, ... }`, `metrics { likes, retweets, replies, views, bookmarks }`, `media[]`, `urls[].card { title, description }`, `isThread`, `hasImage|hasVideo|hasLink`, `quotedTweet`, `retweetedTweet`, `article { title, plainText, ... }`, `tweetKind`, `inReplyToScreenName`. **No `tags` field. No `excerpt` field. No reopen counter.**
- **Storage:** IndexedDB via `idb@8.0.3` (`src/db/index.ts:1`, `package.json`). Schema v6 (`src/lib/constants/db.ts`). Object stores: `bookmarks`, `tweet_details`, `reading_progress`, `highlights`. Bookmarks indexed on `tweetId`, `sortIndex`, `createdAt`, `screenName` (`src/db/index.ts:22-31`). No full-text index.
- **Highlighting:** match-highlighting **does not exist**. The `Highlight` type (`src/types/index.ts:200-211`) refers to user-saved highlights inside the reader — semantically distinct. Color resolver lives at `src/lib/__tests__/highlight-colors.test.ts` for that feature.
- **Reading state:** `reading_progress` store records `lastReadAt` (`src/db/index.ts:39-45`). Useful for recency, but no reopen counter exists today.
- **Tests:** zero tests exercise the search algorithm. `src/api/__tests__/`, `src/stores/__tests__/`, and `src/lib/__tests__/` cover other surfaces.

---

## 4. The three asks — answered

### 4.1 Search the excerpt

Today's data model has no `excerpt` field. We synthesize one in the parser pipeline (`src/api/parsers.ts`) without changing `Bookmark`:

- **Articles** (`bookmark.article` non-null): `excerpt = bookmark.article.plainText.slice(0, 280)` after the title sentence is consumed by `title`.
- **Tweets** (no article): `excerpt = bookmark.text` minus the title sentence (`text` after the first `[.!?]\s` boundary or first 100 chars).
- **Link-card-only bookmarks**: `excerpt = ""`; description fields carry the content.

`excerpt` lives on a derived `SearchableBookmark` type built once when the index is constructed/updated, never on the persisted record. This avoids a schema migration and keeps the source of truth single.

### 4.2 Highlight matches

Per-field highlighting with snippet windowing — Algolia's [highlighting cornerstone post](https://www.algolia.com/blog/engineering/inside-the-algolia-engine-part-5-highlighting-a-cornerstone-to-search-ux) is the reference. Rendering rules:

- Each result emits a `Highlighted` view per contributing field. Fields rendered in priority order: handle/name chip → title → snippet (excerpt or tweetText, whichever matched).
- Snippet window: 30 tokens for `tweetText`/`excerpt`, 15 for `title`, full string for `screenName`/`displayName`/`tags`. Window is the one that maximizes count of *distinct* matched terms (not first-match-wins).
- Mark **all** occurrences in the snippet, not just the first.
- Visual: a `<mark class="search-hit">` element with `bg-amber-100 dark:bg-amber-900/40 rounded px-0.5`. Distinct from the user-highlight palette in `src/lib/highlight-colors.ts` — search hits are transient state, user highlights are user-authored content.
- **Output is structured, not raw HTML.** The highlighter returns an array of `{ text, isMatch }` segments (see §10). The React component renders them as plain `<span>` and `<mark>` children — every segment passes through React's normal text-escaping. No code path in this feature builds an HTML string or sets it on an element. This is a hard rule for the whole search module.

### 4.3 Field priority

`screenName > displayName > title > description > excerpt > tweetText > articleText > cardDescription`. Concrete weights in §7. Today's `articleText` (2) outranks `cardTexts` (1), but the user-stated order has `description` above body content, so we elevate `description` and reorder. Twitter handles get the highest weight (10) because they're unique by definition — analogous to GitHub Code Search weighting filename over content ([engineering blog](https://github.blog/engineering/architecture-optimization/the-technology-behind-githubs-new-code-search/)).

---

## 5. User-visible behavior

### 5.1 Empty state

When the search input is focused but empty:

- Top: "Recent searches" (last 10, persisted in `localStorage`). Click to re-run.
- Middle: "Recently saved" (5 newest bookmarks). Clickable previews.
- Bottom: "Try" — operator chips `from:`, `has:image`, `has:link`, `since:7d`. Click to insert into the input.

Pattern lifted from [Linear's command palette](https://linear.app/docs/search) and [Notion search](https://www.notion.com/help/search). NN/g's [empty states guidance](https://www.nngroup.com/articles/empty-state-interface-design/) — never blank.

### 5.2 Live results with highlighting

As the user types (debounced, see §13):

- Results re-rank in place; matched fields highlighted.
- Each result row shows: handle chip (highlighted if matched) → title (highlighted) → snippet (highlighted, window centered on best match) → metadata strip (saved-when, has-image-icon, has-link-icon).
- Empty results state: "No bookmarks match `<query>`." If a 1-edit-distance correction has 5×+ more results, append: "Did you mean `<correction>`? — show 47 results." Soft suggestion, never auto-replace ([Baymard study](https://baymard.com/blog/offer-autocomplete-suggestions-for-misspellings)).

### 5.3 Operator chips

Typing a recognized operator key (`from:`, `tag:`, `has:`, `since:`, `until:`, `min_faves:`, etc.) followed by `:` opens an inline autocomplete popover:

- `from:el` → suggests handles starting with `el` from the user's bookmark authors.
- `tag:` → suggests the user's tags (when the tags feature ships).
- `has:` → fixed list `image | video | link | thread`.
- Selecting an item commits a **chip** (`from:elonmusk` rendered as a pill). Chips live inline in the input with a removable ✕.
- `Backspace` on empty cursor removes the last chip — Linear's pattern ([filters docs](https://linear.app/docs/filters)).

### 5.4 Saved searches

After typing a query the user finds useful, an "Save view" button appears in the toolbar:

- Click → name modal → saved to IndexedDB.
- Saved searches appear in a new sidebar section above the tab list (Unread / Continue / Read). Click to apply.
- Pattern: Linear's "Custom Views" via `Option/Alt+V`, Superhuman's "Splits", Readwise Reader's "Filtered Views" ([syntax guide](https://docs.readwise.io/reader/guides/filtering/syntax-guide)) — the gold standard for a personal corpus.

### 5.5 Keyboard

`/` focus (already wired). New: `Cmd+K` opens a command palette with the same query box plus jump-to-saved-view actions; `Esc` clears query → second `Esc` closes; `↑ ↓` navigate results; `Enter` opens current; `Cmd+Enter` opens in new tab; `?` shows shortcut help.

### 5.6 "Explain search"

Power-user affordance from [Obsidian](https://obsidian.rocks/obsidian-search-five-hidden-features/). A `?` icon next to the query, on click, shows what the parser produced:

```
from:elonmusk has:image min_faves:>=100
  → author screenName matches "elonmusk"
  AND media contains image
  AND likes ≥ 100
```

---

## 6. Data model changes

The whole point of this section: no record loses fidelity, no schema migration ships unless it earns its keep.

### 6.1 What's added

| Phase | Where | What | Migration? |
|---|---|---|---|
| 1 | derived (`src/lib/search/build-doc.ts`) | `SearchableBookmark` view: `id`, `screenName`, `displayName`, `title`, `description`, `excerpt`, `tweetText`, `articleText`, `cardDescription`, `domain`, `hashtags[]`, `mentions[]`, `hasImage`, `hasVideo`, `hasLink`, `isThread`, `tweetKind`, `createdAt`, `lastReadAt`, `metrics`, `tags?` | None — derived at runtime |
| 1 | `src/lib/constants/db.ts` | `STORE_SEARCH_INDEX = 'search_index'` (single key `'minisearch-v1'` storing serialized JSON) | DB version bump v6 → v7 with object-store creation in `upgrade` callback (`src/db/index.ts:88-143`) |
| 2 | `src/lib/constants/db.ts` | `STORE_SAVED_SEARCHES = 'saved_searches'`, schema `{ id, name, query, createdAt, sortOrder }` | DB version bump v7 → v8 |
| 4 | `src/types/index.ts` `ReadingProgress` | add `reopenCount: number`, default 0; increment in the existing reader-open path | New field on existing record; default-fill on read for legacy rows |
| 5 | `src/lib/constants/db.ts` | `STORE_EMBEDDINGS = 'embeddings'`, key=tweetId, value=`Float32Array` of 384 dims | DB version bump |

Everything else (existing `bookmarks`, `tweet_details`, `reading_progress`, `highlights`) stays untouched.

### 6.2 Why the index is persisted, not rebuilt

Building a MiniSearch index over 50k bookmarks takes ~500 ms via `addAllAsync` and ~3 s synchronously. Rebuilding on every new-tab open is unacceptable. Persisting `JSON.stringify(idx)` to IndexedDB and using `MiniSearch.loadJSONAsync(json, options)` reduces cold-start to ~150 ms. Updates are incremental via `idx.replace(doc)` / `idx.discard(id)` hooked into the bookmark-write paths.

### 6.3 Backward compatibility

- DB version bumps are additive only; no existing object stores are rewritten.
- The serialized search index is treated as a cache, never as truth: if `loadJSONAsync` throws or schema mismatches, we rebuild from `bookmarks` and persist. Bug-by-construction of "search results lie because the index is stale" is impossible — the bookmarks themselves are still authoritative.
- `reopenCount` defaults to 0 on read, so legacy `reading_progress` rows simply never contribute a click boost until they're opened again. No backfill needed.

---

## 7. Field weights, ranking formula, BM25 params

Replaces `src/lib/constants/scoring.ts`.

```ts
// Per-field BM25 boosts (multiplicative on field score)
export const SEARCH_BOOSTS = {
  // tier 1 — author identity (your "username/name" tier)
  screenName:    10,
  displayName:    8,
  // tier 2 — deliberate, dense ("title" tier)
  tags:           7,    // when tags ship; safe default = no effect
  title:          5,
  hashtags:       4,
  domain:         3,
  // tier 3 — body content ("description" tier and below)
  description:  2.5,
  excerpt:      2.5,
  tweetText:      2,
  articleText:  1.5,
  cardDescription: 1,
} as const;

// Per-field BM25 params (tweet-tuned vs article-tuned)
export const SEARCH_BM25 = {
  short: { k1: 0.5, b: 0    },  // screenName, displayName, tags, title, domain, hashtags
  tweet: { k1: 0.9, b: 0.5  },  // tweetText
  long:  { k1: 1.2, b: 0.75 },  // excerpt, description, articleText, cardDescription
} as const;
```

**Why these numbers.** Tier order honors the user's stated `username/name > title > description` priority. Within tier 2, `tags` is highest because user-applied — strongest intent we'll ever have. `domain` is high because `github.com` or `arxiv.org` is what people actually type when they want a class of links. Tweet/article BM25 split mirrors Lucene best practice — short docs need lower length-normalization (`b`) and tighter saturation (`k1`) to compete fairly against article bodies in the same query (Doug Turnbull, [BM25F from scratch](https://softwaredoug.com/blog/2025/09/18/bm25f-from-scratch); Elastic, [practical scoring guide](https://www.elastic.co/guide/en/elasticsearch/reference/current/practical-scoring-function.html)).

### 7.1 Final ranking formula

```
final_score(doc, query) =
    text_score(doc, query)                              // BM25F via MiniSearch boosts
  × max(0.1, 0.5 ^ (age_days(doc) / 90))                // 90-day half-life, floor 0.1
  × (1 + ln(1 + reopen_count(doc)))                     // log click boost (Phase 4)
  × (pinned(doc) ? 1.5 : 1.0)                           // explicit pin multiplier

age_days(doc) = (now - max(doc.createdAt, doc.lastReadAt)) / 1d
```

**Tie-breaking pre-pass** (before the multiplicative score, Algolia-style):

1. Exact match on `screenName` → bucket A, always wins.
2. Exact match on `tags` → bucket B (when tags ship).
3. Everything else → bucket C, ranked by `final_score` above.

The bucketing guarantees `from:elonmusk` returns Elon's bookmarks first regardless of recency. Reference: [Algolia tie-breaking](https://www.algolia.com/doc/guides/managing-results/relevance-overview/in-depth/ranking-criteria/).

**Why a 90-day half-life.** Bookmarks aren't news; people return to them weeks or months later. Pocket's [2017 retrospective](https://blog.mozilla.org/learning/the-anatomy-of-a-pocket-save/) showed ~30% of saves opened >7 days after save. 30 days decays too fast (a 6-month-old bookmark gets 0.0156× — effectively unfindable); 90 days gives 0.25×, still rankable behind newer matches but reachable with a strong text signal.

**Why `max(createdAt, lastReadAt)`.** A 2-year-old bookmark you opened yesterday is more relevant than a 1-week-old bookmark you've ignored. Apple's Spotlight uses [`kMDItemLastUsedDate`](https://developer.apple.com/documentation/corespotlight/cssearchableitemattributeset) for the same reason.

---

## 8. Tokenization

Replaces `src/lib/search.ts:65-66`.

```ts
// Keep @handles, #tags, $cashtags, URLs, emoji as single tokens.
// Otherwise Unicode word-split.
export const TOKEN_RE = /(?:[@#$][\w]+|https?:\/\/\S+|[\p{L}\p{N}_]+)/gu;

export const tokenize = (s: string): string[] =>
  Array.from(s.matchAll(TOKEN_RE), (m) => m[0]);

export const processTerm = (term: string): string | string[] => {
  const t = term.toLowerCase();
  // Index handles both with and without leading sigil.
  // Query "elonmusk" matches stored "@elonmusk"; query "@elonmusk" matches too.
  if (t.startsWith("@") || t.startsWith("#") || t.startsWith("$")) {
    return [t, t.slice(1)];
  }
  return t;
};
```

**What we deliberately skip.**

- **Stemming.** Tweet-language is product-name-heavy (`Frontend` should not stem to `front`). Use a light stemmer or skip — KStem ([Krovetz, 1993](http://ciir.cs.umass.edu/pubfiles/ir-35.pdf)) is the conservative middle ground if we ever need it, but BM25 IDF already handles plurals well enough at this corpus size.
- **Stopword removal.** Tweets are too short; phrase queries (`"deep work"`) need `the` preserved; BM25 IDF already gives `the` near-zero weight.
- **Aggressive diacritic folding.** `asciifolding` with `preserve_original=true` is fine; aggressive folding breaks `naïve` ↔ literal exact match.

**Synonym expansion** (deferred to Phase 4 if at all). Two-mode design: equivalent (`js, javascript, ecmascript`) and one-way (`ai => ai, artificial intelligence`). Apply at *query* time, not index time, so we can edit without reindexing — see Doug Turnbull's [*Why You Shouldn't Use Synonyms at Index Time*](https://opensourceconnections.com/blog/2017/11/21/solr-synonyms-mea-culpa/).

**Typo tolerance.** MiniSearch `fuzzy: 0.2` (≈20% edit distance per term length). Disabled for tokens beginning with `@`, `#`, `$` (handles, hashtags, cashtags) — Algolia's [`disableTypoToleranceOnAttributes`](https://www.algolia.com/doc/api-reference/api-parameters/disableTypoToleranceOnAttributes/) is the model. Quoted phrases bypass typo tolerance entirely.

---

## 9. Operator grammar (Phase 2)

Twitter-compatible. Users already know this syntax from `/search-advanced`.

```
expression  := or_expr
or_expr     := and_expr ( "OR" and_expr )*
and_expr    := not_expr ( ("AND" | implicit) not_expr )*
not_expr    := "-"? atom
atom        := operator | phrase | term | "(" expression ")"
operator    := KEY ":" VALUE
phrase      := "\"" .* "\""
```

**Operator → field mapping** (see `src/types/index.ts` for source fields):

| Operator | Maps to |
|---|---|
| `from:USER`, `@USER` | `author.screenName` exact |
| `to:USER` | `inReplyToScreenName` |
| `tag:WORD` | `tags[]` (when shipped) |
| `#WORD` | hashtag entity in `text` |
| `$WORD` | cashtag entity in `text` |
| `site:DOMAIN`, `url:STR` | `urls[*].displayUrl`, `urls[*].expandedUrl` |
| `since:YYYY-MM-DD` | `createdAt >= date` |
| `until:YYYY-MM-DD` | `createdAt < date` |
| `within_time:7d / 3h / 5m` | `createdAt >= now - duration` |
| `older_than:30d` | `createdAt < now - duration` |
| `min_faves:N`, `min_likes:N` | `metrics.likes >= N` |
| `min_retweets:N` | `metrics.retweets >= N` |
| `min_replies:N` | `metrics.replies >= N` |
| `has:image`, `filter:images` | `media[].type === 'photo'` |
| `has:video`, `filter:videos` | `media[].type === 'video' \|\| 'animated_gif'` |
| `has:link`, `filter:links` | `urls.length > 0` |
| `filter:thread` | `isThread === true` |
| `filter:replies` | `tweetKind === 'reply'` |
| `filter:quote` | `quotedTweet !== null` |
| `is:unread` | no `reading_progress` row |
| `is:reading` | `reading_progress.completed === false` |
| `is:read` | `reading_progress.completed === true` |
| `lang:en` | tweet language (when extracted) |

**Parser implementation:** recursive descent in `src/lib/search/parser.ts`, ~200 LOC. Outputs an AST that the executor walks, applying operator predicates as IndexedDB filters *before* the BM25 free-text run, so `from:elonmusk react` doesn't text-score the entire corpus then filter — it filters first, scores the slice. Order matters at 100k records.

ANTLR/PEG.js are overkill. Reference: Superhuman's [delightful-search architecture post](https://blog.superhuman.com/delightful-search-more-than-meets-the-eye/) — they describe exactly this four-stage pipeline (tokenize → node generation → AST via Shunting-yard → executor). One parser drives autocomplete, chip rendering, and execution. Open-source starter: [`search-query-parser`](https://github.com/nepsilon/search-query-parser) on npm if we want to skip writing it.

---

## 10. Highlighting algorithm

Lives in `src/lib/search/highlight.ts`, ~150 LOC. Runs on the main thread per result (top 50 only — virtualized rows past that don't need highlights computed).

The function returns **structured segments**, not an HTML string. The renderer never builds HTML by string concatenation and never injects raw HTML. React handles all text-escaping at render time:

```ts
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export interface FieldHighlight {
  field: string;            // 'screenName' | 'title' | 'tweetText' | ...
  segments: HighlightSegment[];
  matchedTermCount: number;  // for ordering which fields to render first
}

export function highlightField(
  raw: string,
  matchedTerms: Set<string>,
  windowTokens: number,
): FieldHighlight | null {
  const tokens = [...raw.matchAll(TOKEN_RE)]; // each has .index → offset
  const hits = tokens
    .map((t, i) => ({ i, lower: t[0].toLowerCase(), start: t.index!, end: t.index! + t[0].length }))
    .filter((h) => matchedTerms.has(h.lower) || prefixMatches(matchedTerms, h.lower));
  if (!hits.length) return null;

  const window = pickWindow(tokens, hits, windowTokens);
  const segments = sliceWindow(raw, tokens, window, new Set(hits.map((h) => h.i)));
  return {
    field: '',
    segments,
    matchedTermCount: new Set(hits.map((h) => h.lower)).size,
  };
}
```

`pickWindow` picks the contiguous span of `windowTokens` consecutive tokens that contains the most distinct matched terms (ties broken toward the earliest hit). `sliceWindow` walks the original string within the window range and emits an array of `{ text, isMatch }` segments — non-hit ranges as `{ text, isMatch: false }`, hit tokens as `{ text, isMatch: true }`. Plain values; no markup.

**Component layer** (`src/components/Highlighted.tsx`):

```tsx
export function Highlighted({ hl, as: Tag = 'span', className }: Props) {
  if (!hl) return null;
  return (
    <Tag className={className}>
      {hl.segments.map((seg, i) =>
        seg.isMatch ? (
          <mark key={i} className="search-hit bg-amber-100 dark:bg-amber-900/40 rounded px-0.5">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </Tag>
  );
}
```

Every `seg.text` flows through React's normal text-escaping. There is no string-concatenation path. There is no raw-HTML output. XSS surface area is zero by construction.

The result-row component composes these:

```tsx
<article>
  <header className="flex items-baseline gap-2">
    <Highlighted as="span" hl={hits.handle} className="font-semibold" />
    <Highlighted as="span" hl={hits.name} className="text-muted" />
  </header>
  <Highlighted as="h3" hl={hits.title} />
  <Highlighted as="p" hl={hits.snippet} className="text-sm" />
  <MetadataRow bookmark={b} />
</article>
```

---

## 11. Implementation phases

### Phase 1 — Foundation: BM25, excerpt, highlighting, weights ✅ user's three asks

Goal: ship the three things asked for, swap out the matcher, lay the file structure that the next phases extend.

- `pnpm add minisearch`. Bundle cost: ~6–18 KB gz depending on tree-shaking ([measured](https://lucaong.github.io/minisearch/)).
- New `src/lib/search/index.ts` — MiniSearch wrapper. Exports `createBookmarkSearch()`, `searchBookmarks(query)`, `addBookmark(b)`, `replaceBookmark(b)`, `removeBookmark(id)`. Same shape as today's exports so `useBookmarkSearch` doesn't change signature.
- New `src/lib/search/build-doc.ts` — `toSearchableBookmark(b: Bookmark): SearchableBookmark`. Derives `excerpt` per §4.1, splits `text` into title-sentence and excerpt-rest, joins `urls[*].card.description` into `cardDescription`, extracts `domain` from first URL, extracts `hashtags` and `mentions` from `text`, copies `hasImage|hasVideo|hasLink|isThread`, surfaces `metrics`.
- New `src/lib/search/tokenize.ts` — `TOKEN_RE`, `tokenize`, `processTerm` (§8).
- New `src/lib/search/highlight.ts` — `highlightField`, `pickWindow`, `sliceWindow` (§10). Returns structured segments only; no HTML strings.
- New `src/components/SearchHit.tsx` and `src/components/Highlighted.tsx`. Replace the inline result row in `BookmarksList.tsx`.
- Replace `src/lib/constants/scoring.ts` with the §7 weight constants. Remove the old phrase-bonus weights (`titlePhrase`, `textPhrase`) — BM25 phrase queries handle this natively.
- Replace `src/lib/search.ts` body. Old `searchBookmarks(bookmarks, query)` keeps the same signature but delegates to the new index. Index is built lazily on first query, cached in module scope.
- Add `useEffect` in `useBookmarkSearch.ts` that diffs `bookmarks` array reference and patches the index via `addBookmark`/`replaceBookmark`/`removeBookmark`. Avoid full rebuild on every render.
- Recency decay (§7) baked into `boostDocument` callback.
- Vitest fixtures in `src/lib/search/__tests__/`:
  - `tokenize.test.ts` — handle/hashtag/cashtag/url preservation; emoji as token; CJK behavior.
  - `build-doc.test.ts` — title/excerpt split for tweets, articles, link-only bookmarks.
  - `search.test.ts` — handle parity (`elon` matches `@elonmusk`); field-priority ordering (handle hit beats title hit beats body hit); typo tolerance; phrase query.
  - `highlight.test.ts` — multi-match snippet windowing; segment shape; renderer-level fixture asserting rendered DOM contains escaped text for `<script>` payloads.
  - `eval.test.ts` — 30 hand-labeled `(query, expected_id)` pairs in `src/lib/search/__tests__/fixtures/eval.jsonl`. Asserts MRR ≥ 0.7.
- Telemetry: `performance.mark('search:start')` and `performance.mark('search:end')` around the executor; `console.debug` the duration in dev. No production analytics added.

**Exit criteria:**
- `/` opens search → typing returns ranked results with highlighted matches in handle, name, title, and snippet.
- A bookmark whose excerpt mentions "deep work" but title doesn't, ranks below one whose title matches, and shows the highlight in the snippet.
- A query for `elonmusk` matches a bookmark with `author.screenName === 'elonmusk'` and ranks it first.
- `pnpm test` passes; eval MRR ≥ 0.7.
- No regression in initial-load time (`performance.mark`s baseline before/after).

### Phase 2 — Operator grammar, chips, saved searches

Goal: power-user query language and named filter views.

- `src/lib/search/parser.ts` — recursive-descent for the grammar in §9. Outputs an AST.
- `src/lib/search/executor.ts` — walks the AST. Applies operator predicates as filters on the underlying bookmark array, then runs MiniSearch over remaining free-text terms on the filtered slice.
- `src/components/SearchInput.tsx` — replaces the bare `<Input>` in `BookmarksList.tsx`. Renders chips inline. Autocomplete popover on `from:`/`tag:`/`has:` (handles & tags pulled from existing bookmarks). Backspace-removes-last-chip. Uses [`@base-ui/react`](https://base-ui.com) primitives per project convention (CLAUDE.md).
- DB v6 → v7: add `search_index` object store. `idb` upgrade callback creates it; existing data untouched.
- DB v7 → v8: add `saved_searches` object store. Schema: `{ id, name, query, createdAt, sortOrder }`.
- Persist serialized index on a 30 s debounce after writes. Hydrate on app startup via `MiniSearch.loadJSONAsync`. Fallback to rebuild if hydration fails.
- New `src/components/SavedSearchesList.tsx` — sidebar above the existing tab list. CRUD on `saved_searches`. Click to apply.
- Empty-state UI: recent searches (last 10 in `localStorage`), recently saved (5 newest), suggested operator chips.
- New `?` "Explain search" affordance — prints the AST in plain English.
- `Cmd+K` palette: opens an overlay command box with the same query input, plus jump-to-saved-search actions.
- Tests:
  - `parser.test.ts` — grammar coverage; precedence; quoted phrases; nested parens; escaping in operator values.
  - `executor.test.ts` — operator filters resolve correctly; mixing operators with free text; AND/OR/NOT precedence.
  - `saved-searches.test.ts` — CRUD round-trip through IndexedDB.

**Exit criteria:**
- `from:elonmusk has:image min_faves:1000` returns Elon's image-bearing tweets with ≥1000 likes.
- Typing `from:` shows handle suggestions; clicking commits a chip.
- A saved view persists across sessions and reapplies its full operator query on click.
- "Explain search" produces a human-readable summary of the parsed AST.

### Phase 3 — Persistence robustness, web worker, scale

Goal: keep search snappy at 100k bookmarks; never re-index from scratch.

- Move the MiniSearch instance into a Web Worker — `src/lib/search/worker.ts`. Use `comlink` for the RPC layer. acreom's [blog post](https://acreom.com/blog/the-quest-for-a-great-search) is the integration template.
- Main thread holds: query box, results UI, navigator. Worker holds: index, parser, executor.
- Incremental updates dispatch through the worker via Comlink; `idx.discard` + opportunistic `vacuum`.
- Periodic `JSON.stringify(idx)` → IndexedDB on a 30 s idle debounce. Resume from JSON on next boot.
- Fallback path: if hydration fails (schema mismatch, corruption), worker rebuilds from `bookmarks` and persists.
- Replace the simple `useEffect` diff in `useBookmarkSearch.ts` with a Comlink `proxy`-based subscription so updates propagate without re-rendering the bookmarks array.
- Add `vitest --benchmark` suite measuring index-build, query, and update times against synthetic 1k / 10k / 50k / 100k corpora.
- Add `performance.measure` exposed to a `?debug=search` URL flag for production-time inspection.

**Exit criteria:**
- 50k synthetic bookmarks: cold-start (with hydration) < 200 ms; query < 50 ms; main-thread frame budget never exceeds 16 ms.
- 100k synthetic: cold-start < 600 ms; query < 100 ms.
- Index survives reload; only a delta of recent writes needs replay.

### Phase 4 — Twitter-specific differentiators

Goal: ship the wedges that make us distinctly better than Twitter native + better than Raindrop/Pocket/Refind for tweet-shaped data.

#### 4a. Full-thread + parent + quoted-tweet capture

When a bookmarked tweet is `isThread === true`, fetch the full thread via the X API (we already do this for the reader — `tweet_details` store is the cache, `src/db/index.ts:32-38`) and pipe the full thread body into the search document as `threadText` (own field, weight 1.5). When `quotedTweet` exists, index its `text` as `quotedText` (weight 1.5) attributed to the quoted author. When `inReplyToTweetId` exists, fetch the parent and index its `text` as `parentText` (weight 1.0).

This eliminates the dominant pain point cited in research: ContextBolt's *"the rest of the thread held the useful information"* and Quora's *"I bookmark this art... Later I look through my bookmark to see that it isn't there. Cant remember anything the post said. Can't find it"*.

#### 4b. Linked-article body indexing

When `urls[*].card` points to an article and we don't already have `bookmark.article`, fetch+parse the article body once via the existing reader pipeline and persist `articleText`. This is the same flow the reader uses; we just trigger it from the bookmark write path instead of the read path. Indexed at weight 1.5. No surveyed Twitter-bookmark tool does this well.

#### 4c. Reopen counter + click boost

Add `reopenCount: number` to `ReadingProgress`. Increment on every reader-open path. Wire into the ranking formula via the `(1 + ln(1 + reopen_count))` term in §7.

#### 4d. Image OCR (alt-text first)

Index `media[*].alt_text` from the X API as `mediaAlt` (weight 1.0). Cheapest possible image-search story; no ML required. Real OCR (Tesseract.js or a hosted endpoint) deferred to a follow-up; alt-text alone resolves the bulk of accessibility-tagged bookmarks and design-twitter screenshots that already include captions.

#### 4e. "Did you mean"

When result count < 5 and a 1-edit-distance correction has 5×+ more results, surface the correction as a soft suggestion above the empty/sparse result list. Reference: [Baymard study](https://baymard.com/blog/offer-autocomplete-suggestions-for-misspellings).

#### 4f. Synonym list (small, query-time)

`{ js: ['javascript', 'ecmascript'], ts: ['typescript'], ai: ['artificial intelligence', 'ml'], llm: ['large language model'], db: ['database'] }`. Curated by us, applied query-side only. Reference: [Doug Turnbull on synonyms at query time](https://opensourceconnections.com/blog/2017/11/21/solr-synonyms-mea-culpa/).

**Exit criteria:**
- Bookmarking the second tweet of a thread → searching for a phrase from the *third* tweet finds the bookmark.
- Bookmarking a tweet that's just an article link → search by the article body finds it.
- A bookmark you've reopened 5× ranks above one you saved later but never opened, on equal text relevance.
- Misspelled query surfaces a correction.

### Phase 5 — Hybrid semantic search (behind a flag)

Goal: catch the "I remember the meaning, not the words" queries that BM25 inherently misses.

- `pnpm add @huggingface/transformers`. Lazy-loaded; not in the main bundle.
- Add `embeddings` object store (key=tweetId, value=Float32Array of 384 dims).
- One-time backfill: in a service worker, embed each bookmark with `Xenova/all-MiniLM-L6-v2` (22 MB quantized, ~10–25 ms per inference on M-series via WebGPU). Store embeddings.
- Incremental on new bookmarks.
- New search mode toggle: `~prefix` or an "Ask AI" tab. Runs BM25 and vector queries in parallel, fuses ranks via Reciprocal Rank Fusion ([Cormack et al., SIGIR 2009](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf)) with `k=60`. Default mode stays BM25 — trust matters; people save bookmarks because they remember a phrase.
- Open question: do we ship embeddings as a Phase 5 flag, or migrate the engine to Orama hybrid mode and run unified? Orama's persistence is broken in browser today ([#876](https://github.com/oramasearch/orama/issues/876)) — re-evaluate at Phase 5 time. If Orama is still stuck, layer transformers.js + RRF on top of MiniSearch.
- Reference: Pinecone's [hybrid search guide](https://www.pinecone.io/learn/hybrid-search-intro/), Karpukhin et al. [DPR](https://arxiv.org/abs/2004.04906).

**Exit criteria:**
- Query "things I saved about being productive" surfaces bookmarks containing "deep work tips" via the AI tab.
- Hybrid mode never ships as the default; the user explicitly opts in.

---

## 12. Performance budget

| Corpus size | Cold start (hydrated) | Cold start (rebuild) | Per-query | Memory |
|---|---|---|---|---|
| 1k | < 30 ms | < 100 ms | < 5 ms | < 5 MB |
| 10k | < 80 ms | < 400 ms | < 15 ms | < 30 MB |
| 50k | < 200 ms | < 1500 ms | < 50 ms | < 80 MB |
| 100k | < 600 ms | < 3500 ms | < 100 ms | < 150 MB |

Thresholds inspired by acreom's published numbers and MiniSearch's own benchmarks. Beyond 100k: revisit (sqlite-wasm becomes more attractive at that scale despite the 550 KB bundle hit).

Instrumentation lands in Phase 1: `performance.mark` around `search:build`, `search:query`, `search:hydrate`, `search:persist`. `?debug=search` URL flag prints the marks to the console.

---

## 13. Debounce, race conditions, virtualization

- Keep `SEARCH_DEBOUNCE_MS = 150`. With a Web Worker (Phase 3) we can drop to 50 ms because the main thread stays free, but no need before that.
- The hook tracks `latestQueryId` to discard stale results when the user types faster than the worker responds.
- Virtualization at 64 px row height (existing) is unchanged. Highlights are rendered for visible rows + `overscan: 10` (existing).
- Highlight computation is O(field tokens) per visible row — bounded by virtualizer; no risk of O(N) work per query.

---

## 14. Testing strategy

- **Unit:** every public function in `src/lib/search/` has at least one happy-path and one edge-case test.
- **Integration:** `useBookmarkSearch` exercised end-to-end with a synthetic 1k-bookmark corpus.
- **Eval set:** 30 hand-labeled `(query, expected_id)` pairs in `src/lib/search/__tests__/fixtures/eval.jsonl`. Categories: known-item (12), topic (8), author (5), operator (5). Asserts MRR ≥ 0.7 on Phase 1; tightens to ≥ 0.85 by Phase 4. The eval set lives in-repo; new eval pairs added by hand whenever a real query produces a bad result.
- **Regression:** any bug fix lands with a new eval pair pinned to the offending query.
- **XSS:** every `Highlighted` consumer is exercised with a fixture containing `<script>`, `<img onerror>`, and `javascript:` URIs. Assertion: rendered DOM contains the literal escaped text and zero injected nodes. Because `Highlighted` consumes structured segments and renders them as React children, escaping is guaranteed by React's text-rendering — the test pins this contract.
- **Benchmarks:** `vitest --benchmark` suite (Phase 3 onward) with synthetic corpora at 1k / 10k / 50k / 100k. Fails CI if regressions exceed 20%.

---

## 15. Differentiation pitch (the marketing line)

For copy on the new-tab onboarding card and the website:

> **Bookmark search that works.** Twitter's bookmark search loses tweets past the first thousand, can't filter by author or media, and doesn't even highlight matches. Totem brings every operator from Twitter's advanced search — `from:`, `has:image`, `min_faves:`, `since:` — to your bookmarks, captures the full thread at save-time so deleted tweets stay findable, and ranks results by what you actually remember: who tweeted it, what the title was, what was in it.

Tied to specific cited pain points:
- *"the bookmark search just straight up doesn't work then"* — [@Lymedlym](https://x.com/Lymedlym/status/1810899750431940682)
- *"if you bookmarked something eight months ago, you need to scroll through every bookmark saved since then to find it"* — [Saverything](https://saverything.com/en/blog/twitter-bookmarks-limit/)
- *"X gives you a reverse-chronological list with no search, no folders, no tags"* — [HN, Show HN: enzovarela](https://news.ycombinator.com/item?id=47384765)

---

## 16. Success criteria

- [ ] Phase 1: a query for `@elonmusk` ranks Elon's bookmarks first; a query for a phrase that appears only in `excerpt` returns the bookmark with highlighted snippet.
- [ ] Phase 1: zero XSS regressions — fixture-injected `<script>` renders as escaped text via React.
- [ ] Phase 1: per-query latency < 50 ms on a 50k synthetic corpus on M-class hardware.
- [ ] Phase 2: typing `from:elon has:image min_faves:1000` produces three chips and a filtered, ranked result list.
- [ ] Phase 2: a saved view round-trips through IndexedDB unchanged.
- [ ] Phase 3: cold-start with hydration < 200 ms at 50k bookmarks; main-thread frame budget never exceeds 16 ms during query.
- [ ] Phase 4: thread-body matches resurface the bookmarked tweet even when the matching phrase is in the third reply.
- [ ] Phase 4: a bookmark reopened 5× ranks above one saved later but unopened, given equal text relevance.
- [ ] Phase 5: AI mode finds a bookmark whose words don't lexically overlap with the query (a held-out eval-set pair).
- [ ] Eval-set MRR ≥ 0.7 by end of Phase 1; ≥ 0.85 by end of Phase 4.

---

## 17. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bundle size grows past extension review threshold | MiniSearch is ~6–18 KB gz. Transformers.js is gated behind a flag and lazy-loaded. Total bundle delta budget: < 30 KB gz at Phase 4, < 50 KB gz at Phase 5 (Transformers core only; ONNX models load from CDN at runtime). |
| Index corruption breaks search | Index is treated as a cache, never as truth. Hydration failure triggers rebuild from `bookmarks` (always authoritative). Logged but non-fatal. |
| MiniSearch upstream goes stale | Pinned dep with manual review on upgrades. Migration path to Orama hybrid is contained — both use BM25, both keyed by `id`. |
| User has 100k+ bookmarks (power user) | Phase 3 worker-isolates the index so queries don't jank the UI. Phase 5 upgrade path to sqlite-wasm if 100k+ becomes common. |
| BM25 ranks badly for short queries (`hi`) | Typo tolerance disabled below 4-char terms (Algolia-style); prefix matching takes over. |
| Operator parser breaks on weird input | Parser is total — every input parses to *some* AST or falls through to free-text. Never throws to UI. Fuzz-tested in Phase 2. |
| Match highlighting introduces XSS | Output is structured segments rendered as React children — `<mark>` and `<span>` only, with `text` passed as a child. No HTML strings, no string concatenation, no raw-HTML injection. React handles escaping. Hard rule for the whole search module. |
| User loses saved searches on a DB reset | Saved searches are local; document this in the Settings panel ("local to this device"). Phase 5+ revisits cloud sync. |

---

## 18. Open questions

1. **Tag data model.** When tags ship (separate PRD), do they live on `Bookmark.tags: string[]` or in a join table? Affects how `tag:react` resolves. Lean: array on Bookmark — small cardinality (~50 tags per power user), no join needed.
2. **OpenSearch description for the browser address bar.** Raindrop ships one; lets users type `bm Tab react perf <Enter>` from Chrome's URL bar. Trivial to add via `manifest.json` declarative and a small XML descriptor. Worth its own line in Phase 4 — yes/no?
3. **AI search surface.** Phase 5 offers two surfaces: a `~` prefix (Slack pattern) or a separate "Ask AI" tab (Notion / Mem pattern). Lean: tab. Less surprising for users who don't read docs.
4. **Synonyms editable by user?** Curated list ships in Phase 4. Letting users add `"my synonym"` is power-user candy; ship as a Settings affordance only if real demand surfaces.
5. **Visual: search-hit `<mark>` color.** Plan currently calls for `bg-amber-100 dark:bg-amber-900/40`. Confirm vs. project's amber/yellow tokens before Phase 1 ships.
6. **Reopen counter live in `reading_progress` or its own store?** Currently planned as a column on `reading_progress` (already keyed by tweetId). Could split into `bookmark_signals` if we accumulate more click-derived signals (CTR, dwell time, share count). Lean: keep on `reading_progress` until we have a second signal that wants joining.
7. **Eval set size.** 30 pairs to start; plan to grow to 100 over Phase 4. Confirm we treat eval failures as CI-blocking from Phase 1 onward, not just informational.

---

## 19. References

Real-world citations grounding the design choices.

**Library research**
- [VitePress search (uses MiniSearch)](https://vitepress.dev/reference/default-theme-search)
- [acreom — *The Quest for a Great Search*](https://acreom.com/blog/the-quest-for-a-great-search) — the closest production analog
- [MiniSearch](https://lucaong.github.io/minisearch/), [Fuse.js](https://www.fusejs.io/), [FlexSearch](https://github.com/nextapps-de/flexsearch), [Orama](https://github.com/oramasearch/orama)
- [Notion + sqlite-wasm + OPFS](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite)

**Ranking / NLP**
- [Robertson & Zaragoza, *The Probabilistic Relevance Framework: BM25 and Beyond* (2009)](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf)
- [Robertson, Zaragoza, Taylor, *Simple BM25 extension to multiple weighted fields* (CIKM 2004)](https://dl.acm.org/doi/10.1145/1031171.1031181)
- [Doug Turnbull, *BM25F from scratch*](https://softwaredoug.com/blog/2025/09/18/bm25f-from-scratch)
- [Elastic, *Practical scoring guide*](https://www.elastic.co/guide/en/elasticsearch/reference/current/practical-scoring-function.html)
- [Cormack et al., *Reciprocal Rank Fusion* (SIGIR 2009)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — Phase 5 hybrid

**UX patterns**
- [Linear search](https://linear.app/docs/search), [Linear filters](https://linear.app/docs/filters), [Linear custom views](https://linear.app/docs/custom-views)
- [Superhuman — *Delightful Search*](https://blog.superhuman.com/delightful-search-more-than-meets-the-eye/) — the parser architecture template
- [Algolia ranking criteria](https://www.algolia.com/doc/guides/managing-results/relevance-overview/in-depth/ranking-criteria/)
- [Algolia highlighting](https://www.algolia.com/blog/engineering/inside-the-algolia-engine-part-5-highlighting-a-cornerstone-to-search-ux)
- [Algolia typo tolerance](https://www.algolia.com/doc/guides/managing-results/optimize-search-results/typo-tolerance/)
- [Notion search](https://www.notion.com/help/search), [Slack search](https://slack.com/help/articles/202528808-Search-in-Slack), [Gmail operators](https://support.google.com/mail/answer/7190)
- [Twitter advanced search reference](https://github.com/igorbrigadir/twitter-advanced-search), [Jesus Iniesta's 2026 field guide](https://jesusiniesta.es/tools/twitter/advanced-search-guide)
- [Readwise Reader filtering syntax](https://docs.readwise.io/reader/guides/filtering/syntax-guide)
- [Obsidian — *Five hidden search features*](https://obsidian.rocks/obsidian-search-five-hidden-features/)

**Pain points**
- [twillot — *Twitter Bookmarks Pain Points*](https://www.twillot.com/en/blog/twitter-bookmarks-pain-points-2025)
- [@Lymedlym — bookmark search doesn't work](https://x.com/Lymedlym/status/1810899750431940682)
- [HN Show HN — *X gives you reverse-chronological with no search*](https://news.ycombinator.com/item?id=47384765)
- [Saverything — bookmark cap](https://saverything.com/en/blog/twitter-bookmarks-limit/)
- [Medium @kombib — *bookmarks are a digital graveyard*](https://medium.com/@kombib/notebooklm-twitter-bookmarks-signal-mining-04a97f1d474c)

**Security**
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

## 20. What I'd change FIRST (TL;DR)

Phase 1 is the deliberately-scoped first PR — every change in it directly serves one of the user's three asks (excerpt, highlight, field priority) plus the BM25 swap that makes the rest of the plan possible.

1. `pnpm add minisearch` and create `src/lib/search/{index,build-doc,tokenize,highlight}.ts`.
2. Replace `src/lib/constants/scoring.ts` with the §7 weights.
3. Replace `src/lib/search.ts` body with a thin wrapper around the new module — same exported `searchBookmarks(bookmarks, query)` signature so `useBookmarkSearch` doesn't change.
4. New `src/components/SearchHit.tsx` and `src/components/Highlighted.tsx`. Wire into `BookmarksList.tsx` row rendering.
5. Vitest fixtures: tokenize, build-doc, search ranking, highlight XSS, eval set.

**No DB migration, no UI surface change, no operator grammar.** Phase 1 ships invisibly to anyone who didn't read the changelog — until they search, and the result list is highlighted, ranked properly, and snappy.
