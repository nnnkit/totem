# Screenshot Capture Guide

16 screenshots needed. Follow this exactly so Replit Animation gets clean,
consistent reference images to work from.

SS1–SS8: Viewport-sized UI screenshots (normal capture).
SS9–SS12: Full-page tall screenshots — clean, no highlights (for scroll animation).
SS13–SS16: Full-page tall screenshots — same content WITH highlights and notes applied.

SS13–SS16 are the "after reading" state. They are used in the opening scene to
show before → after: clean article, then the same article with highlights glowing
through it. The two states side by side is the product's strongest visual.

---

## Setup (do this once before all captures)

1. Open Chrome with the Totem extension installed
2. Go to Chrome Settings → Appearance → set zoom to **100%**
3. Open a new tab (this loads the Totem new tab)
4. Press **F11** (Windows) or use **View → Enter Full Screen** (Mac) to hide browser chrome
   - Alternatively: use the screenshot crop to exclude the browser address bar
5. Use **dark theme** in Totem settings (gear icon → Dark)
6. Use **wallpaper background** (not gradient) in Totem settings
7. Make sure you have real bookmarks synced (at least 8–10)
8. Window size: **1440 × 900** or **1280 × 800**
9. Tool to use: macOS built-in `Cmd+Shift+4` for region, or any screen capture tool
10. Save all files as PNG at full resolution into this `screenshots/` folder

---

## SS1 — Home: "Your Next Read" card

**Filename:** `ss1-home-card.png`

**What to show:**
- The full Totem new tab home screen
- Clock visible at the top center
- The frosted glass "YOUR NEXT READ" bookmark card at the bottom
- Both "Open reading list" and "Surprise me" buttons visible below the card
- Wallpaper visible behind everything

**How to get there:**
- Just open a new tab — this is the default state

**What to check before capturing:**
- The bookmark card shows a good long title (not a short one-liner)
- The "Space" badge is visible top-right of the card
- Author avatar and name are visible at the bottom of the card

---

## SS2 — Home: Syncing state

**Filename:** `ss2-home-syncing.png`

**What to show:**
- The home screen with the sync spinner card
- "Syncing your bookmarks…" text visible in the card
- The spinning icon visible

**How to get there:**
- Click the rotate/sync icon in the top-right of the home screen
- Capture quickly while the spinner is visible (you have a few seconds)
- If you miss it, click sync again

---

## SS3 — Reading List: Unread tab

**Filename:** `ss3-list-unread.png`

**What to show:**
- The full reading list panel
- "Unread" tab active with the terracotta underline indicator
- 5–6 bookmark rows with: author avatar, title, "@handle · Thread/Essay" label
- At least one row with a "New" badge visible
- Search bar visible in the top-right header

**How to get there:**
- From the home screen, click "Open reading list" button
- Make sure you're on the "Unread" tab (it's default)

**What to check:**
- The terracotta tab underline is clearly visible under "Unread"
- Row titles are varied and interesting (not all one-word titles)
- The count number next to "Unread" is visible (e.g. "24")

---

## SS4 — Reading List: Reading tab (in-progress)

**Filename:** `ss4-list-reading.png`

**What to show:**
- Reading list panel with "Reading" tab active
- 2–3 in-progress bookmark rows
- Each row shows "Last read X ago · N Highlights" metadata

**How to get there:**
- From SS3, click the "Reading" tab
- You need to have actually opened at least 2 bookmarks before (to have in-progress items)
- If you have no in-progress items, open 2 bookmarks, scroll partway, go back

**What to check:**
- The terracotta underline has moved to "Reading" tab
- The "Highlights" count is visible in at least one row's metadata

---

## SS5 — Reading List: Read tab (completed)

**Filename:** `ss5-list-read.png`

**What to show:**
- Reading list panel with "Read" tab active
- 2–3 completed bookmark rows
- Each row shows "Finished X ago" metadata

**How to get there:**
- Click the "Read" tab
- You need to have explicitly clicked "Mark as read" on some bookmarks first

---

## SS6 — Reader: Full article open

**Filename:** `ss6-reader-article.png`

**What to show:**
- The full reader view, full screen
- A tweet thread rendered as clean prose in Spectral serif font
- At least 3 paragraphs of content visible
- No feed, no sidebar, no engagement numbers
- Wide centered column layout

**How to get there:**
- From the reading list, click any long-form bookmark (a thread or essay)
- Scroll so you can see 3+ paragraphs — not just the header

**What to check:**
- The serif Spectral font is clearly visible (not a sans-serif article)
- Content is substantive — not a one-sentence tweet
- The "Mark as read" button or reader controls are at the bottom, not in frame

---

## SS7 — Reader: Highlight in action

