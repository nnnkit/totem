# Plan: Multi-color highlights with marker-style rendering

> Source PRD: [`plans/highlight-colors-prd.md`](./highlight-colors-prd.md)
> Prototype: [`marker-highlight-test.html`](../marker-highlight-test.html) (repo root — delete in Phase 6)

This plan is structured as tracer-bullet vertical slices. Each phase is independently mergeable, backward-compatible on its own, and has explicit entry/exit criteria for a loop/ralph-style agent to tick off.

Work through phases top-down. **Do not skip ahead** — each phase assumes the previous one has landed.

---

## Architectural decisions

These are fixed across all phases. Do not reopen unless the PRD changes.

- **Data model**: `Highlight.color: string` exists in `src/types/index.ts` and stays exactly as-is. No Dexie version bump. No migration. Legacy values are handled at the render boundary via a resolver.
- **Canonical color values on disk** going forward: one of `"classic" | "yellow" | "mint" | "dark"`. Anything else (including the historical `"green"`) is treated as `"classic"` by the resolver — never rejected, never crashed.
- **DOM contract**: every highlight `<mark>` carries `class="totem-highlight" data-color="<one of four known values>"` and, when freshly created, `data-fresh="true"`. The `data-color` attribute is the single source of truth for CSS styling. The `data-fresh` attr self-clears on `animationend`.
- **Render scoping**: color rules are scoped to `mark.totem-highlight[data-color="X"]`, not to a parent article element. Colors mix freely within a page.
- **Theme scoping**: dark-mode variants live under `[data-theme="dark"] mark.totem-highlight[data-color="X"]`. The "Dark" color inverts polarity with theme (black fill / white text in light; off-white fill / dark text in dark).
- **Motion**: swipe-on animation plays on creation only, keyed by `data-fresh="true"` + a CSS `@keyframes`. Disabled under `prefers-reduced-motion: reduce`.
- **Picker pattern**: split-button (primary Highlight + caret) in `SelectionToolbar`. Color row in `HighlightPopover` for recoloring. Header swatch + popover as the persistent session-default indicator.
- **State**:
  - **Session default color** = in-memory state in the reader store. Seeded from user pref on reader open. Updates when the user picks a color anywhere (caret, header swatch).
  - **User global default** = persisted user preference, reused via the existing prefs machinery (see `useTheme.ts` pattern for the shape).
- **Chrome extension**: out of scope. Only guardrail — any code path that creates a `Highlight` record through the extension must write `"classic"` (not `"green"`, not empty). Verify in Phase 1.

---

## Phase 1: Foundation — resolver + `data-color` attribute

**User stories covered**: §5 backward compatibility (renderer reads any string safely), §4.1 palette values defined as a type.

**Entry criteria**: none (this is the starting phase).

### What to build

Land the invariants that every later phase assumes, with zero visible change for the user. When this phase is merged, every `<mark>` element in the reader DOM must already carry a valid `data-color` attribute — including for highlights that were written long before this feature and have `color: "green"` stored on disk.

This is prep, not feature. Nothing on screen should look different. If it does, the phase is wrong.

### Scope

- Define `HighlightColor` type and `KNOWN_COLORS` constant.
- Implement `resolveHighlightColor(raw: string | undefined): HighlightColor` — maps any unknown/empty value to `"classic"`.
- Thread the resolver through the mark-creation path so every `<mark>` gets `data-color={resolveHighlightColor(h.color)}`.
- Verify the Chrome extension does not create highlight records with `color: "green"` (grep for `Highlight` / `color:` in `src/content/` and any extension background script). If it does, have it use `"classic"`.
- No CSS change in this phase. Existing `.totem-highlight` rule continues to render every highlight in the current flat coral.

### Acceptance criteria

- [ ] Inspecting any highlight in a running reader shows `data-color="classic"` (or another known value) on the `<mark>` element — including highlights that have `color: "green"` in IndexedDB.
- [ ] Unit tests for the resolver pass for: empty string, `undefined`, `"green"`, `"unknown-xyz"`, each of the four known values.
- [ ] No visible change in the reader vs. `main`.
- [ ] No console errors or warnings introduced.
- [ ] Any extension-side highlight creation writes `color: "classic"` (documented or verified absent).

### Exit criteria (merge gate)

- All acceptance criteria met.
- Tests green in CI.
- A second developer (or the next phase) can assume: "every `<mark>` in the reader has a valid `data-color` attr." No further defensive checks needed downstream.

---

## Phase 2: Classic-only marker rendering

**User stories covered**: §4.1 rendering technique, §4.7 motion (baseline wiring — full swipe comes in Phase 3), §5 visual backward compat upgrade.

**Entry criteria**: Phase 1 merged. Every `<mark>` has `data-color`. Resolver in place.

### What to build

Replace the flat coral `--highlight-bg` treatment with the hand-drawn gradient marker look, for the `"classic"` color only. Every existing highlight (which now resolves to `"classic"`) picks up the upgraded look automatically. No picker, no other colors, no color changes possible — just the visual upgrade.

