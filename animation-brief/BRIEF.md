# Totem — Replit Animation Brief

**Product:** Totem Chrome Extension
**One-liner:** Totem turns your Chrome new tab into a focused reading queue for X bookmarks — so you actually read what you saved, without opening X and getting distracted by the feed.
**Tagline:** "Totem — actually read what you saved on X."

---

## Files Index

Upload all of these into Replit. No subfolders — everything is flat.

| File | Scene Used In | Notes |
|---|---|---|
| `ss1-home-card.png` | Scene 3 | Home: "YOUR NEXT READ" card |
| `ss2-home-syncing.png` | — | Home: syncing spinner (reference) |
| `ss3-list-unread.png` | Scene 4 | Reading list — Unread tab |
| `ss4-list-reading.png` | — | Reading list — Reading tab (reference) |
| `ss5-list-read.png` | — | Reading list — Read tab (reference) |
| `ss6-reader-article.jpg` | Scene 5 | Reader — article viewport |
| `ss7-reader-highlight.jpg` | Scene 5 | Reader — highlight toolbar active |
| `ss8-settings.png` | — | Settings modal (reference) |
| `ss9-thread-scroll-dark.png` | Scene 1 | Full thread — clean, dark |
| `ss10-thread-scroll-light.png` | — | Full thread — clean, light (reference) |
| `ss11-article-scroll-dark.jpg` | Scene 1, 5b | Full article — clean, dark |
| `ss12-article-scroll-light.jpg` | Scene 5b | Full article — clean, light |
| `ss13-thread-highlighted-dark.jpg` | Scene 1 | Thread with highlights, dark |
| `ss14-thread-highlighted-light.jpg` | — | Thread with highlights, light (reference) |
| `ss15-article-highlighted-dark.jpg` | Scene 1 | Article with highlights, dark |
| `ss16-article-highlighted-light.jpg` | — | Article with highlights, light (reference) |
| `logo.png` | Scene 2, 7 | Totem logo mark (512×512) |
| `logo-with-shine.png` | Scene 2, 7 | Totem logo with gradient shine (512×512) |
| `favicon.png` | — | Small logo for reference (256×256) |

---

## Replit Animation Prompt

> Paste this into Replit Animation. Click **Enhance Prompt** before submitting.

---

Create a 45-second product promo animation for a Chrome extension called Totem.

**PRODUCT**
Totem turns your Chrome new tab into a distraction-free reading queue for X (Twitter) bookmarks. Instead of opening X and getting pulled into the feed, you open a new tab and see exactly what you saved to read — clean, calm, one at a time. No Totem account, no server, everything stays in your browser.

**TAGLINE:** "Totem — actually read what you saved on X."

**BRAND**
- Primary accent: #e07a5f (warm terracotta/coral)
- Accent dark: #c96b50
- Background: #0f0f0e (near-black)
- Card surface: dark frosted glass, rgba(255,255,255,0.06), border rgba(255,255,255,0.08)
- Text primary: rgba(255,255,255,0.90)
- Text muted: rgba(255,255,255,0.45)
- Sans font: Space Grotesk (use for UI labels, buttons, metadata)
- Serif font: Spectral (use for headlines and reading content)
- Tone: calm, editorial, premium — like Pocket or Substack, not a tech startup

