# Export hydration — technical plan

> Closes #37. Authored 2026-05-12 from a `/grill-me` interview with the maintainer.
> Resolves the open architecture question PRD #33 §11 flagged as the main risk.

## TL;DR

The hydration job is **not** a service worker / `chrome.alarms` background subsystem.

It is a **runtime store slice that runs inside any open Totem tab**, walking IDB for bookmarks missing `tweet_details`, calling the existing `FETCH_TWEET_DETAIL` SW handler with jittered cadence, and persisting results. A single-writer lock in `chrome.storage.session` ensures only one tab runs the loop at a time across multi-tab setups.

No `chrome.alarms`. No offscreen document. No SW lifecycle work. No persistent cursor in `chrome.storage.local`. IDB is the queue; the work is implicit in "bookmarks that don't yet have `tweet_details`."

If no Totem tab is open, the job is paused by definition. Resumes on next Totem tab.

---

## Why not a background subsystem

PRD §6 originally described `chrome.alarms` + foreground accelerator + shared cursor. The grill walked four mechanisms and the cheap answer dominates:

| Mechanism | Runs when… | Complexity | Verdict |
|---|---|---|---|
| Any open Totem tab | Any Totem tab alive (includes NTP override) | Trivial | **Picked.** |
| SW + `chrome.alarms` | Always, even when Chrome closed (alarms fire on startup) | Medium — wake budgets, batch sizing, MV3 quirks | Rejected: PRD §11 risks |
| SW + offscreen document | Chrome running, even with no Totem tab | High — offscreen lifecycle, port keepalive | Rejected: marginal value |
| SW + port keepalive from tab | Tab keeping port open is alive | Medium | Rejected: weird |

The decisive observation: **Totem is the NTP override.** Users routinely have ≥1 Totem tab open. The marginal "runs when Chrome open but no Totem tab" benefit of the offscreen approach is hours, not days, for the realistic user. Not worth the lifecycle complexity.

None of these mechanisms run when Chrome is closed. MV3 has no true background. So the real axis is "any Totem tab" vs "Chrome open at all," and the gap there is small.

---

## Rate-limit discipline

**Conservative trickle with human-paced jitter.** No header reading, no bucket math.

- Base inter-request delay: random in **[1500, 3500] ms**.
- Every 20–40 requests: an additional **[10000, 30000] ms** pause (mimics human reading).
- On `RATE_LIMITED` (HTTP 429 from `api-proxy.ts:204`): pause job for **15 minutes**, then resume at the same jittered cadence.
- No `Retry-After` parsing (X often omits it; the fixed 15-min pause is cheap and conservative).
- No bucket counter, no proactive throttling.

Why not header-based: X doesn't reliably publish per-endpoint limits, and the "50% of documented limit" framing in the original PRD assumed infrastructure we don't have. The trickle rate is calibrated to be slow enough that 429s should be rare in practice — the loop is the throttle, not a counter.

