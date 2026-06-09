---
title: "Improve light-mode color contrast without losing calm"
date: "2026-06-09"
category: design-patterns
module: "Light mode color system"
problem_type: design_pattern
component: theme_tokens
severity: medium
applies_when:
  - "Reviewing light-mode readability in the Reading list or new-tab home"
  - "Changing Totem color tokens, row surfaces, metadata text, or quiet controls"
  - "Adapting document-style color principles to product UI"
  - "Checking whether a calm interface has become too low-contrast"
related_components:
  - "src/index.css"
  - "src/components/BookmarksList.tsx"
  - "src/components/NewTabHome.tsx"
  - "Chrome extension screenshots"
tags:
  - light-mode
  - contrast
  - color-system
  - readability
  - kami-inspired
  - reading-list
---

# Improve light-mode color contrast without losing calm

## Context

The light-mode Reading list can look washed out even though dark mode feels right. The issue is not the base theme token by itself:

```css
--surface: #F5F5F5;
--surface-alt: #EFEFEF;
--foreground: #1A1A1A;
--muted: #6B6B6B;
--border: #DCDCDC;
```

Full `--muted` is readable on `--surface`, but the UI often applies opacity to it. In light mode, `text-muted/50`, `text-muted/45`, and `text-muted/40` turn useful metadata and real controls into pale gray shapes.

Approximate contrast on `#F5F5F5`:

| Pair | Ratio | Meaning |
|---|---:|---|
| `--foreground` on `--surface` | `15.96:1` | Primary titles are fine |
| `--muted` on `--surface` | `4.89:1` | Small secondary text is barely acceptable |
| `text-muted/80` on `--surface` | `3.30:1` | Useful for large or non-critical labels only |
| `text-muted/50` on `--surface` | `1.99:1` | Too weak for metadata |
| `text-muted/45` on `--surface` | `1.84:1` | Controls look disabled |
| `text-muted/40` on `--surface` | `1.70:1` | Section labels and counts disappear |
| `--surface-alt` against `--surface` | `1.05:1` | Alternating rows are barely perceptible |

## Problem Areas

In `src/components/BookmarksList.tsx`, the most visible problems are:

- Row metadata uses `text-muted/50`; subtitles, separators, and annotation wrappers use `text-muted/40`.
- Today's Read action icons use `text-muted/45`, so Snooze, Archive, Act on this, and Pin read like disabled controls in light mode.
- `Action needed` and `Handled today` section labels and counts use `text-muted/40`, weakening the page structure.
- Alternating row backgrounds rely on `#EFEFEF` over `#F5F5F5`, which is too subtle to carry list grouping by itself.
- The Reading-list search placeholder uses `placeholder:text-muted/50`, which is weaker than a searchable input should be.

In `src/components/NewTabHome.tsx`, the card is better overall, but a few supporting elements are near the edge:

- `--color-home-placeholder: rgba(10, 10, 12, 0.36)` is around `2.4:1` on the light search card.
- `text-home-description/80` is around `3.5:1` on a white card.
- `--color-home-fg-muted: rgba(10, 10, 12, 0.54)` is around `4.23:1`; acceptable, but fragile at `text-xxs`.

## Kami-Inspired Direction

Kami's design system is a document system, not Totem's UI system, so do not copy the full aesthetic. The useful principles are:

- Use a warm paper-like canvas instead of sterile neutral gray.
- Define a small set of solid text tiers: primary, secondary, subtext, metadata.
- Keep the accent sparse and purposeful.
- Use warm neutrals for rhythm; avoid cool or equal-channel grays where possible.
- Do not build hierarchy by repeatedly applying opacity to an already-muted token.
- Prefer solid tint tokens for badges and quiet surfaces instead of arbitrary alpha stacks.
- Use low contrast only for decoration, never for text the user must parse or controls the user must recognize.

Kami's transferable model is:

```css
--near-black: #141413; /* primary */
--dark-warm:  #3d3d3a; /* secondary */
--olive:      #504e49; /* descriptions */
--stone:      #6b6a64; /* metadata */
```

For Totem, keep the existing warm peach accent rather than switching to Kami's ink blue. The inspiration is the hierarchy, not the hue.

## Totem Light-Mode Proposal

Consider moving light mode toward explicit semantic tiers:

```css
--surface: #F6F3ED;       /* warmer page canvas */
--surface-alt: #EAE3D8;   /* visible alternating row / grouped surface */
--surface-card: #FFFCF7;  /* lifted card/search surface */
--surface-hover: #EEE8DF; /* hover surface with visible movement */

--foreground: #171512;    /* primary text */
--secondary: #3F3B35;     /* row secondary titles */
--subtle: #57524A;        /* metadata and search snippets */
--muted: #6F685F;         /* default secondary UI text */
--faint: #827A6F;         /* section labels and quiet counts */
--control-muted: #746C61; /* available icon controls */
--placeholder: #847B70;   /* input placeholders */
--border: #DED6C8;
--border-soft: #E8E1D5;
```

The exact values can change during visual QA, but the contract should stay stable:

- Primary text targets at least `10:1` on the page surface.
- Secondary and metadata text should generally stay at or above `4.5:1` when rendered at `12-14px`.
- Placeholder text and disabled controls may be lower, but should not be reused for live metadata or available actions.
- Action icons that are always available should use a solid semantic text tier, not `text-muted/40`.
- Active/important badges may use the accent, but the accent should stay sparse. Totem's peach should signal focus, not decorate every row.
- Alternating rows should be perceptible without making the page striped. If the surface difference cannot reach useful contrast, use a warm divider instead.

## Implementation Guidance

Do this as a small light-mode contrast pass, not a redesign:

1. Add semantic light-mode text tokens before changing many components: `--secondary`, `--subtle`, and possibly `--faint`.
2. Replace readable `text-muted/40-60` usages in the Reading list with semantic tokens.
3. Keep true decorative separators quiet, but make section labels, counts, metadata, and controls legible.
4. Strengthen row grouping through warmer `--surface-alt`, clearer row dividers, or a dedicated row surface token.
5. Raise placeholder contrast for search inputs without making placeholder text compete with entered text.
6. Leave dark-mode tokens unchanged unless visual QA shows a regression.
7. Verify with screenshots in both modes and at least one contrast check for small metadata text.

Avoid these fixes:

- Do not make every label `text-foreground`; that removes hierarchy.
- Do not use pure white page backgrounds to gain contrast; Totem should remain calm and warm.
- Do not introduce Kami's ink blue as a second accent. Totem already has peach, green success, and product-specific color semantics.
- Do not solve light mode by adding heavy shadows or stronger card chrome.
- Do not lower opacity further in dark mode to match light mode; dark mode is already working.

## Useful Review Checklist

Before shipping a light-mode color change, inspect:

- Reading-list title, metadata, author handle, and subtitle in one row.
- Today's Read row action icons before hover.
- `Action needed` and `Handled today` labels, counts, item labels, and Undo buttons.
- Reading-list search placeholder and command key hint.
- New-tab search placeholder.
- New-tab card title, excerpt, author, footer buttons, and keyboard hints.
- At least one dark-mode screenshot to confirm the change did not flatten dark mode.

## Related

- Inspiration: Kami color principles from `/Users/ankit/.agents/skills/kami/references/design.md`
- Screenshot workflow: `docs/extension-screenshot-workflow.md`
- Current light tokens: `src/index.css`
- Main affected UI: `src/components/BookmarksList.tsx`
- New-tab affected UI: `src/components/NewTabHome.tsx`
