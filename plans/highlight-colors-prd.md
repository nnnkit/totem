# PRD — Multi-color highlights with marker-style rendering

**Status:** Draft
**Author:** Ankit
**Last updated:** 2026-04-23
**Scope:** Web app reader. The Chrome extension is out of scope (see §7).

---

## 1. Summary

Replace the current flat coral highlight wash with a hand-drawn "marker swipe" rendering, and give users a palette of four colors (Classic, Yellow, Mint, Dark) that can be mixed freely within the same article. Color is per-highlight. The color picker lives in a **split-button selection toolbar** (primary Highlight button + caret that opens a mini palette) and again on the existing edit popover for recoloring old highlights.

---

## 2. Goals / Non-goals

**Goals**
- Make highlights feel fun and expressive without sacrificing readability in either theme.
- Let users assign semantic meaning to highlights via color (quote / question / key claim / etc.) — no imposed semantics.
- Ship without breaking a single existing highlight — zero data loss, zero visual regressions for pre-feature data.
- Keep the creation flow one tap when the user doesn't want to think about color.

**Non-goals**
- Multi-select recolor ("change all highlights on this page to X"). Out of scope for v1; individual recolor via edit popover covers 95% of the need.
- Custom / user-defined colors. Palette is fixed to four curated values.
- Highlight rendering inside the Chrome extension content script. The extension doesn't render highlights today; this PRD doesn't add that.
- Per-color search/filter in the bookmarks list. Tracked separately; can come later.

---

## 3. Current state (what's there today)

- `Highlight.color: string` already exists (`src/types/index.ts:208`). Set to the literal `"green"` on every new highlight (`src/hooks/useHighlights.ts:310`). **Not read anywhere.**
- `<mark class="totem-highlight">` is the only marker; color is not reflected on the element (`src/hooks/useHighlights.ts:84-87`).
- Styling is a flat translucent coral via CSS variables `--highlight-bg`, `--highlight-bg-hover`, `--highlight-underline` (`src/index.css:262-265` light, `312-315` dark). Only opacity varies between the two themes.
- `SelectionToolbar` and `HighlightPopover` have no color affordance.
- Persistence: IndexedDB via Dexie, schema v6 (`src/lib/constants/db.ts:5`). Migrations happen in the `upgrade` callback (`src/db/index.ts:88-143`).

---

## 4. User-visible behavior

### 4.1 Palette

Four colors, theme-aware. Each carries a label and is identified by a short string value stored on the highlight.

| value        | label     | light ink                        | dark ink                           |
| ------------ | --------- | -------------------------------- | ---------------------------------- |
| `classic`    | Classic   | coral (current brand accent)     | brighter peach, dark text          |
| `yellow`     | Yellow    | saturated yellow                 | bright yellow, dark text           |
| `mint`       | Mint      | soft mint green                  | bright mint, dark text             |
| `dark`       | Dark      | near-black fill, white text      | off-white fill, near-black text    |

Rendering uses the CSS `linear-gradient` marker technique from the prototype (soft ends, bold middle, 104deg swipe) with `box-decoration-break: clone` for multi-line.

### 4.2 Selection flow (split-button pattern)

When the user selects text in the reader:

1. The `SelectionToolbar` shows `[• Highlight] [▾]` where the `•` is the **session default color** dot.
2. Tap **Highlight** → create a highlight with the session default color. A swipe-on animation plays once (720ms) and the highlight settles.
3. Tap **▾** → a mini palette drops with four color dots. Picking a color (a) creates the highlight in that color and (b) updates the session default. The next highlight via the primary button uses that color until changed.

### 4.3 Session default

- Seeded from the user's **global default** (preference, see §4.6) on fresh reader sessions.
- Updates whenever the user picks a color from the caret palette or header swatch.
- Lives in memory only; not persisted beyond the session. Global default in settings is the stable preference.

### 4.4 Header swatch

A round swatch in the reader header shows the **current session default**. Tapping it opens the same palette popover. Same UX as the caret picker, but always accessible without a selection. Useful as a "what color will my next highlight be" indicator.

### 4.5 Edit existing highlight (HighlightPopover)

