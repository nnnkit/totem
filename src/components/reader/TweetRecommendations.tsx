import { ShuffleIcon } from "@phosphor-icons/react";
import type { Bookmark } from "../../types";
import { compactPreview } from "./utils";
import { Button } from "../ui/Button";

interface Props {
  relatedBookmarks: Bookmark[];
  onOpenBookmark: (bookmark: Bookmark) => void;
  onShuffle?: () => void;
}

export function TweetRecommendations({
  relatedBookmarks,
  onOpenBookmark,
  onShuffle,
}: Props) {
  if (relatedBookmarks.length === 0) return null;

  return (
    <section className="my-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg text-balance text-foreground">Read next</h2>
        <div className="flex items-center gap-2">
          {onShuffle && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onShuffle}
              aria-label="Shuffle"
              title="Shuffle"
            >
              <ShuffleIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {relatedBookmarks.slice(0, 3).map((related) => (
          <button
            key={related.tweetId}
            type="button"
            onClick={() => onOpenBookmark(related)}
            className="w-full rounded border border-border bg-surface-card/60 p-2.5 text-left transition-colors hover:bg-surface-hover"
          >
            <div className="flex items-center gap-1.5">
              <img
                src={related.author.profileImageUrl}
                alt=""
                className="size-5 rounded-full"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {related.author.name}
                </p>
                <p className="truncate text-xs text-muted">
                  @{related.author.screenName}
                </p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-pretty text-foreground">
              {compactPreview(related.text)}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
