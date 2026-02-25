import { useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon, XIcon } from "@phosphor-icons/react";
import type { UserSettings } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { ToggleGroup } from "./ui/ToggleGroup";
import { Switch } from "./ui/Switch";
import { Select } from "./ui/Select";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  onResetLocalData: () => Promise<void>;
}

const BACKGROUND_OPTIONS = [
  { value: "gradient" as const, label: "Gradient" },
  { value: "images" as const, label: "Images" },
];

const THEME_OPTIONS = [
  { value: "system" as ThemePreference, label: "Auto", icon: <MonitorIcon className="size-4" /> },
  { value: "light" as ThemePreference, label: "Light", icon: <SunIcon className="size-4" /> },
  { value: "dark" as ThemePreference, label: "Dark", icon: <MoonIcon className="size-4" /> },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  themePreference,
  onThemePreferenceChange,
  onResetLocalData,
}: Props) {
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

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
    <Modal open={open} onClose={onClose} className="bg-[rgba(11,6,5,0.5)]" ariaLabelledBy="settings-title">
      {(closing) => (
      <div className={cn(
        "max-w-md mx-auto mt-[10vh] max-h-[80vh] flex flex-col rounded border border-border bg-surface-card shadow-xl",
        closing ? "animate-preview-out" : "animate-preview-in",
      )}>
        <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
          <h2 id="settings-title" className="text-lg font-semibold text-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="-mr-2"
            aria-label="Close settings"
            title="Close"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        <div className="overflow-y-auto px-6 pb-6 space-y-5">
          <section>
            <h3 className="text-xs font-medium text-muted mb-2.5">
              Appearance
            </h3>
            <ToggleGroup
              items={THEME_OPTIONS}
              value={themePreference}
              onChange={onThemePreferenceChange}
            />
          </section>

          <section>
            <h3 className="text-xs font-medium text-muted mb-2.5">
              Background
            </h3>
            <ToggleGroup
              items={BACKGROUND_OPTIONS}
              value={settings.backgroundMode}
              onChange={(value) => onUpdateSettings({ backgroundMode: value })}
            />
          </section>

          <section>
            <h3 className="text-xs font-medium text-muted mb-2.5">
              New Tab
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span id="label-search-bar" className="text-sm text-foreground">
                  Show search bar
                </span>
                <Switch
                  checked={settings.showSearchBar}
                  onCheckedChange={(checked) => onUpdateSettings({ showSearchBar: checked })}
                  aria-labelledby="label-search-bar"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span id="label-quick-links" className="text-sm text-foreground">
                  Show quick links
                </span>
                <Switch
                  checked={settings.showTopSites}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      try {
                        const granted = await chrome.permissions.request({
                          permissions: ["topSites", "favicon"],
                        });
                        if (!granted) return;
                      } catch {
                        return;
                      }
                    }
                    onUpdateSettings({ showTopSites: checked });
                  }}
                  aria-labelledby="label-quick-links"
                />
              </label>

              {settings.showTopSites && (
                <div className="flex items-center justify-between pl-4">
                  <span className="text-sm text-muted">
                    Max quick links
                  </span>
                  <Select
                    value={settings.topSitesLimit}
                    onChange={(e) =>
                      onUpdateSettings({
                        topSitesLimit: Number(e.target.value),
                      })
                    }
                  >
                    {[3, 4, 5, 6, 8, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-muted mb-2.5">
              Data
            </h3>
            {confirmingReset ? (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetLocalData}
                  disabled={resetting}
                  className="flex-1 border border-red-500/30"
                >
                  {resetting ? "Resetting..." : "Confirm reset"}
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setConfirmingReset(true)}
                className="w-full"
              >
                Reset local data
              </Button>
            )}
            {resetError ? (
              <p className="text-xs text-red-400 mt-2">
                {resetError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
      )}
    </Modal>
  );
}
