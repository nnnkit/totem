# Soul of Totem

This document preserves the product's core intent so decisions do not drift over time.

## Core Purpose

Help people remember and actually read what they saved on X, without needing to open X first and risk distraction.

## Product Soul (Non-Negotiables)

1. Visibility over friction: saved bookmarks should stay in front of the user.
2. Reading over scrolling: the experience should pull attention toward intentional reading.
3. Calm over addiction loops: avoid patterns that lead users back into infinite feeds.
4. Utility over novelty: features must support recall, completion, and focus.

## Feature Filter (Ship / Don’t Ship)

Run every proposed feature through these checks:

1. Reminder strength: Does it increase the chance users see saved bookmarks daily?
2. Reading completion: Does it help users finish saved reading, not just collect more?
3. Distraction risk: Could it pull users back into X feed behavior?
4. Effort cost: Is the value high enough for the added UI/mental complexity?
5. Soul alignment: Does it directly support the core purpose in this doc?

Decision rule:

- Ship only if answers to 1, 2, and 5 are clearly `yes`.
- Do not ship if 3 is `yes` unless there is a strong mitigation.
- Prefer the simpler option when two features deliver similar value.

## How to Add New Entries

Use one entry per date in `YYYY-MM-DD` format:

- `Date`
- `Context`
- `What user pain we are solving`
- `Decision / direction`
- `What we explicitly avoid`
- `How we know it is working`

## One-Liner

Totem — actually read what you saved on X.

---

## Soul Register

### 2026-02-13
- `Context`: Product direction clarification.
- `What user pain we are solving`: People save Twitter/X bookmarks to read later, but they forget them. Opening X to check bookmarks often causes distraction into unrelated tweets.
- `Decision / direction`: Build the product as a persistent reminder surface for bookmarked content, so saved items stay visible in everyday browsing workflows.
- `What we explicitly avoid`: Flows that require users to visit X first just to see what they intended to read.
- `How we know it is working`: Users regularly revisit and complete saved reading from the reminder surface, with less dependence on opening X directly.

### 2026-02-21
- `Context`: Sharpening the product identity.
- `What user pain we are solving`: Twitter bookmarks are trapped inside a noisy, addictive feed app. There is no calm, long-form way to sit down and actually read through what you saved — the way you would read a Substack newsletter or a Pocket queue.
- `Decision / direction`: The extension is a distraction-free reading experience for Twitter bookmarks. Think "Substack for bookmarks" — clean typography, focused layout, one piece at a time. The new tab becomes a reading surface, not a feed.
- `What we explicitly avoid`: Recreating the Twitter timeline. No infinite scroll of tiny cards. No engagement metrics front-and-center. No "you might also like" suggestions that pull attention away from what the user intentionally saved.
- `How we know it is working`: Users describe the experience as "reading" their bookmarks rather than "checking" them. Time-on-bookmark goes up, bounce-back-to-X goes down.

### 2026-02-23
- `Context`: Architecture principle — local-first by default.
- `What user pain we are solving`: Extensions that depend on external servers break when servers go down, change APIs, or shut down entirely. Users lose access to their data and workflow.
- `Decision / direction`: Totem operates local-first. All bookmark data, reading progress, highlights, and notes are stored in the browser (IndexedDB + chrome.storage). The only external call is to X.com to fetch bookmarks — there is no Totem backend server.
- `What we explicitly avoid`: Building or depending on our own server infrastructure. No Totem API, no Totem database, no Totem accounts. The extension should work even if the developer disappears.
- `How we know it is working`: The extension functions fully offline after initial sync. Users never see "server unavailable" errors from Totem.
