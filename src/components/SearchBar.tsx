import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { cn } from "../lib/cn";
import { TotemLogo } from "./TotemLogo";
import { Button } from "./ui/Button";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  syncing: boolean;
  bookmarkCount: number;
  onBack?: () => void;
}

export function SearchBar({
  query,
  onQueryChange,
  onRefresh,
  onOpenSettings,
  syncing,
  bookmarkCount,
  onBack,
}: Props) {
  return (
    <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2" aria-label="Back to home" title="Back">
            <ArrowLeftIcon className="size-5" />
          </Button>
        )}
        <TotemLogo className="size-7 shrink-0" />

        <div className="relative flex-1">
          <MagnifyingGlassIcon className="size-5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-input"
            type="text"
            placeholder="Search bookmarks... (press /)"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-full bg-surface-card text-foreground placeholder-muted rounded py-2.5 pl-11 pr-4 border border-border focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={syncing}
          aria-label="Sync bookmarks"
          title="Sync bookmarks (top page)"
        >
          <span className={cn(syncing && "animate-spin")}><ArrowsClockwiseIcon className="size-5" /></span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <GearSixIcon className="size-5" />
        </Button>

        <span className="text-muted text-sm shrink-0 tabular-nums">
          {bookmarkCount}
        </span>
      </div>
    </div>
  );
}
