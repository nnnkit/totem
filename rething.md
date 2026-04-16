# Totem — Intent System: Full Research & Design Brief
**Date:** April 2026  
**Status:** Pre-implementation — ready for Claude Code  
**Scope:** Read soon / Reference / Act on this — classification, UX, and implementation plan

---

## 1. Problem diagnosis

### What's actually broken

Totem's current UI is a flat chronological list of 330+ bookmarks. The problem isn't the number — it's the **mental model mismatch**. A flat list treats a reading backlog like a passive library you go look things up in. But Twitter bookmarks are an inbox of half-formed intentions. The design job is to flip the metaphor: from library to inbox, from "I go find things" to "things come to me."

### Why a flat list is the wrong metaphor

Because a flat list is a storage metaphor, and what you actually need is a consumption metaphor.

A flat list answers the question "what do I have?" It's designed for retrieval — you know what you're looking for, you scan or search, you find it. That works great for 20 bookmarks. At 330, retrieval breaks down because you can't remember what you have, so you can't search for it. You're back to scanning, and scanning 330 identical-looking rows is just scrolling Twitter with extra steps.

The deeper problem is that a flat list makes every item feel like an equal obligation. Your eye lands on row 1, then row 2, then row 47 — they all present themselves with the same visual weight, the same urgency, the same implicit demand on your attention. There's no signal that row 3 is a 2-minute hot take and row 12 is a 40-tweet thread you need 20 minutes for. No signal that row 7 saved three months ago and is probably stale. No signal that row 23 requires you to actually do something versus just read it passively. Everything looks the same, so everything feels equally daunting, so you close the app.

There's also a psychological effect called decision fatigue that flat lists trigger at scale. Every time you see an item and decide to skip past it, that's a micro-decision. 330 items means potentially 330 micro-decisions before you've read anything. Your brain hits the cost of that before you've even consciously registered it, and the response is avoidance — "I'll deal with this later" — which is how you got to 330 in the first place.

The right metaphor for a reading backlog isn't a library shelf. It's closer to an email inbox that's been sorted by someone who knows your priorities. You open it and immediately see: here are 5 things for today, here are 3 things you said you'd act on, everything else is filed away and not demanding your attention right now. The 330 still exists, but it's not in the room with you.

### Three specific failure modes in the current flat list:

1. **Re-evaluation problem** — Without context, every item must be re-read and re-assessed from scratch to decide if it's worth reading. At 330 items, this is exhausting before you've read a single thing. Users abandon the session after 30 seconds of scrolling.

2. **Priority collapse** — Everything looks equally important. A tweet saved because you needed it *that week* sits next to a vague "someday" reference. Without intent metadata, they're indistinguishable.

3. **Temporal mismatch** — Many Twitter bookmarks are time-sensitive (a hot take relevant to a current debate, a tool that just launched). By the time it surfaces weeks later, the moment has passed. Nothing in the UI signals staleness.

### Bookmark guilt

Bookmark guilt is the low-grade anxiety you feel every time you open a reading list and see how much you've saved but haven't read. It's not about any specific item — it's a diffuse sense of being behind on something you voluntarily signed up for.

It happens because of a fundamental asymmetry in how saving and reading feel in the moment.

When you bookmark something, it feels like progress. You saw something valuable, you captured it, you didn't let it slip away. There's a small dopamine hit — the same one you get from adding a task to a todo list. The act of saving feels like a step toward reading, even though it's actually just deferral with extra optimism attached. You save it because in that moment you genuinely believe future-you will read it. Future-you has more time, more focus, more motivation. Future-you is basically a different, better person.

Future-you arrives and is just as busy as past-you. The item sits unread. You save another one. And another. The list grows. Every time you open it, you're confronted not just with unread content but with evidence of all the optimistic promises you made to yourself that you didn't keep. That's what guilt actually is — it's the gap between who you intended to be and who you turned out to be, made visible and numbered.

The number makes it worse. 331 unread. That's not just a count, it's an accusation. It says: you have failed to read 331 things you told yourself you'd read. The bigger the number gets, the more it functions as a measure of personal failure rather than a neutral inventory. At some point — different for different people, but somewhere between 50 and 150 items — the number itself becomes a reason not to open the app. The guilt of seeing it is worse than the guilt of ignoring it, so you ignore it.

There's also a ratchet effect. Once the list feels overwhelming, every new item you add makes it fractionally worse. But the dopamine hit from saving doesn't diminish — saving still feels good. So you keep saving while reading less and less, and the list grows faster than it shrinks. The gap widens. The guilt compounds.

The reason most reading list apps fail to solve this is that they treat it as an organizational problem — if you could just tag and sort and filter well enough, you'd find the motivation to read. But organization doesn't address guilt. Guilt is about the psychological relationship between you and the number. The real fix is to make the number irrelevant. Stop showing 331 unread as the primary metric. Show 5 things for today instead. The 331 still exists but it's not the thing you're in a relationship with. You're in a relationship with 5 items, which is a relationship you can actually maintain. Clear those 5, feel genuinely done, come back tomorrow for 5 more. The backlog drains without you ever having to confront it as a totality.

