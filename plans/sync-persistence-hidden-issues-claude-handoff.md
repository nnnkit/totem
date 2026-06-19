# Claude Handoff: Sync Persistence Failure Hidden UI Drift

## Improve Skill Context

This handoff was produced after the user invoked `$improve the whole project` and then asked for the hidden interface/data issues caused by the sync persistence finding.

The investigation used the local `improve` skill:

- Skill file read: `/Users/ankit/.agents/skills/improve/SKILL.md`
- Audit playbook read: `/Users/ankit/.agents/skills/improve/references/audit-playbook.md`

Important improve-skill constraints that governed this work:

- Source code was treated as read-only.
- No source fixes, refactors, formatters, installs, commits, or mutating build commands were run.
- Only files under `plans/` may be created or edited by the advisor.
- Findings must be evidence-backed with concrete file/line references.
- Handoffs/plans must be self-contained so another agent can execute without this chat.

This file is a handoff for Claude or another implementation agent, not a completed source fix. If the next agent is acting as an executor rather than an advisor, it can implement the fix, but it should still preserve the evidence, scope boundaries, and verification gates below.

## What Was Already Audited

Initial repo recon established:

- Product: Chrome extension/new-tab reader app with a Vite + React 19 + TypeScript extension, plus an Astro site in `apps/site`.
- Package manager: `pnpm`.
- Main verification commands:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter @totem/site check`
  - `pnpm audit:prod`

Commands already run during the improve pass:

- `pnpm typecheck` passed.
- `pnpm test` passed: 52 files, 607 tests.
- `pnpm --filter @totem/site check` passed with 0 errors/warnings/hints.
- `pnpm audit:prod` failed because `apps/site` depends on an Astro version affected by high-severity advisories. This is separate from the sync persistence issue.

The first improve audit surfaced these top project findings:

1. Upgrade Astro to clear high-severity advisories and restore production audit.
2. Do not swallow IndexedDB write failures during sync.
3. Search index persistence is effectively dead code.
4. Import can synchronously inflate very large ZIPs on the UI thread.
5. Add a lint/format gate before more React complexity accumulates.
6. Gate/remove always-on diagnostic logging.
7. Break up the largest UI/runtime modules after characterization tests.

The follow-up investigation focused on finding #2: swallowed IndexedDB write failures during sync. The hidden issues below are the already-existing downstream effects of that one sync persistence bug.

## Context

Totem's sync path can report success even when fetched bookmarks fail to persist to IndexedDB. The runtime store updates `bookmarks` first, then swallows `upsertBookmarks()` failures, then reports a successful sync completion to the service worker.

This creates split-brain state:

- Current tab runtime state contains new bookmarks.
- IndexedDB may not contain those bookmarks.
- Service-worker/cache state can still record `lastSyncAt` / successful sync.
- UI and derived systems can act on bookmarks that will disappear after reload.

Do not touch unrelated dirty files. At handoff time, these unrelated changes already existed:

- `plans/blog-pipeline.md`
- `apps/site/src/content/blog/twitter-bookmarks-are-a-graveyard.md`
- `plans/blog-drafts/13-twitter-bookmarks-are-a-graveyard-claude-handoff.md`
- `plans/blog-drafts/13-twitter-bookmarks-are-a-graveyard.md`
- `plans/research/obsidian-vault-sync-export-assessment/`

## Primary Bug

In `src/stores/runtime-store.ts`, the sync page handler mutates runtime state before durability is guaranteed:

- `onPage` appends `deduped` bookmarks into runtime state around lines 887-900.
- `upsertBookmarks(deduped)` is wrapped in `try/catch` with an empty catch around lines 902-904.
- Sync completion later sets `syncStatus: "idle"`, `lastSyncAt: Date.now()`, and reports `completionStatus = "success"` around lines 991-997.
- `releaseActiveLease(completionStatus, completionErrorCode)` then informs the service worker around line 1026.

Related UI entry point:

- `src/App.tsx` `handleSync()` only warns when `result.accepted === false`; a swallowed DB failure still returns `{ accepted: true }`.

## Hidden Issues Already Present

1. False successful sync

   A failed bookmark write can still produce an idle/success sync state and no toast/error.

2. Ghost bookmarks in Home, Reading, and Search

   `useDisplayBookmarks()` reads the runtime bookmark array. Unsaved rows can appear in Home, Reading, and search until reload, then vanish.

   Relevant files:

   - `src/stores/selectors.ts`
   - `src/App.tsx`
   - `src/components/NewTabHome.tsx`
   - `src/components/BookmarksList.tsx`
   - `src/hooks/useBookmarkSearch.ts`

3. Wrong empty account message after reload

   Startup hydration reads bookmarks from IndexedDB but `lastSyncAt` can come from service-worker/cache state. If bookmarks did not persist, `selectFooterState()` can return `empty_synced_clean`, causing New Tab Home to say "No bookmarks on this account."

   Relevant files:

   - `src/stores/runtime-store.ts`
   - `src/service-worker/auth.ts`
   - `src/service-worker/sync.ts`
   - `src/components/NewTabHome.tsx`

4. Background sync retry suppression

   The service worker can stamp success and treat cache as fresh, delaying another sync attempt even though bookmarks were not saved.

5. Orphaned tweet detail cache

   Prefetch runs from runtime bookmarks. It can fetch and cache tweet details for bookmarks that never persisted.

   Relevant files:

   - `src/stores/prefetch-controller.ts`
   - `src/api/core/posts.ts`
   - `src/db/index.ts`

6. Today's Read can persist ghost IDs

   `useTodayQueue()` builds from runtime bookmarks and persists snapshots/exposures. A failed bookmark write can leave queue/exposure rows for missing bookmarks.

   Relevant files:

   - `src/hooks/useTodayQueue.ts`
   - `src/lib/today-queue.ts`
   - `src/db/index.ts`

7. Reader progress and growth prompts can record missing bookmarks

   Opening a ghost bookmark can call `ensureReadingProgressExists()` and `recordReaderOpen()`. The app can then count activity against a bookmark that is gone after reload.

   Relevant files:

   - `src/App.tsx`
   - `src/db/index.ts`
   - `src/lib/growth-state.ts`

8. Adjacent inverse drift in delete/unbookmark flows

   Some delete paths also mutate runtime state before durable delete/API completion. This can temporarily remove bookmarks from UI even if storage/API work fails.

   Relevant locations:

   - `handleBookmarkEvents()` delete path in `src/stores/runtime-store.ts`
   - `unbookmark()` in `src/stores/runtime-store.ts`

## Suggested Fix Direction

Fix the sync write path first. Do not start by patching each downstream UI symptom.

Recommended approach:

1. Make sync bookmark page writes transactional from the runtime perspective.

   Options:

   - Persist `deduped` first, then update runtime state only after `upsertBookmarks()` succeeds.
   - Or update runtime optimistically but rollback and mark sync error if persistence fails.

   Prefer persisting first unless there is a strong UX reason to stream unsaved rows into the UI.

2. Do not swallow `upsertBookmarks()` failures in sync.

   Let the error move the sync into the existing failure path. That should set `syncStatus` to `error`, avoid stamping successful `lastSyncAt`, and report failure to the service worker.

3. Prevent `prefetchController.reconcile()` from running for a failed page write.

   It should only run after the bookmark rows are durable.

4. Add tests before/with the fix.

   There is a happy-path test for full seed success, but no regression test where `upsertBookmarks` rejects during sync.

## Concrete Tests To Add

Add focused tests in `src/stores/__tests__/runtime-store.test.ts`.

Minimum regression coverage:

1. `upsertBookmarks` rejects during manual full sync.

   Assert:

   - `state.syncStatus` becomes `"error"`.
   - `completeSyncRun` is called with `status: "failure"` and a useful `errorCode`.
   - runtime `bookmarks` does not retain the unsaved `deduped` bookmarks, or rolls them back if optimistic UI remains.
   - `prefetchController` side effects do not run for the failed page write, if directly observable.

2. `upsertBookmarks` rejects during manual quick/incremental sync.

   Assert the same failure semantics. This matters because quick/incremental sync is common after initial seed.

3. Successful write still streams or displays bookmarks as intended.

   Preserve current happy path behavior after the implementation change.

Optional follow-up tests:

- Selector/UI test proving `empty_synced_clean` only appears after a true durable zero-bookmark sync.
- Bookmark event create path already does not ack on failed write; add or confirm explicit test coverage if missing.
- Delete/unbookmark durability tests for the adjacent inverse drift.

## Acceptance Criteria

- A failed IndexedDB bookmark write during sync cannot be reported as successful sync.
- `lastSyncAt` / service-worker success stamps are not advanced for failed bookmark persistence.
- Unsaved fetched bookmarks are not left in runtime state after the failed sync.
- Home/Reading/Search do not show bookmarks that failed to persist.
- Prefetch, Today Queue, reader progress, growth prompts, and search indexing cannot be triggered by failed sync inserts.
- Existing tests pass:

  ```bash
  pnpm typecheck
  pnpm test
  ```

`pnpm audit:prod` was already failing before this handoff because `apps/site` depends on an Astro version with high-severity advisories. That is separate from this sync persistence issue.
