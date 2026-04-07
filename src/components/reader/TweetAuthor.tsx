import type { Author } from "../../types";
import { cn } from "../../lib/cn";
import { formatCompactNumber } from "../../lib/text";
import { sanitizeUrl } from "./utils";

export function VerifiedBadge() {
  return (
    <svg
      viewBox="0 0 22 22"
      className="size-4 shrink-0 text-accent"
      fill="currentColor"
    >
      <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.538.354 1.167.551 1.813.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z" />
    </svg>
  );
}

interface AffiliateBadgeProps {
  affiliate: NonNullable<Author["affiliate"]>;
}

export function AffiliateBadge({ affiliate }: AffiliateBadgeProps) {
  const content = (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      {affiliate.badgeUrl && (
        <img
          src={affiliate.badgeUrl}
          alt=""
          className="size-4 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
          loading="lazy"
        />
      )}
      <span className="truncate">{affiliate.name}</span>
    </span>
  );

  if (affiliate.url && sanitizeUrl(affiliate.url)) {
    return (
      <a
        href={sanitizeUrl(affiliate.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex hover:underline"
      >
        {content}
      </a>
    );
  }
  return content;
}

const AVATAR_SIZE: Record<string, string> = {
  xs: "size-5",
  sm: "size-6",
  md: "size-10",
  lg: "size-11",
};

interface TweetAuthorProps {
  author: Author;
  /** Controls the avatar image size. Default: "lg" */
  avatarSize?: "xs" | "sm" | "md" | "lg";
  /** Set to false to hide the avatar entirely (e.g. thread items where avatar is in the connector column). Default: true */
  showAvatar?: boolean;
  /** When provided, wraps the avatar in a button instead of an <a> link. Use for toggling a profile card. */
  onAvatarClick?: () => void;
  /** "inline" renders name + handle on a single row. "stacked" renders name on one line, handle below. Default: "stacked" */
  layout?: "inline" | "stacked";
  /** Optional date string shown after @handle in inline layout */
  date?: string;
  /** Whether to show followers count. Default: false */
  showFollowers?: boolean;
  className?: string;
}

export function TweetAuthor({
  author,
  avatarSize = "lg",
  showAvatar = true,
  onAvatarClick,
  layout = "stacked",
  date,
  showFollowers = false,
  className,
}: TweetAuthorProps) {
  const authorUrl = `https://x.com/${author.screenName}`;
  const sizeClass = AVATAR_SIZE[avatarSize] ?? AVATAR_SIZE.lg;

  const avatarImg = (
    <img
      src={author.profileImageUrl}
      alt={`@${author.screenName}`}
      className={cn(
        sizeClass,
        "rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
        "transition-opacity hover:opacity-80",
      )}
      loading="lazy"
    />
  );

  const avatar = showAvatar && (
    <div className="shrink-0">
      {onAvatarClick ? (
        <button
          type="button"
          onClick={onAvatarClick}
          title={`View ${author.name}'s profile`}
        >
          {avatarImg}
        </button>
      ) : (
        <a href={authorUrl} target="_blank" rel="noopener noreferrer">
          {avatarImg}
        </a>
      )}
    </div>
  );

  if (layout === "inline") {
    return (
      <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
        {avatar}
        <a
          href={authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-bold text-foreground hover:underline"
        >
          {author.name}
        </a>
        {author.verified && <VerifiedBadge />}
        {author.affiliate && <AffiliateBadge affiliate={author.affiliate} />}
        <span className="shrink-0 text-muted">@{author.screenName}</span>
        {date && (
          <>
            <span className="shrink-0 text-muted">&middot;</span>
            <span className="shrink-0 text-muted">{date}</span>
          </>
        )}
        {showFollowers && author.followersCount != null && (
          <>
            <span className="shrink-0 text-muted">&middot;</span>
            <span className="shrink-0 text-muted">
              {formatCompactNumber(author.followersCount)} followers
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {avatar}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <a
            href={authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-semibold text-foreground hover:underline"
          >
            {author.name}
          </a>
          {author.verified && <VerifiedBadge />}
          {author.affiliate && <AffiliateBadge affiliate={author.affiliate} />}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted">
          <span>@{author.screenName}</span>
          {showFollowers && author.followersCount != null && (
            <>
              <span>&middot;</span>
              <span>{formatCompactNumber(author.followersCount)} followers</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