That's exactly what the intent system and daily queue are designed to do — not organize the guilt, but dissolve the conditions that create it in the first place.

### Content-type blindness

Content-type blindness is when a reading list treats every saved item as the same kind of thing, when they're actually radically different objects requiring different amounts of time, attention, and mental mode to process.

Look at what's actually in your bookmark list right now. You have a 20-tweet thread that takes 15 minutes to read properly. You have a GitHub repo link that you need to clone and explore. You have a two-sentence hot take that takes 30 seconds. You have an hour-long YouTube lecture. You have a research paper. You have someone's contact info. All of these show up as an identical row with an avatar, a truncated first line, and a content type label that you have to read to even notice.

The damage happens at the moment of choosing what to read. You open the reading list with some amount of mental energy and time available — say you have 10 minutes before a meeting. You scan the list. But because everything looks the same, you can't quickly identify what fits your current context. You'd have to read each item's first line, estimate its length, mentally categorize it, and then decide. That's expensive. Most people don't do it consciously — they just feel a vague friction, close the app, and check Twitter instead.

It also breaks the mental mode matching problem. Reading a long analytical thread requires you to slow down, follow an argument, hold earlier points in memory while you read later ones. Skimming a hot take is completely different — fast, reactive, done in seconds. Exploring a GitHub repo is different again — active, exploratory, requires you to actually open a terminal. These aren't just different lengths of the same activity. They're different kinds of cognitive work. When they're all mixed together with no visual distinction, your brain can't prepare for what's coming, and preparation matters more than most people realize. The mental shift between "I'm about to read something analytical" and "I'm about to skim something" is small but real, and a reading list that forces you to make that shift unexpectedly on every item is subtly exhausting.

There's a third problem which is false completion signals. When content types are invisible, you can clear 10 items from your list by skimming 10 hot takes in five minutes — and feel like you made progress — while 3 substantial threads and 2 research-grade articles sit untouched. The list gets shorter but the actual intellectual debt doesn't. Over time you subconsciously learn that reading from the list feels productive but isn't, which erodes trust in the whole system.

The fix is not complicated. You already show Thread / Article / Link / Post labels in the current UI. The labels are there — they're just visually identical to each other, same size, same color, same weight, sitting next to the author name where your eye barely lands. Making those labels do real visual work — different icons, different row treatments, maybe an estimated read time — turns scanning from a guessing game into an actual decision. You open the list with 10 minutes and immediately see: three hot takes, one short article, one long thread. You pick the two hot takes and the short article, feel genuinely done, and close with no guilt. That's the experience content-type visibility enables.

### Root cause: intent is lost at save time

When you bookmark a tweet on X, your working memory holds:
- Why this specific tweet resonated
- What you were looking for that day
- What you planned to *do* with it — read, implement, share, reply

That context is gone within minutes. The bookmark captures the object but loses the metadata that made it valuable. Unlike articles (which re-establish their own context in the first paragraph), tweets are opaque out of context. A tweet like "1/ The practical importance of crypto derivatives" tells you nothing about *why* you saved it three days ago.

Compound this with the zero-friction save mechanic on X — bookmarking is a one-thumb reflex. The friction asymmetry between saving (zero) and consuming (significant) is what creates the 300+ item backlog in the first place.

### The deeper insight: "bookmark" is a false category

What people actually save falls into three fundamentally different objects:

| Intent | Mental model | Time horizon | "Done" state |
|---|---|---|---|
| **Read soon** | Content to consume — narrative, opinion, analysis | Days | Mark read |
| **Reference** | Resource to return to — tools, docs, repos, lists | Indefinitely | Archive by topic |
| **Act on this** | Requires action — build, share, reply, contribute | Deadline-driven | Check off |

Current bookmark UIs treat all three identically. The right architecture gives each type a different home, a different surfacing cadence, and a different "done" state.

---

## 1b. The core mechanism: context collapse

When you bookmark a tweet, your brain is in a very specific state. You're mid-scroll, you've just read something, and your working memory is holding:

- The thread of thought that led you to this tweet
- What you were looking for or thinking about that day
- Why this specific tweet resonated — was it the data point? The framing? The author's credibility? The fact that it confirmed something you suspected?
- What you planned to do with it — read the linked paper, share it, implement the idea, reply to it

That entire context lives in working memory and is gone within minutes. The bookmark captures the object but loses the metadata that made it valuable.

When you open the extension three days later, all you have is a tweet preview. The question "why did I save this?" has no answer. So your brain either spends energy reconstructing context (expensive), or you skip it and move on (the guilt pile grows).

### Why Twitter bookmarks are uniquely bad at this

Most read-later tools (Pocket, Instapaper) handle articles — long-form content that is self-explanatory. You open it weeks later and the article re-establishes its own context in the first paragraph.

Tweets don't do this. A tweet like "1/ The practical importance of crypto derivatives" from your screenshot is completely opaque out of context. Was this saved because of the argument? Because Brett Harrison wrote it? Because you were mid-debate about something and this was evidence? You can't tell.

Compound this with Twitter's specific save behavior — bookmarking is a one-thumb reflex. It requires zero friction, which means the bar for saving is near-zero, which means you save things you'd never actually read if you had to think for two seconds. The friction asymmetry between saving (zero) and consuming (significant) is what creates the 330-item backlog in the first place.

