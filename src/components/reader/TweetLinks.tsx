import { useMemo } from "react";
import type { LinkCard, TweetUrl } from "../../types";
import { sanitizeUrl } from "./utils";

type ResolvedUrl = {
  href: string;
  displayUrl: string;
  card?: LinkCard;
};

interface LinkPreviewCardProps {
  url: ResolvedUrl;
  card: LinkCard;
}

function LinkPreviewCard({ url, card }: LinkPreviewCardProps) {
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
          className="size-28 shrink-0 object-cover"
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

export function TweetLinks({ urls }: Props) {
  const resolvedUrls = useMemo<ResolvedUrl[]>(
    () =>
      urls.flatMap((url) => {
        const href = sanitizeUrl((url.expandedUrl || url.url || "").trim());
        if (!href) return [];
        return [
          { href, displayUrl: (url.displayUrl || href).trim(), card: url.card },
        ];
      }),
    [urls],
  );

  if (resolvedUrls.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-2.5">
      {resolvedUrls.map((url, index) =>
        url.card?.title ? (
          <LinkPreviewCard
            key={`${url.href}-${index}`}
            url={url}
            card={url.card}
          />
        ) : (
          <a
            key={`${url.href}-${index}`}
            href={url.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded border border-border bg-surface-link-card px-4 py-3 transition-colors hover:bg-surface-hover"
          >
            <span className="text-sm text-accent">{url.displayUrl}</span>
            {url.displayUrl !== url.href && (
              <span className="mt-1 block text-xs text-muted">
                {url.href}
              </span>
            )}
          </a>
        ),
      )}
    </div>
  );
}
