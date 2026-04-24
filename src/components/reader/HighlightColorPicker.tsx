import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "../../lib/highlight-colors";
import { ColorDot } from "./ColorDot";
import { cn } from "../../lib/cn";

interface Props {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
  size?: "sm" | "md";
  groupLabel: string;
  optionLabel: (color: HighlightColor) => string;
  className?: string;
}

const PADDING = { sm: "p-1", md: "p-1.5" } as const;

export function HighlightColorPicker({
  value,
  onChange,
  size = "md",
  groupLabel,
  optionLabel,
  className,
}: Props) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as HighlightColor)}
      aria-label={groupLabel}
      className={cn("flex items-center gap-1", className)}
    >
      {HIGHLIGHT_COLORS.map((c) => (
        <Radio.Root
          key={c}
          value={c}
          aria-label={optionLabel(c)}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-full transition-colors",
            "hover:bg-foreground/6 focus-visible:bg-foreground/6 focus-visible:outline-none",
            PADDING[size],
          )}
        >
          <ColorDot color={c} size={size} selected={c === value} />
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