**Filename:** `ss7-reader-highlight.png`

**What to show:**
- The reader open
- A sentence selected (highlighted/selected with mouse)
- The "Highlight · Add note" toolbar popup visible above the selection
- OR: existing highlights (amber underlined text) visible in the article body

**How to get there — option A (toolbar):**
- Open a bookmark in the reader
- Click and drag to select a sentence
- Capture before the selection disappears

**How to get there — option B (existing highlight):**
- Open a bookmark you've already highlighted
- Scroll to where the amber highlight is visible
- Capture that section

**What to check:**
- The highlight toolbar or amber highlight color is clearly visible
- Enough surrounding text context is shown

---

## SS8 — Settings modal

**Filename:** `ss8-settings.png`

**What to show:**
- The settings modal open over the home screen
- Theme options visible (Light / Dark / System)
- Search engine picker visible
- The home screen blurred/dimmed behind the modal

**How to get there:**
- From the home screen, click the gear icon (top-right)
- The settings modal opens

**What to check:**
- The "Dark" theme option is selected/active
- The modal has the characteristic frosted glass / dark card look
- Background home screen is visible but dimmed

---

## SS9 — Full-page scroll: Twitter Thread (dark mode)

**Filename:** `ss9-thread-scroll-dark.png`
**Type:** FULL-PAGE (taller than viewport — use DevTools method below)
**Theme:** Dark

**What to show:**
- A thread with 6+ tweets, all rendered from top to bottom
- The vertical connector line between tweets clearly visible
- Author avatar at the top tweet, then the thin dot + line for continuity
- Each tweet's text, any media if present
- The thread section header ("Thread") visible at the top of the thread block

**How to pick the right bookmark:**
- Find a thread with 6–10 tweets (not a single tweet)
- Good threads: long essays broken into tweets, step-by-step explanations
- Avoid threads with lots of images — pure text shows the reading experience best

**How to capture full-page in Chrome:**
1. Open the bookmark in the Totem reader
2. Open Chrome DevTools: `Cmd+Option+I` (Mac) / `F12` (Windows)
3. Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows) to open command palette
4. Type "full size" and select **"Capture full size screenshot"**
5. Chrome saves a PNG of the entire scrollable page to your Downloads
6. Move it to this folder and rename to `ss9-thread-scroll-dark.png`

---

## SS10 — Full-page scroll: Twitter Thread (light mode)

**Filename:** `ss10-thread-scroll-light.png`
**Type:** FULL-PAGE
**Theme:** Light

**What to show:** Same thread as SS9, identical bookmark, but switch theme to Light first.

**How to get there:**
- Click gear icon on home → switch to Light theme
- Open the same thread bookmark
- Capture full page (same DevTools method as SS9)
- Switch back to Dark theme after

---

## SS11 — Full-page scroll: Article (dark mode)

**Filename:** `ss11-article-scroll-dark.png`
**Type:** FULL-PAGE
**Theme:** Dark

**What to show:**
- A long article rendered in the reader — cover image at top (if it has one), then big serif H1 title, then multiple sections with subheadings and paragraphs
- The full prose layout: Spectral serif body text, generous line height, centered column
- At least 3 sections visible (heading + 2–3 paragraphs each)
- The ActionBar ("View on X · Grok · Mark read") visible near the top

**How to pick the right bookmark:**
- Find an "Article" type bookmark (ones with the Article badge in the reading list)
- Long-form is better — more than 500 words so there's real content to scroll through
- Avoid very short articles — you want the scroll to feel substantial

**How to capture:** Same DevTools full-size screenshot method as SS9.

---

## SS12 — Full-page scroll: Article (light mode)

**Filename:** `ss12-article-scroll-light.png`
**Type:** FULL-PAGE
**Theme:** Light

**What to show:** Same article as SS11, identical content, Light theme.

**How to get there:**
- Switch to Light theme in settings
- Open the same article bookmark
- Capture full page
- Switch back to Dark theme after

---

## How Replit Animation Uses the Full-Page Screenshots

These 4 tall screenshots enable a specific animation technique:

```
Thread dark/light:
  — Start at the top (author header)
  — Slow scroll downward at ~80px/s
  — Pause briefly at each tweet node
  — Shows: clean thread rendering, connector lines, no engagement clutter

Article dark/light:
  — Start at cover image / title
  — Slow scroll through headings and paragraphs
  — Shows: editorial serif typography, section structure, long-form reading

Dark ↔ Light flip:
  — Cross-dissolve between SS9 and SS10 (or SS11 and SS12)
  — Copy: "Read in any light."
  — Timing: 0.5s dissolve, hold each mode for 1.5s, repeat once
```

---

