import { useState } from "react";
import { usePopupBookmarks } from "./hooks/usePopupBookmarks";
import { useBookmarkSearch } from "./hooks/useBookmarkSearch";
import { useTheme } from "./hooks/useTheme";
import { PopupHeader } from "./components/popup/PopupHeader";
import { PopupSuggestion } from "./components/popup/PopupSuggestion";
import { PopupBookmarkList } from "./components/popup/PopupBookmarkList";
import { PopupFooter } from "./components/popup/PopupFooter";
import type { Bookmark } from "./types";

type Tab = "discover" | "all";

export function PopupApp() {
  useTheme();
  const { bookmarks, stats, randomBookmark, shuffleSuggestion, syncing, sync, isLoading } =
    usePopupBookmarks();
  const { query, setQuery, results, isSearching } = useBookmarkSearch(bookmarks);
  const [activeTab, setActiveTab] = useState<Tab>("discover");

  const openBookmark = (bookmark: Bookmark) => {
    const url = chrome.runtime.getURL(
      `newtab.html?read=${bookmark.tweetId}`,
    );
    chrome.tabs.create({ url });
  };

  const openFullPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
  };

  if (isLoading) {
    return (
      <div className="bg-x-bg">
        <div className="animate-pulse px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 rounded-md bg-x-border/50" />
              <div className="h-5 w-8 rounded-md bg-x-border/40" />
            </div>
            <div className="size-7 rounded-md bg-x-border/30" />
          </div>
          <div className="mt-2.5 h-8 rounded-lg bg-x-border/30" />
        </div>
        <div className="px-3 pb-3">
          <div className="rounded-xl border border-x-border/30 p-4">
            <div className="h-5 w-20 rounded-md bg-x-border/40" />
            <div className="mt-3 flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-x-border/40" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 rounded bg-x-border/40" />
                <div className="h-3 w-16 rounded bg-x-border/30" />
              </div>
            </div>
            <div className="mt-3 h-4 w-full rounded bg-x-border/40" />
            <div className="mt-1.5 h-3 w-3/4 rounded bg-x-border/30" />
            <div className="mt-3 flex items-center gap-2">
              <div className="h-5 w-12 rounded-md bg-x-border/30" />
              <div className="h-3 w-16 rounded bg-x-border/30" />
            </div>
            <div className="mt-4 h-10 w-full rounded-lg bg-x-border/30" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[500px] flex-col bg-x-bg">
      <PopupHeader
        stats={stats}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        syncing={syncing}
        onSync={sync}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "discover" ? (
          <PopupSuggestion
            bookmark={randomBookmark}
            onOpen={openBookmark}
            onShuffle={shuffleSuggestion}
          />
        ) : (
          <PopupBookmarkList
            bookmarks={results}
            onOpen={openBookmark}
            query={query}
            onQueryChange={setQuery}
            isSearching={isSearching}
          />
        )}
      </div>
      <PopupFooter onOpenFullPage={openFullPage} />
    </div>
  );
}
