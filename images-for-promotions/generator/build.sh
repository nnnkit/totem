#!/usr/bin/env bash
# Regenerate all Totem promo images from the HTML frames in this folder.
#
# 1. Drop the real product screenshots into ./input/ (see README.md for the list).
#    Use PNG, captured as large as possible (>=1900px wide; 2x/retina is ideal) —
#    the embedded UI is only as sharp as the screenshot you feed it.
# 2. Run: ./build.sh
#
# Quality: every frame is rendered at 2x and the 1x Chrome Web Store images are
# downscaled from that (supersampling) for razor-sharp text and edges. The @2x
# marketing set keeps the full 2x render.
#
# Requires: agent-browser on PATH + sips (macOS). No dev server needed.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
CWS="$ROOT/chrome-web-store"
SHOTS="$CWS/screenshots"
SESSION="promo-build"
TMP="$DIR/.render.png"
mkdir -p "$SHOTS"

# emit <html> <cws_out|-> <x2_out|-> <baseW> <baseH> [required-input]
# Renders the frame once at 2x (baseW*2 x baseH*2). Saves that as the @2x output,
# and downscales a copy to baseW x baseH for the Chrome Web Store output.
emit () {
  local html="$1" cws="$2" x2="$3" w="$4" h="$5" need="${6:-}"
  if [ -n "$need" ] && [ ! -f "$DIR/input/$need" ]; then
    printf '  %-44s SKIP (missing input/%s)\n' "$html" "$need"
    return
  fi
  agent-browser --session "$SESSION" set viewport "$((w*2))" "$((h*2))" >/dev/null 2>&1
  agent-browser --session "$SESSION" open "file://$DIR/$html" >/dev/null 2>&1
  agent-browser --session "$SESSION" batch \
    "eval (()=>{document.body.style.zoom='2';return 1})()" \
    "wait 1300" \
    "screenshot $TMP" >/dev/null 2>&1
  [ "$x2"  != "-" ] && cp "$TMP" "$x2"
  [ "$cws" != "-" ] && sips -z "$h" "$w" "$TMP" --out "$cws" >/dev/null 2>&1
  printf '  %-44s -> %s%s\n' "$html" \
    "$([ "$cws" != "-" ] && echo "1x " )" "$([ "$x2" != "-" ] && echo "2x" )"
}

echo "Rendering (2x supersampled)…"
#     html            CWS 1x output                                              @2x output                                  baseW baseH  input
emit hero.html      "$SHOTS/01-twitter-bookmarks-on-every-new-tab.png"          "$ROOT/01-read-x-bookmarks-not-the-feed@2x.png" 1280 800 todays-read.png
emit reader.html    "$SHOTS/02-read-twitter-threads-without-the-feed.png"       "$ROOT/02-read-threads-without-feeds@2x.png"    1280 800 reader.png
emit search.html    "$SHOTS/03-search-saved-posts-authors-links-threads.png"    "$ROOT/03-find-any-bookmark-fast@2x.png"        1280 800 search.png
emit export.html    "$SHOTS/04-export-twitter-bookmarks-markdown-csv-notion.png" "$ROOT/06-export-csv-markdown@2x.png"          1280 800 export.png
emit privacy.html   "$SHOTS/05-local-first-no-account-no-server.png"            "-"                                             1280 800
emit highlight.html "-"                                                          "$ROOT/04-highlight-and-save-notes@2x.png"      1280 800 highlight.png
emit track.html     "-"                                                          "$ROOT/05-track-what-you-ve-read@2x.png"        1280 800 track.png
emit offline.html   "-"                                                          "$ROOT/07-keep-reading-offline@2x.png"          1280 800
emit calmtab.html   "-"                                                          "$ROOT/08-your-calm-new-tab-reader@2x.png"      1280 800 new-tab.png
emit marquee.html   "$CWS/marquee-promo-tile.png"                               "$ROOT/09-marquee-promo@2x.png"                 1400 560 todays-read.png
emit small.html     "$CWS/small-promo-tile.png"                                 "$ROOT/10-small-promo@2x.png"                   440  280

agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
rm -f "$TMP"
echo "Done."
