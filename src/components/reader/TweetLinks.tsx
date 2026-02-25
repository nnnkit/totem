import { useMemo } from "react";
import {
  ArrowSquareOutIcon,
  BookmarkSimpleIcon,
  CheckIcon,
  LightningIcon,
} from "@phosphor-icons/react";
import type { LinkCard, TweetUrl } from "../../types";
import { buildGrokUrl, sanitizeUrl } from "./utils";
import { Button } from "../ui/Button";

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
      className="flex overflow-hidden rounded-xl border border-border bg-surface-link-card transition-colors hover:bg-surface-hover"
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

interface LinkCardsProps {
  urls: ResolvedUrl[];
}

function LinkCards({ urls }: LinkCardsProps) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {urls.map((url, index) =>
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
            className="block rounded-xl border border-border bg-surface-link-card px-4 py-3 transition-colors hover:bg-surface-hover"
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

interface ReadStatusButtonProps {
  onToggle: () => void;
  isRead: boolean;
}

function ReadStatusButton({ onToggle, isRead }: ReadStatusButtonProps) {
  return (
    <Button
      variant={isRead ? "outline" : "outline"}
      size="sm"
      onClick={onToggle}
      className={
        isRead
          ? "border-green-500/30 bg-green-500/10 text-success hover:border-green-500/50 hover:bg-green-500/20"
          : ""
      }
    >
      <CheckIcon weight="bold" className="size-3.5" />
      {isRead ? "Read" : "Mark as read"}
    </Button>
  );
}

interface Props {
  urls: TweetUrl[];
  viewOnXUrl?: string;
  onToggleRead?: () => void;
  isMarkedRead?: boolean;
  onDeleteBookmark?: () => void;
}

export function TweetLinks({
  urls,
  viewOnXUrl,
  onToggleRead,
  isMarkedRead,
  onDeleteBookmark,
}: Props) {
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

  const readStatusBtn = onToggleRead ? (
    <ReadStatusButton
      onToggle={onToggleRead}
      isRead={isMarkedRead ?? false}
    />
  ) : null;

  const viewOnXLink = viewOnXUrl ? (
    <a
      href={viewOnXUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
    >
      View on X
      <ArrowSquareOutIcon className="size-3.5" />
    </a>
  ) : null;

  const askGrokLink = viewOnXUrl ? (
    <a
      href={buildGrokUrl(viewOnXUrl)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      <LightningIcon weight="bold" className="size-3.5" />
      Ask Grok
    </a>
  ) : null;

  const deleteBookmarkBtn = onDeleteBookmark ? (
    <Button
      variant="outline"
      size="sm"
      onClick={onDeleteBookmark}
      className="hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10"
    >
      <BookmarkSimpleIcon weight="fill" className="size-3.5" />
      Remove
    </Button>
  ) : null;

  const hasActions = readStatusBtn || viewOnXLink || askGrokLink || deleteBookmarkBtn;

  return (
    <>
      <LinkCards urls={resolvedUrls} />
      {hasActions && (
        <div className="mt-5 flex items-center justify-end gap-3">
          {viewOnXLink}
          {askGrokLink}
          {deleteBookmarkBtn}
          {readStatusBtn}
        </div>
      )}
    </>
  );
}
