import { useMemo, useState } from "react";
import { Monitor, Moon, Sun, X } from "@phosphor-icons/react";
import type { Bookmark, UserSettings } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  bookmarks: Bookmark[];
  onResetLocalData: () => Promise<void>;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { value: "system", label: "Auto", icon: "monitor" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  themePreference,
  onThemePreferenceChange,
  bookmarks,
  onResetLocalData,
}: Props) {
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const stats = useMemo(() => {
    const uniqueAuthors = new Set<string>();
    let withMedia = 0;
    let articles = 0;
    for (const b of bookmarks) {
      uniqueAuthors.add(b.author.screenName);
      if (b.media.length > 0) withMedia++;
      if (b.tweetKind === "article" || b.isThread) articles++;
    }
    return {
      total: bookmarks.length,
      uniqueAuthors: uniqueAuthors.size,
      withMedia,
      articles,
    };
  }, [bookmarks]);

  const handleResetLocalData = async () => {
    if (resetting) return;

    setResetError(null);
    setResetting(true);

    try {
      await onResetLocalData();
    } catch {
      setResetError("Reset failed. Please try again.");
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="bg-black/50" ariaLabelledBy="settings-title">
      {(closing) => (
      <div className={cn(
        "max-w-md mx-auto mt-[10vh] max-h-[80vh] flex flex-col rounded-xl border border-x-border bg-x-card shadow-xl",
        closing ? "animate-preview-out" : "animate-preview-in",
      )}>
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
          <h2 id="settings-title" className="text-lg font-semibold text-x-text">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-x-text-secondary hover:text-x-text hover:bg-x-hover transition-colors"
            aria-label="Close settings"
            title="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-6 space-y-5">
          <section>
            <h3 className="text-xs font-medium text-x-text-secondary mb-2.5">
              Appearance
            </h3>
            <div className="flex gap-1 rounded-lg bg-x-bg p-1">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onThemePreferenceChange(opt.value)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5",
                    themePreference === opt.value
                      ? "bg-accent/15 text-accent"
                      : "text-x-text-secondary hover:text-x-text",
                  )}
                >
                  {opt.icon === "monitor" ? (
                    <Monitor className="size-4" />
                  ) : opt.icon === "sun" ? (
                    <Sun className="size-4" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <BackgroundSettings
            settings={settings}
            onUpdateSettings={onUpdateSettings}
          />

          <section>
            <h3 className="text-xs font-medium text-x-text-secondary mb-2.5">
              New Tab
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span id="label-search-bar" className="text-sm text-x-text">
                  Show search bar
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showSearchBar}
                  aria-labelledby="label-search-bar"
                  onClick={() =>
                    onUpdateSettings({
                      showSearchBar: !settings.showSearchBar,
                    })
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.showSearchBar ? "bg-accent" : "bg-x-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-white transition-transform",
                      settings.showSearchBar ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span id="label-quick-links" className="text-sm text-x-text">
                  Show quick links
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.showTopSites}
                  aria-labelledby="label-quick-links"
                  onClick={async () => {
                    if (!settings.showTopSites) {
                      try {
                        const granted = await chrome.permissions.request({
                          permissions: ["topSites", "favicon"],
                        });
                        if (!granted) return;
                      } catch {
                        return;
                      }
                    }
                    onUpdateSettings({
                      showTopSites: !settings.showTopSites,
                    });
                  }}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.showTopSites ? "bg-accent" : "bg-x-border",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-white transition-transform",
                      settings.showTopSites ? "translate-x-6" : "translate-x-1",
                    )}
                  />
                </button>
              </label>

              {settings.showTopSites && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-x-text-secondary">
                    Max quick links
                  </span>
                  <select
                    value={settings.topSitesLimit}
                    onChange={(e) =>
                      onUpdateSettings({
                        topSitesLimit: Number(e.target.value),
                      })
                    }
                    className="rounded-lg border border-x-border bg-x-bg px-2.5 py-1.5 text-sm text-x-text focus:border-accent focus:outline-none transition-colors"
                  >
                    {[3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-x-text-secondary mb-2.5">
              Stats
            </h3>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-x-bg p-2.5">
                <p className="text-lg font-semibold text-x-text tabular-nums">
                  {stats.total}
                </p>
                <p className="text-xs text-x-text-secondary">
                  Bookmarks
                </p>
              </div>
              <div className="rounded-lg bg-x-bg p-2.5">
                <p className="text-lg font-semibold text-x-text tabular-nums">
                  {stats.uniqueAuthors}
                </p>
                <p className="text-xs text-x-text-secondary">
                  Authors
                </p>
              </div>
              <div className="rounded-lg bg-x-bg p-2.5">
                <p className="text-lg font-semibold text-x-text tabular-nums">
                  {stats.withMedia}
                </p>
                <p className="text-xs text-x-text-secondary">
                  Media
                </p>
              </div>
              <div className="rounded-lg bg-x-bg p-2.5">
                <p className="text-lg font-semibold text-x-text tabular-nums">
                  {stats.articles}
                </p>
                <p className="text-xs text-x-text-secondary">
                  Articles
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-x-text-secondary mb-2.5">
              Data
            </h3>
            {confirmingReset ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetting}
                  className="flex-1 rounded-lg border border-x-border bg-x-bg px-3 py-2 text-sm font-medium text-x-text-secondary transition-colors hover:bg-x-hover disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetLocalData}
                  disabled={resetting}
                  className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-70"
                >
                  {resetting ? "Resetting..." : "Confirm reset"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="w-full rounded-lg border border-x-border bg-x-bg px-3 py-2 text-sm font-medium text-x-text-secondary transition-colors hover:bg-x-hover"
              >
                Reset local data
              </button>
            )}
            {resetError ? (
              <p className="text-xs text-red-400 mt-2">
                {resetError}
              </p>
            ) : null}
          </section>
        </div>

        <div className="shrink-0 border-t border-x-border px-6 py-3">
          <p className="text-xs text-x-text-secondary/60 text-center text-pretty">
            Settings sync across your devices
          </p>
        </div>
      </div>
      )}
    </Modal>
  );
}

interface BackgroundSettingsProps {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
}

const BACKGROUND_OPTIONS: { value: UserSettings["backgroundMode"]; label: string }[] = [
  { value: "gradient", label: "Gradient" },
  { value: "images", label: "Images" },
];

function BackgroundSettings({ settings, onUpdateSettings }: BackgroundSettingsProps) {
  return (
    <section>
      <h3 className="text-xs font-medium text-x-text-secondary mb-2.5">
        Background
      </h3>
      <div className="flex gap-1 rounded-lg bg-x-bg p-1">
        {BACKGROUND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onUpdateSettings({ backgroundMode: opt.value })}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              settings.backgroundMode === opt.value
                ? "bg-accent/15 text-accent"
                : "text-x-text-secondary hover:text-x-text",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
