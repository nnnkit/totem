# Code Style

## Components

- Props for each component must be declared in a named `interface Props` above the component.
  - For files with multiple components, the main exported component uses `Props`; internal helper components use `[ComponentName]Props`.
- Do not use inline prop type annotations (e.g. `{ foo }: { foo: string }`).
- Do not add comments to components unless the logic is non-obvious. Avoid section label comments like `{/* Header */}` or `{/* Footer */}`.

## Styling

- Do not hardcode widths, font sizes, or other sizing values with arbitrary pixel values (e.g. `w-[347px]`, `text-[13px]`). Use Tailwind's built-in scale tokens instead (e.g. `w-80`, `text-sm`).
- Use `size-N` instead of `w-N h-N` for square elements.
- Use Tailwind classes instead of inline `style` attributes where possible (e.g. `max-h-96` not `style={{ maxHeight: 400 }}`).

## Border Radius

Follow the squarish border-radius scale:
- `rounded-xl` (12px): Large containers — modals, media, author cards, quotes
- `rounded-lg` (8px): Buttons, inputs, cards, bookmark items, popovers, link cards, code blocks
- `rounded-md` (6px): Pills, badges, small controls, toggle groups, stat boxes
- `rounded-full`: **Only** avatars, toggle switch tracks/thumbs, spinners

Never use `rounded-2xl`, `rounded-3xl`, or arbitrary radius values in components.

## Typography

- Never add `tracking-wider` or `tracking-tight` unless explicitly requested.
- Add `text-balance` to headings and `text-pretty` to body text.
- Add `tabular-nums` to numeric data (counts, stats, times).

## Color Tokens

- The accent color token is `accent` (not `x-blue`). Use `text-accent`, `bg-accent`, `border-accent`, `ring-accent/40`, `focus:border-accent`.
- Semantic color tokens: `x-bg`, `x-card`, `x-border`, `x-text`, `x-text-secondary`, `x-hover`, `x-link-card`.

## Interactions

- Use inline confirmation (Cancel/Confirm buttons) instead of `window.confirm` for destructive actions.
- Empty states should include one clear action button.
- Do not use `hover:scale-*` on buttons. Use `transition-colors` for hover feedback. The global `button:active { scale(0.97) }` provides press feel.

## Animations

- All custom animations use compositor-only properties (transform + opacity).
- Entrances: ~200ms with ease-out-quint `cubic-bezier(0.23, 1, 0.32, 1)`.
- Exits: ~150ms with `ease-in`. Exits are 20% faster than entrances.
- `prefers-reduced-motion: reduce` is handled globally in `index.css`.
- Z-index scale: `z-10` sticky | `z-20` nav | `z-30` popover | `z-40` overlay | `z-50` modal.
