# Totem Website + Demo Architecture Plan

Date: 2026-02-28

## Objective

Build a public website that:

1. Explains Totem clearly for users and Chrome Web Store reviewers.
2. Includes required policy/support pages.
3. Shows a live, interactive "New Tab" demo.
4. Reuses extension UI components so we do not maintain two UI implementations.

## Soul Alignment

From `soul.md`, this site and demo must reinforce:

- Visibility over friction
- Reading over scrolling
- Calm over addiction loops
- Utility over novelty

The website should present Totem as a calm reading surface, not a social feed clone.

## Core Decision

Use one shared UI layer and two runtimes:

- Extension runtime (current): real auth, real sync, real storage, real X data.
- Demo runtime (new): fixture bookmarks + local browser storage + no Chrome APIs.

### What is shared

- `NewTabHome`
- `BookmarksList`
- `BookmarkReader`
- Reader/tweet rendering components
- Design tokens and core styles

### What is runtime-specific

- Auth/sync providers (`useAuth`, `useBookmarks`)
- Chrome-only APIs (`chrome.runtime`, permissions, topSites)
- Network-backed detail resolution

## Implementation Pattern

### 1. Keep extension app behavior unchanged

`newtab.html` + existing `src/main.tsx` / `src/App.tsx` remain the production extension path.

### 2. Add a demo runtime entry

Create `website/demo.html` with `website/src/demo/main.tsx` that composes shared UI components with dummy data and local interactions.

### 3. Inject detail resolver into reader

Add optional resolver prop to `BookmarkReader` so demo mode can provide local detail data instead of calling `chrome.runtime.sendMessage`.

This keeps reader UI shared while decoupling transport.

### 4. Build website as static multi-page app

Add static pages:

- `website/index.html` (landing)
- `website/privacy.html` (policy for Chrome Web Store)
- `website/support.html` (support + troubleshooting)
- `website/demo.html` (interactive extension preview)

Landing embeds `demo.html` in a browser-frame section with tab-like controls.

## Build/Deploy Strategy

Use Vite multi-entry build so one build emits extension + website assets:

- `newtab.html` for extension package
- public website pages for deployment

Result: one repository, one shared component set, one deployment pipeline.

## Change Propagation Guarantee

When shared components change, both extension and demo update automatically because both import the same component modules.

No duplicated rendering layer is introduced.

## Phase Plan

1. Foundation
- Add website/demo entries and multi-entry build config.
- Add reader resolver injection point.

2. Experience
- Implement fixture-driven demo runtime.
- Build landing page with embedded tabbed preview.

3. Compliance
- Add privacy/support pages with explicit permissions/data handling.

4. Validation
- Run tests/build.
- Manual smoke checks for `newtab.html`, `website/demo.html`, `website/index.html`, `website/privacy.html`, `website/support.html`.

## Risks and Mitigations

1. Chrome API assumptions crash website runtime
- Mitigation: only extension runtime uses auth/sync hooks; demo runtime avoids chrome-bound APIs.

2. Component drift between extension and demo
- Mitigation: demo imports the same components directly (no duplicated UI markup).

3. Website styles conflict with extension styles
- Mitigation: isolate landing page styles under `site-*` class namespace.

## Follow-up Enhancements

- Introduce a formal runtime adapter interface for auth/bookmarks/settings to eventually share more orchestration logic with `App.tsx`.
- Add visual snapshot tests for demo and extension surfaces to catch UI drift.
- Add analytics only on website pages (never extension runtime), if needed.
