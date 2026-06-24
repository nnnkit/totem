---
title: "Build a deterministic Today's Read queue"
date: "2026-06-08"
category: design-patterns
module: "Today's Read queue"
problem_type: design_pattern
component: service_object
severity: medium
applies_when:
  - "Building a daily recommendation queue that must stay stable without AI"
  - "Separating actionable daily picks from the full unread reading list"
  - "Using lightweight feedback actions to clear, defer, or promote queue candidates"
  - "Designing an inbox-zero style completion state for a finite daily reading surface"
related_components:
  - "React reading list UI"
  - "IndexedDB persistence"
  - "Reader activity tracking"
  - "Import/export"
  - "Settings"
tags:
  - todays-read
  - daily-queue
  - deterministic-scoring
  - local-first
  - reading-list
  - feedback-loop
---

# Build a deterministic Today's Read queue

## Context

Totem needed a reading loop for saved X bookmarks, not another backlog view. Prior product sessions framed the recurring problem as recall: users save posts, then the archive becomes passive and returning to X exposes them to the feed again (session history).

The shipped pattern is Today's Read: generate a small local daily queue, keep it stable for the account, date, budget, and queue version, and let users clear it with explicit actions. Earlier directions such as generic bookmark management, random next-read selection, and AI-assisted recommendations were rejected because they were either too broad, too unstable, or outside the local-first v1 constraint (session history).

## Guidance

Use deterministic local scoring for v1. Do not depend on AI, remote ranking, or telemetry. The queue should be explainable and testable from local facts: unread bookmarks, reading progress, pins, queue metadata, exposure history, cached details, account id, local date, reading budget, and queue version.

Persist the daily snapshot as ordered tweet ids, then derive active and handled state from current facts. The snapshot is the user's plan for the day; read status, snooze state, and intent metadata decide which snapshot items are still active.

```ts
const key = makeTodayQueueKey({ localDate, budgetMinutes });

const snapshot = storedSnapshot ?? toTodayQueueSnapshot(
  buildTodayQueue({
    accountId,
    localDate,
    budgetMinutes,
    bookmarks,
    readingProgress,
    metadata,
    exposures,
    pinnedTweetIds,
    detailedTweetIds,
    restrictToCachedDetails,
  }),
);
```

Compose the queue deliberately before filling wildcard slots. A useful daily queue should mix "continue reading", recent saves, pinned/read-soon items, old neglected saves, and a fallback wildcard rather than simply sorting the whole archive.

```ts
pick(inProgress);
pick(recent);
pick(pinned || readSoon);
pick(neglected);

while (picked.length < targetSize) {
  pick(bestRemainingCandidate);
}

// One bounded, deterministic repair pass after the fill loop: if the set repeats
// an author or kind, swap the weakest fill-tail offender for the best
// non-repeating unpicked candidate. Never touch the four priority slots or a
// deliberate (in-progress / read-soon / pinned) pick; no-op if nothing fits.
repairDiversity(picked);
```

Score recency on a single continuous curve, not two disjoint bands. Freshness
fades smoothly from full weight at "just saved" to zero at the two-week
(`neglectedAfter`) mark, where the older-item ("neglected") boost takes over —
so a mid-age save (3–14 days) is ordered by age, not by tie-break noise. The
fresh and older *slot* predicates are independent of the score, so the set still
structurally guarantees one fresh and one older pick when such posts exist.

Suppress items that should not carry daily reading pressure:

```ts
if (progress.completed) suppress();
if (metadata.snoozedUntil > localDate) suppress();
if (metadata.intent === "reference") suppress();
if (metadata.intent === "act") suppress();
if (restrictToCachedDetails && !detailedTweetIds.has(tweetId)) suppress();
if (queuedTooOftenWithoutEngagement) suppress();
```

Treat user actions as feedback over the stable snapshot rather than as a reason to rebuild the queue. Active items are the snapshot items that remain unhandled. Handled items are the same snapshot items with a reason that explains how the user cleared them.

```ts
const activeItems = snapshot.tweetIds.filter((tweetId) =>
  !completed(tweetId) &&
  !futureSnoozed(tweetId) &&
  !reference(tweetId) &&
  !actOnThis(tweetId) &&
  (!restrictToCachedDetails || detailedTweetIds.has(tweetId))
);

const handledItems = snapshot.tweetIds
  .map((tweetId) => handledReason(tweetId))
  .filter(Boolean);
```

Keep the UX language specific:

