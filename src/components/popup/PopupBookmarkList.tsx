import type { Bookmark } from "../../types";
import {
  pickTitle,
  estimateReadingMinutes,
} from "../../lib/bookmark-utils";

interface Props {
  bookmarks: Bookmark[];
  onOpen: (bookmark: Bookmark) => void;
}

export function PopupBookmarkList({ bookmarks, onOpen }: Props) {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-x-text-secondary">No bookmarks yet.</p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="space-y-1 p-2">
        {bookmarks.map((bookmark) => (
          <button
            key={bookmark.id}
            type="button"
            onClick={() => onOpen(bookmark)}
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-x-hover"
          >
            <img
              src={bookmark.author.profileImageUrl}
              alt=""
              className="size-8 shrink-0 rounded-full"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-x-text">
                {pickTitle(bookmark)}
              </p>
              <p className="text-xs text-x-text-secondary">
                @{bookmark.author.screenName} &middot;{" "}
                {estimateReadingMinutes(bookmark)} min
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