The creation-time flash animation (`totem-highlight-new` class in `useHighlights.ts`) is the obvious place to plumb the new swipe keyframe, but Phase 3 adds the `data-fresh` mechanism properly. In Phase 2, reuse or upgrade the existing flash — the point is new look, not new motion machinery.

### Scope

- Add CSS rules for `mark.totem-highlight[data-color="classic"]` using the gradient from the prototype. Light + dark variants.
- Remove (or scope down) the old flat `--highlight-bg` rule. Keep `--highlight-bg` CSS variables defined if other parts of the app reference them for non-mark purposes — grep to confirm.
- Preserve the existing `data-has-note="true"` wavy-underline treatment. Note-highlights keep their special rendering regardless of color (see PRD §9 open question — default answer: preserve).
- Preserve hover / active flash states visually in the new gradient style.

### Acceptance criteria

- [ ] Every existing highlight in the reader renders with the new gradient marker look in light mode.
- [ ] Same highlights render correctly in dark mode with the dark-mode override.
- [ ] Multi-line highlights wrap cleanly — each line gets its own swipe via `box-decoration-break: clone`.
- [ ] Note-highlights (if the `data-has-note` variant exists) still show the wavy-underline, not a solid fill.
- [ ] Hover / click flash still works visually (even if slightly different from the old flat look).
- [ ] Visual regression snapshot (if you have one) updated or reviewed; no unintended collateral on surrounding text.

### Exit criteria

- All acceptance criteria met.
- No other mark colors render correctly yet — any accidental `data-color="yellow"` mark would render as unstyled default background. That's acceptable since no code writes non-classic values until Phase 3.

---

## Phase 3: Picker in SelectionToolbar + four-color rendering + swipe-on

**User stories covered**: §4.1 full palette, §4.2 selection flow (split-button), §4.3 session default (in-memory), §4.7 motion (swipe-on creation).

**Entry criteria**: Phase 2 merged. Classic renders as the new marker.

### What to build

Users can now create highlights in any of the four colors from the selection toolbar, using the split-button pattern (primary button + caret → mini palette). Picking a color via the caret does two things: creates the highlight in that color *and* updates an in-memory session default so the primary button uses that color next time. The swipe-on animation plays once on creation, then settles.

This is the first phase where `Highlight.color` on disk takes a non-`"classic"` value for new highlights.

### Scope

- Add CSS rules for `mark.totem-highlight[data-color="yellow"]`, `[data-color="mint"]`, `[data-color="dark"]`, each with light + dark variants (from the prototype).
- Add `data-fresh="true"` + CSS keyframe `@keyframes marker-swipe` with `cubic-bezier(0.22, 1, 0.36, 1)` ~720ms.
- Clear `data-fresh` on `animationend`.
- Honor `@media (prefers-reduced-motion: reduce)` — skip animation.
- Refactor the selection-toolbar component to the split-button layout. Primary button shows the current session default as a small dot. Caret toggles a palette popover with four dots.
- Introduce `sessionDefaultColor` in the reader store (in-memory, not persisted). Seed with `"classic"` for now; Phase 5 will seed from user pref.
- Extend the highlight-create callback signature to accept a color. Default still resolves to session default if omitted.
- Picking a color from the caret: sets session default AND creates the highlight in that color.

### Acceptance criteria

- [ ] User can select text, click caret, pick Yellow → a yellow highlight is created and persisted.
- [ ] `Highlight.color` in IndexedDB for that new highlight is the literal string `"yellow"`.
- [ ] Swipe-on animation plays once per creation, then the highlight is static on subsequent renders.
- [ ] Session default indicator (dot on the primary button) updates to match the last-picked color.
- [ ] Clicking the primary Highlight button (no caret) creates a highlight in the session default.
- [ ] All four colors render correctly in both light and dark mode.
- [ ] `prefers-reduced-motion: reduce` disables the animation; the highlight still appears, just instantly.
- [ ] Closing and reopening the article: session default resets to `"classic"` (no persistence yet; that's Phase 5).

### Exit criteria

- All acceptance criteria met.
- No regression in single-color creation (default path still works).
- Split-button is keyboard-accessible (tab to primary, tab to caret, enter/space to activate).

---

## Phase 4: Recolor existing + header swatch

**User stories covered**: §4.4 header swatch, §4.5 edit existing highlight.

**Entry criteria**: Phase 3 merged. Users can create highlights in any color.

### What to build

Close the editing loop: let users recolor existing highlights from the `HighlightPopover`, and give them a persistent visual indicator of the current session default in the reader header. The header swatch opens the same palette popover — it's a second entry point to change the session default from outside a selection context.

### Scope

- Extend `HighlightPopover` with a row of four color dots. The currently-selected color is marked pressed. Picking a color updates the highlight's `color` field in IndexedDB.
- On recolor, the target `<mark>` element's `data-color` attr updates in the DOM. No swipe animation (that's creation-only).
- Add the header swatch button to the reader chrome. The swatch shows the current session default color as a round dot. Click opens a palette popover identical in shape to the caret popover.
- Picking a color from the header swatch updates the session default but does NOT create or modify any highlight.
- Extract the palette popover into a shared component used by the caret, the header swatch, and the highlight-popover color row. All three consume the same color list and the same dot-rendering.

