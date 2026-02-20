import type { LinkCard, TweetUrl } from "../../types";

function isArticleHref(href: string): boolean {
  return /(?:x|twitter)\.com\/i\/article\//i.test(href);
}

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
      className="block overflow-hidden rounded-xl border border-x-border bg-x-link-card transition-colors hover:bg-x-hover"
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.imageAlt || card.title || ""}
          className="aspect-2/1 w-full object-cover"
        />
      )}
      <div className="px-4 py-3">
        <span className="block text-xs text-x-text-secondary">
          {card.domain || url.displayUrl}
        </span>
        <span className="mt-0.5 block text-sm font-medium text-x-text line-clamp-2">
          {card.title}
        </span>
        {card.description && (
          <span className="mt-0.5 block text-xs text-x-text-secondary line-clamp-2">
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
            className="block rounded-xl border border-x-border bg-x-link-card px-4 py-3 transition-colors hover:bg-x-hover"
          >
            <span className="text-sm text-x-blue">{url.displayUrl}</span>
            {url.displayUrl !== url.href && (
              <span className="mt-1 block text-xs text-x-text-secondary">
                {url.href}
              </span>
            )}
          </a>
        ),
      )}
    </div>
  );
}

interface MarkAsReadButtonProps {
  onMarkAsRead: () => void;
  isMarkedRead: boolean;
}

function MarkAsReadButton({
  onMarkAsRead,
  isMarkedRead,
}: MarkAsReadButtonProps) {
  return (
    <button
      type="button"
      onClick={onMarkAsRead}
      disabled={isMarkedRead}
      className={
        isMarkedRead
          ? "inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400"
          : "inline-flex items-center gap-1.5 rounded-full border border-x-border bg-x-card px-3 py-1.5 text-xs font-medium text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text"
      }
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      {isMarkedRead ? "Marked as read" : "Mark as read"}
    </button>
  );
}

interface Props {
  urls: TweetUrl[];
  preferArticleButton?: boolean;
  onMarkAsRead?: () => void;
  isMarkedRead?: boolean;
}

export function TweetUrls({
  urls,
  preferArticleButton = false,
  onMarkAsRead,
  isMarkedRead,
}: Props) {
  const resolvedUrls: ResolvedUrl[] = urls.flatMap((url) => {
    const href = (url.expandedUrl || url.url || "").trim();
    if (!href) return [];
    return [
      { href, displayUrl: (url.displayUrl || href).trim(), card: url.card },
    ];
  });

  const markAsReadBtn = onMarkAsRead ? (
    <MarkAsReadButton
      onMarkAsRead={onMarkAsRead}
      isMarkedRead={isMarkedRead ?? false}
    />
  ) : null;

  if (resolvedUrls.length === 0) {
    if (!markAsReadBtn) return null;
    return <div className="mt-5 flex justify-end">{markAsReadBtn}</div>;
  }

  const articleUrl = resolvedUrls.find((url) => isArticleHref(url.href));
  if (preferArticleButton && articleUrl) {
    const remainingUrls = resolvedUrls.filter(
      (url) => url.href !== articleUrl.href,
    );
    return (
      <>
        <div className="mt-5 flex items-center justify-end gap-2">
          {markAsReadBtn}
          <a
            href={articleUrl.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-x-border bg-x-card px-3 py-1.5 text-xs font-medium text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-blue"
          >
            Original article
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
              <path d="M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6v2H6v10h10v-5h2zm-6.29-6.29l1.41 1.41L17 4.24V11h2V1h-10v2h6.76l-4.05 4.05z" />
            </svg>
          </a>
        </div>
        <LinkCards urls={remainingUrls} />
      </>
    );
  }

  return (
    <>
      {markAsReadBtn && (
        <div className="mt-5 flex justify-end">{markAsReadBtn}</div>
      )}
      <LinkCards urls={resolvedUrls} />
    </>
  );
}