### The three failure modes downstream

Once intent is lost, three things happen when you try to use the backlog:

1. **The re-evaluation problem.** Without context, you have to re-read and re-evaluate every item from scratch to decide if it's worth reading. At 330 items, that's exhausting before you've read a single thing. Most people abandon the session after scrolling for 30 seconds.

2. **The priority collapse.** Everything looks equally important because you have no signal about urgency or relevance at the time of saving. The tweet you bookmarked because you needed it that week sits next to the one you saved as a vague "someday" reference. Without intent metadata, they're indistinguishable.

3. **The temporal mismatch.** A lot of Twitter bookmarks are highly time-sensitive — a hot take that's relevant to a current debate, a tool that just launched, a thread about something you were actively building. By the time you surface it weeks later, the moment has passed. But nothing in the UI signals that this item is stale. You waste time reading something that's no longer actionable.

### What capturing intent at save time would actually change

Even one bit of metadata changes everything. Imagine if on sync, Totem detects new bookmarks and pops a tiny card: "Why did you save this?" with three options:

- **Read soon** → surfaces in the daily queue within 48 hours
- **Reference** → goes into the topic cluster archive, never pressures you
- **Act on this** → goes into a dedicated action list with a nudge

That single choice transforms the entire downstream experience:

- "Read soon" items get prioritized and cleared, creating visible progress
- "Reference" items stop generating guilt — you know they're not meant to be read sequentially
- "Act on" items get a separate surface so they don't get buried

The reason nobody does this well is that the save moment is on X's interface — you don't control it. That's why the sync popup is the right intervention point for Totem. It's the next-best moment while the context might still be partially recoverable (especially for items saved that same day).

### The deeper insight: most bookmarks are really three different objects

Once you start thinking about intent, you realize that "bookmark" is a false category. What people actually save falls into:

- **Things to consume** — articles, threads to read, videos to watch. Time-bounded value.
- **Things to reference** — resources, tools, frameworks to return to repeatedly. Evergreen value.
- **Things to act on** — ideas to build, people to follow up with, things to share. Task-like.

Current bookmark UIs treat all three identically. That's why they fail. The right architecture gives each type a different home, a different surfacing cadence, and a different "done" state — read, archived, or completed.

For Totem specifically, this distinction maps cleanly onto the three-tier architecture from before. Tier 1 is for "consume," Tier 2 clusters are for "reference," and there's a currently-missing tier for "act on" that might be worth adding as a simple pinned list at the very top.

---

## 2. Totem soul constraints (non-negotiables)

From `soul.md` in the repo — every decision must pass these:

1. **Visibility over friction** — saved bookmarks should stay in front of the user
2. **Reading over scrolling** — the experience should pull attention toward intentional reading
3. **Calm over addiction loops** — avoid patterns that lead users back into infinite feeds
4. **Utility over novelty** — features must support recall, completion, and focus
5. **Local-first** — no Totem backend server; all data in IndexedDB + chrome.storage; only external call is to X to fetch bookmarks
6. **Explicit completion** — the only way to mark something as read is the explicit button; no heuristic-based auto-completion

