import { useCallback, useEffect, useState } from "react";
import { BookmarkReader } from "../../../../../src/components/BookmarkReader";
import { decodeShareFragment } from "../../../../../src/lib/share/codec";
import { isSharePayload, readSharePayload } from "../../../../../src/lib/share/payload";
import {
  parseShareFragment,
  parseShareTweetId,
} from "../../../../../src/lib/share/link";
import type { Bookmark, ThreadTweet } from "../../../../../src/types";
import { SITE_LINKS } from "../site-content";
import { openThreadInExtension, pingExtension } from "./extension-bridge";

const HANDOFF_STORAGE_KEY = "totem.share.handoff";

interface DecodedThread {
  focalTweet: Bookmark;
  thread: ThreadTweet[];
}

type ViewState =
  | { status: "loading" }
  | { status: "opening" }
  | { status: "thread"; tweetId: string; decoded: DecodedThread }
  | { status: "unavailable"; tweetId: string | null };

/**
 * The handoff replaces this tab, so pressing Back returns here. Without this
 * marker the page would immediately bounce the reader open again and the user
 * could never get back to the web view.
 */
function hasHandedOff(tweetId: string): boolean {
  try {
    return window.sessionStorage.getItem(HANDOFF_STORAGE_KEY) === tweetId;
  } catch {
    return false;
  }
}

function markHandedOff(tweetId: string): void {
  try {
    window.sessionStorage.setItem(HANDOFF_STORAGE_KEY, tweetId);
  } catch {
    return;
  }
}

async function decodeThreadFromHash(): Promise<DecodedThread | null> {
  const fragment = parseShareFragment(window.location.hash);
  if (!fragment) return null;
  try {
    const payload = await decodeShareFragment(fragment);
    return isSharePayload(payload) ? readSharePayload(payload) : null;
  } catch {
    return null;
  }
}

export function SharedThreadApp() {
  const [view, setView] = useState<ViewState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const decoded = await decodeThreadFromHash();
      if (cancelled) return;

      // The path carries the id, but a link that lost its path (or a local
      // dev URL without the rewrite) can still name the tweet in its payload.
      const tweetId =
        parseShareTweetId(window.location.pathname) ??
        decoded?.focalTweet.tweetId ??
        null;

      if (tweetId && !hasHandedOff(tweetId)) {
        const presence = await pingExtension();
        if (cancelled) return;
        if (presence.installed && presence.canOpenThread) {
          markHandedOff(tweetId);
          setView({ status: "opening" });
          const opened = await openThreadInExtension(tweetId);
          if (opened || cancelled) return;
        }
      }

      setView(
        decoded && tweetId
          ? { status: "thread", tweetId, decoded }
          : { status: "unavailable", tweetId },
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const decoded = view.status === "thread" ? view.decoded : null;
  const loadDetail = useCallback(
    async (tweetId: string) => {
      if (!decoded || decoded.focalTweet.tweetId !== tweetId) {
        throw new Error("DETAIL_NOT_FOUND");
      }
      return { focalTweet: decoded.focalTweet, thread: decoded.thread };
    },
    [decoded],
  );

  if (view.status === "loading" || view.status === "opening") {
    return (
      <ShareSplash
        label={view.status === "opening" ? "Opening in Totem…" : "Loading thread…"}
      />
    );
  }

  if (view.status === "unavailable") {
    return <ShareUnavailable tweetId={view.tweetId} />;
  }

  return (
    <div className="reader-page min-h-dvh">
      <ShareRibbon />
      <BookmarkReader
        bookmark={view.decoded.focalTweet}
        relatedBookmarks={[]}
        getBookmarkHref={() => "/"}
        onBack={() => window.location.assign("/")}
        backLabel="Go to Totem"
        loadDetail={loadDetail}
      />
      <ShareInstallCard />
    </div>
  );
}

function ShareSplash({ label }: { label: string }) {
  return (
    <div className="reader-page flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function ShareRibbon() {
  return (
    <div className="border-b border-border bg-surface-card/60">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2 text-xs text-muted">
        <span>
          Shared from <span className="text-foreground">Totem</span>
        </span>
        <a
          href={SITE_LINKS.installUrl}
          className="ml-auto underline underline-offset-4 hover:text-foreground"
        >
          Add to Chrome
        </a>
      </div>
    </div>
  );
}

function ShareInstallCard() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-20">
      <div className="rounded border border-border bg-surface-card p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Read your own saved posts like this
        </h2>
        <p className="mt-2 text-sm text-muted">
          Totem puts your X bookmarks on every new tab — full threads, offline,
          with highlights and notes. Nothing leaves your browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={SITE_LINKS.installUrl}
            className="inline-flex h-9 items-center rounded bg-foreground px-4 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            Add to Chrome — Free
          </a>
          <a
            href={SITE_LINKS.demoPageUrl}
            className="text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Try the demo first
          </a>
        </div>
      </div>
    </div>
  );
}

function ShareUnavailable({ tweetId }: { tweetId: string | null }) {
  return (
    <div className="reader-page flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md rounded border border-border bg-surface-card p-6">
        <h1 className="text-lg font-semibold text-foreground">
          {tweetId ? "This thread didn't travel with the link" : "Broken share link"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {tweetId
            ? "The link is missing the part that carries the thread — it was probably trimmed when it was copied. You can still read the original on X, or open it in Totem."
            : "This link doesn't point at a shared thread. Check that you copied the whole thing."}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {tweetId && (
            <a
              href={`https://x.com/i/status/${tweetId}`}
              className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              View on X
            </a>
          )}
          <a
            href={SITE_LINKS.installUrl}
            className="inline-flex h-9 items-center rounded bg-foreground px-4 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            Add Totem to Chrome
          </a>
        </div>
      </div>
    </div>
  );
}