- Use `Today's Read`, not generic `Today`, because it explains the job.
- Snooze means "not today"; Removed/Reference means "take this out of daily reading pressure."
- Do not show Snooze and Removed/Reference as equivalent primary actions.
- Split `Act on this` into an `Action needed` section because it is a follow-up task, not passive completion.
- Show passive completions under `Handled today` with undo.
- When Today's Read is clear, show completion copy and send `Browse unread` to the Unread tab, not back to an empty Today tab.
- Offer a calm, optional `Two more` in the done-state: completion stays the headline; pressing it appends up to two budget-fitting, non-over-exposed saves chosen at random from a safe pool (the sole intentional, persisted-once randomness over the otherwise-frozen build). No streak, counter, or escalation; retire the control with an honest line when the pool is empty.

Home and reading-list completion copy should stay synced:

```text
Nice. Today's Read is clear.
You handled everything for today. We'll line up a fresh read tomorrow.
```

## Why This Matters

Daily stability makes the queue feel intentional instead of random. Persisting a snapshot prevents reloads, new syncs, or rerenders from changing the user's plan mid-day.

Deriving active and handled state from the snapshot preserves that stability while still giving immediate feedback. Read, Snooze, Removed/Reference, and Act on this can clear items from Today's Read without rebuilding the whole queue.

The split between `Action needed` and `Handled today` prevents a product ambiguity: Act on this is not the same as done. It is a different workstream that should not disappear into passive completion history.

Local deterministic logic also preserves Totem's privacy model and makes the feature cheap to test. The pure queue tests assert outcomes such as stability, suppression, composition, and budget behavior rather than brittle weight constants.

## When to Apply

- The product has a large saved-item backlog and needs a bounded daily consumption loop.
- The user should not choose from the whole archive every time.
- The daily set must remain stable across reloads and sync updates.
- Completion should mean "done for today", not "the archive is empty."
- Feedback actions should influence future suggestions without requiring remote ranking.
- Offline or local-first behavior matters.

Do not extend this pattern into AI ranking, action-task management, streak systems, or digest generation until the core reading loop feels right. Prior sessions called out "Why this?" labels as the next useful improvement, with reasons such as `Continue reading`, `Recently saved`, `Pinned`, `Old save resurfaced`, `Fits budget`, or `Read soon` attached to queue items (session history).

## Examples

Stable queue key:

```ts
makeTodayQueueKey({
  localDate: "2026-06-08",
  budgetMinutes: 15,
  version: 2,
});
// "2026-06-08:15:v2"
```

The scoring version is part of the key, so a bump re-derives today's already-frozen
sets under the new logic instead of waiting for the local date to roll over. A
one-time, per-active-account load sweep drops any stored snapshot whose version is
not current, so the bump does not leave orphaned records behind.

Handled actions:

```ts
await snooze(tweetId);
// metadata: intent unset, snoozed until tomorrow
// exposure: snoozed

await setIntent(tweetId, "act");
// metadata: action intent, no snooze date
// exposure: act

await undoHandled(tweetId, "read");
// mark reading progress incomplete

await undoHandled(tweetId, "snoozed");
// clear queue metadata
```

Completion condition:

```ts
const isDone =
  status === "ready" &&
  totalCount > 0 &&
  activeCount === 0;
```

Durable local stores:

```text
today_queue_snapshots
  key -> localDate, budgetMinutes, version, tweetIds

bookmark_queue_metadata
  tweetId -> intent, snoozedUntil, updatedAt

today_queue_exposures
  id -> tweetId, action, localDate, createdAt
```

Home CTA behavior:

```ts
const openReadingFromHome = (tab?: ReadingTab) => {
  onOpenReading(tab ?? (todayQueueDone ? "unread" : undefined));
};

<Button onClick={() => onOpenReading("unread")}>
  Browse unread
</Button>
```

## Related

- Product PRD: `prds/todays-queue.md`
- Implementation plan: `docs/plans/2026-06-08-001-feat-todays-queue-plan.md`
- GitHub issue #15: Intent system and daily reading ritual
- GitHub issue #22: Queue tab grouped by intent
- GitHub issue #29: Settings Intent and Ritual section
- GitHub issue #33: Export and Import PRD
- GitHub issue #21: Read log and streak tracker, intentionally deferred
- GitHub issue #25: Skip cooldown behavior, intentionally deferred

Overlap with the GitHub issues is moderate: they share the reading ritual problem and deterministic local direction, but this implementation is narrower than the broader intent-classification, streak, skip-cooldown, and settings concepts.

Verification for the shipped implementation:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm vitest run src/lib/__tests__/today-queue.test.ts
pnpm test
pnpm build
git diff --check
```