At base cadence, a 3000-bookmark library takes ~100 minutes; a 10k library ~5.5 hours. Acceptable for a one-shot "Make it ready" job the user kicks off and walks away from (the tab needs to stay open, but they don't have to watch it).

Why the jitter range is asymmetric (1.5–3.5s, not 1.9–2.1s): bot fingerprints come from suspiciously regular timing as much as from sheer rate. Wider variance + occasional long pauses look much more like a human casually reading.

---

## Single-writer lock (multi-tab coordination)

Multiple Totem tabs can be open simultaneously (NTP + library + reader). Only one should run the loop.

**Mechanism:** `chrome.storage.session` key `hydration_lock`.

```ts
interface HydrationLock {
  tabId: number;          // chrome.tabs.Tab.id of the holder
  acquiredAt: number;     // ms epoch
  lastTickAt: number;     // ms epoch; heartbeat
}
```

- On loop start, tab tries `compareAndSet(lock, null, { tabId, now, now })`.
- If lock is held by another tab and `lastTickAt > 60s old` → steal it (the holder has stalled or closed).
- During loop, holder updates `lastTickAt` every iteration (heartbeat).
- On loop end (done, paused-by-user, tab closing), holder releases the lock.

`chrome.storage.session` is cleared on browser restart, so a stale lock from a hard crash auto-resolves on next session.

Non-holder tabs poll the lock every 5s and start the loop themselves if it goes stale.

The Export modal in non-holder tabs renders the same progress (read from `chrome.storage.local` snapshot — see below) but doesn't drive the loop.

---

## State surfaces

### Runtime store slice — local to each tab

```ts
interface HydrationRuntimeState {
  status: "idle" | "running" | "paused-429" | "done";
  total: number;          // count of bookmarks needing hydration, recomputed on tick
  processed: number;      // count attempted in this session
  unavailable: number;    // count that came back deleted/protected/parse-failed
  pauseUntil: number;     // ms epoch; for 429 backoff
  startedAt: number;      // ms epoch; for "started Xh Ym ago" line
}
```

Lives in a Zustand slice. Re-derives `total` from IDB on each tick (cheap; resilient to bookmarks added mid-job).

### Cross-tab snapshot — `chrome.storage.local`

Single key `CS_HYDRATION_SNAPSHOT`. The holder writes a snapshot of its runtime state every ~5s. Non-holder tabs read it to render the same modal/footer.

```ts
interface HydrationSnapshot {
  status: "idle" | "running" | "paused-429" | "done";
  total: number;
  processed: number;
  unavailable: number;
  pauseUntil: number;
  startedAt: number;
  updatedAt: number;
}
```

Not persistent across browser restarts — it's a UI mirror, not a checkpoint. Real state is in IDB.

### Why no persistent cursor

The original PRD called for an account-scoped cursor in `chrome.storage.local`. We don't need it.

- A bookmark needs hydration iff its `tweet_details` row is missing or has `detailsStatus !== "ok"`.
- That predicate is queryable from IDB at any time.
- "Resume" means "run the loop again"; the work picks up because hydrated rows don't get re-queued.
- No need to track "what was the last id processed" — the next id is whatever IDB returns next.
- No 30-day auto-clear because there's no cursor to clear.

The PRD's framing of resume/cancel/clear assumed a persistent queue. There isn't one.

---

## Schema changes

### `TweetDetailCache` (in `src/types/index.ts:176`)

Add two optional fields:

```ts
export interface TweetDetailCache {
  tweetId: string;
  fetchedAt: number;
  focalTweet: Bookmark | null;
  thread: ThreadTweet[];
  // NEW:
  detailsStatus?: "ok" | "unavailable";
  unavailableReason?: "deleted" | "protected" | "parse_failed" | "unknown";
}
```

Existing rows have `detailsStatus === undefined` → treat as `"ok"`. New rows from hydration set the status explicitly. Failed rows (`detailsStatus === "unavailable"`) are **not** re-queued by subsequent hydration runs.

### IDB migration

Additive optional fields. No version bump on the IDB schema itself — `idb` library passes through unknown fields untouched.

### Export `manifest.json` schema version

PRD §10 manifest currently uses `schema_version: 3`. Bump to **`schema_version: 4`** in the export to declare the new optional fields. Importer reading v4 into a v3 install just ignores the unknown fields (forward-compat). Importer in this codebase already accepts `schema_version <= current`.

---

## Failure modes & UI surfaces

Six job states, mapped to PRD §3 modal + footer surfaces. Two pause reasons surfaced to the user; everything else self-recovers silently.

| State | Modal | Footer | Surface trigger |
|---|---|---|---|
| `idle` | "Make it ready" CTA | (hidden) | Job not started |
| `running` | progress bar, counts, "Download what's ready now" | `Preparing full export: N / M` | Loop active |
| `paused-429` | progress bar + "Resumes in 8m (X rate limit)" | `Preparing full export: N / M · resumes in 8m` | 429 received, 15-min cooldown |
| `paused-auth` | "Sign in to X again" + CTA | `Full export paused: sign in to X →` | Session goes non-`ready` per Invariant #3 |
| `paused-storage` | "Out of storage" + CTA | `Full export paused: out of storage →` | `navigator.storage.estimate()` quota near full |
| `done` | "Download ZIP →" | `Full export ready · Download →` | All bookmarks have `detailsStatus` set |

**Silent failures** (no user surface, just write `detailsStatus: "unavailable"` and continue):
- 404 / `DETAIL_NOT_FOUND` → `unavailableReason: "deleted"`
- 403 on a previously-public tweet → `unavailableReason: "protected"`
- JSON parse failure → `unavailableReason: "parse_failed"`
- Anything else network-ish → `unavailableReason: "unknown"` *and* retry on next iteration (transient errors should self-heal; we only mark "unavailable" for clear terminal cases)

**Aggregate count on the ready screen:** `184 unavailable (deleted or protected)`. No drill-down list in v1.

---

## Auth / quota / session interplay

- **Auth pause:** the existing runtime store already classifies session state. Hydration store subscribes to session changes; when session leaves `ready`, set `status: "paused-auth"` and stop the loop. When session returns to `ready`, auto-resume.
- **Storage pause:** on each iteration (or every N iterations to amortize cost), call `navigator.storage.estimate()`. If `usage / quota > 0.95`, set `status: "paused-storage"`. User must manually clear space and re-trigger.
- **Sync interplay:** sync (the `Bookmarks` graphql endpoint) and hydration (the `TweetDetail` graphql endpoint) hit different X endpoints. We don't share rate-limit state with the sync orchestrator. If hydration gets a 429, sync is unaffected (and vice versa). Both back off independently.
  - Caveat: if X applies a global per-account limit (not per-endpoint), they'll cross-contaminate at the HTTP layer regardless of what our state machines do. Acceptable — both will back off; the user just sees one pause.
- **Account switch / logout:** existing account-switch flow already invalidates account-scoped state. Hydration store reset is one extra line.

---

## "Download what's ready now"

Mid-job action that fires a Quick export of current IDB state without stopping the hydration loop. Implementation: just calls the existing `quickExport()` from `src/lib/export/quick-export.ts`. The loop keeps running. The user gets a partial archive immediately and another (more complete) archive when the job finishes.

---

## Cancel semantics

PRD §2 #7 distinguished "Cancel (keeps cursor)" vs "Clear progress and start over (wipes cursor)." With no cursor, this simplifies:

- **Cancel:** sets `status: "idle"`, releases the lock, stops the loop. Progress is preserved automatically (in IDB).
- **Clear progress:** there is nothing to clear. Existing `detailsStatus: "ok"` rows are legitimate cache hits, not "cursor state." Clearing them would just force re-fetching tweets we already have. The PRD's "start over" button has no purpose in this design and is **dropped from the spec**.
- If a user genuinely wants to "re-hydrate everything" (because an old export looks incomplete or whatever), the right path is a separate "Re-fetch all `tweet_details`" Settings action — a v2 concern, not v1.

---

## What `#38` and `#39` look like now

The grill collapsed #38's "background machinery" into one runtime store slice. Re-scope:

**#38 — Hydration runtime store + single-writer lock** (re-scoped from "background machinery")
- New file: `src/stores/hydration-store.ts` (~150 LOC)
- New file: `src/lib/hydration/lock.ts` (~50 LOC for the `chrome.storage.session` lock)
- IDB schema additions on `TweetDetailCache` (two optional fields)
- New IDB query: `findNextBookmarkNeedingHydration()` (cursor over `bookmarks`, filter by missing or `unavailable === undefined` detail row)
- Tests: lock contention between two simulated tabs; jitter is within expected range; 429 pause; auth pause; storage pause; happy-path completion

**#39 — Full Export modal option + footer status** (unchanged scope, now unblocked)
- Wire hydration store into existing `ExportModal.tsx` as second radio
- "Recommended" tag logic: Quick when `processed / total >= 0.9`, else Full
- Mid-job modal state (progress bar, "resumes in" line, "Download what's ready now" button)
- All six paused/running/ready states from PRD §3
- New-tab footer line, six variants
- Tests: state transitions, "Recommended" tag flips, footer mirrors modal

Both are now Ralph-pickable (no `hitl`, no `Blocked by #37`).

---

## What's explicitly NOT in this plan

Aligns with PRD §9 plus a few new exclusions:

- ❌ `chrome.alarms` or any SW-side scheduler
- ❌ Offscreen document
- ❌ Persistent cursor in `chrome.storage.local`
- ❌ Header-based rate-limit accounting
- ❌ "50% of X's documented limit" math
- ❌ 30-day cursor auto-clear (no cursor)
- ❌ "Clear progress and start over" button (no cursor)
- ❌ Cross-account hydration coordination (one account at a time, same as sync)
- ❌ Telemetry, diagnostics, event log
- ❌ Per-tweet failure drill-down (just an aggregate count)

---

## Open risks (revised from PRD §11)

The original §11 risks are mostly moot now:

- ~~MV3 service worker timeouts~~ — no SW loop, no timeout to manage
- ~~X rate-limit accuracy~~ — we don't measure; we just trickle and back off on 429s
- **IDB quota at scale** — still real for huge libraries. `navigator.storage.estimate()` pre-flight before starting; pause job at 95% usage. Not fixed, but bounded.
- ~~Account switching mid-job~~ — existing logout flow + lock release handles this; no special code
- **Forward-compat of import logic** — adding `detailsStatus` is a `schema_version` bump (3→4). Importers ignore unknown fields. v3 importer reading v4 archive loses status info but still imports the tweet detail body — acceptable.
- **NEW: lock thrashing** — if heartbeat is too slow, two tabs might both think the lock is stale and steal it concurrently. Mitigation: heartbeat every tick (1.5–3.5s), steal threshold 60s. 20× safety margin.

---

## Implementation checklist (for #38)

- [ ] Add `detailsStatus` + `unavailableReason` to `TweetDetailCache` in `src/types/index.ts`
- [ ] Add `findNextBookmarkNeedingHydration()` to `src/db/index.ts`
- [ ] Write `src/lib/hydration/lock.ts` (acquire / steal / heartbeat / release)
- [ ] Write `src/stores/hydration-store.ts` (Zustand slice with the loop, jitter, 429 backoff, state machine)
- [ ] Wire session-state subscription for auth pause
- [ ] Wire `navigator.storage.estimate()` pre-flight + every-N-iteration check
- [ ] Snapshot writer (`CS_HYDRATION_SNAPSHOT`) on every tick
- [ ] Snapshot reader for non-holder tabs (poll every 5s, render same state)
- [ ] Map `RATE_LIMITED` / `DETAIL_NOT_FOUND` / `AUTH_EXPIRED` / parse failures into store actions
- [ ] Bump export `manifest.json` `schema_version` to 4 in `src/lib/export/quick-export.ts`
- [ ] Tests: lock contention, jitter range, 429 pause/resume, auth pause/resume, storage pause, completion, multi-tab snapshot

## Implementation checklist (for #39)

- [ ] Second radio in `ExportModal.tsx` ("Full export")
- [ ] "Recommended" tag flip logic
- [ ] Mid-job modal state
- [ ] "Download what's ready now" button (calls existing `quickExport()`)
- [ ] Paused-auth / paused-storage modal variants with CTAs
- [ ] Footer line in `NewTabHome.tsx` — six variants
- [ ] Tests: state-driven snapshot tests for each modal state; footer mirroring
