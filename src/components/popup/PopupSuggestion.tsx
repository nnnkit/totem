import { ShuffleIcon } from "@phosphor-icons/react";
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

function getKindLabel(bookmark: Bookmark): string {
  if (bookmark.tweetKind === "article") return "Article";
  if (bookmark.tweetKind === "thread" || bookmark.isThread) return "Thread";
  return "Post";
}

export function PopupSuggestion({ bookmark, onOpen, onShuffle }: Props) {
  if (!bookmark) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm text-x-text-secondary text-pretty">
          No bookmarks yet. Save some on X to get started.
        </p>
      </div>
    );
  }

  const minutes = estimateReadingMinutes(bookmark);

  return (
    <div className="p-3">
      <div className="rounded-xl border border-x-border bg-x-card p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            Pick for you
          </span>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Shuffle suggestion"
            title="Show another"
            className="rounded-md p-1.5 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
          >
            <ShuffleIcon className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <img
            src={bookmark.author.profileImageUrl}
            alt=""
            className="size-8 shrink-0 rounded-full"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-x-text">
              {bookmark.author.name}
            </p>
            <p className="truncate text-xs text-x-text-secondary">
              @{bookmark.author.screenName}
            </p>
          </div>
        </div>

        <h2 className="mt-3 text-sm font-semibold leading-snug text-x-text text-balance line-clamp-2">
          {pickTitle(bookmark)}
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-x-text-secondary text-pretty line-clamp-2">
          {pickExcerpt(bookmark)}
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs text-x-text-secondary">
          <span className="rounded-md bg-x-hover px-1.5 py-0.5 font-medium">
            {getKindLabel(bookmark)}
          </span>
          <span className="tabular-nums">{minutes} min read</span>
        </div>

        <button
          type="button"
          onClick={() => onOpen(bookmark)}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Read now
        </button>
      </div>
    </div>
  );
}
