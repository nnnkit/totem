# Extension Screenshot Workflow

This is the canonical workflow for screenshots of the Totem extension UI, especially Chrome Web Store assets. Read this before capturing, regenerating, editing, or reviewing extension screenshots.

## When To Use This

Use this doc whenever the task mentions:

- extension screenshots
- Chrome Web Store screenshots
- CWS screenshots, marquee tile, or promo tile
- new-tab, reader, search, export, or privacy screenshots
- screenshot text or screenshot ordering

For website route screenshots, use the route-specific plan if one exists, such as `plans/astro-migration.md`. For extension/product screenshots, use this doc.

## Source Of Truth

Listing copy and screenshot text come from `plans/chrome-web-store-listing.md`.

Current CWS asset outputs live here:

```txt
images-for-promotions/chrome-web-store/
```

The CWS-ready screenshot set must contain exactly five PNG files in this order:

```txt
images-for-promotions/chrome-web-store/screenshots/01-twitter-bookmarks-on-every-new-tab.png
images-for-promotions/chrome-web-store/screenshots/02-read-twitter-threads-without-the-feed.png
images-for-promotions/chrome-web-store/screenshots/03-search-saved-posts-authors-links-threads.png
images-for-promotions/chrome-web-store/screenshots/04-export-twitter-bookmarks-markdown-csv-notion.png
images-for-promotions/chrome-web-store/screenshots/05-local-first-no-account-no-server.png
```

Promo tiles live beside the screenshot folder:

```txt
images-for-promotions/chrome-web-store/marquee-promo-tile.png
images-for-promotions/chrome-web-store/small-promo-tile.png
```

Keep the older `images-for-promotions/*@2x.png` files as source/reference material unless the user asks to replace them.

## Required Copy

Use these exact screenshot captions unless the listing plan has been intentionally updated:

```txt
Twitter bookmarks on every new tab
Read Twitter threads without the feed
Search saved posts, authors, links, and threads
Export Twitter bookmarks to Markdown, CSV, or Notion
Local-first. No Totem account. No server.
```

Use this exact promo tile copy:

```txt
Read, search, and export Twitter bookmarks.
```

Do not revert to X-first copy like `Read X Bookmarks, Not the Feed` or `A calm reader for your saved X bookmarks`.

## Dimensions

Chrome Web Store screenshots:

```txt
1280 x 800
```

Chrome Web Store promo tiles:

```txt
marquee: 1400 x 560
small: 440 x 280
```

Verify dimensions after every capture:

```bash
sips -g pixelWidth -g pixelHeight \
  images-for-promotions/chrome-web-store/screenshots/*.png \
  images-for-promotions/chrome-web-store/*.png
```

## Capture Tool

Use `agent-browser` for browser-rendered screenshots. Do not hand-edit bitmap text in Preview, Photoshop, or ad hoc image tools unless the user explicitly asks for a one-off manual edit.

Before using `agent-browser`, load its current guide:

```bash
agent-browser skills get core
```

Set the viewport before each capture size:

```bash
agent-browser --session cws-assets set viewport 1280 800
agent-browser --session cws-assets screenshot images-for-promotions/chrome-web-store/screenshots/01-twitter-bookmarks-on-every-new-tab.png

agent-browser --session cws-assets set viewport 1400 560
agent-browser --session cws-assets screenshot images-for-promotions/chrome-web-store/marquee-promo-tile.png

agent-browser --session cws-assets set viewport 440 280
agent-browser --session cws-assets screenshot images-for-promotions/chrome-web-store/small-promo-tile.png
```

Always close the screenshot session when done:

```bash
agent-browser --session cws-assets close
```

## Rendering Approach

For Chrome Web Store marketing assets, render a controlled HTML composition and capture it with `agent-browser`. This is preferred over editing PNGs because it keeps typography, crop, dimensions, and copy reproducible.

The composition should:

- use the existing extension UI screenshots as background/product frames
- overlay the required listing caption as real HTML text
- capture at the exact CWS dimensions listed above
- write only into `images-for-promotions/chrome-web-store/`
- keep source/reference screenshots outside `images-for-promotions/chrome-web-store/` unchanged

If regenerating the current asset set, remove the old generated screenshot files first so the folder does not accidentally contain eight screenshots:

```bash
find images-for-promotions/chrome-web-store/screenshots -type f -delete
```

Then capture exactly the five ordered screenshots and the two promo tiles.

## Visual Review

After capture, inspect at least:

- the hero screenshot
- the export screenshot
- the privacy screenshot
- the small promo tile

Use local image inspection:

```bash
sips -g pixelWidth -g pixelHeight images-for-promotions/chrome-web-store/screenshots/*.png
```

Then visually open the files. Check for:

- required text present and readable
- no overlap between caption and UI crop
- no clipped headline
- no old X-first copy
- browser/product frame not blank
- exactly five CWS screenshots in the folder
- promo tile text legible at 440 x 280

The export screenshot is the most likely to break because its title is long. If text overlaps the browser crop, tighten the headline size or move the crop down and recapture.

## Verification Commands

Run these checks before marking screenshot work complete:

```bash
find images-for-promotions/chrome-web-store -maxdepth 3 -type f -print | sort
```

Expected count:

```txt
5 screenshots
1 marquee promo tile
1 small promo tile
```

Dimension check:

```bash
sips -g pixelWidth -g pixelHeight \
  images-for-promotions/chrome-web-store/screenshots/*.png \
  images-for-promotions/chrome-web-store/*.png
```

If the work also changes extension or website code, run the relevant checks:

```bash
pnpm test
pnpm build:all
```

For docs-only screenshot process updates, do not run the full test suite unless the doc change is coupled to implementation changes.

## Reporting Back

When finishing screenshot work, report:

- output folder
- filenames generated
- dimension check result
- visual review result
- whether tests/builds were run

If Chrome Web Store dashboard submission is still pending, say that clearly. Generated repo assets are not the same thing as a submitted CWS listing update.
