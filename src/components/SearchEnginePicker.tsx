import { Popover } from "@base-ui/react/popover";
import { CaretUpDownIcon, CheckIcon } from "@phosphor-icons/react";
import type { SearchEngineId } from "../types";
import { SEARCH_ENGINES, BROWSER_DEFAULT_LOGO } from "../lib/search-engines";
import { cn } from "../lib/cn";

interface PickerOption {
  id: SearchEngineId;
  name: string;
  logo: React.ReactNode;
}

const OPTIONS: PickerOption[] = [
  ...Object.values(SEARCH_ENGINES).map((engine) => ({
    id: engine.id,
    name: engine.name,
    logo: engine.logo,
  })),
  { id: "default", name: "Browser default", logo: BROWSER_DEFAULT_LOGO },
];

interface Props {
  value: SearchEngineId;
  onChange: (engine: SearchEngineId) => void;
}

export function SearchEnginePicker({ value, onChange }: Props) {
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  const handleSelect = async (id: SearchEngineId) => {
    if (id === "default") {
      try {
        const granted = await chrome.permissions.request({
          permissions: ["search"],
        });
        if (!granted) return;
      } catch {
        return;
      }
    }
    onChange(id);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className="flex items-center gap-1 rounded-md p-1 transition-colors hover:[background:var(--totem-accent-bg)]"
        aria-label={`Search engine: ${current.name}`}
      >
        {current.logo}
        <CaretUpDownIcon weight="bold" className="size-3 opacity-40" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          sideOffset={6}
          positionMethod="fixed"
          className="z-50"
        >
          <Popover.Popup className="totem-popover w-48 rounded-lg border border-border bg-surface-card py-1.5 shadow-xl">
            {OPTIONS.map((option) => {
              const selected = option.id === value;
              return (
                <Popover.Close
                  key={option.id}
                  render={<button type="button" />}
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                    selected
                      ? "text-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {option.logo}
                  <span className="flex-1 text-left">{option.name}</span>
                  {selected && <CheckIcon weight="bold" className="size-4" />}
                </Popover.Close>
              );
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