**LOGO**
Use the uploaded file `logo-with-shine.png` for the logo mark. It is a dark rounded square (#1c1c1e) with a terracotta triangle (fill #e07a5f) and a shadow triangle (fill #c96b50) with a soft white gradient shine. Use it in the pivot scene and the closing tagline scene.

**VIDEO SPECS**
Duration: 30–35 seconds (short — optimised for social/Twitter, grab attention fast)
Output: 1080p, 16:9, 60fps
Aspect ratio: consider also exporting a 9:16 vertical crop for mobile

---

### SCENE 1 — OPEN WITH THE READING EXPERIENCE (0–8s)

Do not start with the problem. Start with the product.

Show the full-page article screenshot (`ss11-article-scroll-dark.jpg`) filling the frame — no browser chrome, edge to edge. Begin a slow upward scroll from the title downward at ~60px/s. The Spectral serif text, clean paragraphs, and dark background should feel like opening a well-designed book.

After 3 seconds of scrolling, zoom in (scale 1.0 → 1.08, 600ms ease-out) and cross-dissolve to the highlighted version (`ss15-article-highlighted-dark.jpg`) — the same article, same scroll position, but now sentences glow with soft terracotta highlights and wavy note underlines are visible.

Play a soft click sound at the moment the highlight dissolve happens.

Hold on the highlighted version for 1.5 seconds while continuing the slow scroll.

Overlay text fades in (bottom-left, small caps): "Read it. Mark it. Own it."

Then cut to: the same sequence for the thread (`ss9-thread-scroll-dark.png` → `ss13-thread-highlighted-dark.jpg`), 3 seconds total. Thread has the vertical connector lines and avatar — visually very different from X's UI.

---

### SCENE 2 — THE PROBLEM (8–12s)

**Line 1** (fades in at 1s): "You saved it to read later."
**Line 2** (fades in at 2.5s): "You opened X. You scrolled instead."

Then a browser new tab appears — dark, minimal, completely empty except for the Totem logo mark (`logo-with-shine.png`) centered on screen, which gently scales in from 0.85 to 1.0.

Text fades in below the logo: "Open a new tab. Start reading."
Hold for 1.5 seconds.

---

### SCENE 3 — HOME SCREEN (12–22s)

Show the Totem new tab interface. Reference screenshot `ss1-home-card.png`.

Key elements to render:
- Large serif clock numerals centered ("10:42") in text-white/90
- A frosted glass card below the clock containing:
  - Small caps label "YOUR NEXT READ" in #e07a5f
  - Serif headline (2 lines): "Why the best founders read more than they build"
  - One-line excerpt in muted text: "A thread on the reading habits behind long-term thinking."
  - Author: Patrick O'Shaughnessy · @patrick_oshag
  - "Space" keyboard hint badge top-right of card
- Two ghost buttons below the card: "Open reading list [L]" and "Surprise me [S]"
- Subtle dark landscape wallpaper behind everything, darkened to 40% opacity

Animate: card slides up 12px and fades in over 400ms. Hold 3 seconds.
Overlay text bottom-left: "Your next read, every new tab."

---

### SCENE 4 — READING LIST (22–32s)

Transition to the reading list view. Reference screenshot `ss3-list-unread.png`.

Show a clean list panel with:
- Header: back arrow + "Reading" title + search input top-right
- Three tabs: "Unread 24" / "Reading 3" / "Read 11"
  A terracotta (#e07a5f) underline bar slides from "Unread" to "Reading" tab (animate the slide over 250ms ease-in-out)
- Under Unread tab: 5 bookmark rows, each with author avatar, title, "@handle · Thread"
  One row has a small "New" badge in terracotta
- Switch to Reading tab: show 2 rows with "Last read 2h ago · 3 Highlights" metadata

**Bookmark rows (Unread tab):**
1. "Why the best founders read more than they build" · @patrick_oshag · Thread · **New**
2. "The quiet collapse of long-form thinking" · @paulg · Essay
3. "How Stripe builds product" · @shl · Thread
4. "Naval on reading without guilt" · @naval · Thread
5. "The Lindy Effect and why old ideas win" · @nntaleb · Essay

Overlay text: "Every bookmark. Sorted. No feed."

---

### SCENE 5 — THE READER INTERACTION (32–38s)

Show a viewport-sized crop of the reader (`ss6-reader-article.jpg`). Also reference `ss7-reader-highlight.jpg` for the highlight toolbar state.

Animate a mouse cursor moving to a sentence mid-paragraph and clicking to select it. Play a soft click sound as the selection appears. Zoom in slightly on the selected text (scale 1.0 → 1.06, 400ms ease-out).

The SelectionToolbar ("Highlight · Add note") appears above the selection with a gentle popover-in animation (scale 0.92 → 1.0, 200ms).

User clicks "Highlight" — play a second soft click sound. The text immediately gets the terracotta background fill (highlight sweep: 300ms left-to-right). Zoom back out (1.06 → 1.0, 300ms ease-in).

Then cursor moves to a second sentence, clicks "Highlight" then "Add note" — play click sounds for each. That sentence switches to the wavy underline style. Zoom into the wavy underline for 0.5 seconds to make sure it registers visually.

**Body text to render (plausible content):**
> "The founders who compound knowledge the fastest aren't the ones who read more headlines — they're the ones who actually finish what they start."

> "Most of us have a graveyard of bookmarks. Things we meant to read. Links we meant to revisit. The tab closes, the thought evaporates."

> "The difference is a reading habit built into your workflow, not bolted onto it. You don't check your reading list. You run into it."

**Highlighted sentence:** "The difference is a reading habit built into your workflow, not bolted onto it."

Overlay text: "Read it. Highlight it. Pick up where you left off."

---

### SCENE 5b — DARK / LIGHT MODE FLIP (38–42s)

Show the full-page article screenshot (`ss11-article-scroll-dark.jpg`) filling the screen with a slow upward scroll. After 2 seconds, cross-dissolve to the same article in light mode (`ss12-article-scroll-light.jpg`), continuing the scroll. Then dissolve back to dark.

Copy overlay center: "Read in any light."

This scene should feel like watching someone adjust to the right reading environment — calm, deliberate, satisfying.

---

### SCENE 6 — LOCAL FIRST (40–43s)

Dark minimal scene. Browser icon on one side. A cloud/server icon with a diagonal line through it on the other side.

**Main text:** "Your data never leaves your browser."
**Subtitle in muted text:** "No account. No server. Always yours."

---

### SCENE 7 — TAGLINE CLOSE (43–45s)

Full dark screen. Totem logo mark (`logo-with-shine.png`) fades in center. Below it in large Spectral serif, weight 400:

> "actually read what you saved on X."

Small text below in muted: "Free Chrome extension — usetotem.app"

Slow fade to black over 1.5 seconds.

---

### SOUND DESIGN

Use a subtle soft click sound (like a mechanical keyboard or a gentle UI tap) at these exact moments:
- When the highlight background fill appears (Scene 1 dissolve + Scene 5 click)
- When the SelectionToolbar button is clicked
- When a note is added (the wavy underline appears)

No music. No voiceover. Sound only on interactions — everything else is silent. The silence reinforces the calm, focused reading atmosphere.

---

### MOTION RULES

- All transitions: slow opacity dissolves or 12px upward fades, 350–500ms duration
- Easing for entrances: cubic-bezier(0.23, 1, 0.32, 1)
- No cuts, no wipes, no zoom bursts, no bounces
- Text enters line by line with 150ms stagger between lines
- Card translate: always 12px upward (translateY: 12px → 0)
- Backdrop blur on frosted glass: blur(16px)
- Overall pacing: calm and deliberate, like turning a page

---

**OUTPUT:** 1080p, 16:9, 45 seconds, 60fps

---

## Round 2 Prompt — Motion Refinement

Slow down all text entrance animations. Each line should take 400ms to fade in with 200ms stagger between lines. The tab indicator underline in Scene 4 should slide with cubic-bezier(0.645, 0.045, 0.355, 1) over 250ms. In Scene 5 the text highlight should appear with a 300ms left-to-right sweep, not an instant fill. Make the card in Scene 3 feel heavier — increase the frosted glass blur to backdrop-filter: blur(16px) and darken the card background slightly.

---

## Round 3 Prompt — Color and Typography Polish

Darken the background to #0a0a09. The terracotta accent (#e07a5f) should only appear on: the "YOUR NEXT READ" label, the tab indicator underline, the "New" badge, and the Totem logo. Remove it from any other elements. In the reader scene make sure the body text uses Spectral at font-weight 400, not bold. The frosted glass card borders should be rgba(255,255,255,0.07) — very subtle. Increase the muted text opacity to rgba(255,255,255,0.50) so it is readable but still clearly secondary.

---

## Brand Tokens

### Colors

| Token | Value | Use |
|---|---|---|
| Accent primary | `#e07a5f` | Logo, "YOUR NEXT READ" label, tab indicator, "New" badge — nowhere else |
| Accent dark | `#c96b50` | Logo shadow, hover states |
| Page background | `#0f0f0e` | Main new tab background |
| Background dark | `#0a0a09` | Darkest scenes |
| Card surface | `rgba(255,255,255,0.06)` | Frosted glass cards |
| Card border | `rgba(255,255,255,0.07)` | Subtle card edges |
| Text primary | `rgba(255,255,255,0.90)` | Headlines, titles |
| Text secondary | `rgba(255,255,255,0.65)` | Card content, body |
| Text muted | `rgba(255,255,255,0.50)` | Metadata, handles, timestamps |
| Highlight amber | `#fbbf24` at 40% opacity | Text highlights in reader |
| Border default | `rgba(255,255,255,0.08)` | List item borders |

### Typography

| Role | Family | Size |
|---|---|---|
| Clock | Spectral light | 60–72px |
| Reader body / card headline | Spectral 400 | 22–24px |
| Section headers | Space Grotesk 600 | 18–20px |
| Bookmark titles | Space Grotesk 500 | 14px |
| Tab labels / metadata | Space Grotesk 500 | 12px |
| "YOUR NEXT READ" label | Space Grotesk 700, 0.25em letter-spacing, small caps | 10px |

### Logo SVG

```svg
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="18" fill="#1c1c1e"/>
  <path d="M20 80L80 80L80 20Z" fill="#e07a5f"/>
  <path d="M80 20L52.5 47.5L80 80Z" fill="#c96b50"/>
  <path d="M20 80L80 80L80 20Z" fill="url(#shine)"/>
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="white" stop-opacity="0.45"/>
      <stop offset="50%" stop-color="white" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>
```

---

## Alternate Copy (if any scene feels too long)

| Scene | Alternate |
|---|---|
| Scene 1 | "Bookmarks don't read themselves." |
| Scene 3 | "One thing. Right there." |
| Scene 4 | "Your list. Your pace." |
| Scene 5 | "Finish what you started." |
| Scene 6 | "Fully offline. Fully private." |
| Close | "Read. Don't scroll." |
