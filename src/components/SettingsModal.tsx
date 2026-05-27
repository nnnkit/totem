import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ExportIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { Checkbox } from "@base-ui/react/checkbox";
import type { UserSettings } from "../types";
import type { ThemePreference } from "../hooks/useTheme";
import { resolveHighlightColor } from "../lib/highlight-colors";
import { cn } from "../lib/cn";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { Select } from "./ui/Select";
import { HighlightColorPicker } from "./reader/HighlightColorPicker";

interface Props {
  open: boolean;
  isResetting?: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  onResetAppState: () => void;
  onDeleteAllData: () => void;
  onExport: () => void;
  scrollToStorage?: boolean;
}

const RESET_STATE_TOOLTIP =
  "Drops cached UI state, sync flags, recent searches, and the local bookmark cache (re-syncs from X on next load). Fixes most stuck-UI symptoms.";
const RESET_CONTENT_TOOLTIP =
  "Permanently deletes everything you've created on this device: highlights, notes, reading progress, and saved searches. This can't be undone.";

const toggleBase =
  "flex items-center justify-center h-7 text-sm font-medium rounded-[5px] transition-[color,box-shadow] text-muted hover:text-foreground data-[pressed]:bg-surface-card data-[pressed]:text-accent data-[pressed]:shadow-sm cursor-default";
const TOP_SITES_LIMIT_OPTIONS = [3, 4, 5, 6, 8, 10].map((value) => ({
  value: String(value),
  label: String(value),
}));

