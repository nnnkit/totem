import type { Bookmark } from "../../types";
import {
  pickTitle,
  pickExcerpt,
  estimateReadingMinutes,
} from "../../lib/bookmark-utils";

interface Props {
  bookmark: Bookmark | null;
  onOpen: (bookmark: Bookmark) => void;
  onShuffle: () => void;
}

export function PopupSuggestion({ bookmark, onOpen, onShuffle }: Props) {
  if (!bookmark) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-x-text-secondary">
          No bookmarks yet. Save some on X to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="rounded-xl border border-x-border bg-x-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-x-blue">
            Pick for you
          </p>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Show different suggestion"
            title="Show another"
            className="rounded-full p-1 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M17.65 6.35a7.95 7.95 0 0 0-6.48-2.31c-3.67.37-6.69 3.35-7.1 7.02C3.52 15.91 7.27 20 12 20a7.98 7.98 0 0 0 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.64 0-6.5-3.2-5.94-6.91.4-2.66 2.56-4.82 5.22-5.22a5.98 5.98 0 0 1 4.87 1.78L13.5 10.5H20V4l-2.35 2.35z" />
            </svg>
          </button>
        </div>
        <h2 className="mt-2 text-sm font-semibold leading-snug text-x-text">
          {pickTitle(bookmark)}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-x-text-secondary line-clamp-3">
          {pickExcerpt(bookmark)}
        </p>
        <p className="mt-2 text-xs text-x-text-secondary">
          @{bookmark.author.screenName} &middot;{" "}
          {estimateReadingMinutes(bookmark)} min
        </p>
        <button
          type="button"
          onClick={() => onOpen(bookmark)}
          className="mt-3 w-full rounded-lg bg-x-blue px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Read now &rarr;
        </button>
      </div>
    </div>
  );
}
