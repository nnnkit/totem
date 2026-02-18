import type { TweetUrl } from "../../types";

function isArticleHref(href: string): boolean {
  return /(?:x|twitter)\.com\/i\/article\//i.test(href);
}

type ResolvedUrl = {
  href: string;
  displayUrl: string;
};

interface LinkCardsProps {
  urls: ResolvedUrl[];
}

function LinkCards({ urls }: LinkCardsProps) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {urls.map((url, index) => (
        <a
          key={`${url.href}-${index}`}
          href={url.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl border border-x-border bg-x-link-card px-4 py-3 transition-colors hover:bg-x-hover"
        >
          <span className="text-sm text-x-blue">
            {url.displayUrl}
          </span>
          {url.displayUrl !== url.href && (
            <span className="mt-1 block text-xs text-x-text-secondary">
              {url.href}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

interface Props {
  urls: TweetUrl[];
  preferArticleButton?: boolean;
}

export function TweetUrls({ urls, preferArticleButton = false }: Props) {
  const resolvedUrls: ResolvedUrl[] = urls
    .map((url) => {
      const href = (url.expandedUrl || url.url || "").trim();
      if (!href) return null;
      return {
        href,
        displayUrl: (url.displayUrl || href).trim(),
      };
    })
    .filter((url): url is ResolvedUrl => url !== null);

  if (resolvedUrls.length === 0) return null;

  const articleUrl = resolvedUrls.find((url) => isArticleHref(url.href));
  if (preferArticleButton && articleUrl) {
    const remainingUrls = resolvedUrls.filter(
      (url) => url.href !== articleUrl.href,
    );
    return (
      <>
        <div className="mt-5 flex justify-end">
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

  return <LinkCards urls={resolvedUrls} />;
}
