# Totem — Replit Animation Brief

**How Replit Animation works:** It writes React code that plays in a loop. It is NOT a video editor — it animates HTML/CSS/JS. Upload all files flat into the Replit project (no subfolders). Reference them by filename in your prompts.

---

## Files to Upload

Upload everything flat — no subfolders.

| File | What It Is |
|---|---|
| `ss1-home-card.png` | Home screen — "YOUR NEXT READ" card |
| `ss3-list-unread.png` | Reading list — Unread tab |
| `ss6-reader-article.jpg` | Reader — full article view |
| `ss7-reader-highlight.jpg` | Reader — highlight toolbar visible |
| `ss9-thread-scroll-dark.png` | Full-page thread, dark, no highlights |
| `ss11-article-scroll-dark.jpg` | Full-page article, dark, no highlights |
| `ss12-article-scroll-light.jpg` | Full-page article, light mode |
| `ss13-thread-highlighted-dark.jpg` | Full-page thread, dark, WITH highlights |
| `ss15-article-highlighted-dark.jpg` | Full-page article, dark, WITH highlights |
| `logo-with-shine.png` | Totem logo mark (512×512) |

Reference-only (upload but don't need to call out in prompts unless asked):
`ss2`, `ss4`, `ss5`, `ss8`, `ss10`, `ss14`, `ss16`, `logo.png`, `favicon.png`

---

## Step 1 — Initial Prompt

**Keep it short. Hit "Enhance Prompt" before submitting.**

> Create a 35-second dark-mode product promo animation for Totem, a Chrome extension that turns your new tab into a distraction-free reading queue for X (Twitter) bookmarks.
>
> Use the uploaded screenshots as the main visuals. Start with the reading experience (ss11-article-scroll-dark.jpg scrolling slowly upward, then dissolving to ss15-article-highlighted-dark.jpg showing highlights). Cut to the home screen (ss1-home-card.png). Then the reading list (ss3-list-unread.png). Then the reader (ss6-reader-article.jpg).
>
> Brand: dark background #0f0f0e, terracotta accent #e07a5f, serif font Spectral for headlines, Space Grotesk for UI. Tone: calm, editorial, premium.
>
> End with the logo (logo-with-shine.png) centered on a dark screen and the text: "actually read what you saved on X."
>
> Pacing: slow and deliberate. Smooth cross-dissolves between scenes. Text overlays fade in gently, one line at a time.

---

## Step 2 — After First Render

Review what it built. Then send one of these depending on what you see:

**If the overall structure is right but motion feels cheap:**
> Make the animations more cinematic and polished. Slow everything down — the screenshot scrolls should feel like turning pages, not sliding. All text should fade in line by line with a subtle upward drift. Make transitions between scenes cross-dissolve instead of cut. Add a slow zoom (scale 1.0 to 1.06) on the screenshots while they scroll.

**If it ignored the screenshots:**
> The screenshots are uploaded as project files. Use them as the actual visual content — display them as large full-screen images and animate them (slow scroll, slow zoom, dissolve). Do not generate placeholder graphics in place of the screenshots.

**If the brand colors are off:**
> Correct the color palette: background must be #0f0f0e (near-black), accent color #e07a5f (terracotta/coral) used only on the tab underline indicator, "YOUR NEXT READ" label, and the logo. All other UI is white at reduced opacity. No blues, no bright whites, no gradients that weren't in the original.

---

## Step 3 — Refinement Round

Once the structure and motion feel right, push on polish:

> Opening scene: ss11-article-scroll-dark.jpg fills the frame edge-to-edge with no letterboxing. It scrolls upward slowly at a reading pace. After 3 seconds, cross-dissolve to ss15-article-highlighted-dark.jpg at the same scroll position — the same article but now with soft terracotta sentence highlights glowing through it. Text overlay bottom-left fades in: "Read it. Mark it. Own it."
>
> Then repeat for the thread: ss9-thread-scroll-dark.png dissolves to ss13-thread-highlighted-dark.jpg.
>
> Home scene: ss1-home-card.png fades in, the card slides up 12px as it appears. Overlay: "Your next read, every new tab."
>
> List scene: ss3-list-unread.png. Show the tab indicator animating from "Unread" to "Reading". Overlay: "Every bookmark. Sorted. No feed."
>
> Dark/light flip: ss11-article-scroll-dark.jpg cross-dissolves to ss12-article-scroll-light.jpg while continuing to scroll. Overlay center: "Read in any light."
>
> Close: logo-with-shine.png fades in centered. Below it in large serif: "actually read what you saved on X." Then "Free Chrome extension — usetotem.app" in small muted text. Fade to black.

---

## Step 4 — Typography and Color Pass

> Typography corrections: the clock on the home screen and all article body text should use Spectral serif at weight 400. All UI labels, tab text, and metadata use Space Grotesk. The "YOUR NEXT READ" label is Space Grotesk weight 700, all caps, with wide letter-spacing, in #e07a5f. Body text opacity: primary content rgba(255,255,255,0.90), secondary rgba(255,255,255,0.65), metadata rgba(255,255,255,0.50).
>
> Remove any bounce or elastic easing. All entrances should use a smooth ease-out curve. No wipes, no slides from the side — only upward fades and cross-dissolves.

---

## Scene Copy (Text on Screen)

Use these exact words for each overlay:

| Scene | Copy |
|---|---|
| Opening (article + thread) | "Read it. Mark it. Own it." |
| Home screen | "Your next read, every new tab." |
| Reading list | "Every bookmark. Sorted. No feed." |
| Reader | "Read it. Highlight it. Pick up where you left off." |
| Dark/light flip | "Read in any light." |
| Local-first scene | "Your data never leaves your browser." / "No account. No server. Always yours." |
| Close | "actually read what you saved on X." / "Free Chrome extension — usetotem.app" |

**Alternates if a scene runs short:**

| Scene | Alternate |
|---|---|
| Opening | "Bookmarks don't read themselves." |
| Home | "One thing. Right there." |
| List | "Your list. Your pace." |
| Reader | "Finish what you started." |
| Close | "Read. Don't scroll." |

---

## Brand Reference

**Colors**

| Token | Value | Rule |
|---|---|---|
| Page background | `#0f0f0e` | All dark scenes |
| Deepest dark | `#0a0a09` | Close scene |
| Accent | `#e07a5f` | Logo, tab underline, "YOUR NEXT READ" label, "New" badge — nowhere else |
| Accent shadow | `#c96b50` | Logo shadow path only |
| Card surface | `rgba(255,255,255,0.06)` | Frosted glass cards |
| Card border | `rgba(255,255,255,0.07)` | Card edges |
| Text primary | `rgba(255,255,255,0.90)` | Headlines |
| Text secondary | `rgba(255,255,255,0.65)` | Body |
| Text muted | `rgba(255,255,255,0.50)` | Metadata, handles |
| Text highlight | `#fbbf24` at 40% opacity | Highlighted sentences in reader |

**Fonts**
- Headlines / reader body: Spectral (serif), weight 400
- UI / labels / buttons: Space Grotesk (sans), weight 500–700
- Clock: Spectral, weight 300, 60–72px

**Motion feel**
- Entrance: smooth ease-out (no bounce, no elastic)
- All transitions: cross-dissolve or upward fade (12px translate + opacity)
- Pacing: slow and deliberate, like turning a page
- No cuts. No wipes. No side-slides.

---

## What to Expect

- **First render will be rough.** That's normal — use Step 2 prompts to correct direction.
- **Screenshots as assets:** If Replit ignores the uploaded images and draws placeholder boxes instead, explicitly tell it the files are uploaded and to use them as `<img>` sources or CSS backgrounds.
- **No reliable audio:** Replit Animation can attempt click sounds but results vary. Don't make sound a requirement — focus on visuals first and add "add subtle click sound effects on highlight interactions" only after visuals are locked.
- **Export:** Top-right Export button → 1080p, 60fps → renders server-side, downloads as MP4.
