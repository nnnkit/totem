# Today’s Queue PRD

## Problem Statement

Totem already helps people read X bookmarks in a calm, local-first environment. The remaining problem is that most users do not open a bookmark archive with a clear idea of what to read. They save reflexively, accumulate a large unread pile, and then avoid the backlog because every item looks like another decision.

The recent research points to the same pain in different language: X bookmarks become a graveyard. Users need saved posts to come back as useful reading, not as a larger library to manage.

Totem should focus on the feature that best matches its current shape: a small, stable daily queue of saved posts surfaced on every new tab.

## Solution

Build Today’s Queue: a local-first daily reading queue that selects a small set of unread bookmarks for the user and gives them a clear “done for today” state.

The product promise is:

> Your X bookmarks, turned into today’s reading.

This is not a generic folder/tag system. It is a consumption loop:

1. Totem chooses a bounded set of saved posts for today.
2. The new-tab home shows the next item from that set.
3. The reading list has a Today view with queue progress.
4. The reader lets the user mark items read, snooze them, or move them out of the reading queue.
5. When the queue is cleared, Totem shows completion instead of reminding the user how large the full backlog is.

## User Stories

1. As a reader with many X bookmarks, I want Totem to suggest a small number of posts for today, so that I do not have to scan my entire backlog.
2. As a reader opening a new tab, I want to see one clear next read, so that I can make progress without deciding what to pick.
3. As a reader with limited time, I want to choose a reading budget, so that Totem suggests posts that fit a 5, 15, or 30 minute session.
4. As a reader, I want the same queue to stay stable during the day, so that the app feels intentional instead of random.
5. As a reader, I want a “done for today” state, so that finishing a small queue feels complete even if my archive is large.
6. As a reader, I want to snooze a suggested post, so that a bad suggestion does not keep appearing.
7. As a reader, I want to mark a post as Reference, so that evergreen resources leave the guilt-producing read queue.
8. As a reader, I want to mark a post as Act on this, so that task-like bookmarks do not get buried among passive reading.
9. As a reader, I want pinned items to influence Today’s Queue, so that important saves are more likely to come back.
10. As a reader, I want in-progress items to be prioritized, so that unfinished reading is easier to resume.
11. As a reader, I want older neglected bookmarks to occasionally resurface, so that the backlog drains over time.
12. As a reader, I want recently saved items to appear while they are still relevant, so that time-sensitive posts do not go stale.
13. As a reader, I want Totem to avoid showing the same skipped item repeatedly, so that the queue does not feel stuck.
14. As a reader, I want the queue to work offline using cached data, so that Today’s Queue remains useful without X.
15. As a reader, I want manual control over completion, so that Totem does not incorrectly auto-mark items as read.
16. As a reader, I want a digest of today’s queue, so that I can turn the day’s reading into Markdown for notes or Obsidian.
17. As a privacy-conscious user, I want this to work locally, so that my reading history and queue decisions do not leave my browser.
18. As a power user, I want search and filters to feed into future queues, so that “today’s AI reading” or “today’s saved tools” becomes possible later.

## Today’s Read Suggestion Strategy

The first version should be deterministic, local, and testable. Do not start with AI. A good scoring model will be easier to trust, easier to debug, and easier to improve from real behavior.

### Candidate Pool

Include:

- unread bookmarks
- in-progress bookmarks
- pinned unread bookmarks
- recently saved bookmarks
- older unread bookmarks that have not been shown recently

Exclude or strongly suppress:

- completed/read bookmarks
- items snoozed until a future date
- items marked Reference
- items marked Act on this, unless the user is viewing an action-focused queue
- items already shown too many times this week without engagement
- items whose detail fetch failed and cannot be read offline, unless the user is online

### Daily Stability

Generate the queue from a stable seed:

- active account id
- local calendar date
- selected reading budget
- queue version

The queue should not reshuffle on every reload. New syncs can add candidates, but they should not disrupt the current day unless the user manually refreshes today’s queue.

### Scoring Inputs

Use a weighted score with clear signals:

