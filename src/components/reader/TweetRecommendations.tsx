import type { Bookmark } from "../../types";
import { compactPreview } from "./utils";

interface Props {
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
}

export function TweetRecommendations({ relatedBookmarks, onOpenBookmark, onShuffle }: Props) {
  if (relatedBookmarks.length === 0) return null;

  return (
    <section className="mt-8 border-t border-x-border pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-balance text-x-text">
          Recommended bookmarks
        </h2>
        <div className="flex items-center gap-2">
          {onShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              className="inline-flex items-center gap-1.5 rounded-full border border-x-border bg-x-card px-2.5 py-1 text-xs font-medium text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-blue"
              aria-label="Shuffle recommendations"
              title="Shuffle recommendations"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 4l3 3-3 3" />
                <path d="M18 17l3 3-3 3" />
                <path d="M3 7h6a4 4 0 0 1 4 4" />
                <path d="M3 20h6a4 4 0 0 0 4-4" />
                <path d="M14 11h7" />
                <path d="M14 20h7" />
              </svg>
              Shuffle
            </button>
          )}
          <span className="text-xs text-x-text-secondary">3 picks</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {relatedBookmarks.slice(0, 3).map((related) => (
          <button
            key={related.tweetId}
            type="button"
            onClick={() => onOpenBookmark(related)}
            className="w-full rounded-xl border border-x-border bg-x-card/60 p-2.5 text-left transition-colors hover:bg-x-hover"
          >
            <div className="flex items-center gap-1.5">
              <img
                src={related.author.profileImageUrl}
                alt=""
                className="size-5 rounded-full"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-x-text">
                  {related.author.name}
                </p>
                <p className="truncate text-[11px] text-x-text-secondary">
                  @{related.author.screenName}
                </p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-pretty text-x-text">
              {compactPreview(related.text)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
