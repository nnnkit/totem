# Concepts

Shared domain vocabulary for this project - entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Reading Workflow

### Saved Post
A post saved by the user in X and brought into Totem as material for reading, search, and export.

### Reading List
The full in-product surface for browsing saved posts by reading state, including unread, in-progress, completed, and daily-pick views.

### Today's Read
The finite set of saved posts Totem asks the user to consider today.
*Avoid:* Today's Queue, Daily Queue

Today's Read is a daily reading surface, not a folder or permanent collection. Clearing it means the user has handled today's picks; it does not mean the saved-post archive is empty.

### Continuous Recency Curve
Internal: the daily-set freshness score fades smoothly from full weight at "just saved" to zero at the two-week mark, so every save contributes a recency score by age with no dead 3–14 day gap. The older-item ("neglected") boost beyond two weeks is separate and unchanged.

### Variety Self-Heal
Internal: a single bounded, deterministic repair after the daily set is built — if it repeats an author or kind, the weakest fill-tail pick is swapped for the best non-repeating alternative. It never touches the four priority slots or a deliberate (in-progress / read-soon / pinned) pick, and never manufactures variety the library can't supply.

### Handled Today
The record of Today's Read items the user cleared during the current day through reading, snoozing, removing from daily pressure, or marking for action.

### Action Needed
A Today's Read outcome for a saved post that requires follow-up work outside passive reading.

Action Needed items are separated from passive completion history because they remain work to do, even though they no longer belong in today's reading pressure.

### Snooze
A temporary deferral that removes a saved post from Today's Read until a later day without changing its long-term place in the reading list.

### Reference
A saved post kept for future lookup rather than daily reading.

Reference items should not keep resurfacing as Today's Read picks unless the user changes that intent.

## Today's Read Engagement

### End-of-Day Activation
Time-gated behavior where Today's Read shifts from calm and minimal during the day to a gentler, more present invitation to finish in the final hours before the day ends. Calm is the default; activation is the exception, never all-day.
*Avoid:* Urgency mode, Countdown

### Two more
The calm, optional control offered in the Today's Read done-state once Handled Today covers the whole set. It adds up to two more eligible saved posts chosen at random from a budget-fitting safe pool. Repeatable and unescalating — completion is always the headline, with no streak, counter, or momentum framing. Retires for the day with an honest line when no eligible posts remain.
*Avoid:* Keep going, Next up, Load more, Streak

### Reading Rhythm
An optional, forgiving record of the days a user read at least one post — encouragement framed as a rhythm, never a chain with a loss state. Off by default, with grace days and no punitive "you lost it" moment.
*Avoid:* Streak, Chain

### Focus Mode
A user-invoked state that softens (blurs) the Today's Read surface so it recedes without disappearing, restoring it crisply on demand. Lets the high-frequency new tab get out of the way of active work.
*Avoid:* Hide, Dismiss, Distraction-free (as a noun)
