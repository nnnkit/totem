# Codebase Deep-Dive: Feature Surface & Export (Paywall Gate Analysis)

Scope: map every user-facing feature, deep-dive Export (the proposed primary Pro gate), assess gate-insertion cost per feature, and propose the single cleanest entitlement boundary. All citations are to the extension code under `src/`.

**Headline finding:** There is **zero gating today** — every feature is fully free. Export, the proposed primary Pro gate, is one of the cleanest things in the codebase to wrap: it has exactly two entry points (a new-tab modal and a per-article reader menu), both routed through `App.tsx`, and both consume `account`/`viewerProfile` already, so an entitlement check slots in with almost no plumbing.

---

## 1. EXPORT TODAY

### 1a. Formats currently supported

Totem has **two distinct export systems**:

**A) Library-wide ZIP export** (`src/lib/export/quick-export.ts`, `runQuickExport`, lines 561–776). One ZIP (`totem-export-YYYY-MM-DD.zip`) bundling **every supported format at once**:
- **CSV** — `bookmarks.csv`, 11 columns (`quick-export.ts:95–107`, written by `bookmarkCsvLine`/`csvLines` `:314–343`), BOM-prefixed for Excel.
- **Markdown** — `readme.md` index (`buildReadme` `:215–263`) **plus one `.md` file per bookmark** under `bookmarks/` (`buildBookmarkMarkdown` `:192–213`, written in the entries generator `:686–702`), rendered through the same `articleToMarkdown` path as the reader's Copy-Markdown.
- **JSONL** — canonical re-importable data under `data/*.jsonl`: `bookmarks-<year>.jsonl` (sharded by year), `details.jsonl`, `highlights.jsonl`, `reading-progress.jsonl`, `today-queue-snapshots.jsonl`, `bookmark-queue-metadata.jsonl`, `today-queue-exposures.jsonl` (`:620–684`).
- **manifest.json** — version, account id-hash, per-file SHA-256 checksums, counts, shard map (`:704–750`).
- **Zip mechanism**: **not** `client-zip`. It uses a **custom streaming zip** in `src/lib/export/stream-zip.ts` (`makeZipEntriesStream`, consumed at `quick-export.ts:753`). Output is streamed straight to disk via the **File System Access API** (`window.showSaveFilePicker` → `createWritable` → `pipeTo`, `openWritable` `:284–301`), with a `Blob` + anchor-click fallback (`downloadBlob` `:303–312`) when the API is absent.

**B) Per-article export** (reader, `src/lib/export/article-download.ts` + `src/components/reader/ArticleExportMenu.tsx`). Four actions on a single focal article/thread:
- **Copy for Agent** (`articleToAgentMarkdown`), **Copy Markdown** (`articleToMarkdown`) → clipboard (`article-download.ts:62–80`).
- **Download Markdown** → single `.md` Blob download (`downloadArticleMarkdown`/`downloadMarkdownFile` `:82–107`).
- **Print / Save PDF** → renders print HTML into a hidden iframe and calls `window.print()` (`printArticleAsPdf` `:109–197`).

### 1b. How export is triggered (entry points)

Only **two** UI entry points exist:

1. **`ExportModal`** (`src/components/ExportModal.tsx`). Opened from two places, both setting `exportOpen` in `App.tsx`:
   - `NewTabHome` "Export" affordance → `onOpenExport` (`App.tsx:684`).
   - `SettingsModal` "Export" button → `onExport` (`App.tsx:706`; button at `SettingsModal.tsx:64,101`).
   - The modal offers **Quick/Basic export** (download ZIP now) and **Full export** (background-hydrate missing content first, then download). The click path: `handleStart` → `handleQuickExport` → `runQuickExport(account)` (`ExportModal.tsx:60–88`). Full export instead calls `getHydrationStore().getState().start()` (`:78–80`).

2. **`ArticleExportMenu`** (`src/components/reader/ArticleExportMenu.tsx`), rendered inside the reader's `ActionBar` (`src/components/reader/TweetContent.tsx:221–228`, props plumbed from `articleExport`). This is the per-article path (1a-B above).

### 1c. Code path: click → data read → file produced (ZIP)