## SS13 — Full-page: Thread WITH highlights (dark)

**Filename:** `ss13-thread-highlighted-dark.png`
**Type:** FULL-PAGE · **Theme:** Dark
**Must have before capturing:** 4–6 highlights applied across different tweets in the thread.

**Two visual states to show:**
- **Highlight only** → soft terracotta background wash over the sentence
  (color: `rgba(226, 128, 103, 0.16)` — looks like a physical highlighter pen)
- **Highlight + note** → wavy terracotta underline under the text, no background
  (color: `rgba(226, 128, 103, 0.75)` — looks like a handwritten annotation)

**Before capturing:**
1. Open the same thread bookmark used for SS9
2. Highlight 3–4 sentences across different tweets (select text → click Highlight)
3. On 1–2 of those highlights, add a note (click the highlight → click Note → type anything)
4. The wavy-underlined notes and the filled highlights should both be visible
5. Capture full-page (DevTools → Capture full size screenshot)

**What to check:**
- At least one highlight-only (filled) AND one highlight-with-note (wavy underline) are visible
- The highlights are spread across different tweets, not all in one place
- The terracotta color is clearly visible against the dark background

---

## SS14 — Full-page: Thread WITH highlights (light)

**Filename:** `ss14-thread-highlighted-light.png`
**Type:** FULL-PAGE · **Theme:** Light

Same thread, same highlights as SS13, but switch to Light theme first.
Capture full-page. Switch back to Dark after.

---

## SS15 — Full-page: Article WITH highlights (dark)

**Filename:** `ss15-article-highlighted-dark.png`
**Type:** FULL-PAGE · **Theme:** Dark
**Must have before capturing:** 4–6 highlights across different sections of the article.

**Before capturing:**
1. Open the same article used for SS11
2. Highlight 3–4 sentences in different paragraphs/sections
3. Add notes to 1–2 of them
4. Scroll through to confirm highlights are spread throughout the article
5. Capture full-page

**Why this matters for the animation:**
The opening scene dissolves from the clean article (SS11) to this one (SS15).
The viewer sees the same content — same title, same paragraphs — but now
sentences are glowing with soft terracotta and wavy annotation lines. It
communicates "people actually read and engage here" without saying a word.

---

## SS16 — Full-page: Article WITH highlights (light)

**Filename:** `ss16-article-highlighted-light.png`
**Type:** FULL-PAGE · **Theme:** Light

Same article, same highlights as SS15, but Light theme.
Capture full-page. Switch back to Dark after.

---

## Quick Capture Checklist

| # | File | Scene | Type | Status |
|---|---|---|---|---|
| 1 | `ss1-home-card.png` | Home with bookmark card | Viewport | [ ] |
| 2 | `ss2-home-syncing.png` | Home syncing spinner | Viewport | [ ] |
| 3 | `ss3-list-unread.png` | Reading list — Unread tab | Viewport | [ ] |
| 4 | `ss4-list-reading.png` | Reading list — Reading tab | Viewport | [ ] |
| 5 | `ss5-list-read.png` | Reading list — Read tab | Viewport | [ ] |
| 6 | `ss6-reader-article.png` | Reader — article viewport | Viewport | [ ] |
| 7 | `ss7-reader-highlight.png` | Reader — highlight active | Viewport | [ ] |
| 8 | `ss8-settings.png` | Settings modal | Viewport | [ ] |
| 9 | `ss9-thread-scroll-dark.png` | Full thread — clean, dark | Full-page | [ ] |
| 10 | `ss10-thread-scroll-light.png` | Full thread — clean, light | Full-page | [ ] |
| 11 | `ss11-article-scroll-dark.png` | Full article — clean, dark | Full-page | [ ] |
| 12 | `ss12-article-scroll-light.png` | Full article — clean, light | Full-page | [ ] |
| 13 | `ss13-thread-highlighted-dark.png` | Thread with highlights, dark | Full-page | [ ] |
| 14 | `ss14-thread-highlighted-light.png` | Thread with highlights, light | Full-page | [ ] |
| 15 | `ss15-article-highlighted-dark.png` | Article with highlights, dark | Full-page | [ ] |
| 16 | `ss16-article-highlighted-light.png` | Article with highlights, light | Full-page | [ ] |

---

## Tips for Better Screenshots

- **Dark theme + wallpaper** makes everything look more cinematic
- Use a bookmark with a long, interesting title for SS1 and SS6
  (e.g. pick a long thread or essay, not a short tweet)
- For SS7, highlight text mid-paragraph — not at the very top or bottom of visible area
- Export at 2x if your display is retina/HiDPI — Replit Animation will use the detail
- Crop out any browser chrome (address bar, bookmarks bar, tab strip)
