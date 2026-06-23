# Architecture refactor tracker

Working tracker for the verified architecture-review survivors on branch
`refactor/account-persistence-seam`. Source: `/improve-codebase-architecture`
(verified pass — 37 raw candidates → 12 canonical → 3-lens adversarial
verification → 4 survivors). This file drives the implementation and is
resumable: a fresh session can read it + the branch state and continue.

> Note: the repo convention is to track work in GitHub issues, not local md.
> This file is a transient working tracker for this branch — convert to issues
> or delete before merge if preferred.

## Verification gates (run after every step)
- `pnpm typecheck` — must be clean.
- `pnpm test` — all 608 tests must pass.
- Each issue commits separately; behaviour-preserving unless noted.

---

## ISSUE 1 — C4: Make the account part of the persistence seam  (Strong / top rec)

**Goal:** the account rides the persistence seam (`openAccountDb(accountId)`)
instead of an ambient module-global `activeDbName`, so the "switch account
first" invariant is enforced structurally, not by 4 prose comments. Lays the
foundation for future logout/disconnect/multi-account (kept Twitter-driven for
now — no behaviour change).

### Done (committed)
- [x] `openAccountDb(accountId: string | null): AccountDb` added to `src/db/index.ts`;
      `dbName` threaded through all 54 data ops + inter-function calls; handle memoized per db name.
- [x] `runtime-store` holds an `AccountDb` handle (`accountDb`), swapped in lockstep
      with `setActiveAccountId`; its 10 db calls route through the handle.

### Remaining (to fully close the leak)
- [ ] **`useAccountDb()` selector.** Expose the store's current account handle reactively
      (put the active handle in runtime state or derive from `activeAccountId`) so React
      consumers can read/write through it and re-render on account switch.
- [ ] **Migrate the 14 remaining db consumers** off bare global functions onto a handle:
      - React (via `useAccountDb()`): `components/BookmarksList.tsx`, `hooks/useContinueReading.ts`,
        `hooks/useTodayQueue.ts`, `hooks/useHighlights.ts`, `hooks/useReadingProgress.ts`,
        `hooks/useBookmarkSearch.ts`, `runtime/RuntimeProvider.tsx`.
      - Non-React (handle passed/obtained explicitly): `stores/prefetch-controller.ts`,
        `stores/hydration-store.ts`, `lib/search.ts`, `lib/reset.ts`,
        `lib/export/quick-export.ts`, `api/core/posts.ts`.
      - **Special:** `lib/import/run-import.ts` — creates/targets a *new* account's DB during
        import; needs `openAccountDb(targetAccountId)` explicitly, not the current handle.
- [ ] **Remove the global** once no one reads it: delete `setActiveAccountId`, `activeDbName`,
      and the 4 hazard comments (`db/index.ts`, `runtime-store.ts:~554/688/1146`,
      `selectors.ts:78`, `useReaderDetail.ts:83`, `App.tsx:798`).
- [ ] **Demote `bookmarksLoaded`** to a pure data-readiness flag (its safety role is now the
      `null`-handle gate). Keep `subscribeTweetDetailCache` global (cross-account listener).

**Acceptance:** no remaining bare global db calls; `setActiveAccountId`/`activeDbName` gone;
typecheck + 608 tests green; logged-out/account-switch behaviour unchanged (Twitter-driven).

---

## ISSUE 2 — C9: Unify the article-export block-walk behind one emitter  (Worth exploring)

**Files:** `src/lib/export/article-to-markdown.ts` (`blocksToMarkdown` ~92-212),
`src/lib/export/article-to-print-html.ts` (`blocksToArticleHtml` ~34-157).

**Problem:** the block-group walk + 3-way shape-dispatch (hasBlocks → blocks;
no-headings → richText; else → heading-chunks) are duplicated byte-for-byte
across the markdown and print-HTML adapters; only the emitted leaf string differs
(`## x` vs `<h2>x</h2>`).

**Plan:** extract one `walkArticle(article, emit)` iterator + single shape-dispatch,
parameterised by a per-target `emit` table whose only job is the leaf string.
Both adapters become thin emit tables.

**Scope guard (from verification):** do NOT absorb `block-inline-markdown.ts`
(its renderer is already shared with the on-screen reader at `reader/utils.ts` /
`TweetArticle.tsx`), `article-heading-chunks.ts` (already target-agnostic), or
`agent-markdown-optimizer.ts` (orthogonal post-processor). Limit to the two orchestrators.

**Acceptance:** identical markdown + print-HTML output (golden-compare against current);
typecheck + tests green.

---

## ISSUE 3 — C10: Unify the chrome.storage.sync preference lifecycle  (Worth exploring)

**Files:** `src/hooks/useSettings.ts` (97-145), `src/hooks/useTheme.ts` (44-99).

**Problem:** both hooks reimplement the identical synced-preference lifecycle —
`hasChromeStorageSync()`-guarded load with a cancelled-flag race guard, an
`onChanged`/`areaName==='sync'`+key listener, and a guarded swallow-on-fail set.
(`useTheme`'s `onChanged` is even missing the cancelled re-check — a latent bug.)

**Plan:** extract `useSyncedPreference<T>(key, normalize, default)` owning the
platform guard, areaName filter, cancelled-load race guard, and swallow-on-fail set.

**Scope guard:** keep `useSettings`' field validator + `userPatchedRef` race-guard
and `useTheme`'s `matchMedia`/`resolvedTheme`/`root.dataset` DOM effect OUTSIDE the
primitive, or it becomes shallow.

**Acceptance:** settings + theme load/persist/cross-tab behaviour unchanged; the
`useTheme` cancelled-recheck bug fixed; typecheck + tests green.

---

## Dropped in verification (do NOT implement / re-suggest)
- **C2** Saved Post removal — `deleteBookmarksByTweetIds` already deep; only a 1-line
  early-return bug (skips `prefetch.reconcile()` on API-delete failure). *(Optional tiny bug-fix.)*
- **C5** Sync orchestrator — already deep in `service-worker/sync.ts`; runtime holds only a
  per-tab handle that can't live in MV3 SW.
- **C7** RPC envelope — not actually uniform across api/core.
- **C11** Search singleton — already deep; explicit setBookmarks/search would widen the interface.
- **C12** Bookmark event — deliberate SW↔runtime serialization seam.
- **C3 / C6 / C8** (weakened) — narrow: local-store has only a shared subscribe helper across 2/5
  files; auth phase logic already centralized (only a dead SW `authPhase` field to delete); the
  sortIndex fallback is ~6 shared lines (+ a latent NaN-leak fix in `reading-list`).

## Finish
- Push branch `refactor/account-persistence-seam`; open PR (not main).
