# Changelog

All notable changes to this project will be documented in this file.

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
