import { useState } from "react";
import { usePopupBookmarks } from "./hooks/usePopupBookmarks";
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
      <div className="flex items-center justify-center bg-x-bg" style={{ height: 200 }}>
        <div className="animate-pulse">
          <svg
            viewBox="0 0 24 24"
            className="size-8 text-x-blue"
            fill="currentColor"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-x-bg" style={{ maxHeight: 500 }}>
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
          <PopupBookmarkList bookmarks={bookmarks} onOpen={openBookmark} />
        )}
      </div>
      <PopupFooter onOpenFullPage={openFullPage} />
    </div>
  );
}