- intent: Read soon gets the largest boost; Reference is suppressed; Act on this belongs in a separate action surface
- pinned: pinned unread items get a strong boost
- progress: partially read items get a strong boost
- freshness: new saves get a temporary boost for 48 to 72 hours
- neglected age: older unread items get a gradual revival boost after a cooldown
- estimated reading time: items should fit the selected reading budget
- content type: threads, articles, links, and short posts should be mixed
- prior exposure: items shown and skipped recently get a cooldown
- annotations: highlighted or noted items can reappear in follow-up queues, but should not dominate the main queue
- search context: later versions can let saved searches produce focused queues

### Queue Composition

For the default queue, choose 5 items:

- 1 in-progress item, if available
- 1 recently saved item, if available
- 1 pinned or manually prioritized item, if available
- 1 older neglected item
- 1 high-score wildcard

If the selected reading budget is low, prefer short posts and short threads. If the budget is high, include longer threads and articles.

Avoid a queue made entirely of the same content type or same author unless the user explicitly filtered for that.

### User Feedback Loop

Each action should update future suggestions:

- Read: remove from unread, count as positive signal for similar items
- Snooze: hide until the snooze date
- Reference: remove from daily reading pressure
- Act on this: move to action surface
- Pin: boost in future queues
- Open but do not finish: prioritize in-progress next time

Do not use hidden heuristics to mark completion. Totem’s existing explicit read model should remain the rule.

## Implementation Decisions

- Add a queue generation module with a small interface: build today’s queue from bookmarks, reading progress, pins, intent metadata, exposure history, and user preferences.
- Persist queue state locally per account and date so the queue is stable across reloads.
- Add lightweight bookmark intent metadata: Read soon, Reference, Act on this, and unset.
- Add exposure history so Totem knows what was shown, skipped, snoozed, or completed.
- Extend the home recommendation source so the main new-tab card can pull from Today’s Queue before falling back to unread or pinned items.
- Add a Today view to the reading list before the full unread/archive views.
- Add row and reader actions for Snooze, Reference, and Act on this.
- Reuse the existing reading progress and explicit completion model.
- Reuse the existing Markdown/export pipeline for a later “Digest today’s queue” action.
- Keep all queue generation local. No backend, no telemetry, no AI service in the first version.

## Testing Decisions

Good tests should verify externally visible behavior, not the internal weight constants.

Test the queue generation module with fixed inputs:

- stable queue for the same account, date, budget, and corpus
- read items are excluded
- snoozed items are excluded until the snooze date
- Reference items are suppressed
- in-progress and pinned items are prioritized
- older neglected items can resurface
- low reading budget prefers shorter items
- queue does not contain duplicate tweet ids
- queue remains bounded at the configured size

Test UI behavior around:

- home card uses Today’s Queue when available
- “done for today” appears after the queue is cleared
- snooze removes an item from today’s queue
- Reference removes an item from daily reading pressure
- Act on this moves the item out of the normal reading queue
- offline cached bookmarks can still produce a queue

Prior art exists in the current tests for reading-list behavior, reader navigation, growth UI, search, and local storage invariants.

## Out of Scope

- AI summaries
- AI ranking
- cloud sync
- email digests
- Notion, Readwise, Sheets, or Zotero sync
- automatic mark-as-read heuristics
- writer/composer features
- multi-platform bookmark sources
- server-side account system or billing

## Rollout Strategy

1. Ship the local queue model and Today view behind a small feature flag or internal setting.
2. Use deterministic scoring first and tune from manual testing with realistic bookmark libraries.
3. Update the new-tab home to say “Today’s read” instead of generic “your next read” when the queue is active.
4. Add Snooze and Reference before adding Act on this, because they directly reduce queue friction.
5. Add “Digest today’s queue” only after the daily queue feels useful.
6. Position the feature publicly as a reading loop, not an organization system.

## Success Metrics

Because Totem has no telemetry by design, success should be evaluated through local/debug counters, manual QA, and user feedback:

- users understand why a post was suggested
- users clear a daily queue without seeing the full backlog as a guilt number
- users return to the new tab and continue reading
- users use Snooze and Reference instead of abandoning the queue
- users describe Totem as making bookmarks come back, not merely storing them

## Further Notes

This feature should become the center of the product. Search, highlights, export, and future digests all become stronger when they orbit Today’s Queue.

The main strategic risk is overbuilding organization before proving the daily reading loop. Keep the first version small: five local suggestions, stable for the day, easy to dismiss, easy to finish.