```
ExportModal.handleStart (ExportModal.tsx:82)
  → handleQuickExport (:60)
    → runQuickExport(account)  (quick-export.ts:561)
        → openWritable(filename)                         // FS Access API or blob fallback (:284)
        → Promise.all([
            collectBookmarkMarkdownFiles(),              // iterateBookmarks() over IndexedDB (:457)
            collectDetailSummary(),                      // iterateTweetDetails() (:413)
            collectHighlightIds(), collectReadingProgressIds()
          ])
        → entries() async generator yields StreamZipEntry per file (:599)
            // readme.md, bookmarks.csv, data/*.jsonl, bookmarks/*.md, manifest.json
            // each text entry hashed via createSha256Hex (:372 hashingTextEntry)
        → makeZipEntriesStream(entries())  (stream-zip.ts, :753)
        → pipeTo(writable)  OR  new Response(stream).blob() → downloadBlob (:754–759)
    → setQuickState({ phase: "done", result })           // counts shown in DoneView
```
All reads are local IndexedDB iterators (`src/db/index.ts`: `iterateBookmarks`, `iterateTweetDetails`, `getTweetDetailCache`, etc.). No network, no server — consistent with the local-first ethos.

### 1d. Is there ANY gating today?

**No.** The only preconditions anywhere are functional, not commercial:
- `runQuickExport` requires a non-null `account` (`ExportModal.tsx:61`, `canExport = bookmarkCount > 0 && account !== null` `:157`). `account` is derived from `viewerProfile` in `App.tsx:713–717`.
- `ArticleExportMenu` actions are always enabled.
- No `isPro`, `entitlement`, `license`, `paywall`, `upgrade`, or `checkout` symbol exists anywhere in `src/` or `apps/site/src/` (grep confirmed — the only "upgrade" hits are IndexedDB schema-version upgrades). **The codebase is a clean slate for monetization.**

---

## 2. FEATURE INVENTORY & GATE DIFFICULTY

| Feature | Entry-point component / file | User trigger | Gate difficulty | GTM tier |
|---|---|---|---|---|
| New-tab queue / Today's Read | `NewTabHome.tsx`, `useTodayQueue` (`hooks/useTodayQueue.ts`) | Open new tab | n/a (don't gate) | **FREE** |
| Reading list (Unread / Continue / Read / Today tabs) | `BookmarksList.tsx` | "Reading" view | n/a | **FREE** |
| Reader (article/thread render) | `BookmarkReader.tsx`, `reader/TweetContent.tsx` | Click a bookmark | n/a | **FREE** |
| Sync (intercept + IndexedDB) | `runtime-store.ts` `actions.refresh`, service worker | "Sync" button | n/a | **FREE** |
| Basic in-library search (free text) | `useBookmarkSearch.ts` → `lib/search.ts` | Type in search box (`BookmarksList.tsx:301`) | n/a | **FREE** |
| Web search box (Google/Bing/…) | `NewTabHome.tsx:1147`, `SearchEnginePicker.tsx` | Type + Enter | n/a | **FREE** |
| **Export — library ZIP (CSV/MD/JSONL)** | `ExportModal.tsx` → `quick-export.ts` | Export button → "Download ZIP" | **Trivial** (1 call site: `handleQuickExport`) | **PRO** |
| **Export — Full export (deleted-tweet preservation)** | `ExportModal.tsx` → `hydration-store.ts` `start()` | "Start full export" | **Trivial** (1 call site: `handleStartFullExport` `:78`) | **PRO** |
| **Export — per-article (Download MD / Print PDF)** | `ArticleExportMenu.tsx`, `article-download.ts` | Reader menu | **Trivial** (gate the 4 `on*` handlers in `TweetContent`) | **PRO** (Copy-MD/Copy-Agent could stay free as a teaser) |
| Import (re-import a Totem ZIP) | `ImportModal.tsx` → `lib/import/run-import.ts` | Import button | Trivial | **FREE** (keeps data portability honest) |
| **Advanced search filters** (`from: tag: site: min_faves: has: is: since:` …) | `lib/search/parser.ts`, `lib/search/executor.ts` | Type operators in same box | **Medium** (one box; must gate by parsed AST, not the box) | **PRO** |
| **Annotations — highlights** | `reader/SelectionToolbar.tsx`, `HighlightPopover.tsx` → `db.upsertHighlight` | Select text → "Highlight" | Medium (gate `onHighlight` in `SelectionToolbar`) | **PRO** (per GTM) |
| **Annotations — notes** | `reader/SelectionToolbar.tsx`, `NotePopover.tsx` | Select text → "Add Note" | Medium (gate `onAddNote`) | **PRO** (per GTM) |
| **Bulk ops** | *does not exist yet* (no multi-select anywhere; grep found none in `BookmarksList`) | — | **Hard** (net-new selection UI) | **PRO** |
| **Thread-aware capture** | partially exists: `hydration-store.ts` fetches `thread`, `tweet-export.ts` `buildSyntheticExportPlainText(includeThread)` | implicit via Full export | Medium | **PRO** (couple to Full export) |
| Settings / theme / reset / delete-all | `SettingsModal.tsx` | Settings | n/a | **FREE** |

