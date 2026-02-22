import { useMemo } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { Bookmark } from "../../types";
import { pickTitle } from "../../lib/bookmark-utils";
import { sortIndexToTimestamp } from "../../lib/time";
import { NEW_BADGE_CUTOFF_MS } from "../../lib/constants";

interface Props {
  bookmarks: Bookmark[];
  onOpen: (bookmark: Bookmark) => void;
  query: string;
  onQueryChange: (q: string) => void;
  isSearching: boolean;
}

function getKindLabel(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  return "Post";
}

export function PopupBookmarkList({ bookmarks, onOpen, query, onQueryChange, isSearching }: Props) {
  const newBookmarkIds = useMemo(() => {
    const cutoff = Date.now() - NEW_BADGE_CUTOFF_MS;
    const ids = new Set<string>();
    for (const b of bookmarks) {
      if (
        b.sortIndex !== b.tweetId &&
        sortIndexToTimestamp(b.sortIndex) >= cutoff
      )
        ids.add(b.tweetId);
    }
    return ids;
  }, [bookmarks]);

  return (
    <div className="p-2">
      <div className="sticky top-0 z-10 bg-x-bg pb-1">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-x-text-secondary" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full rounded-lg border border-x-border bg-x-card py-2 pl-8 pr-3 text-xs text-x-text placeholder:text-x-text-secondary/60 focus:border-accent focus:outline-none"
          />
        </div>
        {isSearching && (
          <p className="px-1 pt-1.5 text-xs tabular-nums text-x-text-secondary">
            {bookmarks.length} {bookmarks.length === 1 ? "result" : "results"}
          </p>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-sm text-x-text-secondary text-pretty">
            {isSearching
              ? "No bookmarks match your search."
              : "No bookmarks yet. Save some on X to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {bookmarks.map((bookmark) => (
            <button
              key={bookmark.id}
              type="button"
              onClick={() => onOpen(bookmark)}
              className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-x-hover"
            >
              <img
                src={bookmark.author.profileImageUrl}
                alt=""
                className="mt-0.5 size-8 shrink-0 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium leading-snug text-x-text line-clamp-2">
                    {pickTitle(bookmark)}
                  </p>
                  {newBookmarkIds.has(bookmark.tweetId) && (
                    <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
                      New
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-x-text-secondary">
                  <span className="truncate">@{bookmark.author.screenName}</span>
                  <span>&middot;</span>
                  <span className="shrink-0">{getKindLabel(bookmark)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