When the user taps an existing mark:
- The popover shows current affordances (note, share, delete) plus **four color dots** for recoloring.
- Picking a color updates that highlight only. Does not affect session default or other highlights.
- No swipe animation on recolor — only on creation.

### 4.6 Settings — default highlight color

In the existing Settings UI, under the reader section:

> **Default highlight color** — the color used on your first highlight in a new article.

Radio or palette UI, four options. Stored in user preferences.

### 4.7 Motion

- **Swipe-on animation** plays only on creation (`data-fresh="true"` attr + CSS keyframe, self-clears on `animationend`).
- No animation on color change, page load, or theme switch.
- Respects `prefers-reduced-motion: reduce` — animation disabled, static render.

---

## 5. Data model & backward compatibility

**The whole point of this section: no user should lose a highlight, no old highlight should look broken.**

### 5.1 What we change

- **Nothing about the `Highlight` schema.** `color: string` exists and stays exactly as it is. No Dexie version bump. No migration script.
- New highlights write one of the literal values `"classic" | "yellow" | "mint" | "dark"`.
- Introduce a small resolver at render time that maps **any legacy or unrecognized value** to `"classic"`:

  ```ts
  const KNOWN = new Set(['classic', 'yellow', 'mint', 'dark']);
  export function resolveHighlightColor(raw: string | undefined): HighlightColor {
    return raw && KNOWN.has(raw) ? (raw as HighlightColor) : 'classic';
  }
  ```

- `"classic"` is defined to look visually equivalent-or-upgraded to what users see today. (Same hue family as current coral; the new gradient rendering is the visual upgrade, but still reads as the same color.)

### 5.2 Why this is safe

- `"green"` (current literal) is not in the known set → resolves to `"classic"` → renders as the coral marker. Same color family as today, just the upgraded gradient.
- Any partial/corrupted/missing color value → resolves to `"classic"`. Never crashes, never renders "no color."
- No migration failure mode. The worst case for any existing highlight is "it rendered as Classic, which is what it would have looked like anyway."
- Over time, as users recolor old highlights, `"green"` gets replaced with `"classic"` naturally. No forced rewrite.

### 5.3 Why we don't migrate the value

Migration from `"green"` → `"classic"` is tempting but costs more than it's worth:
- Requires a Dexie version bump (v6 → v7), which adds a release-risk surface.
- Users on older app versions writing to the same DB would produce mixed data.
- The resolver handles this at zero runtime cost.

If we later add per-color search/filter and want clean data, we can do a lazy rewrite on read (write back `"classic"` if we observe `"green"`) without a version bump. Deferred to follow-up.

### 5.4 What gets stored on disk going forward

- New highlight: `color: "classic" | "yellow" | "mint" | "dark"`.
- Edited highlight: whatever the user picked; same value set.
- Old highlights: untouched on disk. Render-resolved to `"classic"`.

---

## 6. Implementation phases (what ships when)

### Phase 1 — Foundation, no user-visible change ✅ safest first step

Goal: land the plumbing without any visual change, so we can roll it back cleanly if anything goes wrong.

- Add `HighlightColor` type + `KNOWN_COLORS` constant.
- Add `resolveHighlightColor()` util.
- Update `useHighlights.ts` `wrapTextRange()` to set `data-color={resolveHighlightColor(h.color)}` on each `<mark>` alongside the existing class.
- No CSS change yet. Existing `.totem-highlight` rule keeps rendering every mark coral regardless of `data-color` — so users see zero change.
- Unit tests for the resolver (empty, `"green"`, unknown, all four known values).

Exit criteria: PR merged, nothing visible, `data-color` attrs present in the DOM, storybook/tests pass.

### Phase 2 — New rendering + Classic as default

Goal: visual upgrade for everyone, no color choice UI yet.

- Replace the flat `--highlight-bg` rule with per-`data-color` gradient rules (from the prototype). Keep the old `.totem-highlight` as fallback.
- Add light + dark variants for all four colors.
- Add `data-fresh` / swipe keyframe, wired from the new-highlight flash already in `useHighlights.ts` (the `totem-highlight-new` class can drive the same mechanic).
- Every highlight resolves to Classic → upgraded gradient look. No recoloring possible yet; feels like a polish update.

