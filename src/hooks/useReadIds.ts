import { useCallback, useEffect, useState } from "react";
import type { Bookmark } from "../types";

const READ_IDS_KEY = "tw_breath_read_ids";

function loadReadIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set<string>();
  const raw = localStorage.getItem(READ_IDS_KEY);
  if (!raw) return new Set<string>();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function persistReadIds(value: Set<string>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(value)));
}

export function useReadIds(bookmarks: Bookmark[]) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());

  useEffect(() => {
    if (bookmarks.length === 0) return;

    setReadIds((previous) => {
      if (previous.size === 0) return previous;

      const liveIds = new Set(bookmarks.map((bookmark) => bookmark.tweetId));
      let changed = false;
      const next = new Set<string>();

      for (const id of previous) {
        if (liveIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      if (!changed) return previous;

      persistReadIds(next);
      return next;
    });
  }, [bookmarks]);

  const markAsRead = useCallback((tweetId: string) => {
    setReadIds((previous) => {
      if (previous.has(tweetId)) return previous;
      const next = new Set(previous);
      next.add(tweetId);
      persistReadIds(next);
      return next;
    });
  }, []);

  return { readIds, markAsRead };
}
