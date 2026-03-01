# Website v2 Implementation Plan

## Overview
Complete rewrite of Totem's landing page and privacy policy. Light & airy, ultra-minimal design using Tailwind CSS. Demo embedded prominently on landing page.

## Design Direction
- **Palette**: White/`#fafafa` background, `#111`/`#666` text, warm orange `#f4a259` accent (brand), `#0b1118` dark sections
- **Typography**: Space Grotesk (body), Newsreader (headlines) — both already loaded via Google Fonts
- **Feel**: Notion/Cal.com energy. Whitespace-heavy, clean borders, neutral tones.

## Files to Change

### 1. DELETE: `website/src/site.css`
The entire vanilla CSS file is replaced by Tailwind classes inline.

### 2. DELETE: `website/support.html`
Support page is removed. Contact info folded into footer.

### 3. MODIFY: `vite.config.ts`
Remove the `support` entry from `rollupOptions.input`:
```ts
input: {
  website: resolve(__dirname, "website/index.html"),
  privacy: resolve(__dirname, "website/privacy.html"),
  demo: resolve(__dirname, "website/demo.html"),
  newtab: resolve(__dirname, "newtab.html"),
},
```

### 4. REWRITE: `website/src/main.tsx`
- Replace `import "./site.css"` with `import "../../src/index.css"` (reuse extension's Tailwind setup)
- Remove `"support"` from the `SitePage` type handling
- Page type becomes `"landing" | "privacy"`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteApp, type SitePage } from "./SiteApp";
import "../../src/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

const pageAttr = root.dataset.page;
const page: SitePage = pageAttr === "privacy" ? "privacy" : "landing";

createRoot(root).render(
  <StrictMode>
    <SiteApp page={page} />
  </StrictMode>,
);
```

### 5. REWRITE: `website/src/SiteApp.tsx`
Complete rewrite. Structure below.

#### Type
```ts
export type SitePage = "landing" | "privacy";
```

#### Layout Component
Sticky header + footer. Tailwind classes. No scroll reveal JS (keep it simple/fast).

**Header**: Logo ("T" mark + "Totem") left, nav right: "Privacy" link + "Add to Chrome" pill CTA.
- Sticky with backdrop-blur on scroll (same useEffect pattern as v1 but with Tailwind classes)
- `max-w-5xl mx-auto` container

**Footer**: Compact. Logo, tagline, links (Privacy, support@usetotem.app), copyright.
- `border-t border-neutral-200`

#### Landing Page Sections (top to bottom)

**1. Hero**
- Eyebrow: "Free Chrome Extension"
- H1 (Newsreader serif): "Actually read what you saved on X."
- Sub-copy (1 line): "Totem turns every new tab into a calm reading queue for your X bookmarks."
- Two CTAs: "Add to Chrome — free" (orange pill) + "See the demo" (outlined, scrolls to #demo)
- Trust badges inline: "No backend" / "No account" / "100% local" — as small muted text pills
- No hero preview mockup — the real demo speaks for itself

**2. Embedded Demo** (`id="demo"`)
- Full-width dark section (`bg-[#0b1118]`)
- Eyebrow: "Live preview"
- H2: "Try it. Open a new tab."
- Browser mockup chrome (dots + address bar) wrapping an iframe to `demo.html`
- No tab switcher — just show the Totem new tab demo directly
- Note below: "Demo uses fixture data. Same UI as the extension."

**3. Brief Features**
- Eyebrow: "What you get"
- H2: "Save. Open. Read."
- 3x2 grid of feature cards, each with:
  - Small icon (text, not emoji — use the existing content but with a cleaner icon approach)
  - Title (bold, 1 line)
  - Body (1 short line, muted text)
- Features: Reader, Unread/Continue/Read, Highlights & notes, Explicit mark-as-read, Offline-friendly, Keyboard-first

**4. How It Works**
- Eyebrow: "Three steps"
- 3 columns with numbered circles (1, 2, 3) + title + one-line body
- Same content as v1: Bookmark on X / Open a new tab / Read, highlight, done

**5. CTA Band**
- Dark section full-bleed
- H2: "Start reading what you saved."
- Sub: "Free. No account. No backend."
- White "Add to Chrome" button

**6. Footer** (part of layout)

#### Privacy Page
Simple long-form document. Tailwind prose classes.
- Header: "Totem Legal" eyebrow, "Privacy Policy" h1, "Last updated: February 28, 2026"
- Sections in simple card-like containers (white bg, subtle border):
  1. What Totem collects
  2. Where data is stored
  3. What Totem does not collect
  4. Why permissions are used
  5. Data retention
  6. Your control
  7. Contact
- Same content as v1, just cleaner presentation

### 6. KEEP UNCHANGED
- `website/demo.html` — already works
- `website/src/demo/DemoNewTabApp.tsx` — already works
- `website/src/demo/fixtures.ts` — already works
- `website/src/demo/main.tsx` — already works
- `website/data.json` — fixture data
- `website/index.html` — only change if font links need updating
- `website/privacy.html` — no changes needed

## Tailwind Strategy
The website pages will import `src/index.css` which already has `@import "tailwindcss"` and the Tailwind v4 setup. This means website pages get access to all the same design tokens (colors, fonts, etc.) as the extension.

The website will primarily use standard Tailwind utility classes rather than custom CSS variables, keeping it simple and maintainable.

## Key Tailwind Classes Used

### Colors (inline, not from theme)
- Background: `bg-white`, `bg-neutral-50`
- Text: `text-neutral-900`, `text-neutral-500` (muted)
- Accent: `bg-[#f4a259]`, `text-[#f4a259]`, `hover:bg-[#c97b30]`
- Dark sections: `bg-[#0b1118]`, `text-white`, `text-white/60`
- Borders: `border-neutral-200`

### Typography
- Headlines: `font-[Newsreader]` serif
- Body: default sans (Space Grotesk from the theme)
- Sizes: `text-5xl`/`text-4xl` for h1, `text-3xl` for h2, standard for body

### Layout
- `max-w-5xl mx-auto px-6` main container
- `grid grid-cols-3 gap-4` for features
- `sticky top-0 z-50` for header
- `backdrop-blur-md` for scrolled header

## Build Verification
After implementation:
1. `pnpm build` — verify no errors
2. Check dist output for website/index.html, website/privacy.html, website/demo.html
3. Visual check with `pnpm dev` (if available) or serve the dist