export function SettingsModal({
  open,
  isResetting = false,
  onClose,
  settings,
  onUpdateSettings,
  themePreference,
  onThemePreferenceChange,
  onResetAppState,
  onDeleteAllData,
  onExport,
  scrollToStorage,
}: Props) {
  const storageSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open && scrollToStorage) {
      const frame = requestAnimationFrame(() => {
        storageSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [open, scrollToStorage]);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetAppState, setResetAppState] = useState(true);
  const [resetContent, setResetContent] = useState(false);

  const canReset = resetAppState || resetContent;

  const closeConfirm = () => {
    setConfirmingReset(false);
    setResetAppState(true);
    setResetContent(false);
  };

  const handleClose = () => {
    closeConfirm();
    onClose();
  };

  const handleConfirmReset = () => {
    if (isResetting || !canReset) return;
    closeConfirm();
    if (resetContent) {
      onDeleteAllData();
    } else {
      onResetAppState();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="bg-black/50"
      title="Settings"
      titleId="settings-title"
      closeLabel="Close settings"
      bodyClassName="overflow-y-auto px-6 pb-6 divide-y divide-border"
    >
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
                    className="flex gap-1 rounded-md bg-foreground/6 p-1"
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

              </div>
            </section>

            <section className="py-4 first:pt-0 last:pb-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-10 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground/80">
                      Default highlight color
                    </span>
                    <span className="text-xxs text-muted/60 leading-snug">
                      Used for new highlights in a fresh article
                    </span>
                  </div>
                  <HighlightColorPicker
                    value={resolveHighlightColor(settings.defaultHighlightColor)}
                    onChange={(c) => onUpdateSettings({ defaultHighlightColor: c })}
                    groupLabel="Default highlight color"
                    optionLabel={(c) => `Default color ${c}`}
                  />
                </div>
                <label className="flex items-center justify-between gap-4 min-h-10">
                  <div className="flex flex-col gap-0.5">
                    <span
                      id="label-open-in-totem"
                      className="text-sm text-foreground/80"
                    >
                      Open in Totem button
                    </span>
                    <span className="text-xxs text-muted/60 leading-snug">
                      Adds a button on each tweet to open it in the reader
                    </span>
                  </div>
                  <Switch
                    checked={settings.showOpenInTotem}
                    onCheckedChange={(checked) =>
                      onUpdateSettings({ showOpenInTotem: checked })
                    }
                    aria-labelledby="label-open-in-totem"
                  />
                </label>
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
                      value={String(settings.topSitesLimit)}
                      onValueChange={(value) =>
                        onUpdateSettings({
                          topSitesLimit: Number(value),
                        })
                      }
                      options={TOP_SITES_LIMIT_OPTIONS}
                      ariaLabel="Max quick links"
                      size="sm"
                      className="w-[5.5rem] shrink-0 border-border/70 bg-surface/45 hover:bg-surface/55"
                      popupClassName="w-[5.5rem]"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between min-h-10">
                  <span className="text-sm text-foreground/80">
                    Recommended post
                  </span>
                  <Select
                    value={settings.recommendationSource}
                    onValueChange={(value) =>
                      onUpdateSettings({
                        recommendationSource: value as "random" | "pinned",
                      })
                    }
                    options={[
                      { value: "random", label: "Random" },
                      { value: "pinned", label: "Pinned" },
                    ]}
                    ariaLabel="Recommended post source"
                    size="sm"
                    className="w-[7.5rem] shrink-0 border-border/70 bg-surface/45 hover:bg-surface/55"
                    popupClassName="w-[7.5rem]"
                  />
                </div>
              </div>
            </section>

            <section ref={storageSectionRef} className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-muted mb-1.5">
                Storage
              </h3>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-10 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground/80">
                      Export your data
                    </span>
                    <span className="text-xxs text-muted/60 leading-snug">
                      Download your bookmarks as CSV, Markdown, and JSONL
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleClose();
                      onExport();
                    }}
                  >
                    <ExportIcon className="size-3.5" />
                    Export
                  </Button>
                </div>
              </div>
            </section>

            <section className="py-4 first:pt-0 last:pb-0">
              {confirmingReset ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted/80 leading-snug">
                    Choose what to reset. App state alone is enough to fix
                    most stuck-UI issues.
                  </p>
                  <div className="space-y-2">
                    <ResetCheckbox
                      id="reset-app-state"
                      label="App state"
                      description="Cached UI, sync flags, bookmark cache."
                      tooltip={RESET_STATE_TOOLTIP}
                      checked={resetAppState}
                      onCheckedChange={setResetAppState}
                      disabled={isResetting}
                    />
                    <ResetCheckbox
                      id="reset-content"
                      label="Personal content"
                      description="Highlights, notes, reading status, saved searches."
                      tooltip={RESET_CONTENT_TOOLTIP}
                      checked={resetContent}
                      onCheckedChange={setResetContent}
                      disabled={isResetting}
                      destructive
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={closeConfirm}
                      disabled={isResetting}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={resetContent ? "destructive" : "primary"}
                      onClick={handleConfirmReset}
                      disabled={isResetting || !canReset}
                      className={cn(
                        "flex-1",
                        resetContent && "border border-red-500/30",
                      )}
                    >
                      {isResetting
                        ? resetContent
                          ? "Deleting..."
                          : "Resetting..."
                        : resetContent
                          ? "Confirm delete"
                          : "Reset"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingReset(true)}
                  disabled={isResetting}
                  className="w-full"
                >
                  {isResetting ? "Resetting..." : "Reset data"}
                </Button>
              )}
            </section>
    </Modal>
  );
}

interface ResetCheckboxProps {
  id: string;
  label: string;
  description: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  destructive?: boolean;
}

function ResetCheckbox({
  id,
  label,
  description,
  tooltip,
  checked,
  onCheckedChange,
  disabled,
  destructive,
}: ResetCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded border border-border/60 bg-surface/40 p-3 cursor-pointer transition-colors",
        "hover:bg-surface/60",
        disabled && "opacity-60 cursor-default",
        destructive && checked && "border-red-500/40 bg-red-500/5",
      )}
      title={tooltip}
    >
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          "border-border bg-surface-card",
          "data-[checked]:bg-accent data-[checked]:border-accent",
          destructive &&
            "data-[checked]:bg-red-500 data-[checked]:border-red-500",
        )}
      >
        <Checkbox.Indicator className="text-white">
          <CheckIcon weight="bold" className="size-3" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={cn(
            "text-sm leading-tight",
            destructive ? "text-foreground" : "text-foreground/90",
          )}
        >
          {label}
        </span>
        <span className="text-xxs text-muted/70 leading-snug">
          {description}
        </span>
      </div>
    </label>
  );
}
