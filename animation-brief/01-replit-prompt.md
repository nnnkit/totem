# Replit Animation Prompt

## Instructions
1. Open Replit Animation
2. Upload all 8 screenshots from the `screenshots/` folder
3. Paste the INITIAL PROMPT below
4. Click **Enhance Prompt** before hitting submit
5. After the first render, use ROUND 2 and ROUND 3 prompts to refine

---

## INITIAL PROMPT — paste this first

Create a 45-second product promo animation for a Chrome extension called Totem.

PRODUCT
Totem turns your Chrome new tab into a distraction-free reading queue for X (Twitter) bookmarks. Instead of opening X and getting pulled into the feed, you open a new tab and see exactly what you saved to read — clean, calm, one at a time. No Totem account, no server, everything stays in your browser.

TAGLINE: "Totem — actually read what you saved on X."

BRAND
- Primary accent: #e07a5f (warm terracotta/coral)
- Accent dark: #c96b50
- Background: #0f0f0e (near-black)
- Card surface: dark frosted glass, rgba(255,255,255,0.06), border rgba(255,255,255,0.08)
- Text primary: rgba(255,255,255,0.90)
- Text muted: rgba(255,255,255,0.45)
- Sans font: Space Grotesk (use for UI labels, buttons, metadata)
- Serif font: Spectral (use for headlines and reading content)
- Tone: calm, editorial, premium — like Pocket or Substack, not a tech startup

LOGO
The Totem logo is a dark rounded square (#1c1c1e) containing a triangle shape
made of two paths: a large terracotta triangle (M20 80 L80 80 L80 20 Z, fill #e07a5f)
and a darker shadow triangle (M80 20 L52.5 47.5 L80 80 Z, fill #c96b50).
Use this mark in the pivot scene and the closing tagline scene.

SCENES

SCENE 1 — THE PROBLEM (0–8s)
A chaotic social feed fills the screen: rows of small cards with engagement
numbers, trending labels, notification dots, random images. Colors are muted
and desaturated. Text fades in on the left side:
  Line 1: "You saved it to read later."
  Line 2 (1.5s delay): "You opened X. You scrolled instead."
The feed blurs and dims to near-black.

SCENE 2 — THE PIVOT (8–12s)
A browser new tab appears — dark, minimal, completely empty except for the
Totem logo mark centered on screen, which gently scales in from 0.85 to 1.0.
Text fades in below the logo: "Open a new tab. Start reading."
Hold for 1.5 seconds.

SCENE 3 — HOME SCREEN (12–22s)
Show the Totem new tab interface. Reference screenshot ss1-home-card.png.
Key elements to render:
- Large serif clock numerals centered ("10:42") in text-white/90
- A frosted glass card below the clock containing:
    - Small caps label "YOUR NEXT READ" in #e07a5f
    - Serif headline (2 lines): "Why the best founders read more than they build"
    - One-line excerpt in muted text
    - Author avatar (small circle) + name + handle at the bottom
    - "Space" keyboard hint badge top-right of card
- Two ghost buttons below the card: "Open reading list [L]" and "Surprise me [S]"
- Subtle dark landscape wallpaper behind everything, darkened to 40% opacity
Animate: card slides up 12px and fades in over 400ms. Hold 3 seconds.
Overlay text bottom-left: "Your next read, every new tab."

SCENE 4 — READING LIST (22–32s)
Transition to the reading list view. Reference screenshot ss3-list-unread.png.
Show a clean list panel with:
- Header: back arrow + "Reading" title + search input top-right
- Three tabs: "Unread 24" / "Reading 3" / "Read 11"
  A terracotta (#e07a5f) underline bar slides from "Unread" to "Reading" tab
  (animate the slide over 250ms ease-in-out)
- Under Unread tab: 5 bookmark rows, each with author avatar, title, "@handle · Thread"
  One row has a small "New" badge in terracotta
- Switch to Reading tab: show 2 rows with "Last read 2h ago · 3 Highlights" metadata
Overlay text: "Every bookmark. Sorted. No feed."

SCENE 5 — THE READER (32–40s)
Open the reader view full screen. Reference screenshot ss6-reader-article.png.
Show:
- Wide centered column, Spectral serif at 20px, generous line height
- A 3-paragraph tweet thread rendered as clean prose
- User's mouse cursor selects a sentence — highlight it in amber (#fbbf24 at 40% opacity)
- A small toolbar appears above the selection with two buttons: "Highlight" and "Note"
- The selected text gains a persistent amber underline/background
Overlay text: "Read it. Highlight it. Pick up where you left off."

SCENE 6 — LOCAL FIRST (40–43s)
Dark minimal scene. Browser icon on one side. A cloud/server icon with a
diagonal line through it on the other side.
Text centered: "Your data never leaves your browser."
Subtitle in muted text: "No account. No server. Always yours."

SCENE 7 — TAGLINE CLOSE (43–45s)
Full dark screen. Totem logo mark fades in center.
Below it in large Spectral serif, weight 400:
  "actually read what you saved on X."
Small text below in muted: "Free Chrome extension"
Slow fade to black over 1.5 seconds.

MOTION RULES
- All transitions: slow opacity dissolves or 12px upward fades, 350–500ms duration
- Easing for entrances: cubic-bezier(0.23, 1, 0.32, 1)
- No cuts, no wipes, no zoom bursts, no bounces
- Text enters line by line with 150ms stagger between lines
- Overall pacing: calm and deliberate, like turning a page

OUTPUT: 1080p, 16:9, 45 seconds, 60fps

---

## ROUND 2 PROMPT — motion refinement

Slow down all text entrance animations. Each line should take 400ms to fade in
with 200ms stagger between lines. The tab indicator underline in Scene 4 should
slide with cubic-bezier(0.645, 0.045, 0.355, 1) over 250ms. In Scene 5 the
text highlight should appear with a 300ms left-to-right sweep, not an instant
fill. Make the card in Scene 3 feel heavier — increase the frosted glass blur
to backdrop-filter: blur(16px) and darken the card background slightly.

---

## ROUND 3 PROMPT — color and typography polish

Darken the background to #0a0a09. The terracotta accent (#e07a5f) should only
appear on: the "YOUR NEXT READ" label, the tab indicator underline, the "New"
badge, and the Totem logo. Remove it from any other elements. In the reader
scene make sure the body text uses Spectral at font-weight 400, not bold. The
frosted glass card borders should be rgba(255,255,255,0.07) — very subtle.
Increase the muted text opacity to rgba(255,255,255,0.50) so it is readable
but still clearly secondary.
