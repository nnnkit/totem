# Totem — Issue Backlog

Source-of-truth is GitHub issues (`nnnkit/totem`). This file is a local snapshot of what was filed from the 2026-06-23 repo cleanup. `afk-ok` = safe for autonomous implementation; `hitl` = requires a human.

---

## 1 · Fix swallowed IndexedDB write failures during sync (false-success split-brain)
**Labels:** `bug`, `afk-ok` · **GitHub:** _pending_

`src/stores/runtime-store.ts:903` runs `await upsertBookmarks(deduped)` inside an empty `catch {}`. The in-memory store is updated via `setRuntimeState({ bookmarks: updated, ... })` **before** the persist, so if the IndexedDB write throws it is silently swallowed: sync reports success, the UI shows the new bookmarks, but the DB never persisted them. On next load store and DB disagree (split-brain). A second swallow exists at ~`src/stores/runtime-store.ts:1236`.

**Acceptance criteria**
- [ ] A rejecting `upsertBookmarks` during the onPage handler does not report sync success.
- [ ] Sync status reflects the failed / partial write.
- [ ] Regression test in `src/stores/__tests__/runtime-store.test.ts` simulates a rejection and asserts no false success.
- [ ] `pnpm typecheck` and `pnpm test` pass.
- [ ] Re-checked against `ARCHITECTURE.md` sync/persistence invariants.

---

## 2 · Ship freemium Pro: runtime-gated entitlement + merchant-of-record license
**Labels:** `enhancement`, `hitl` · **GitHub:** _pending_

Paid Pro tier ($19 one-time). No premium/license/entitlement code exists today. HITL: needs external payment/license infrastructure + product/legal decisions. Implement the runtime gate first; wire the provider with a human.

**Acceptance criteria**
- [ ] One runtime-gated entitlement boundary (single `isPro` capability gate).
- [ ] License activation via a merchant-of-record (payments + key validation).
- [ ] Existing installs grandfathered.
- [ ] Paywall/upsell UX defined; CWS-policy compliant.

Design + evidence: `plans/premium-conversion-plan.md`, `plans/research/premium-monetization/raw/`.

---

## 3 · Next-release growth + launch bets (CWS resubmit, Featured badge, outreach)
**Labels:** `enhancement`, `hitl` · **GitHub:** _pending_

Consolidated launch tracker (merges old growth checklist + phase-2 outreach + GTM "3 Bets"). HITL: mostly external actions.

**Tasks**
- [ ] Resubmit CWS listing with compliant name `Totem - Twitter / X Bookmarks`.
- [ ] Featured-badge submission prep + submission.
- [ ] Ship/scope: omnibox, side panel, reading stats.
- [ ] Launch: r/nosurf founder story, Show HN, r/SideProject, bookmarksave.com outreach.
- [ ] GTM: lead with thread-aware full capture; deleted-tweet caching as a Pro hook.
- [ ] Publish remaining backlog posts (`docs/blog-pipeline.md`).

Outreach drafts captured in the GitHub issue body; full text in `git show a2ac8577^:plans/phase-2-release-foundation-outreach.md`.

---

## 4 · Native Obsidian vault export for Totem bookmarks
**Labels:** `enhancement`, `hitl` · **GitHub:** _pending_

Native one-click Totem → Obsidian vault export (not shipped). HITL/coordinate: an active design memory exists (one-way "Export to Vault"; delta = recompute-and-hash; un-bookmark == delete → orphan-and-freeze; not called "sync") and a parallel session may own this.

**Acceptance criteria**
- [ ] Decide + document transport (File System Access API / download-folder / companion).
- [ ] Vault folder layout + per-note manifest/frontmatter; idempotent re-sync (no dupes).
- [ ] Resolve open product decisions (digest cadence, destination scope).
- [ ] Local-first Markdown digest export ships first.

Source: `git show a2ac8577^:plans/research/obsidian-vault-sync-export-assessment/`.

---

## 5 · Today's Read engagement: pick-algorithm + non-guilt urgency experiments
**Labels:** `enhancement`, `hitl` · **GitHub:** _pending_

⚠️ **In active development** — a parallel session is building this now (`CONCEPTS.md` defines End-of-Day Activation, Reading Rhythm, Focus Mode; research under `plans/research/todays-read-engagement-2026-06-23/`). Track only; coordinate.

Baseline: `src/lib/today-queue.ts` (`buildTodayQueue`).

**Acceptance criteria**
- [ ] Pick-algorithm: enumerate scoring/selection changes; ship vs A/B.
- [ ] Non-guilt nudges: prototype subset; reject guilt patterns (per `soul.md`).
- [ ] Interface variants: choose/test.
- [ ] Each shipped change carries a metric/hypothesis.
