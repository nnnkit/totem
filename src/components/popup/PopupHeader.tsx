import { ArrowsClockwise } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";
import type { Stats } from "../../hooks/usePopupBookmarks";

type Tab = "discover" | "all";

interface Props {
  stats: Stats;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  syncing: boolean;
  onSync: () => void;
}

export function PopupHeader({ stats, activeTab, onTabChange, syncing, onSync }: Props) {
  const statLine = [
    stats.articles > 0 && `${stats.articles} articles`,
    stats.threads > 0 && `${stats.threads} threads`,
    stats.posts > 0 && `${stats.posts} posts`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="bg-x-bg px-4 pt-3 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-x-text text-balance">Bookmarks</h1>
            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-xs font-medium tabular-nums text-accent">
              {stats.total}
            </span>
          </div>
          {statLine && (
            <p className="mt-0.5 text-xs tabular-nums text-x-text-secondary">
              {statLine}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="rounded-md p-1.5 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text disabled:opacity-50"
          aria-label="Sync bookmarks"
          title="Sync bookmarks"
        >
          <ArrowsClockwise className={cn("size-4", syncing && "animate-spin")} />
        </button>
      </div>

      <div className="mt-2.5 flex rounded-lg bg-x-border/20 p-0.5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "discover"}
          onClick={() => onTabChange("discover")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
            activeTab === "discover"
              ? "bg-x-card text-accent shadow-sm ring-1 ring-x-border/50"
              : "text-x-text-secondary hover:text-x-text",
          )}
        >
          Discover
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => onTabChange("all")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
            activeTab === "all"
              ? "bg-x-card text-accent shadow-sm ring-1 ring-x-border/50"
              : "text-x-text-secondary hover:text-x-text",
          )}
        >
          All Bookmarks
        </button>
      </div>
    </div>
  );
}
