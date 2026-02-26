import { useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon, XIcon } from "@phosphor-icons/react";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import type { UserSettings } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { Select } from "./ui/Select";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  onResetLocalData: () => void;
}

const toggleBase =
  "flex items-center justify-center h-7 text-sm font-medium rounded transition-[color,background-color,box-shadow] text-muted hover:text-foreground data-[pressed]:bg-surface-card data-[pressed]:text-accent data-[pressed]:shadow-sm cursor-default";

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
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleResetLocalData = () => {
    if (resetting) return;
    setResetting(true);
    onResetLocalData();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="bg-black/50"
      ariaLabelledBy="settings-title"
    >
      {(closing) => (
        <div
          className={cn(
            "max-w-md mx-auto mt-[10vh] max-h-[80vh] flex flex-col rounded border border-border bg-surface-card shadow-xl",
            closing ? "animate-preview-out" : "animate-preview-in",
          )}
        >
          <div className="flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
            <h2
              id="settings-title"
              className="text-lg font-semibold text-foreground text-balance"
            >
              Settings
            </h2>
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

          <div className="overflow-y-auto px-6 pb-6 divide-y divide-border">
            <section className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-muted mb-1.5">
                Appearance
              </h3>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-10">
                  <span className="text-sm text-foreground/80">
                    Colour mode
                  </span>
                  <ToggleGroup
                    value={[themePreference]}
                    onValueChange={(values) => {
                      if (values.length)
                        onThemePreferenceChange(values[0] as ThemePreference);
                    }}
                    className="flex gap-1 rounded bg-foreground/6 p-1"
                  >
                    <Toggle
                      value="system"
                      aria-label="Auto"
                      className={cn(toggleBase, "px-2.5")}
                    >
                      <MonitorIcon className="size-4" />
                    </Toggle>
                    <Toggle
                      value="light"
                      aria-label="Light"
                      className={cn(toggleBase, "px-2.5")}
                    >
                      <SunIcon className="size-4" />
                    </Toggle>
                    <Toggle
                      value="dark"
                      aria-label="Dark"
                      className={cn(toggleBase, "px-2.5")}
                    >
                      <MoonIcon className="size-4" />
                    </Toggle>
                  </ToggleGroup>
                </div>

                <div className="flex items-center justify-between min-h-10">
                  <span className="text-sm text-foreground/80">Background</span>
                  <ToggleGroup
                    value={[settings.backgroundMode]}
                    onValueChange={(values) => {
                      if (values.length)
                        onUpdateSettings({
                          backgroundMode:
                            values[0] as UserSettings["backgroundMode"],
                        });
                    }}
                    className="flex gap-1 rounded bg-foreground/6 p-1"
                  >
                    <Toggle
                      value="gradient"
                      aria-label="Gradient"
                      className={cn(toggleBase, "px-3")}
                    >
                      Gradient
                    </Toggle>
                    <Toggle
                      value="images"
                      aria-label="Images"
                      className={cn(toggleBase, "px-3")}
                    >
                      Images
                    </Toggle>
                  </ToggleGroup>
                </div>
              </div>
            </section>

            <section className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-muted mb-1.5">
                New Tab
              </h3>
              <div className="space-y-1.5">
                <label className="flex items-center justify-between min-h-10">
                  <span
                    id="label-search-bar"
                    className="text-sm text-foreground/80"
                  >
                    Show search bar
                  </span>
                  <Switch
                    checked={settings.showSearchBar}
                    onCheckedChange={(checked) =>
                      onUpdateSettings({ showSearchBar: checked })
                    }
                    aria-labelledby="label-search-bar"
                  />
                </label>

                <label className="flex items-center justify-between min-h-10">
                  <span
                    id="label-quick-links"
                    className="text-sm text-foreground/80"
                  >
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
                  <div className="flex items-center justify-between pl-4 min-h-10">
                    <span className="text-sm text-muted">Max quick links</span>
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
              <div className="mt-3">
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
              </div>
            </section>
          </div>
        </div>
      )}
    </Modal>
  );
}
