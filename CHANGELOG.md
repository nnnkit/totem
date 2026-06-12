# Changelog

All notable changes to this project will be documented in this file.

## [1.2.3] - 2026-06-12

- fix: harden extension integrity checks
- fix(today): address queue review findings
- fix(today): keep offline queue state accurate
- fix(export): avoid repeated bookmark reads in quick export
- feat: publish three blog posts and improve search discoverability
- fix: polish Today's Read queue interactions
- feat: add Today's Read queue

## [1.2.2] - 2026-06-05

- Maintenance release.

## [1.2.1] - 2026-06-05

- Use safer Chrome Web Store listing metadata after keyword-stuffing rejection.

## [1.2.0] - 2026-05-30

- Commit promotion source images
- Fix export import review issues
- Stop import refresh from flashing a loading spinner
- Harden import against bad rows and oversized ZIPs
- Make streaming export resilient to concurrent row deletes
- Fix hydration single-writer lock and background loop robustness
- Address export import follow-ups
- Refine dark mode highlight colors
- Publish Twitter bookmark export guides
- Polish site feature grid and export docs
- Fix import refresh and hydration locking
- Add shared X extension core package
- parallelize content script builds
- stabilize runtime sync flows
- optimize data and export helpers
- fix reader rendering and controls
- refactor large app surfaces
- fix: remove trailing settings divider
- feat: improve export archive layout
- feat: improve full export readiness
- fix: sync detail cache state after hydration
- fix: validate Totem export imports
- Use shared auth primitives in Totem
- RALPH: full export modal + hydration footer line (closes #39)
- Revert "chore: pin dependency versions for supply-chain safety"
- RALPH: hydration runtime store + single-writer lock (closes #38)
- plan: export hydration design (closes #37)
- RALPH: home count line + first-run import drop-zone (closes #40)
- RALPH: public schema docs page at /export-format/v1 (closes #41)
- RALPH: round-trip import — ZIP validation, additive IDB import, modal UI (closes #36)
- RALPH: quick export end-to-end — JSONL + CSV + Markdown ZIP (closes #35)
- RALPH: streaming ZIP + IDB cursor spike (closes #34)

## [1.1.25] - 2026-05-30

- Commit promotion source images
- Fix export import review issues
- Stop import refresh from flashing a loading spinner
- Harden import against bad rows and oversized ZIPs
- Make streaming export resilient to concurrent row deletes
- Fix hydration single-writer lock and background loop robustness
- Address export import follow-ups
- Refine dark mode highlight colors
- Publish Twitter bookmark export guides
- Polish site feature grid and export docs
- Fix import refresh and hydration locking
- Add shared X extension core package
- parallelize content script builds
- stabilize runtime sync flows
- optimize data and export helpers
- fix reader rendering and controls
- refactor large app surfaces
- fix: remove trailing settings divider
- feat: improve export archive layout
- feat: improve full export readiness
- fix: sync detail cache state after hydration
- fix: validate Totem export imports
- Use shared auth primitives in Totem
- RALPH: full export modal + hydration footer line (closes #39)
- Revert "chore: pin dependency versions for supply-chain safety"
- RALPH: hydration runtime store + single-writer lock (closes #38)
- plan: export hydration design (closes #37)
- RALPH: home count line + first-run import drop-zone (closes #40)
- RALPH: public schema docs page at /export-format/v1 (closes #41)
- RALPH: round-trip import — ZIP validation, additive IDB import, modal UI (closes #36)
- RALPH: quick export end-to-end — JSONL + CSV + Markdown ZIP (closes #35)
- RALPH: streaming ZIP + IDB cursor spike (closes #34)

## [1.1.24] - 2026-05-05

- fix: harden auth capture startup
- fix: auth flow
- feat: group FAQs by category and refine disclosure animation

## [1.1.23] - 2026-04-28

- Maintenance release.

## [1.1.22] - 2026-04-28

- feat: split reset into "reset app state" and "delete all data"
- feat: overhaul bookmark search with bm25 engine, saved searches, and ranking signals

## [1.1.21] - 2026-04-27

- fix: generate blog posts before tsc in build:extension

## [1.1.20] - 2026-04-27

- fix: blogs ui
- feat: utm-tag blog totem links, footer blog link, fix post sort
- fix: include sourcefile in generated blogpost interface
- feat: add how-it-works transit map and blog index/post views
- feat: add blog build pipeline and vite blog/how-it-works inputs
- feat: add ga4 page-view tracking and utm tag the install link

## [1.1.19] - 2026-04-24

- fix: gate auth trio on twid cookie and hide uncached unread offline
- feat: plumb viewer-profile fetch via UserByRestId
- logo: loading variant (shine-breath) + TotemLoading inline wrapper
- fix: keep activeAccountId and reader detail in sync with hydration
- highlights: saturated hues back in dark mode, softer peaks + smoother transitions to kill the metal-glint feel
- highlights: desaturated pastel hues in dark mode to calm the shine
- highlights: tone down dark-mode peaks to kill the glossy-bead look
- highlights: dark mode now uses low-alpha tinted wash, body text preserved
- highlights: match light-mode painterly feel in dark mode with text-shadow backup
- highlights: polish — padding-inline fade, painterly dark gradients, drop header swatch
- highlights: phase 6 — remove unused --highlight-bg vars and dead class
- highlights: phase 5 — default highlight color in settings, seeded into reader session
- highlights: phase 4 — recolor from popover + header swatch
- highlights: phase 3 — split-button picker, 4-color gradients, swipe-on animation
- fix: keep reading-progress rows visible through auth transitions
- highlights: phase 2 — classic gradient marker rendering
- highlights: phase 1 — resolver + data-color attr, default 'classic'
- fix: portal tweet button tooltip to body with viewport-aware flip
- diag: lower TOTEM-DIAG traces from console.log to console.debug
- sync: scope localCount=0 full-seed to manual trigger; clear retry on auth flip; await closeDb in reset ack
- sync: dedupe blocked-reason logs and skip maybeStartAutomaticSync when retry pending
- sync: bypass fresh_cache for auto when last completion wasn't success (skip/fail)
- sync: force full on manual trigger when localCount=0; seed-backoff and auto-reclaim hardening
- reset: broadcast CS_RESET_EPOCH so open tabs release IDB handles before deleteDatabase
- fix: lift Open-in-Totem tooltip above tweet content and flip it above the button
- fix: address review feedback on bookmark export
- fix: address PR review — remove stray docs, reuse export pipeline, harden YAML
- feat: add export-all bookmarks button to reading list
- fix: include full thread in reader export with cleaner separators
- fix: only inject open-in-totem button on main tweet of thread pages
- fix: link exported videos to x.com instead of video.twimg.com
- fix: double-print bug, wrapInlineCode fence, and download anchor
- feat: add download and copy for bookmarks

## [1.1.18] - 2026-03-30

- fix: keep plain URLs inline in tweet text like Twitter

## [1.1.17] - 2026-03-30

- fix: remove red accent border on search input focus

## [1.1.16] - 2026-03-29

- fix: tab indicator animation and manual sync now runs full reconcile

## [1.1.15] - 2026-03-29

- feat: add setting to toggle open-in-totem content script on tweets

## [1.1.14] - 2026-03-27

- fix: links not rendering anchor
- fix: address PR review — auth slice bugs, a11y, cleanup races, fallback handling
- fix: reauth retry guard, dedup concurrent reauth, centralize storage keys
- fix: active mode
- feat: add ralph
- RALPH: integration tests + SW monolith removal (#11)
- RALPH: SW API proxy + events modules, bookmarks & reader store slices (#10)
- RALPH: auth+boot & sync store slices — state machines, unified cancellation (#9)
- RALPH: auth pipeline end-to-end — content script TS, SW auth module, diagnostics (#8)
- RALPH: query ID resilience — module extraction, passive catalog primary, hardened scraping (#7)
- RALPH: foundation — shared types, SW message router, fake Chrome test layer (#6)
- feat: add ralph local dispatch config
- fix: UI polish, pin events, auth flow tests
- feat: add ralph local dispatch with parallel git worktrees
- fix: restore login flow and fix recursive stack overflow in query ID cache
- fix: style improvment
- fix: improve animation
- fix: scope profile click to avatar and username on pinned cards
- fix: remove auto-unpin, cap only counts unread pins
- fix: stop filtering pinned bookmarks from reading/read tab lists
- feat: limit pins to 6, show only on unread tab, auto-unpin on read
- feat: add fold corner effect and accent bar to pinned bookmark cards
- fix: open in totem
- fix: rotate through all pinned bookmarks instead of always showing first
- ui: segrigate ui
- feat: add clickable Twitter profile links in bookmarks list
- fix: remove unnecessary sender guard blocking newtab auth messages
- feat: add chrome web store install link and unify button labels
- feat: fix bugs after review
- feat: hide sort control on empty tabs and use ghost buttons for empty states
- feat: add individual tweet on render and sorting
- feat: refactoa nd fix issues
- fix: remove bookmark from reader
- feat: add open in totem

## [1.1.13] - 2026-03-11

- feat: update title

## [1.1.12] - 2026-03-11

- Maintenance release.

## [1.1.11] - 2026-03-11

- feat: improve privacy and remove comments

## [1.1.10] - 2026-03-11

- fix: footer
- feat" add support to website
- feat: add support
- fix: improve font sizes
- feat: improve faq and refactor css
- fix: faq and words
- fix: update images
- fix: show confirm delete message

## [1.1.9] - 2026-03-06

- update: archetecture
- fix: initial sync
- fix: loading sync
- fix: reset sync
- feat: implement rewrite
- feat: update website metadata and improve user experience

## [1.1.8] - 2026-03-05

- feat: fix impossible state

## [1.1.7] - 2026-03-05

- feat: improve parsing

## [1.1.6] - 2026-03-05

- Maintenance release.

## [1.1.5] - 2026-03-05

- feat: improve tweetdetails fetch

## [1.1.4] - 2026-03-05

- feat: optimize offline mode

## [1.1.3] - 2026-03-05

- Maintenance release.

## [1.1.2] - 2026-03-05

### Added
- feat: fix tailwind
- feat: optimize images

## [1.1.1] - 2026-03-05

### Added
- feat: improve parser
- feat: improve build seperation
- feat: auto sync
- feat: add new features
- feat: add vercel json

### Changed
- fix vercel routes for privacy and demo pages
- route root to website on vercel

### Fixed
- fix: css build

## [1.1.0] - 2026-03-03

### Added
- feat: improve sync
- feat: fix better error messages
- feat: implement sync threshold
- feat: add animation info
- feat: improve copy
- feat: improve sync and auth
- feat: fix offline and syncing issues
- feat: refactor and improve sync
- feat: website v2 implementation
- feat: website v2
- feat: add website basics
- feat: fix parsing
- feat: update website
- feat: remove driver.js and product walkthrough

### Changed
- refactor: phase 2
- refactor: from scratch the archetecture
- refactor: move to provider
- refactor: auth and sync
- refactor: replace SyncState reducer with SyncStatus state machine

### Fixed
- fix: code review changes
- fix: remove wallpaper selector
- fix: quote showing full body
- fix: remove image avatar for threads
- fix: remove website
- fix: remove tabs permission
- fix: sanatize
- fix: only persist reading tab to localStorage when tab has items
- fix: sync state
- fix: escape single quotes in escapeHtml and scope postMessage origin

## [1.0.4] - 2026-02-26

### Added
- feat: fix colors
- feat: fix dewsign issues

### Fixed
- fix: border 0.5 rem
- fix: change text

## [1.0.3] - 2026-02-26

### Added
- feat: improve home page gap
- feat: improve archetecture
- feat: refactor core sync logic
- feat: add core archetecture and offline message
- feat: change O shortcut to Space and add keycap shadow to kbd badges
- feat: pin author info to bottom of bookmark card with flexible spacing
- feat: improve card hierarchy with badge, larger title, and pinned author footer
- feat: remove auto completion
- feat: improve color and make it more readable
- feat: improve settings and individual posts
- feat: improve font for articles and structure of bookmark
- feat: add dual font system with SF Pro Display (sans) and Spectral (serif)
- feat: change xbt css names
- feat: remove claude file
- feat: add offline support
- feat: stable footer layout with cached bookmarks during connecting phase
- feat: inline login card in footer instead of full-page onboarding
- feat: add search switch
- feat: auto-initial sync + soft/hard sync model for bookmarks
- feat: add search engine picker to homepage search bar
- feat: improve product tour and add reader tour
- feat: open full-page view on extension icon click
- feat: delate query id and update wallpaper

### Changed
- refactor: remove 167 lines of dead code across core modules
- refactor: replace arbitrary Tailwind values with standard utilities in NewTabHome
- refactor: unify fonts to sans-serif and border radius to 4px
- refactor: extract shared UI components into src/components/ui/
- refactor: standardize color system with semantic tokens and accent scale
- remove unused css
- refactor: rename onUnbookmark to onDeleteBookmark
- refactor: move remove bookmark button from header to bottom actions
- update tagline to actually read what you saved

### Fixed
- fix: add SYNC_SKIPPED action so ready→synced transition isn't dropped
- fix: dedup onPage bookmarks to prevent duplicates from concurrent sync
- fix: improve html structure and element
- fix: use direct --color-* overrides in .totem-home instead of var() refs
- fix: restore sugar-high syntax highlighting CSS variables
- fix: prevent empty-state flash on reload with localStorage bookmark hint
- fix: update highlight and underline colors to warm peach accent palette
- fix: skip idle loading screen when no bookmarks to load
- fix: remove theme switch
- fix: resolve stale/wrong GraphQL query IDs for bookmarks

## [1.0.2] - 2026-02-23

### Added
- feat: add ask grok and refactor highlight
- feat: add base ui
- feat: add image wallpaper
- feat: fix icons
- feat: add highlight and notes
- feat: revamp design tokens
- feat: move to phosphore for icons
- feat: fix sorting, continue reading issues

### Changed
- redesign logo with glass shine
- refactor: update header layout and logo size in NewTabHome component
- add logo header and shine loading animation
- rebrand to Totem with origami logo
- apply react perf best practices
- refactor: update NotePopover styles and layout
- Merge pull request #1 from nnnkit/worktree-highlight-notes
- Delete highlight-notes
- refactor: add modal
- refacotr: fetching and syncing
- refactor: change namings

### Fixed
- fix: refactor style
- fix: add toast on request fail
- fix: improve finding query id
- fix: move all config to constants
- fix: resolve merge conflicts from main
- fix: delete bookmark
- fix: size inconsistency and content policy
- fix: standard font size
- fix: add title to buttons
- fix: mark as read
- fix: tweet link better aspect ratio
- fix: improve continue reading and read
- fix: persist tab

## [1.0.1] - 2026-02-18

### Added
- feat: add end-to-end release and versioning workflow

### Fixed
- fix: remove limit
- fix: fix button style and radius
- fix: remove console.log
- fix: add backtick rendering and update google search

## [1.0.0] - 2026-02-18

### Added
- Initial public release of Totem extension.
- GitHub Actions release pipeline that publishes an installable extension ZIP asset.