"Trivial" = single call-site, value already in scope. "Medium" = call-site exists but must gate by intent (parsed query / specific button) not the whole surface. "Hard" = feature doesn't exist; gate is part of new construction.

---

## 3. PROPOSED PRO FEATURES — EXISTS vs NET-NEW

| Pro feature | Already in code? | File(s) that would host the gate |
|---|---|---|
| **Export (MD/CSV/JSONL/ZIP)** | **EXISTS, complete.** Full multi-format streaming ZIP + per-article MD/PDF. | `ExportModal.tsx` (`handleQuickExport` `:60`); `reader/TweetContent.tsx` `ActionBar`/`ArticleExportMenu` handlers `:221`. Underlying `lib/export/*` left ungated. |
| **Deleted-tweet caching / preservation** | **EXISTS.** The "Full export" hydration engine (`src/stores/hydration-store.ts`) back-fills `TweetDetailCache` for every bookmark and explicitly classifies/persists deleted+protected tweets (`classifyError` `:116`, `cacheUnavailable`, `detailsStatus: "unavailable"`, `unavailableReason: "deleted"` `:132,213`). This *is* the preservation feature; it just isn't framed/sold as one. | `ExportModal.tsx:78` (`handleStartFullExport`) and/or `hydration-store.ts` `start()` `:249`. |
| **Bulk ops** | **NET-NEW.** No multi-select / batch-action UI exists in `BookmarksList.tsx` or anywhere (`bulk`/`selectAll`/`checkbox` grep is empty in components). | New code in `BookmarksList.tsx`; gate at the bulk-action dispatcher you build. |
| **Advanced search filters** | **EXISTS, complete & impressive.** Full recursive-descent grammar with `from/to/tag/site/url/since/until/within/older_than/min_faves/min_retweets/min_replies/has/filter/is/lang` + AND/OR/NOT/quotes/parens (`lib/search/parser.ts`, `executor.ts:140–208`). Twitter-compatible aliases too. | `useBookmarkSearch.ts` (or a wrapper) — detect operator nodes in the parsed AST and gate; keep plain free-text search free. |
| **Annotations** | **EXISTS.** Highlights (multi-color) and notes are fully built: `db.upsertHighlight`/`getHighlightsByTweetId` (`db/index.ts:840–880`), `SelectionToolbar.tsx`, `HighlightPopover.tsx`, `NotePopover.tsx`, `HighlightColorPicker.tsx`. They're even already exported in the ZIP (`highlights.jsonl`). | `reader/SelectionToolbar.tsx` `onHighlight`/`onAddNote` callbacks `:128,131`, or the consuming reader component that passes them. |
| **Thread-aware capture** | **MOSTLY EXISTS.** Threads are fetched by hydration and rendered; export composes full threads (`tweet-export.ts:buildSyntheticExportPlainText(thread, includeThread)` `:152`, called with `includeThreadInExport: true` from `quick-export.ts:201`). | Naturally gated together with Full export / library export. No separate gate likely needed. |

**Net takeaway:** 5 of 6 proposed Pro features are *already built and shipping for free*. Only **bulk ops** is net-new. Monetization here is overwhelmingly a **gating/packaging exercise, not a build exercise** — which makes a single clean entitlement boundary the highest-leverage piece of work.

---

## 4. CLEANEST SPOT FOR A SINGLE REUSABLE GATE

### Recommended pattern

