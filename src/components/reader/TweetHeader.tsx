import { useState, useRef, useEffect, useCallback } from "react";
import type { Bookmark, TweetKind } from "../../types";
import { KIND_LABEL } from "./types";
import { sanitizeUrl } from "./utils";
import { cn } from "../../lib/cn";
import { formatCompactNumber } from "../../lib/text";
import { CARD_CLOSE_MS } from "../../lib/constants";
import { TweetAuthor, VerifiedBadge, AffiliateBadge } from "./TweetAuthor";

interface TweetKindPillProps {
  kind: TweetKind;
}

function TweetKindPill({ kind }: TweetKindPillProps) {
  return (
    <span className="inline-block rounded bg-surface-hover px-2 py-0.5 text-xs font-medium text-muted">
      {KIND_LABEL[kind]}
    </span>
  );
}

export { TweetKindPill };

function formatJoinDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en", { month: "long", year: "numeric" });
}

function formatHeaderDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AuthorCardProps {
  author: Bookmark["author"];
  closing: boolean;
  onClose: () => void;
}

function AuthorCard({ author, closing, onClose }: AuthorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const authorUrl = `https://x.com/${author.screenName}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "mb-4 overflow-hidden rounded bg-surface-card shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06),inset_0_0_0_1px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.15),inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        closing ? "animate-card-out" : "animate-card-in",
      )}
    >
      {author.bannerUrl && (
        <img
          src={author.bannerUrl}
          alt=""
          className="h-24 w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="relative px-4 pb-4">
        <div className={author.bannerUrl ? "-mt-8" : "mt-4"}>
          <img
            src={author.profileImageUrl}
            alt={`@${author.screenName}`}
            className="size-16 rounded-full border-2 border-surface-card"
            loading="lazy"
          />
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-1.5">
            <a
              href={authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-bold text-foreground hover:underline"
            >
              {author.name}
            </a>
            {author.verified && <VerifiedBadge />}
            {author.affiliate && (
              <AffiliateBadge affiliate={author.affiliate} />
            )}
          </div>
          <a
            href={authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted hover:underline"
          >
            @{author.screenName}
          </a>
        </div>

        {author.bio && (
          <p className="mt-2 truncate text-sm text-foreground">{author.bio}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {author.followingCount != null && (
            <span>
              <span className="font-semibold text-foreground">
                {formatCompactNumber(author.followingCount)}
              </span>{" "}
              <span className="text-muted">Following</span>
            </span>
          )}
          {author.followersCount != null && (
            <span>
              <span className="font-semibold text-foreground">
                {formatCompactNumber(author.followersCount)}
              </span>{" "}
              <span className="text-muted">Followers</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {author.website && sanitizeUrl(author.website) && (
            <a
              href={sanitizeUrl(author.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-accent hover:underline"
            >
              {author.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {author.createdAt && (
            <span>Joined {formatJoinDate(author.createdAt)}</span>
          )}
        </div>

        <a
          href={authorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded bg-foreground px-4 py-1.5 text-sm font-semibold text-surface hover:opacity-90"
        >
          View on X
        </a>
      </div>
    </div>
  );
}


interface Props {
  author: Bookmark["author"];
  displayKind: TweetKind;
  createdAt: number;
  readingMinutes?: number | null;
}

export function TweetHeader({ author, displayKind, createdAt, readingMinutes }: Props) {
  const [cardOpen, setCardOpen] = useState(false);
  const [cardClosing, setCardClosing] = useState(false);

  const handleClose = useCallback(() => {
    setCardClosing(true);
    setTimeout(() => {
      setCardOpen(false);
      setCardClosing(false);
    }, CARD_CLOSE_MS);
  }, []);

  const toggleCard = useCallback(() => {
    if (cardOpen) {
      handleClose();
    } else {
      setCardOpen(true);
    }
  }, [cardOpen, handleClose]);

  return (
    <>
      {/* Author row */}
      <TweetAuthor
        author={author}
        avatarSize="lg"
        onAvatarClick={toggleCard}
        layout="stacked"
        showFollowers
      />

      {cardOpen && (
        <div className="mt-3">
          <AuthorCard
            author={author}
            closing={cardClosing}
            onClose={handleClose}
          />
        </div>
      )}

      {/* Meta row: kind pill + reading time */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TweetKindPill kind={displayKind} />
        {createdAt > 0 && (
          <>
            <span className="text-xs text-muted">&middot;</span>
            <span className="text-xs text-muted">
              {formatHeaderDate(createdAt)}
            </span>
          </>
        )}
        {readingMinutes != null && readingMinutes > 1 && (
          <>
            <span className="text-xs text-muted">&middot;</span>
            <span className="text-xs tabular-nums text-muted">
              {readingMinutes} min read
            </span>
          </>
        )}
      </div>
    </>
  );
}