### Acceptance criteria

- [ ] Clicking an existing highlight opens the popover. Popover shows four color dots with the current color pressed.
- [ ] Picking a different color updates the `<mark>`'s fill immediately (no reload required) and persists `Highlight.color` in IndexedDB.
- [ ] Recolor does NOT animate (no swipe replay).
- [ ] Header swatch is visible in the reader chrome, shows the session default.
- [ ] Clicking the header swatch opens a palette; picking a color updates the session default (primary Highlight button's dot reflects it).
- [ ] Changing the session default from the header does not affect any existing highlights.
- [ ] The palette popover component is shared across all three entry points (no duplicated dot markup).

### Exit criteria

- All acceptance criteria met.
- Theme switch while a color is selected updates all dot indicators correctly (e.g. Dark color's dot flips from black to cream in dark theme).

---

## Phase 5: Global default color in settings

**User stories covered**: §4.6 default highlight color in settings.

**Entry criteria**: Phase 4 merged. Session default works everywhere in the reader.

### What to build

A persistent user preference for the default highlight color. Applied on reader open as the initial session default. Users can change it in the existing Settings surface under the reading-related section. Follow the same prefs pattern used by `useTheme` or equivalent.

### Scope

- Add `defaultHighlightColor` to the user preferences schema. Default: `"classic"`.
- Surface the preference in the Settings UI — reuse the palette popover component or a simpler radio-style picker, whichever matches the existing settings style.
- On reader mount, seed `sessionDefaultColor` in the store from this preference.
- Updating the preference updates the session default for the currently-open reader as well.

### Acceptance criteria

- [ ] Settings shows a "Default highlight color" field with four options.
- [ ] Changing the pref persists across reload.
- [ ] Opening a new reader session (e.g. navigating to a different article) starts with the pref'd color as session default.
- [ ] Changing the pref while a reader is open updates its session default live (don't require a refresh).
- [ ] First-time users see `"classic"` as the default (matching current brand coral).

### Exit criteria

- All acceptance criteria met.
- No regression in other preferences.
- Settings reads cleanly when the pref is absent (e.g. pre-feature users): falls back to `"classic"`.

---

## Phase 6: Cleanup + lazy data normalization

**User stories covered**: ops / hygiene (not in PRD §4 proper — §5.3 deferred item).

**Entry criteria**: Phase 5 merged. Feature is fully shipped.

### What to build

Remove prototype artifacts and — optionally — normalize legacy `"green"` values on the disk lazily. The resolver has been handling these at render time since Phase 1, so this is pure hygiene and can be skipped if risk budget is tight.

### Scope

- Delete `marker-highlight-test.html` from the repo root.
- Delete any temporary shims from Phase 1 that are no longer needed (most likely nothing — the resolver stays).
- **Optional**: Add a one-shot "lazy rewrite" at the highlight-read boundary: if `h.color` is `"green"` (or any unknown), write back `"classic"` to IndexedDB on next save. No forced batch rewrite.
- **Optional**: Review the `--highlight-bg` / `--highlight-bg-hover` / `--highlight-underline` CSS variables; if no code references them anymore, delete.
- Internal docs / changelog entry if the project has one.

### Acceptance criteria

- [ ] `marker-highlight-test.html` no longer exists in the repo.
- [ ] (Optional) `"green"` highlights are rewritten to `"classic"` as users interact with them, or decision is made to defer this indefinitely.
- [ ] (Optional) Unused CSS variables removed.
- [ ] No dead imports or unused utilities left behind.

### Exit criteria

- Repo is clean; nothing references the prototype; no TODO comments from the feature work remain.

---

## Global success criteria (across all phases)

These are the PRD §8 criteria restated as a cross-cutting checklist. Verify after Phase 5.

- [ ] Every pre-existing highlight renders without visual artifacts after the upgrade.
- [ ] Users can create four distinctly-colored highlights on a single article.
- [ ] Recoloring an existing highlight updates that highlight only (no cross-contamination).
- [ ] `prefers-reduced-motion: reduce` disables the swipe animation.
- [ ] Dark mode highlights are legible (text doesn't fight fill; tested against all four colors).
- [ ] Zero console errors from `data-color` attribute missing or unrecognized values.
- [ ] Legacy `"green"` color strings render as Classic — no exceptions, no empty marks.

---

## Loop runner notes

For a ralph/loop-style agent working through this plan:

- **Start at Phase 1.** Don't touch Phases 2+ until Phase 1's exit criteria are all met.
- **One phase per PR** (or per commit if solo). Never combine phases.
- **Acceptance criteria are the test specs.** If you can't write a test (or a manual verification step) for a criterion, it's too vague — ask before proceeding.
- **Backward compat is non-negotiable.** If any phase breaks existing highlights, stop and redesign the phase — don't paper over with a migration.
- **When stuck, re-read §5 of the PRD.** The resolver handles every edge case the DB can throw at us; most "uh-oh" moments will resolve to "let the resolver do it."
