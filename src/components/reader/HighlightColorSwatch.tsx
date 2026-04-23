import { useState } from "react";
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "../../lib/highlight-colors";
import { Button } from "../ui/Button";
import { Popover, PopoverContent } from "../ui/Popover";
import { ColorDot } from "./ColorDot";

interface Props {
  color: HighlightColor;
  onChange: (color: HighlightColor) => void;
}

export function HighlightColorSwatch({ color, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Highlight color"
            title="Highlight color"
          >
            <ColorDot color={color} size="md" />
          </Button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" sideOffset={6} align="end">
          <PopoverContent onMouseDown={(e) => e.preventDefault()}>
            <div className="flex items-center gap-1 p-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className="rounded p-1.5 transition-colors hover:bg-surface-hover"
                  aria-label={`Use ${c} for new highlights`}
                  aria-pressed={c === color}
                >
                  <ColorDot color={c} size="md" selected={c === color} />
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
