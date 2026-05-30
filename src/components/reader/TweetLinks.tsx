import { useMemo } from "react";
import type { LinkCard, TweetUrl } from "../../types";
import { sanitizeUrl } from "./utils";

type ResolvedUrl = {
  href: string;
  displayUrl: string;
  card: LinkCard;
};

interface LinkPreviewCardProps {
  url: ResolvedUrl;
}

function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const { card } = url;
  return (
    <a
      href={url.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex overflow-hidden rounded border border-border bg-surface-link-card transition-colors hover:bg-surface-hover"
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.imageAlt || card.title || ""}
          className="size-28 shrink-0 border-r border-border object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center px-3 py-2.5">
        <span className="truncate text-xs text-muted">
          {card.domain || url.displayUrl}
        </span>
        <span className="mt-0.5 text-sm font-medium text-foreground line-clamp-1">
          {card.title}
        </span>
        {card.description && (
          <span className="mt-0.5 text-xs text-muted line-clamp-2">
            {card.description}
          </span>
        )}
      </div>
    </a>
  );
}

interface Props {
  urls: TweetUrl[];
}

/** Only renders URLs that have rich card data. Plain URLs are now kept inline in the tweet text. */
export function TweetLinks({ urls }: Props) {
  const cardUrls = useMemo<ResolvedUrl[]>(
    () =>
      urls.flatMap((url) => {
        if (!url.card?.title) return [];
        const href = sanitizeUrl((url.expandedUrl || url.url || "").trim());
        if (!href) return [];
        return [
          { href, displayUrl: (url.displayUrl || href).trim(), card: url.card },
        ];
      }),
    [urls],
  );

  if (cardUrls.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {cardUrls.map((url) => (
        <LinkPreviewCard key={`${url.href}-${url.displayUrl}-${url.card.title}`} url={url} />
      ))}
    </div>
  );
}
