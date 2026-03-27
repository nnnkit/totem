import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/cn";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-labelledby"?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, className, ...props }: Props) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-labelledby={props["aria-labelledby"]}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        "data-[checked]:bg-accent data-[unchecked]:bg-border",
        className,
      )}
    >
      <BaseSwitch.Thumb
        className={cn(
          "inline-block size-4 rounded-full bg-white transition-transform",
          "data-[checked]:translate-x-6 data-[unchecked]:translate-x-1",
        )}
      />
    </BaseSwitch.Root>
  );
}