**Feature filter (ship only if):**
- Does it increase the chance users see saved bookmarks daily? ✓
- Does it help users finish saved reading, not just collect more? ✓
- Could it pull users back into X feed behavior? ✗ (don't ship if yes)
- Soul alignment: does it directly support the core purpose? ✓

---

## 3. Three UX routes explored

### Route A — Sync Triage (modal after sync)

**Philosophy:** Capture intent at the earliest possible moment — right after sync, before items enter limbo.

**Flow:**
1. Totem syncs N new bookmarks
2. A triage modal appears: "7 new bookmarks — quick sort (takes ~60 seconds)"
3. Each bookmark shown one at a time with three choices: Read soon / Reference / Act on this
4. Keyboard-driven: `R` / `F` / `A` keys. Skip button available.
5. After triage, items route to their respective zones.

**Pros:** Highest context fidelity. Intent captured while memory is freshest.  
**Cons:** Friction at the wrong moment. Works for 7 bookmarks; breaks for 80. Feels like work.  
**Mitigation needed:** Bulk "classify all as Reference" escape hatch. Only show on same-day syncs, not backlog imports.

---

### Route B — Focus Card Mode (in-reading intent assignment)

**Philosophy:** Don't change the sync flow. Assign intent as a lightweight label *while* you're already reading.

**Flow:**
1. User opens reading list, enters a reading session
2. Each bookmark shown as a focus card (one at a time)
3. Intent chips on each card: Read soon / Reference / Act on this (pre-selected by rules if available)
4. Keyboard shortcuts: `M` mark read, `A` archive, `S` snooze
5. Progress dots show session status (3 done, 4 left)

**Pros:** Most aligned with soul ("reading over scrolling"). Doesn't add friction to sync. Keyboard-driven.  
**Cons:** Intent captured late (after context has faded). Requires user to open the app and start a session — doesn't solve "I don't open the app."

---

### Route C — Intent-First Home Screen (structural redesign) ⭐ Recommended

**Philosophy:** The three intent zones *are* the navigation. Users never see "331 unread" as a number they're responsible for.

**Structure:**
```
┌─────────────────────────────────────────┐
│ Today's queue — 5 surfaced for you      │ ← Blue strip, always visible
│ [item] [item] [item]                    │
├─────────────────────────────────────────┤
│ ▼ Act on this · 3 items                 │ ← Amber dot, collapsible
│ [item] [item]                           │
├─────────────────────────────────────────┤
│ ▼ Reference · 287 items · 9 topics      │ ← Teal dot, collapsible
│ [DeFi cluster] [AI cluster] [EVM]       │
├─────────────────────────────────────────┤
│       View all 331 bookmarks →          │ ← Full archive, not default
└─────────────────────────────────────────┘
```

**Key insight:** The 331-item flat list becomes Tier 3 (archive), only accessible via "view all." Users never confront the number by default.

**Pros:** Radical reduction in overwhelm. Works for users who never triage manually — rules auto-populate the zones. Best path for incremental shipping (stub zones first, add AI clustering later).  
**Cons:** Requires UI restructuring. Topic clusters need either rules or AI to be meaningful.

---

## 4. Decision: Route C as shell + Route A as optional first-run + Route B's chips on individual cards

**What to build:**

1. **Route C's home screen structure** — the three-zone layout replaces the flat list as the default view
2. **Route A's triage modal** — appears only on first sync (or manually triggered via "sort my backlog"). Not recurring.
3. **Route B's intent chips** — live on individual bookmark cards in the reading experience. Lightweight, inline, non-blocking.

This lets each mechanism work at its best moment without any one being a recurring burden.

---

## 5. UX cue placement (fits existing screens with zero new screens)

### Screen 1 — New tab page

**Current:** Shows "YOUR NEXT READ" card with a topic tag (e.g., "Space") and two buttons: Open reading list / Surprise me.

**Change:** Replace/augment the topic tag with an intent badge:
- Blue dot + "read soon" → the surfaced card is from the Read soon pool
- "Surprise me" scoped to Read soon items only (not all unread)
- Zero layout change. One field addition.

**Note on current behavior:** "Surprise me" already prioritizes unread items (`unreadItems.length > 0 ? unreadItems : items`). The change here is more specific: once intent is in place, narrow the pool to `read_soon` items only, so "Surprise me" carries a semantic promise rather than just "something you haven't read yet."

**Why:** Teaches the intent system passively on every new tab. Changes the semantic promise of "Surprise me" from "random unread bookmark" to "something you explicitly said you wanted to read."

---

### Screen 2 — Reading list (Unread / Reading / Read tabs)

**Change 1: Intent filter pills** (between tab bar and list)
```
[● Read soon · 24]  [● Act on · 3]  [Reference · 287]  [Unsorted · 4]
```
- One-tap to filter 318 items down to 24
- "Unsorted · 4" gives users a clear target to clear
- Pills are additive to existing tab/sort UI — no restructuring

**Change 2: 3px left border accent per row**
- Blue = Read soon
- Amber = Act on this  
- Teal = Reference
- No bar = Unsorted

Zero layout impact. Encodes intent without any text labels. Users parse colored left borders instinctively.

**Change 3: Hover-to-assign dots**
- On hover, three small colored dots appear at the right edge of each row
- Click blue/teal/amber dot to assign intent inline
- Appears only on hover — invisible at rest, no clutter
- Allows triaging 10 items in 30 seconds without leaving the list

---

### Screen 3 — Reader (individual bookmark view)

**Change: Post-read intent tray**

Fires when user taps "Mark read" (already an explicit action):
```
┌─────────────────────────────────────────────────────┐
│ File as:  [Read soon]  [Reference]  [Act on this]  done │
└─────────────────────────────────────────────────────┘
```
- Small tray slides up from the action bar
- Tapping a chip: files the item, dismisses the tray, returns to list
- Tapping "done" without choosing: marks read, moves on — no forced friction
- This is the highest-leverage cue: user just finished reading, context is peak-fresh

**Why this placement is optimal:** It catches intent at the moment of maximum context — the user just read the content. They know exactly whether it was useful, whether they need to act on something, whether it's a reference to save. No other moment in the flow has this much signal.

---

## 6. Intent classification — can we do it without AI?

### What data we have per bookmark

From Totem's parsed and stored Bookmark object (post-sync, in IndexedDB):

```
text              - Full tweet content (up to 280 chars)
createdAt         - Tweet creation timestamp in ms (staleness proxy — not save date)
urls[]            - TweetUrl objects: { url, expandedUrl, displayUrl, card? }
  card            - LinkCard: { title, description, imageUrl, domain, cardType }
isThread          - boolean, from X API self_thread field
tweetKind         - 'tweet'|'reply'|'quote'|'repost'|'thread'|'article'
hasImage          - boolean
hasVideo          - boolean  
hasLink           - boolean
metrics           - { likes, retweets, replies, views, bookmarks }
inReplyToTweetId  - string, if part of a thread
author            - { screenName, name, followersCount, verified, ... }
quotedTweet       - full nested Bookmark if quoted tweet
article           - ArticleContent if long-form X article
```

What we do NOT have: separate hashtag/mention arrays (discarded by parser), `context_annotations` (X's own topic tags — not stored), a `saved_at` date distinct from `createdAt` (no bookmark timestamp in X API), full thread body (requires separate TweetDetail fetch), linked article content beyond link card title/description.

What this means for classification: Layer 1 can use `isThread`, `tweetKind`, `hasLink`, `urls[].expandedUrl`, `urls[].card.domain`. Layer 2 can use `urls[0].card.title` for keyword matching. Staleness must be approximated from `createdAt` (tweet post date), not actual save date.

---

### Layer 1 — Structural rules (zero AI, zero API calls, deterministic)

These are binary, high-confidence, instant, fully local.

```typescript
type Intent = 'read_soon' | 'reference' | 'act_on' | 'unsorted';

interface ClassificationResult {
  intent: Intent;
  confidence: number; // 0-1
  source: 'structural' | 'keyword' | 'ai' | 'manual';
}

function classifyStructural(bookmark: Bookmark): ClassificationResult | null {

  const urls = bookmark.urls ?? [];
  const text = bookmark.text ?? '';

  // GitHub repo URL → Reference (very high confidence)
  if (urls.some(u => /github\.com\/[^\/]+\/[^\/]+/.test(u.expandedUrl))) {
    return { intent: 'reference', confidence: 0.95, source: 'structural' };
  }

  // arXiv / research paper → Reference
  if (urls.some(u => /arxiv\.org|papers\.ssrn\.com/.test(u.expandedUrl))) {
    return { intent: 'reference', confidence: 0.95, source: 'structural' };
  }

  // Documentation URL → Reference
  if (urls.some(u => /\/docs\/|docs\.|readthedocs|developer\.|api\./.test(u.expandedUrl))) {
    return { intent: 'reference', confidence: 0.88, source: 'structural' };
  }

  // YouTube / video → Read soon
  if (urls.some(u => /youtube\.com\/watch|youtu\.be/.test(u.expandedUrl))) {
    return { intent: 'read_soon', confidence: 0.90, source: 'structural' };
  }

  // Known article/blog domains → Read soon
  const ARTICLE_DOMAINS = [
    'medium.com', 'substack.com', 'mirror.xyz', 'techcrunch.com',
    'coindesk.com', 'theblock.co', 'decrypt.co', 'bloomberg.com',
    'wired.com', 'theverge.com', 'hackernews.com'
  ];
  if (urls.some(u => ARTICLE_DOMAINS.some(d => u.expandedUrl.includes(d)))) {
    return { intent: 'read_soon', confidence: 0.85, source: 'structural' };
  }

  // X long-form article → Read soon
  if (bookmark.tweetKind === 'article') {
    return { intent: 'read_soon', confidence: 0.90, source: 'structural' };
  }

  // Thread (stored flag or kind) → Read soon
  if (bookmark.isThread || bookmark.tweetKind === 'thread') {
    return { intent: 'read_soon', confidence: 0.85, source: 'structural' };
  }

  // Thread opener by text pattern (1/ or 1.) → Read soon
  if (/^\d+[\/\.]\s/.test(text.trim())) {
    return { intent: 'read_soon', confidence: 0.88, source: 'structural' };
  }

  // No URL, short text (hot take / standalone post) → Read soon
  if (!bookmark.hasLink && text.length < 180) {
    return { intent: 'read_soon', confidence: 0.70, source: 'structural' };
  }

  return null; // Pass to Layer 2
}
```

**Estimated coverage: ~60% of bookmarks classified with high confidence.**

---

### Layer 2 — Keyword scoring (zero AI, zero API calls, probabilistic)

Scores each intent bucket. Net highest score wins if it clears a minimum threshold.

```typescript
function classifyKeywords(bookmark: Bookmark): ClassificationResult | null {
  const text = (bookmark.text ?? '').toLowerCase();
  // card.title comes from X's link card metadata — already fetched and stored on sync
  const urlTitle = bookmark.urls?.[0]?.card?.title?.toLowerCase() ?? '';
  const combined = `${text} ${urlTitle}`;

  let scores = { read_soon: 0, reference: 0, act_on: 0 };

  // Act on this signals
  const ACT_ON = [
    /\b(try|build|implement|ship|contribute|submit|apply)\b/,
    /\b(dm me|reach out|looking for|hiring|open to)\b/,
    /\b(PR|pull request|contributors wanted)\b/,
    /\bstep \d+\b/,
    /\b(remember to|todo|action item)\b/,
  ];
  ACT_ON.forEach(p => { if (p.test(combined)) scores.act_on += 1; });

  // Reference signals
  const REFERENCE = [
    /\b(cheat ?sheet|toolkit|resource|framework|boilerplate)\b/,
    /\b(list of|collection of|compilation|roundup|everything you need)\b/,
    /\bTIL\b/,
    /\b(guide|tutorial|walkthrough|introduction to|overview of)\b/,
    /\b(documentation|spec|RFC|EIP|HIP|standard)\b/,
    /^\d+\s+(tools|resources|ways|tips|tricks)/,
  ];
  REFERENCE.forEach(p => { if (p.test(combined)) scores.reference += 1; });

  // Read soon signals
  const READ_SOON = [
    /\b(just|today|breaking|new|launching|released|announcing)\b/,
    /\b(thread|here's why|hot take|unpopular opinion)\b/,
    /\b(story|experience|lessons|what i learned|retrospective)\b/,
    /\b(must read|worth reading|fascinating|great read)\b/,
  ];
  READ_SOON.forEach(p => { if (p.test(combined)) scores.read_soon += 1; });

  // Staleness decay: old tweets are more likely Reference than time-sensitive Read soon
  // Note: createdAt is tweet post date, not save date — best staleness proxy we have
  const daysSince = (Date.now() - bookmark.createdAt) / 86400000;
  if (daysSince > 30) scores.reference += 0.5;
  if (daysSince > 90) { scores.reference += 1; scores.read_soon -= 1; }

  // Engagement signal (high retweets → reference-quality content)
  if ((bookmark.metrics?.retweets ?? 0) > 500) scores.reference += 0.5;

  // Find winner
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const [intent, score] = winner;

  // Only classify if score is meaningfully above others
  const THRESHOLD = 1.5;
  if (score >= THRESHOLD) {
    return {
      intent: intent as Intent,
      confidence: Math.min(0.75, 0.5 + score * 0.1),
      source: 'keyword'
    };
  }

  return null; // Pass to Layer 3 (AI) or leave as unsorted
}
```

**Estimated coverage: Layer 1 + Layer 2 together = ~65-70% classified.**

---

### Layer 3 — AI classification (Claude API, opt-in)

The remaining 30-35% are genuinely ambiguous — semantic understanding required.

**When to call AI:**
- Layer 1 returned null AND Layer 2 returned null
- OR Layer 2 confidence < 0.55
- AND user has enabled AI classification in settings

**API call:**

```typescript
async function classifyWithAI(bookmark: Bookmark): Promise<ClassificationResult> {
  const urlInfo = bookmark.urls?.[0];
  const urlContext = urlInfo?.card
    ? `\nURL title: ${urlInfo.card.title}\nURL description: ${urlInfo.card.description}\nDomain: ${urlInfo.card.domain}` 
    : urlInfo 
    ? `\nURL: ${urlInfo.expandedUrl}`
    : '';

  const prompt = `Classify this saved tweet into exactly one category:
- read_soon: content to consume now (articles, threads, opinions, analysis, videos)
- reference: resource to return to repeatedly (tools, docs, repos, lists, guides)  
- act_on: requires a specific action (contribute, build, reply, apply, share)

Tweet text: ${bookmark.text}${urlContext}
Author: @${bookmark.author.screenName}

Reply with JSON only, no explanation: {"intent": "read_soon|reference|act_on", "confidence": 0.0-1.0}`;

  // API key stored in chrome.storage.local — user enters it in settings, never sent to Totem servers
  const { anthropic_api_key } = await chrome.storage.local.get('anthropic_api_key');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropic_api_key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // required for browser fetch
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  // Note: this call must run from the service worker context, not a content script,
  // to avoid CORS issues. Service worker can be terminated mid-batch — caller must
  // checkpoint progress in chrome.storage and resume on next activation.

  const data = await response.json();
  const text = data.content[0].text;
  const parsed = JSON.parse(text);

  return {
    intent: parsed.intent,
    confidence: parsed.confidence,
    source: 'ai'
  };
}
```

**Cost:** Claude Haiku at $0.25/MTok input. 330 bookmarks × ~200 tokens = 66K tokens = **~$0.016 total** for entire backlog. Negligible.

**Privacy:** Tweet text leaves the device. Must be **opt-in with explicit UI toggle** in settings. Label: *"Use AI to auto-classify bookmarks (sends tweet text to Anthropic API)"*. Consistent with local-first soul principle.

**Accuracy estimate:** 85-92% correct on the ambiguous cases that rules miss.

---

### Combined classification pipeline

```typescript
async function classifyBookmark(
  bookmark: Bookmark, 
  aiEnabled: boolean
): Promise<ClassificationResult> {
  
  // Layer 1: Structural rules (instant, local)
  const structural = classifyStructural(bookmark);
  if (structural && structural.confidence >= 0.80) {
    return structural;
  }

  // Layer 2: Keyword scoring (instant, local)
  const keyword = classifyKeywords(bookmark);
  if (keyword && keyword.confidence >= 0.65) {
    return keyword;
  }

  // Layer 3: AI (async, opt-in, network)
  if (aiEnabled) {
    try {
      return await classifyWithAI(bookmark);
    } catch (e) {
      console.warn('AI classification failed, leaving unsorted:', e);
    }
  }

  // Fallback: unsorted
  return { intent: 'unsorted', confidence: 0, source: 'structural' };
}
```

---

### Signal reliability reference table

| Signal | Intent | Confidence | AI needed? |
|---|---|---|---|
| URL: github.com/user/repo | Reference | 95% | No |
| URL: arxiv.org, papers | Reference | 95% | No |
| URL: docs.*, developer.* | Reference | 88% | No |
| URL: youtube.com/watch | Read soon | 90% | No |
| URL: medium, substack, news domain | Read soon | 85% | No |
| Text starts with `1/` or `1.` | Read soon | 88% | No |
| Text: "cheat sheet", "list of N" | Reference | 85% | No |
| Text: "try this", "DM me", "contribute" | Act on | 70% | No |
| Text: "just launched", "breaking" | Read soon | 72% | No |
| No URL + text < 180 chars | Read soon | 70% | No |
| High retweets (>500) | Reference boost | 55% | No |
| Ambiguous text, generic URL | — | <50% | **Yes** |
| Truncated fragment, no URL | — | <40% | **Yes** |
| Thread that's actually a reference index | — | Low | **Yes** |

---

## 7. Data model changes

### New field on bookmark object

```typescript
interface Bookmark {
  // ...existing fields...
  intent?: 'read_soon' | 'reference' | 'act_on' | 'unsorted';
  intent_confidence?: number;      // 0-1
  intent_source?: 'structural' | 'keyword' | 'ai' | 'manual';
  intent_assigned_at?: string;     // ISO timestamp
}
```

`manual` source = user explicitly chose it via post-read tray, hover dots, or triage modal. Manual always wins over auto-classification and is never overwritten on re-sync.

### New settings field

```typescript
interface TotemSettings {
  // ...existing fields...
  ai_classification_enabled: boolean; // default: false (opt-in)
}
```

---

## 8. Implementation phases

### Phase 1 — UI shell (no classification logic)
**What:** Add `intent` field to bookmark schema (default: `'unsorted'`). Build the three UX cues:
1. Filter pills on reading list (works even if everything is "unsorted" — shows "Unsorted · 331")
2. 3px left border accent (transparent for unsorted, colored once set)
3. Post-read intent tray after "Mark read"
4. Hover-to-assign dots on list rows

**Why first:** Proves the UX works. Users can manually assign intent for everything from day one. No classification logic required.

**Scope:** Pure UI. No new data fetching. No API calls.

---

### Phase 2 — Layer 1 + 2 classification
**What:** Run `classifyStructural()` and `classifyKeywords()` on every bookmark at sync time. Store result in `bookmark.intent`. Apply to all existing bookmarks on first run (one-time migration).

**When:** On sync, after bookmarks are written to IndexedDB. Classification runs synchronously (it's just regex + pattern matching, takes <1ms per bookmark).

**Result:** ~65-70% of bookmarks auto-classified. Filter pills show real numbers. "Unsorted" count drops. New tab card badge shows "read soon".

**Scope:** TypeScript utility functions. IndexedDB schema migration. No network calls.

---

### Phase 3 — Settings toggle + AI classification
**What:** Settings page toggle: "Auto-classify with AI." When enabled, runs `classifyWithAI()` for all unsorted bookmarks (batch, one-time). On subsequent syncs, only calls AI for new bookmarks that rules can't classify.

**Privacy notice:** Surface clearly in settings: "Tweet text is sent to Anthropic's API. No data is stored by Totem servers."

**Result:** ~95%+ of bookmarks classified. Unsorted count approaches 0 for users who opt in.

**Scope:** Settings UI addition. API integration (already in codebase if Totem uses Claude elsewhere). Rate limiting logic to avoid hammering API on large backlogs.

---

### Phase 4 — Intent-first home screen (Route C)
**What:** Restructure the new tab page to show three intent zones instead of (or in addition to) the single surfaced card.

**Options:**
- Keep current single-card design, add "Today's queue" count + zone selector below
- Full Route C restructure with collapsible zones

**Scope:** Larger UI change. Requires Phases 1-2 to be meaningful (zones need populated data).

---

## 9. Open questions (resolve before PRD)

1. ~~**Current bookmark schema in IndexedDB** — Does Totem already store a `content_type` field?~~
   **Resolved:** No `content_type` field, but better: `tweetKind` ('tweet'|'reply'|'quote'|'repost'|'thread'|'article'), `isThread`, `hasLink`, `hasImage`, `hasVideo` are all stored. Layer 1 can use these directly without any new parsing.

2. ~~**URL title/description fetching** — Does Totem already fetch expanded URL metadata?~~
   **Resolved:** Yes. `urls[].card` stores `{ title, description, imageUrl, domain, cardType }` from X's link card API. Layer 2 keyword matching on `card.title` works out of the box.

3. ~~**Sync cadence** — Real-time / on-open / manual?~~
   **Resolved:** Hybrid. Auto backfill every 4 hours, manual with cooldowns, bootstrap on first install, plus X.com content script event monitoring. Classification should hook into `completeSyncRun()` in `src/service-worker/sync.ts` — runs after bookmarks are written, doesn't block the sync lease.

4. **Re-classification on re-sync** — Should auto-classification re-run on subsequent syncs? Rule: manual intent (`source === 'manual'`) is never overwritten. Auto intent can be refreshed if bookmark is updated. *Still open.*

5. **Unsorted in daily queue** — Should unsorted bookmarks surface in the new tab card, or only "read soon"? Recommendation: surface all until user has >20 classified items, then restrict to read soon only. *Still open.*

6. **Act on this surface** — Where does "Act on this" live on the new tab page? Current design only surfaces one card. Options: separate "you have 3 action items" banner, or just accessible via the reading list filter. *Still open.*

7. ~~**Totem's existing Claude Code setup** — Check if there's an existing API key pattern.~~
   **Resolved:** No existing AI/Claude integration in the extension codebase. `.claude/` contains development skills only (for Claude Code the dev tool). API key would need to be added fresh — user enters it in settings, stored in `chrome.storage.local`. This is the first external non-X network call, which is a deliberate tension with the local-first soul principle. Require explicit opt-in and make the data flow transparent in settings UI.

8. **Service worker lifecycle for AI batch classification** — MV3 service workers can be terminated mid-operation. For Phase 3, the batch classifier must checkpoint progress (e.g., store `lastClassifiedIndex` in `chrome.storage.local`) so it resumes correctly after the worker restarts. *Needs design.*

9. **Virtual scrolling compatibility** — The reading list uses `@tanstack/react-virtual`. Left border accents and hover dots must work within virtualized rows (standard DOM styling is fine, but avoid any approach that measures or repositions the list container). *Needs verification during Phase 1.*

10. **Highlights as intent signal** — The existing `highlights` IndexedDB store tracks annotated bookmarks. A highlighted bookmark is a strong reference signal. Should classification check `highlights` store for existing annotations? *Probably yes — easy win for Layer 1.*

---

## 10. Files to create / modify in the repo

**New files:**
```
src/
  lib/
    classification/
      structural.ts        ← Layer 1 rules (uses tweetKind, isThread, urls[].expandedUrl)
      keywords.ts          ← Layer 2 scoring (uses text, urls[0].card.title, createdAt, metrics)
      ai.ts               ← Layer 3 Claude API call (service worker context only)
      index.ts            ← Combined pipeline + types (Intent, ClassificationResult)
  
  components/
    IntentBadge.tsx        ← Colored dot + label chip (used everywhere)
    IntentFilterPills.tsx  ← Filter bar on reading list
    IntentTray.tsx         ← Post-read tray after Mark read
    IntentDots.tsx         ← Hover-to-assign dots on list row
```

**Modify existing files:**
```
src/types/index.ts
  └── Add intent, intentConfidence, intentSource, intentAssignedAt to Bookmark interface

src/lib/db.ts (or wherever DB_VERSION is defined — src/lib/constants/db.ts)
  └── Bump DB version (currently 6 → 7), add migration to set intent: undefined on existing bookmarks

src/stores/slices/bookmarks-slice.ts
  └── Add setIntent action, update selectors for intent filtering

src/service-worker/sync.ts
  └── Hook classification into completeSyncRun() — after write, before releasing lease

src/components/BookmarksList.tsx
  └── Add IntentFilterPills between tab bar and list, add left border accent to rows, add IntentDots on hover

src/components/BookmarkReader.tsx
  └── Add IntentTray after Mark read action

src/components/NewTabHome.tsx
  └── Add intent badge to surfaced card, scope Surprise me pool to read_soon

src/components/SettingsModal.tsx
  └── Add AI classification toggle + API key input field (Phase 3 only)
```

No new routes. No new pages.

---

## 11. What the codebase already gives us (verified)

Running a full fact-check against the repo before implementation revealed these relevant existing capabilities:

| What we need | What already exists |
|---|---|
| Content type detection | `tweetKind`, `isThread`, `hasLink`, `hasImage`, `hasVideo` stored per bookmark in IndexedDB |
| URL metadata for classification | `urls[].card` stores title, description, domain from X link cards — fetched at sync time |
| "Mark read" hook for intent tray | Explicit `onToggleRead` action in `BookmarkReader.tsx` — no heuristics, soul-compliant |
| Reading completion state | Separate `reading_progress` IndexedDB store (scroll position, lastReadAt, completed) |
| State management | Zustand v5 with slice pattern in `src/stores/slices/` |
| Settings modal | `src/components/SettingsModal.tsx` — add toggle here, no new page needed |
| Sync hook point | `completeSyncRun()` in `src/service-worker/sync.ts` |
| Annotation signal | `highlights` IndexedDB store — annotated bookmarks are strong reference candidates |
| Virtual scrolling | `@tanstack/react-virtual` — list rows are virtualized, styling must account for this |

Tech stack: React 19, TypeScript, Vite, Tailwind 4, Base UI, Manifest V3 service worker.

---

## 12. Summary

**The core bet:** Most bookmark intent can be inferred from structure and language patterns without AI. Rules cover ~65%. AI covers the rest if the user opts in. The UX works identically regardless of how intent was assigned — manually, by rules, or by AI. This means Phase 1 (UI only) is shippable immediately and useful from day one, without waiting for any classification logic.

**The key UX principle:** Don't build new screens. Add cues to moments that already exist:
- New tab → intent badge on the surfaced card
- Reading list → filter pills + left border accents + hover dots
- Reader → post-read intent tray

**The key data principle:** `intent` is a field on the bookmark. `source` tracks whether it was set manually or automatically. Manual always wins. Everything else is additive.
