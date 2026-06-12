# Totem

A Chrome extension that replaces your new tab with a calm reading queue built from your X (Twitter) bookmarks. No servers, no passwords, local-first.

## Project structure

```
.                   # Root workspace — the Chrome extension
  src/              # Extension source (React + Vite)
  apps/
    site/           # Marketing website + interactive demo (@totem/site, Astro)
  packages/
    x-twitter-extension-core/  # Shared X/Twitter extension primitives
  scripts/          # Build, release, and packaging scripts
```

Workspace packages:

| Workspace | Name | Purpose |
|-----------|------|---------|
| `.` | `totem` | Chrome extension (new tab page) |
| `apps/site` | `@totem/site` | Public website with live demo |
| `packages/x-twitter-extension-core` | `@make/x-twitter-extension-core` | Shared auth, URL parsing, and GraphQL query-id primitives |

The website (Astro) renders blog posts statically and uses React islands for interactive surfaces (the demo, etc.). Interactive components import from the extension's `src/` via relative paths so both targets share one rendering layer.

## Getting started

```sh
pnpm install
```

### Development

```sh
pnpm dev              # Extension dev server (Vite)
pnpm --filter @totem/site dev   # Website dev server
```

### Building

```sh
pnpm build:extension   # tsc + vite build for the extension
pnpm build:website     # Astro build for the website
pnpm build:all         # Both
```

### Packaging

```sh
pnpm package:extension   # Build + zip the extension
pnpm package:website     # Build + zip the website
pnpm package:all         # Both
```

### Testing

```sh
pnpm test              # Run all tests (vitest)
pnpm ci:verify         # Run tests, extension build, core typecheck, and site checks
```

### Releasing

```sh
pnpm ship              # Patch release
pnpm ship:minor        # Minor release
pnpm ship:major        # Major release
```

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS 4, Base UI
- Zustand (state), IndexedDB via `idb` (local storage)
- Vitest (tests)
