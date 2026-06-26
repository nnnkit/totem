# Totem promo image generator

Reusable system for the Chrome Web Store screenshots + promo tiles + `@2x`
marketing set. **Edit the HTML once; swap screenshots and re-run forever.**

## How it works

Each frame is a static HTML file (warm Direction-A composition: real Totem
logo, Spectral serif headline, dark browser window). The window shows a **real
product screenshot** from `input/`, zoomed to crop empty margins. `build.sh`
renders every frame with `agent-browser` at the right size (and 2× for the
`@2x` set) and writes the final PNGs into place.

```
./build.sh          # regenerate everything from ./input/*.png
```

No dev server needed to build — only to *capture* the input screenshots.

## Screenshots to provide  (drop into ./input/ with these exact names)

Capture from the live app or the `/demo` route. **Dark theme. Hide the demo
"Demo ready" toast. Capture the browser content only (no OS chrome).** Any
reasonable size works — the frames zoom/crop to the content, so it's fine if
the window is wider than the content. A ~1280×800 capture is ideal.

| File | What it must show |
|------|-------------------|
| `todays-read.png` | **List view, "Today's Read" tab selected** — the finite daily queue (3–5 items) + the "Handled today" section. The hero shot. |
| `reader.png` | **A bookmark open in the reader** — author header, the action bar (View on X / Grok / Copy for Agent), and article/thread body. A real thread is ideal for the "threads" caption. |
| `search.png` | **List view with a search query typed**, showing filtered results (e.g. search "claude"). Falls back fine to the full library list. |
| `export.png` | **The real "Export your library" modal open** — Basic/Full export options + Download ZIP, over the dimmed library. |
| `highlight.png` | **Reader with a real highlight applied** (one of the 4 colors) and ideally a note attached. |
| `track.png` | **Reading/Read tabs** showing reading states — items with progress and Read checkmarks. |
| `new-tab.png` | **The actual new tab** — clock + web-search box + the Today's Read card. Pick a calm wallpaper if possible. |

### Notes
- `privacy.png` and `offline.png` are **not** needed — those two frames
  (`privacy.html`, `offline.html`) are designed panels because the app has no
  dedicated privacy/offline *screen*. If you do have a real screen for either,
  tell me and I'll convert it to a screenshot frame.
- Zoom/crop per frame is controlled by `--zoom` and `--pos` in each HTML's
  `.shot` style. Bump `--zoom` to fill more; nudge `--pos` (`50% 0%` = top
  center) to reframe. Ask me to tune any frame.

## Output map

| Frame HTML | 1× (CWS) | 2× (`@2x`) |
|---|---|---|
| hero | `screenshots/01-…new-tab.png` | `01-read-x-bookmarks-not-the-feed@2x` |
| reader | `02-…threads…` | `02-read-threads-without-feeds@2x` |
| search | `03-…search…` | `03-find-any-bookmark-fast@2x` |
| export | `04-…export…` | `06-export-csv-markdown@2x` |
| privacy | `05-…local-first…` | — |
| highlight | — | `04-highlight-and-save-notes@2x` |
| track | — | `05-track-what-you-ve-read@2x` |
| offline | — | `07-keep-reading-offline@2x` |
| calmtab | — | `08-your-calm-new-tab-reader@2x` |
| marquee | `marquee-promo-tile.png` | `09-marquee-promo@2x` |
| small | `small-promo-tile.png` | `10-small-promo@2x` |
