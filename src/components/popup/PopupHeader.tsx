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

interface StatItemProps {
  value: number | string;
  label: string;
}

function StatItem({ value, label }: StatItemProps) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-x-hover/60 px-2 py-1.5">
      <span className="text-sm font-bold text-x-text">{value}</span>
      <span className="text-xs text-x-text-secondary">{label}</span>
    </div>
  );
}

export function PopupHeader({ stats, activeTab, onTabChange, syncing, onSync }: Props) {
  return (
    <div className="border-b border-x-border bg-x-bg px-4 pt-3 pb-0">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-x-text">X Bookmarks</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-x-text-secondary">
            {stats.total} saved
          </span>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="rounded-md p-1 text-x-text-secondary transition-colors hover:bg-x-hover hover:text-x-text disabled:opacity-50"
            aria-label="Sync bookmarks"
            title="Sync bookmarks"
          >
            <svg
              viewBox="0 0 24 24"
              className={cn("size-3.5", syncing && "animate-spin")}
              fill="currentColor"
            >
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <StatItem value={stats.articles} label="Articles" />
        <StatItem value={stats.threads} label="Threads" />
        <StatItem value={stats.posts} label="Posts" />
      </div>

      <div className="mt-3 flex" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "discover"}
          onClick={() => onTabChange("discover")}
          className={cn(
            "relative flex-1 py-2 text-sm font-medium transition-colors",
            activeTab === "discover"
              ? "text-x-text"
              : "text-x-text-secondary hover:text-x-text",
          )}
        >
          Discover
          {activeTab === "discover" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-x-blue" />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => onTabChange("all")}
          className={cn(
            "relative flex-1 py-2 text-sm font-medium transition-colors",
            activeTab === "all"
              ? "text-x-text"
              : "text-x-text-secondary hover:text-x-text",
          )}
        >
          All Bookmarks
          {activeTab === "all" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-x-blue" />
          )}
        </button>
      </div>
    </div>
  );
}
