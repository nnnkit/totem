# Code Style

## Components

- Props for each component must be declared in a named `interface Props` above the component.
  - For files with multiple components, the main exported component uses `Props`; internal helper components use `[ComponentName]Props`.
- Do not use inline prop type annotations (e.g. `{ foo }: { foo: string }`).
- Do not add comments to components unless the logic is non-obvious. Avoid section label comments like `{/* Header */}` or `{/* Footer */}`.

## Styling

- Do not hardcode widths, font sizes, or other sizing values with arbitrary pixel values (e.g. `w-[347px]`, `text-[13px]`). Use Tailwind's built-in scale tokens instead (e.g. `w-80`, `text-sm`).
