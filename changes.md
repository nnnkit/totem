# Production Readiness Audit

A comprehensive review of every file, line-by-line, with suggestions organized by priority and category.

Each issue is cross-referenced against [Vercel React Best Practices](https://vercel.com/blog) where applicable. Vercel rule citations are shown as **`[V: rule-name]`**.

---

## 1. Critical / Security Issues

### 1.1 XSS via `dangerouslySetInnerHTML`
- **Files:** `src/components/reader/TweetText.tsx:32`, `TweetArticle.tsx:39-41,55-57,129,139,151,163,175,184`, `utils.ts:188-221`
- **Issue:** `linkifyText()` and `renderBlockInlineContent()` build raw HTML from user-generated tweet/article content and inject via `dangerouslySetInnerHTML`. While `escapeHtml()` is applied, the URL regex in `linkifyText()` at `utils.ts:194` does not validate the protocol — a crafted tweet containing `javascript:alert(1)` in a URL-like position could bypass it.
- **Fix:** Validate that all href values start with `https://` or `http://` before inserting into `<a>` tags. Add a `sanitizeUrl()` helper.

### 1.2 Content script injects raw JS into the page
- **File:** `public/content/detect-user.js:72-202`
- **Issue:** The `injectMutationHook()` function builds a `<script>` tag via string concatenation with `script.textContent`. While the current content is static, this pattern is fragile. If any dynamic value (like `MESSAGE_SOURCE`) were to contain user-controlled data in the future, it would be a direct XSS vector.
- **Fix:** Consider using a separate JS file loaded via `chrome.scripting.executeScript` or a `web_accessible_resource` to avoid inline script injection.

### 1.3 No CSP meta tag in `newtab.html`
- **File:** `newtab.html`
- **Issue:** No Content-Security-Policy meta tag. The extension's manifest v3 provides some CSP, but an explicit CSP in the HTML would harden the new tab page.
- **Fix:** Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src https: data:; style-src 'self' 'unsafe-inline'; connect-src https://x.com https://www.bing.com">`.

---

## 2. Architecture / Structure Issues

### 2.1 Massive `App.tsx` — too many responsibilities
- **File:** `src/App.tsx` (321 lines)
- **Issue:** App.tsx manages routing (home/library/reader), search, focused index, unbookmarking, export, header messages, settings modal, and shuffle seed all in one component. This is hard to test and maintain.
- **Fix:** Extract the "library" view into its own `BookmarkLibrary.tsx` component. Move `handleUnbookmark`, `exportApiDocs`, and header message logic into custom hooks or a context.

### 2.2 Dead/unused components
- **Files:** `src/components/BookmarkStack.tsx`, `src/components/BookmarkSwiper.tsx`, `src/components/BookmarkFilmstrip.tsx`
- **Issue:** These three components are not imported or used anywhere in the app. `NewTabHome.tsx` has its own inline card rendering. These are dead code.
- **Fix:** Either remove them or integrate them as selectable widget styles controlled by `settings.widgetStyle`.

### 2.3 Duplicated `previewText()` function
- **Files:** `BookmarkStack.tsx:14-18`, `BookmarkSwiper.tsx:14-18`, `BookmarkFilmstrip.tsx:14-18`
- **Issue:** Identical `previewText()` function defined in three files. Also very similar to `compactPreview()` in `src/lib/text.ts:28-32`.
- **Fix:** Remove the duplicated functions and import `compactPreview` from `src/lib/text.ts`.

### 2.4 Duplicated helper functions in `useWallpaper.ts`
- **File:** `src/hooks/useWallpaper.ts:39-46`
- **Issue:** `toRecord()` and `toString()` duplicate `asRecord()` and `asString()` from `src/lib/json.ts`.
- **Fix:** Import from `src/lib/json.ts` instead of redefining.

### 2.5 Duplicated `hasChromeStorageSync` / `hasChromeStorageOnChanged`
- **Files:** `src/hooks/useSettings.ts:17-23`, `src/hooks/useTheme.ts:8-14`
- **Issue:** Both hooks define identical chrome storage availability checks.
- **Fix:** Extract to a shared `src/lib/chrome.ts` utility.

### 2.6 Duplicated `parseTwidUserId` across service worker and content script
- **Files:** `public/service-worker.js:86-111`, `public/content/detect-user.js:6-31`
- **Issue:** Acknowledged in comments but still a maintenance risk. If one is updated the other must be too.
- **Fix:** Consider a shared snippet or build step that generates both from a single source.

### 2.7 No error boundary
- **File:** `src/main.tsx`
- **Issue:** No React error boundary wrapping the app. An unhandled error in any component will white-screen the new tab page.
- **Fix:** Add a top-level `<ErrorBoundary>` component that shows a fallback UI.

### 2.8 `SettingsModal` rendered in 3 places
- **File:** `src/App.tsx:188-197, 214-223, 241-249`
- **Vercel:** **`[V: 6.3 Hoist Static JSX Elements]`** — identical JSX recreated in three branches instead of being hoisted once.
- **Issue:** `<SettingsModal>` is rendered identically in the reader view, home view, and library view. If it unmounts/remounts when switching views, it loses focus state.
- **Fix:** Render `<SettingsModal>` once at the top level of App, outside the conditional view branches.

### 2.9 Barrel file re-exports *(NEW)*
- **File:** `src/api/twitter.ts`
- **Vercel:** **`[V: 2.1 Avoid Barrel File Imports]`** — barrel files force the bundler to load all re-exported modules even if only one is used.
- **Issue:** `src/api/twitter.ts` is a pure barrel file that re-exports everything from `./messages` and `./parsers`. Every import from `"../api/twitter"` pulls in both modules regardless of what's used. While Vite's tree-shaking mitigates this at build time, it slows down dev HMR and increases module graph complexity.
- **Fix:** Import directly from `src/api/messages` or `src/api/parsers` where needed, then remove the barrel file.

---

## 3. Performance Issues

### 3.1 `NewTabHome` re-derives all items on every clock tick
- **File:** `src/components/NewTabHome.tsx:186-199`
- **Vercel:** **`[V: 5.3 Narrow Effect Dependencies]`** — `now` is a full `Date` object that updates every 30s, but `formatSavedLabel` only needs a minute-granularity timestamp.
- **Issue:** `items` memo depends on `now`, which updates every 30 seconds. This recomputes `formatSavedLabel()` for every bookmark every 30s. For large bookmark sets this is wasteful.
- **Fix:** Separate the `savedLabel` computation or memoize at the item level. Alternatively, only pass `now.getTime()` rounded to the nearest minute.

### 3.2 Progress tick runs at 50ms intervals
- **File:** `src/components/NewTabHome.tsx:33,388-399`
- **Vercel:** **`[V: 5.7 Use Transitions for Non-Urgent Updates]`** — progress bar state updates are non-urgent and should not block the UI. Also **`[V: 7.1 Batch DOM CSS Changes]`** — a CSS animation would avoid all React re-renders.
- **Issue:** `PROGRESS_TICK_MS = 50` means `setProgressMs` fires 20 times per second, causing re-renders. For a progress bar this is excessive.
- **Fix:** Use CSS animations or `requestAnimationFrame` for the progress bar instead of React state updates. Or increase tick to 200-500ms.

### 3.3 `useKeyboardNavigation` recreates handler on every dependency change
- **File:** `src/hooks/useKeyboard.ts:23-97`
- **Vercel:** **`[V: 8.1 Store Event Handlers in Refs]`** and **`[V: 8.2 useLatest for Stable Callback Refs]`** — store frequently-changing values in refs so the effect doesn't re-subscribe on every change.
- **Issue:** The keyboard handler is recreated whenever `filteredBookmarks`, `focusedIndex`, or `selectedBookmark` changes. This means `addEventListener`/`removeEventListener` churn on every keystroke.
- **Fix:** Use refs for frequently-changing values (`focusedIndex`, `filteredBookmarks`) and keep the effect dependency list minimal.

### 3.4 DOM query in effect for scroll-into-view
- **File:** `src/App.tsx:68-73`
- **Issue:** `document.querySelector` is called on every `focusedIndex` change. This could be replaced with a ref callback.
- **Fix:** Use React refs instead of DOM queries for scroll targeting.

### 3.5 `BookmarkSwiper` pointer events update state on every pixel
- **File:** `src/components/BookmarkSwiper.tsx:63-71`
- **Vercel:** **`[V: 5.1 Defer State Reads to Usage Point]`** — drag position is only needed at release time, not during every move event.
- **Issue:** `handlePointerMove` calls `setDrag()` on every pointer move event, causing a re-render per pixel.
- **Fix:** Use a ref for drag state and only setState on release, or throttle updates.

### 3.6 `inferCategory()` creates RegExp inside useMemo recomputation *(NEW)*
- **File:** `src/components/NewTabHome.tsx:86-98`
- **Vercel:** **`[V: 7.9 Hoist RegExp Creation]`** — RegExp literals inside `inferCategory()` are re-created on every call. This function runs inside the `items` useMemo, which means 4 RegExp objects × N bookmarks on every recomputation.
- **Issue:** Lines 91-96 create 4 inline RegExp patterns (`/\b(ai|llm|...)\b/`, etc.) each time `inferCategory` is called. For a large bookmark list, this is thousands of unnecessary RegExp allocations.
- **Fix:** Hoist the RegExp patterns to module-level constants:
  ```ts
  const AI_RE = /\b(ai|llm|gpt|alignment|model)\b/;
  const INDIE_RE = /\b(startup|indie|saas|founder|revenue|launch)\b/;
  // etc.
  ```

### 3.7 Multiple array passes where one loop suffices *(NEW)*
- **File:** `src/components/NewTabHome.tsx:186-318`, `src/hooks/useBookmarks.ts:209-210`
- **Vercel:** **`[V: 7.6 Combine Multiple Array Iterations]`** — multiple `.filter()` passes over the same data can be combined into a single loop.
- **Issue:** In NewTabHome, `items` (map), `unreadItems` (filter), `unreadItemsWithMinutes` (filter), and `totalMinutes` (reduce) require 4 passes over the bookmark data. In useBookmarks.ts:209-210, `deleteEvents` and `createEvents` are two separate filter passes.
- **Fix:** Combine into a single loop. For NewTabHome, derive `unreadCount`, `unreadWithMinutes`, and `totalMinutes` in the same `useMemo` as `items`.

### 3.8 Bookmark grid has no content-visibility optimization *(NEW)*
- **File:** `src/App.tsx:306-316`
- **Vercel:** **`[V: 6.2 CSS content-visibility for Long Lists]`** — applying `content-visibility: auto` defers rendering of off-screen items, providing up to 10x faster initial paint for large lists.
- **Issue:** The bookmark grid renders all `filteredBookmarks` at once with no virtualization or content-visibility. Users with 500+ bookmarks will experience slow rendering.
- **Fix:** Add `content-visibility: auto; contain-intrinsic-size: 0 200px;` to the bookmark card elements.

### 3.9 SVG `animate-pulse` directly on SVG element *(NEW)*
- **File:** `src/App.tsx:157-164`
- **Vercel:** **`[V: 6.1 Animate SVG Wrapper Instead of SVG Element]`** — many browsers don't hardware-accelerate CSS animations on SVG elements.
- **Issue:** The loading spinner uses `className="w-12 h-12 text-x-blue animate-pulse"` directly on the `<svg>` element. This prevents GPU acceleration.
- **Fix:** Wrap the SVG in a `<div className="animate-pulse">` and remove the class from the SVG:
  ```tsx
  <div className="animate-pulse">
    <svg viewBox="0 0 24 24" className="w-12 h-12 text-x-blue" fill="currentColor">
      ...
    </svg>
  </div>
  ```

### 3.10 Duplicated SVG icons re-created on every render *(NEW)*
- **Files:** `App.tsx:157-164,283-289`, `Onboarding.tsx`, `SearchBar.tsx`, `NewTabHome.tsx:705-707`, `SettingsModal.tsx:99-101`
- **Vercel:** **`[V: 6.3 Hoist Static JSX Elements]`** — static JSX (like SVG icons) should be extracted outside components to avoid re-creation.
- **Issue:** The X logo SVG, settings gear SVG, bookmark SVG, and close icon SVG are defined inline and recreated on every render. These are static and never change.
- **Fix:** Hoist each icon SVG to a module-level constant or an `icons/` module:
  ```ts
  const xLogoIcon = (
    <svg viewBox="0 0 24 24" className="w-12 h-12" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227..." />
    </svg>
  );
  ```

### 3.11 `handleUnbookmark` callback has unnecessary dependencies *(NEW)*
- **File:** `src/App.tsx:86-107`
- **Vercel:** **`[V: 5.5 Use Functional setState Updates]`** and **`[V: 8.2 useLatest for Stable Callback Refs]`** — `selectedBookmark` and `unbookmarkingId` in the dependency array cause the callback to be recreated unnecessarily.
- **Issue:** `handleUnbookmark` depends on `[unbookmark, selectedBookmark, unbookmarkingId]`. The `unbookmarkingId` check on line 88 is a guard that could use a ref, and `selectedBookmark` on line 94 is only read for comparison and could also use a ref. This causes the callback to be recreated on every bookmark selection change.
- **Fix:** Store `unbookmarkingId` and `selectedBookmark` in refs, removing them from the dependency array to make the callback stable.

### 3.12 `useBookmarks` uses `[...arr].sort()` instead of `.toSorted()` *(NEW)*
- **File:** `src/hooks/useBookmarks.ts:45-46,65,136,276`
- **Vercel:** **`[V: 7.12 Use toSorted() Instead of sort() for Immutability]`** — `.toSorted()` is clearer about intent (non-mutation) and avoids the intermediate spread.
- **Issue:** Multiple instances of `[...array].sort(compareFn)` pattern. While functionally correct (spread prevents mutation), `.toSorted()` is more idiomatic and marginally more efficient (avoids the spread copy).
- **Fix:** Replace `[...incoming].sort(compareSortIndexDesc)` with `incoming.toSorted(compareSortIndexDesc)`.

---

## 4. Correctness / Bug Risks

### 4.1 `useAuth` recursive `setTimeout` without cleanup
- **File:** `src/hooks/useAuth.ts:43`
- **Issue:** `setTimeout(doCheck, 500)` inside `doCheck` is not cleaned up if the component unmounts. This can cause state updates on unmounted components.
- **Fix:** Track the timeout ID in a ref and clear it in the effect cleanup.

### 4.2 `useBookmarks.doSync` uses `setInterval` inside a callback without cleanup
- **File:** `src/hooks/useBookmarks.ts:161-183`
- **Issue:** A `setInterval` is created for polling re-auth status, but it's only cleaned up via the `attempts >= 15` check or a successful re-auth. If the component unmounts during polling, the interval leaks.
- **Fix:** Track the interval in a ref and clear it on unmount via a cleanup effect.

### 4.3 Race condition in `reconcileTopWindow`
- **File:** `src/hooks/useBookmarks.ts:41-68`
- **Issue:** If two sync operations run concurrently (e.g., visibility change + manual refresh), `bookmarksRef.current` may be stale when the second one resolves.
- **Fix:** The `syncingRef` guard mostly prevents this, but it's cleared in `finally` so a rapid re-trigger during the error retry interval could slip through. Use an abort controller pattern.

### 4.4 `BookmarkFilmstrip.goTo` returns cleanup function but caller ignores it
- **File:** `src/components/BookmarkFilmstrip.tsx:61-69`
- **Issue:** `goTo()` returns a cleanup function from `window.clearTimeout`, but none of the callers use the return value. The resume-auto-advance timeout leaks.
- **Fix:** Track the timeout in a ref and clear it properly.

### 4.5 Video elements auto-play without user interaction
- **File:** `src/components/reader/TweetMedia.tsx:29-30`
- **Issue:** `autoPlay={item.type === "animated_gif"}` may cause unexpected data usage and is a poor UX for users on metered connections.
- **Fix:** Consider respecting `prefers-reduced-motion` or using intersection observer to only autoplay when visible.

### 4.6 `useActiveSection` uses stale `sectionIds` in the dependency
- **File:** `src/components/reader/TableOfContents.tsx:7,38`
- **Issue:** `idsKey = sectionIds.join(",")` is used as the effect dependency instead of `sectionIds`. If two different arrays produce the same joined string (unlikely but possible), the observer won't re-attach.
- **Fix:** Minor risk, but using a stable ID or proper memoization is cleaner.

### 4.7 Unsafe `imageUrl` injection in entity map
- **File:** `src/api/parsers.ts:295`
- **Issue:** `data.imageUrl = imageUrl` mutates the parsed data object. This modifies the API response in place, which could cause issues with cached data.
- **Fix:** Create a new object instead of mutating: `{ ...data, imageUrl }`.

---

## 5. CSS / Styling Issues

### 5.1 Massive CSS duplication for dark theme
- **File:** `src/index.css:61-117`
- **Issue:** The dark theme variables are duplicated verbatim — once inside `@media (prefers-color-scheme: dark) :root` (lines 61-88) and again inside `[data-theme="dark"]` (lines 91-117). This is 56 lines of pure duplication.
- **Fix:** Use a CSS mixin, or define dark values once and reference from both selectors.

### 5.2 Large amount of non-utility CSS
- **File:** `src/index.css` (610 lines)
- **Issue:** The `breath-*` class system (lines 152-597) is essentially a hand-rolled component library in CSS. This contradicts using Tailwind and makes it hard to reason about styles.
- **Fix:** Consider converting the `breath-*` classes to Tailwind utilities using `@apply`, or move them into component-scoped CSS modules.

### 5.3 Vendor-prefixed properties without standard fallbacks
- **File:** `src/index.css:318-321`, multiple places
- **Issue:** `-webkit-line-clamp` and `-webkit-box-orient` are used (also via Tailwind's `line-clamp-*`). These work in Chromium (which is sufficient for a Chrome extension), but are technically non-standard.
- **Fix:** Not blocking for a Chrome extension, but document the Chromium-only assumption.

### 5.4 Hardcoded `rgba` colors instead of theme variables
- **File:** `src/index.css:162-178`, `src/components/NewTabHome.tsx:663`
- **Issue:** Many `breath-*` variables use hardcoded `rgba(255, 255, 255, ...)` and `rgba(224, 122, 95, ...)` values directly, bypassing the theme system. The `breath-home` UI will look broken if someone forces light mode.
- **Fix:** Either make the home screen theme-aware or document that it's intentionally dark-only.

---

## 6. TypeScript / Type Safety Issues

### 6.1 Loose type assertions in `messages.ts`
- **File:** `src/api/messages.ts:62-69`
- **Issue:** `fetchGraphqlCatalog` casts `endpoints as GraphQLEndpointCatalogEntry[]` without validation. The data comes from `chrome.storage` which could be corrupted.
- **Fix:** Validate each field or use the same defensive parsing pattern used elsewhere (like `normalizeBookmarkChangeEvents`).

### 6.2 Non-null assertions on optional data
- **File:** `src/components/reader/TweetRenderer.tsx:97` (`tweet.article!`), `TweetArticle.tsx:231` (`article.contentBlocks!`)
- **Issue:** Non-null assertions bypass TypeScript safety. If the upstream condition check is wrong, this will throw at runtime.
- **Fix:** Use proper null checks or narrow the type with an if-guard.

### 6.3 Missing return type annotations on exported functions
- **Files:** Multiple hooks and API functions
- **Issue:** `useSettings()`, `useTheme()`, `useWallpaper()`, `useTopSites()` don't have explicit return types. This makes refactoring riskier.
- **Fix:** Add return type annotations to all exported hook and function signatures.

### 6.4 `imageUrl` property added dynamically without type
- **File:** `src/api/parsers.ts:295`
- **Issue:** `data.imageUrl = imageUrl` adds a property to `Record<string, unknown>` which is valid but loses type info. Downstream code (`TweetArticle.tsx:74`) accesses it via `entity.data?.imageUrl` without type guarantees.
- **Fix:** Add `imageUrl` to the `ArticleContentEntity.data` type definition.

---

## 7. Missing Production Features

### 7.1 No loading/skeleton states
- **Issue:** When bookmarks are loading from IndexedDB, there's no skeleton/shimmer state. The library view shows nothing and then jumps.
- **Fix:** Add skeleton cards during the initial load.

### 7.2 No favicon or icons in manifest
- **File:** `public/manifest.json`
- **Issue:** The manifest has no `icons` field. Chrome will show a generic puzzle piece icon.
- **Fix:** Add 16, 32, 48, and 128px icons.

### 7.3 No favicon in `newtab.html`
- **File:** `newtab.html`
- **Issue:** No `<link rel="icon">` tag. The new tab will show a default favicon.
- **Fix:** Add a favicon link.

### 7.4 No `offline_enabled` or graceful offline handling
- **Issue:** If the user opens a new tab without internet, wallpaper fetch will fail silently, sync will error, but there's no offline indicator.
- **Fix:** Detect online/offline state and show appropriate UI.

### 7.5 No analytics/telemetry for error monitoring
- **Issue:** All errors are caught and silently swallowed (especially in the service worker). There's no way to know if the extension is broken in production.
- **Fix:** Consider a lightweight error reporting mechanism or at least structured logging.

### 7.6 Build output uses non-hashed filenames
- **File:** `vite.config.ts:16-18`
- **Issue:** `entryFileNames: "assets/[name].js"` produces predictable filenames without content hashes. While this is fine for extensions (no CDN caching), it could cause issues if users have multiple versions.
- **Fix:** This is intentional for extensions — just document why hashes are omitted.

### 7.7 No version bump automation
- **File:** `package.json`, `public/manifest.json`
- **Issue:** Version is manually set to `1.0.0` in both files with no sync mechanism. They could drift.
- **Fix:** Use a build script that syncs `manifest.json` version from `package.json`, or use a single source of truth.

---

## 8. UX Issues

### 8.1 No confirmation for unbookmark
- **File:** `src/App.tsx:86-107`
- **Issue:** Clicking "Remove bookmark" immediately deletes it with no undo or confirmation. This is destructive and irreversible.
- **Fix:** Add an "Undo" toast with a timeout, or a confirmation dialog.

### 8.2 Export API docs button is confusing for regular users
- **File:** `src/components/SearchBar.tsx:68-78`
- **Issue:** The "Export GraphQL API docs" button is a developer tool exposed in the main UI. Regular users will not understand what this does.
- **Fix:** Move it to a developer section in settings, or hide behind a long-press / advanced menu.

### 8.3 No empty state illustration
- **File:** `src/App.tsx:282-294`
- **Issue:** The empty state for "No bookmarks found" is text-only with a small SVG icon. It doesn't guide the user.
- **Fix:** Add a more descriptive empty state with a CTA to bookmark something on X.

### 8.4 Keyboard shortcuts not discoverable
- **File:** `src/hooks/useKeyboard.ts`
- **Issue:** Keyboard shortcuts (j/k, /, Escape, Enter/o) exist but are not documented anywhere in the UI.
- **Fix:** Add a "Keyboard shortcuts" section in settings, or a `?` shortcut that shows a help overlay.

### 8.5 Settings modal is not accessible
- **File:** `src/components/SettingsModal.tsx:81-239`
- **Issue:** The modal lacks `role="dialog"`, `aria-modal="true"`, and focus trapping. Screen reader users can tab out of the modal into the background.
- **Fix:** Add proper ARIA attributes and focus trap logic.

### 8.6 No `aria-live` region for dynamic messages
- **File:** `src/App.tsx:251-257`
- **Issue:** The `headerMessage` banner appears/disappears dynamically but has no `aria-live` attribute. Screen readers won't announce it.
- **Fix:** Add `aria-live="polite"` to the message container.

---

## 9. Code Quality / Consistency

### 9.1 Inconsistent SVG icon usage
- **Files:** Throughout all components
- **Issue:** The X logo SVG path is duplicated in `App.tsx:161-163`, `Onboarding.tsx:9-11,23-25`, `SearchBar.tsx:38-40`. Other icons (settings gear, back arrow, bookmark) are also duplicated across files.
- **Fix:** Extract SVG icons into a shared `src/components/icons/` directory.

### 9.2 Inconsistent error handling patterns
- **Issue:** Some places use `.catch(() => {})` (e.g., `useBookmarks.ts:94,97,312,317`), some use `try/catch` with empty catch blocks (e.g., `useSettings.ts:76`), some rethrow (e.g., `useBookmarks.ts:279`).
- **Fix:** Establish a consistent error handling pattern. At minimum, log errors in development.

### 9.3 Magic numbers throughout
- **Files:** Multiple
- **Issue:** `3500` (header message timeout in `App.tsx:139`), `500` (auth check delay in `useAuth.ts:43`), `1000` (polling interval in `useAuth.ts:74`), `15` (max retry attempts in `useBookmarks.ts:175`), `2000` (poll interval in `useBookmarks.ts:183`), `WEEK_MS` / `DETAIL_CACHE_RETENTION_MS` etc.
- **Fix:** Extract all timing constants to a shared config file with descriptive names.

### 9.4 Console-free debugging
- **Issue:** There is zero `console.log` / `console.error` anywhere in the codebase. While clean, it makes debugging production issues impossible.
- **Fix:** Add structured debug logging behind a `DEBUG` flag, especially for the service worker and API layer.

### 9.5 `unused` variable `userId` in `useAuth`
- **File:** `src/hooks/useAuth.ts:78`
- **Issue:** `userId` is returned from `useAuth()` but never used by any consumer. `App.tsx:20` destructures only `{ phase }`.
- **Fix:** Either use it (e.g., display username) or remove it from the return value.

### 9.6 `unused` function `formatFullDate`
- **File:** `src/lib/time.ts:23-29`
- **Issue:** `formatFullDate` is exported but never imported anywhere.
- **Fix:** Remove it or use it in the UI.

### 9.7 `unused` function `fetchGraphqlCatalog`
- **File:** `src/api/messages.ts:56-70`, re-exported from `src/api/twitter.ts:7`
- **Issue:** `fetchGraphqlCatalog` is exported but never called anywhere in the app.
- **Fix:** Remove it or use it in a developer tools UI.

### 9.8 Unused `useTopSites` hook
- **File:** `src/hooks/useTopSites.ts`
- **Issue:** This hook is never imported or used anywhere. The `showTopSites` setting exists but the top sites UI was apparently removed.
- **Fix:** Either implement the top sites feature or remove the hook and the `showTopSites` setting.

### 9.9 Unused `drainBookmarkEvents` export
- **File:** `src/api/twitter.ts:11`
- **Issue:** `drainBookmarkEvents` is re-exported but never called in app code.
- **Fix:** Remove the re-export or use it.

---

## 10. Build / Config Issues

### 10.1 No linter configured
- **Issue:** No ESLint config found. The `tsconfig.json` has `strict: true` and `noUnusedLocals: true`, but no runtime lint rules for code quality, import order, or React-specific rules.
- **Fix:** Add ESLint with `@typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`.

### 10.2 No test framework
- **Issue:** No test files, no test runner, no test scripts in `package.json`.
- **Fix:** Add Vitest with React Testing Library. Start with tests for the critical parsing logic in `src/api/parsers.ts` and utility functions in `src/lib/`.

### 10.3 No Prettier or formatting config
- **Issue:** No `.prettierrc` or `.editorconfig`. The code formatting is consistent (likely from an editor), but there's no guarantee.
- **Fix:** Add Prettier config for consistent formatting.

### 10.4 `.npmrc` and `pnpm-workspace.yaml` exist but seem unnecessary
- **Issue:** These suggest monorepo setup but there's only one package.
- **Fix:** Verify if these are needed. If not, remove them to reduce confusion.

### 10.5 Documentation files are excessive
- **Files:** `ARCHITECTURE.md`, `IMPLEMENTATION_DETAILS.md`, `LINE_BY_LINE_EXPLAINED.md`, `STORAGE_EXPLAINED.md`, `soul.md`
- **Issue:** Five markdown documentation files exist alongside the code. Some may be generated/AI docs that go stale quickly.
- **Fix:** Consolidate into a single `ARCHITECTURE.md` or `docs/` folder. Remove generated explanations that don't add value.

---

## 11. Service Worker Issues

### 11.1 Service worker is plain JS — no TypeScript
- **File:** `public/service-worker.js` (1265 lines)
- **Issue:** The service worker is the largest file in the project but has no type checking. It handles auth, API calls, and data management — all critical paths.
- **Fix:** Convert to TypeScript. Use a separate Vite entry or build step.

### 11.2 Service worker has no tests
- **Issue:** The most critical code (auth capture, bookmark mutation detection, API proxying) has zero tests.
- **Fix:** Extract pure functions (like `parseTwidUserId`, `parseBookmarkMutation`, `extractTweetIdFromRequestBody`) and unit test them.

### 11.3 `reAuthSilently` opens a tab that may be visible
- **File:** `public/service-worker.js:196`
- **Issue:** `chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: false })` opens a background tab, but users may notice it in their tab bar.
- **Fix:** Document this behavior or consider using `chrome.offscreen` API for MV3.

### 11.4 No rate limiting on API calls
- **File:** `public/service-worker.js:827-871`
- **Issue:** There's no rate limiting on `handleFetchBookmarks` or `handleFetchTweetDetail`. Rapid tab opens could hammer the X API.
- **Fix:** Add a debounce or minimum interval between API calls.

### 11.5 Stale feature set fallback
- **File:** `public/service-worker.js:840`
- **Issue:** `DEFAULT_FEATURES` is hardcoded. If X changes their API features, the extension will break. The dynamic capture (`tw_features`) mitigates this, but only after the user visits x.com.
- **Fix:** Consider fetching the latest features from the first successful API call and always preferring captured values.

---

## 12. Vercel React Best Practices — Cross-Reference Summary

The following table maps each applicable Vercel rule to the issues found in this audit. Rules marked "N/A" are Next.js/SSR-specific and don't apply to this Vite SPA Chrome extension.

| Vercel Rule | Impact | Status | Issue # |
| --- | --- | --- | --- |
| **1. Eliminating Waterfalls** | | | |
| 1.1 Defer Await Until Needed | HIGH | N/A — no server-side awaits | — |
| 1.2 Dependency-Based Parallelization | CRITICAL | N/A — no parallel async in components | — |
| 1.3 Prevent Waterfall Chains in API Routes | CRITICAL | N/A — no API routes | — |
| 1.4 Promise.all() for Independent Operations | CRITICAL | OK — `useBookmarks` sequences intentionally for state consistency | — |
| 1.5 Strategic Suspense Boundaries | HIGH | N/A — no async components | — |
| **2. Bundle Size Optimization** | | | |
| 2.1 Avoid Barrel File Imports | CRITICAL | **VIOLATION** | 2.9 |
| 2.2 Conditional Module Loading | HIGH | OK — no large conditional modules | — |
| 2.3 Defer Non-Critical Third-Party Libraries | MEDIUM | OK — no analytics loaded | — |
| 2.4 Dynamic Imports for Heavy Components | CRITICAL | OK — small bundle, single-page extension | — |
| 2.5 Preload Based on User Intent | MEDIUM | OK — no lazy-loaded heavy modules | — |
| **3. Server-Side Performance** | | | |
| 3.1–3.5 | HIGH | N/A — no server-side rendering | — |
| **4. Client-Side Data Fetching** | | | |
| 4.1 Deduplicate Global Event Listeners | LOW | OK — single keyboard listener | — |
| 4.2 Use SWR for Automatic Deduplication | MEDIUM-HIGH | N/A — uses Chrome messaging, not HTTP fetching | — |
| **5. Re-render Optimization** | | | |
| 5.1 Defer State Reads to Usage Point | MEDIUM | **VIOLATION** | 3.5 |
| 5.2 Extract to Memoized Components | MEDIUM | OK — memo used where needed | — |
| 5.3 Narrow Effect Dependencies | LOW | **VIOLATION** | 3.1 |
| 5.4 Subscribe to Derived State | MEDIUM | OK — `usePrefersReducedMotion` correctly uses `matchMedia` listener | — |
| 5.5 Use Functional setState Updates | MEDIUM | **PARTIAL** — most setState uses functional form, but `handleUnbookmark` has broad deps | 3.11 |
| 5.6 Use Lazy State Initialization | MEDIUM | OK — `useState(() => loadReadIds())` correctly uses lazy init | — |
| 5.7 Use Transitions for Non-Urgent Updates | MEDIUM | **VIOLATION** | 3.2 |
| **6. Rendering Performance** | | | |
| 6.1 Animate SVG Wrapper Instead of SVG Element | LOW | **VIOLATION** | 3.9 |
| 6.2 CSS content-visibility for Long Lists | HIGH | **VIOLATION** | 3.8 |
| 6.3 Hoist Static JSX Elements | LOW | **VIOLATION** | 2.8, 3.10 |
| 6.4 Optimize SVG Precision | LOW | OK — SVG paths are from official X/Twitter assets | — |
| 6.5 Prevent Hydration Mismatch | MEDIUM | N/A — no SSR | — |
| 6.6 Use Activity Component for Show/Hide | MEDIUM | N/A — React `<Activity>` is experimental | — |
| 6.7 Use Explicit Conditional Rendering | LOW | OK — conditionals use boolean comparisons, not raw numbers | — |
| **7. JavaScript Performance** | | | |
| 7.1 Batch DOM CSS Changes | MEDIUM | **VIOLATION** — progress bar should use CSS animation | 3.2 |
| 7.2 Build Index Maps for Repeated Lookups | LOW-MEDIUM | OK — `useBookmarks` uses `Map` and `Set` correctly | — |
| 7.3 Cache Property Access in Loops | LOW-MEDIUM | OK — no deep property access in hot loops | — |
| 7.4 Cache Repeated Function Calls | MEDIUM | OK — `inferCategory` results are memoized via `items` useMemo | — |
| 7.5 Cache Storage API Calls | LOW-MEDIUM | OK — `loadReadIds()` runs once via lazy useState | — |
| 7.6 Combine Multiple Array Iterations | LOW-MEDIUM | **VIOLATION** | 3.7 |
| 7.7 Early Length Check for Array Comparisons | MEDIUM-HIGH | OK — no expensive array comparisons | — |
| 7.8 Early Return from Functions | LOW-MEDIUM | OK — functions use early returns properly | — |
| 7.9 Hoist RegExp Creation | LOW-MEDIUM | **VIOLATION** | 3.6 |
| 7.10 Use Loop for Min/Max Instead of Sort | LOW | OK — no sort-for-min/max patterns | — |
| 7.11 Use Set/Map for O(1) Lookups | LOW-MEDIUM | OK — `Set` used in `reconcileTopWindow`, `readIds`, etc. | — |
| 7.12 Use toSorted() Instead of sort() | MEDIUM-HIGH | **VIOLATION** | 3.12 |
| **8. Advanced Patterns** | | | |
| 8.1 Store Event Handlers in Refs | LOW | **VIOLATION** | 3.3 |
| 8.2 useLatest for Stable Callback Refs | LOW | **VIOLATION** | 3.3, 3.11 |

---

## Summary by Priority

| Priority | Count | Category |
| --- | --- | --- |
| Critical | 3 | XSS risks, CSP |
| High | 12 | Architecture, dead code, error handling, barrel imports |
| Medium | 22 | Performance (incl. 8 new Vercel violations), correctness, type safety |
| Low | 18 | UX, consistency, build config |
| **Total** | **55** | |

### Vercel Rules Summary

- **12 violations** found across the codebase
- **1 partial** compliance (functional setState mostly correct, one callback has broad deps)
- **18 rules** are N/A (Next.js/SSR-specific, not applicable to this Vite SPA)
- **14 rules** are already followed correctly