Exit criteria: existing highlights render with the new marker style. No tooling or prefs exposed yet.

### Phase 3 — Selection toolbar picker (split pattern)

Goal: let users pick a color when creating.

- Update `SelectionToolbar.tsx` to render the split-button variant from the prototype.
- Add session-default state to the reader store.
- Wire `onHighlight(ranges, color)` — bump the callback signature.
- Add the mini palette component behind the caret.
- Write the chosen color into `Highlight.color` on create.

Exit criteria: user can create highlights in any of the four colors from the selection toolbar.

### Phase 4 — Recolor existing + header swatch

Goal: close the loop on editing and give users a visible indicator.

- Extend `HighlightPopover.tsx` with a four-dot color row. Wire `onRecolor(id, color)` that updates the highlight record.
- Add the header swatch + popover in the reader chrome (click = palette, shows session default).
- Both surfaces share the palette component from Phase 3.

Exit criteria: any highlight is recolorable; header indicator reflects session default.

### Phase 5 — Settings + global default

Goal: one persistent preference.

- Add "Default highlight color" field to user preferences (reuse existing prefs machinery — check `useTheme.ts` pattern).
- Seed session default from this on reader open.
- Settings UI in the same screen as other reader prefs.

Exit criteria: the user's chosen default survives a reload.

### Phase 6 — Cleanup

- Remove any temporary shims from Phase 1 if unused.
- Docs update if we have an internal feature log.

---

## 7. Chrome extension impact

The extension (`src/content/open-in-totem.ts`, manifest `public/manifest.json`) is a content script that injects an "Open in Totem" button on x.com. It does **not** render highlights on the external page — it only links back to the main app. So:

- **No rendering changes** required in the extension.
- **No manifest changes** required.
- One thing to verify: if there's any bookmark-import / highlight-creation path through the extension that writes a `Highlight` record, ensure it sets `color: "classic"` (the new default) rather than leaving it empty or `"green"`. Grep `Highlight` / `highlights` in `src/content/` and `src/background/` (if that exists) during Phase 1.

---

## 8. Success criteria

- [ ] Every pre-existing highlight renders without visual artifacts after the upgrade.
- [ ] Users can create four distinctly-colored highlights on a single article.
- [ ] Recoloring an existing highlight updates that highlight only.
- [ ] `prefers-reduced-motion: reduce` disables the swipe animation.
- [ ] Dark mode highlights are legible (no text fighting fill; tested against all four colors).
- [ ] Zero console errors from `data-color` attribute missing or unrecognized values.
- [ ] Legacy `"green"` color strings present in user DBs render as Classic — no exceptions, no empty marks.

---

## 9. Open questions

1. **Rename "Dark" to "Ink" or "Mono"?** "Dark" is confusing next to dark mode. The color is really "high-contrast ink that flips polarity with theme." Light rename, no impact to the `value` string.
2. **Do we preserve the existing `data-has-note="true"` wavy-underline variant?** Current behavior: highlights with notes hide the background and show a wavy underline. Keep for all four colors, or let noted highlights keep their color fill? My lean: preserve wavy-underline for noted highlights regardless of color — the affordance of "this one has a note" is more important than the color distinction.
3. **Import path color for highlights created via the Chrome extension** — see §7. Needs a one-minute grep to confirm whether this path exists.
4. **Lazy rewrite of `"green"` → `"classic"`** — ship now or defer? My lean: defer. Resolver handles it; no pressure.

---

## 10. What I'd change FIRST (TL;DR for the "what do I touch first" question)

Phase 1 is deliberately the smallest, safest change:

1. `src/types/index.ts` — add `HighlightColor` type + `KNOWN_COLORS`.
2. `src/lib/` (new file `highlight-colors.ts`) — add `resolveHighlightColor()`.
3. `src/hooks/useHighlights.ts:84-87` — set `data-color` on the `<mark>` using the resolver.
4. Tests for the resolver.

**No CSS, no UI, no data changes.** If anything in later phases goes wrong, the resolver + `data-color` attr are harmless to leave in place. This is the backward-compat foundation: everything downstream assumes `data-color` is always present and always valid, and Phase 1 makes that true for 100% of existing and future highlights before we change a single pixel.
