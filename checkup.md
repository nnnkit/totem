# Codebase Checkup

Production-readiness review of every folder and file.

---

## Summary of changes made

### Dead code removed
- **`src/api/messages.ts`** — Redundant barrel file re-exporting from `api/core/auth` and `api/core/bookmarks`. Never imported anywhere. All consumers use `api/core` or direct module imports. Deleted.
- **`src/components/reader/TweetMetrics.tsx`** — Full component never imported or rendered anywhere. Deleted.
- **`src/components/reader/TableOfContents.tsx`** — Component + two hooks (`useActiveSection`, `useScrolledPast`) never imported outside their own file. Deleted.
- **`src/lib/format.ts`** — Single `formatNumber` function only consumed by the deleted `TweetMetrics`. Deleted.
- **`src/lib/json.ts`** → Removed unused `asStringOrEmpty` function (only defined, never imported).
- **`src/components/reader/utils.ts`** → Removed dead `formatNumber` re-export (only consumer was deleted TweetMetrics).

### Duplicate code consolidated
- **`src/components/BookmarksList.tsx`** — Had local copies of `toSingleLine`, `pickTitle`, `estimateReadingMinutes` that were identical to `src/lib/bookmark-utils.ts`. Removed duplicates and imported from the shared module. Replaced local `formatTimeAgo` with `timeAgo` from `src/lib/time.ts`.
- **`src/lib/time.ts`** → `timeAgo` was defined but never imported. Updated it to match the `formatTimeAgo` behavior needed by BookmarksList (adds "ago" suffix, handles edge cases).
- **`src/hooks/useWallpaper.ts`** + **`src/lib/gradient.ts`** — Both had identical `simpleHash` functions. Exported from `gradient.ts`, imported in `useWallpaper.ts`.

### Trailing whitespace / blank lines
- **`src/lib/bookmark-utils.ts`** — Removed trailing blank line.
- **`src/lib/time.ts`** — Removed trailing blank line.

---

## Observations (no code changes, noted for awareness)

### Architecture
- **`src/api/core/bookmarks.ts`** and **`src/api/core/posts.ts`** both define a local `RuntimeResponse` interface and `runtimeError` helper. These are intentionally kept separate — the error fallback strings differ (`"API_ERROR"` vs `"DETAIL_ERROR"`), and the duplication is minimal (3 lines each). Extracting them would add coupling for negligible gain.
- **`src/lib/cn.ts`** wraps `clsx` in a single function. This is a common pattern (e.g., shadcn/ui) that allows future extension (e.g., adding `tailwind-merge`). Kept as-is.

### Styling
- **`src/PopupApp.tsx`** uses inline `style={{ height: 200 }}` and `style={{ maxHeight: 500 }}`. These are for the Chrome extension popup which needs explicit pixel constraints. Tailwind's `h-` scale doesn't map cleanly to popup sizing requirements.
- **`src/components/popup/PopupBookmarkList.tsx`** uses `style={{ maxHeight: 400 }}` for the same reason.
- **`src/components/reader/TableOfContents.tsx`** (now deleted) used `text-[11px]` and `text-[13px]` — hardcoded pixel sizes that violated CLAUDE.md styling rules.

### Documentation
Root has many markdown files. For a production open-source project, consider:
- **Keep**: `CHANGELOG.md`, `CLAUDE.md`, `ARCHITECTURE.md` (after updating outdated file paths), `RELEASING.md`
- **Consider removing**: `changes.md`, `IMPLEMENTATION_DETAILS.md`, `LINE_BY_LINE_EXPLAINED.md`, `STORAGE_EXPLAINED.md`, `soul.md` — these read as internal dev notes rather than user/contributor-facing docs
- **Missing**: A `README.md` with project description, install instructions, and screenshots

### ARCHITECTURE.md is outdated
References files that no longer exist:
- `src/background/service-worker.ts` → actual location is `public/service-worker.js`
- `src/content/detect-user.ts` → actual location is `public/content/detect-user.js`
- `src/components/BookmarkCard.tsx` → does not exist
- `src/components/SyncProgress.tsx` → does not exist

### Service worker
- `public/service-worker.js` is plain JavaScript (~1258 lines). Contains GraphQL catalog capture/export functionality (`handleGetGraphqlCatalog`, `handleExportGraphqlDocs`, `buildGraphqlDocsMarkdown`) that appears to be developer tooling rather than user-facing features. Consider extracting or removing if not needed in production.