**(a) Entitlement source — mirror `useSettings`.** Settings already persist via `chrome.storage.sync` keyed by a constant (`useSettings.ts:104–141`, `SYNC_SETTINGS` from `lib/storage-keys.ts`), with a live `chrome.storage.onChanged` subscription. **Clone this exactly** for entitlement: add `SYNC_ENTITLEMENT` (or `LOCAL_ENTITLEMENT`) to `lib/storage-keys.ts`, and a `useEntitlement()` hook in `src/hooks/useEntitlement.ts` that reads/normalizes the stored license and re-renders on change. This keeps the proven storage/subscription pattern and stays server-optional (the unlock token is verified once and cached locally — fits the no-server ethos).

**(b) Boundary — a `<ProGate>` component + a `requirePro(action)` wrapper.** Put both in `src/components/ui/ProGate.tsx` (alongside `Modal`, `Button`). `<ProGate>` renders children for Pro users and a locked/upsell affordance otherwise; `requirePro(isPro, action, onUpsell)` wraps an imperative handler so a free user gets the upsell modal instead of the action. A single shared `<UpgradeModal>` (sibling of `ExportModal`/`ImportModal` in `App.tsx:708–725`, opened via a new `upgradeOpen` flag in `newTabRouteReducer` `:131`) gives every gate one consistent surface to point at.

### Why this is the cleanest single insertion point

- **Export already concentrates at `App.tsx`.** `ExportModal` and `ImportModal` are both rendered there with `viewerProfile`/`account` already in scope (`App.tsx:708–725`). Adding `upgradeOpen` state + an `<UpgradeModal>` there means **one place owns the upsell surface** for the whole new-tab app.
- **Two export gates, both trivial.** For the primary gate, wrap `handleQuickExport` (`ExportModal.tsx:60`) and `handleStartFullExport` (`:78`) with `requirePro(...)`. The `IdleView` primary button (`:299–306`) can additionally show a lock state by passing `isPro` down. No change to `lib/export/*` — the data layer stays clean and testable.
- **Reader gate is one prop hop.** The per-article menu handlers are passed as a single `articleExport` prop object through `TweetContent.tsx:221`. Wrap those four `on*` functions (or just `onDownloadMarkdown`/`onPrintPdf`) once at the point they're constructed.
- **Search & annotations reuse the same hook.** `useBookmarkSearch` and `SelectionToolbar` can both call `useEntitlement()` and route to the same `<UpgradeModal>` — no second mechanism.

### Concrete first slice (lowest-risk MVP gate)
1. `lib/storage-keys.ts`: add `SYNC_ENTITLEMENT`.
2. `src/hooks/useEntitlement.ts`: `useEntitlement(): { isPro: boolean }` (copy `useSettings` shape).
3. `src/components/ui/ProGate.tsx`: `<ProGate>` + `requirePro()`.
4. `App.tsx`: add `upgradeOpen` to `NewTabRouteState`, render `<UpgradeModal>` next to `ExportModal`.
5. `ExportModal.tsx`: wrap `handleQuickExport`/`handleStartFullExport`; pass `isPro` into `IdleView` for lock styling.

That single boundary covers the primary Pro gate (export) and is immediately reusable for full export/preservation, advanced search, and annotations — all of which already exist and just need the same `requirePro`/`<ProGate>` wrapper.

---

### Key file reference
- Export (library ZIP): `src/lib/export/quick-export.ts`, `src/lib/export/stream-zip.ts`, `src/lib/export/tweet-export.ts`, `src/components/ExportModal.tsx`
- Export (per-article): `src/lib/export/article-download.ts`, `src/components/reader/ArticleExportMenu.tsx`, `src/components/reader/TweetContent.tsx:221`
- Deleted-tweet preservation: `src/stores/hydration-store.ts`
- Advanced search: `src/lib/search/parser.ts`, `src/lib/search/executor.ts`, `src/hooks/useBookmarkSearch.ts`
- Annotations: `src/components/reader/SelectionToolbar.tsx`, `HighlightPopover.tsx`, `NotePopover.tsx`, `src/db/index.ts:840–880`
- Wiring / proposed gate host: `src/App.tsx:684,706,708–725`; pattern to mirror: `src/hooks/useSettings.ts:104–141`
