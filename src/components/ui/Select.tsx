import { type ReactNode } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
  className?: string;
  popupClassName?: string;
  leadingIcon?: ReactNode;
  placeholder?: ReactNode;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  size?: "default" | "sm";
}

export function Select({
  value,
  onValueChange,
  options,
  ariaLabel,
  className,
  popupClassName,
  leadingIcon,
  placeholder,
  disabled,
  align = "end",
  size = "default",
}: Props) {
  const isSmall = size === "sm";
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      modal={false}
      onValueChange={(nextValue: string | null) => {
        if (typeof nextValue === "string") {
          onValueChange(nextValue);
        }
      }}
    >
      <BaseSelect.Trigger
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center border border-border bg-surface-card text-foreground shadow-sm transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:bg-surface-hover focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60",
          isSmall
            ? "min-h-8 gap-1.5 rounded-lg px-2.5 text-xs"
            : "min-h-10 gap-2 rounded-xl px-3 text-sm",
          className,
        )}
      >
        {leadingIcon && (
          <span aria-hidden="true" className="shrink-0 text-muted/75">
            {leadingIcon}
          </span>
        )}
        <BaseSelect.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate text-left"
        />
        <BaseSelect.Icon className="ml-auto shrink-0 text-muted/65">
          <CaretDownIcon weight="bold" className="size-3.5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          side="bottom"
          align={align}
          sideOffset={8}
          positionMethod="fixed"
          alignItemWithTrigger={false}
          className="z-50 outline-none"
        >
          <BaseSelect.Popup
            className={cn(
              "totem-popover max-h-80 overflow-y-auto border border-border bg-surface-card shadow-xl outline-none",
              isSmall
                ? "min-w-[8rem] rounded-lg p-0.5"
                : "min-w-[12rem] rounded-2xl p-1",
              popupClassName,
            )}
          >
            <BaseSelect.List className="outline-none">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  label={typeof option.label === "string" ? option.label : undefined}
                  disabled={option.disabled}
                  className={cn(
                    "flex cursor-default items-center text-muted outline-none transition-colors duration-150 ease-out data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground data-[selected]:text-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                    isSmall
                      ? "min-h-8 gap-2 rounded-lg px-2.5 text-xs"
                      : "min-h-10 gap-3 rounded-xl px-3 text-sm",
                  )}
                >
                  <BaseSelect.ItemText className="min-w-0 flex-1 truncate">
                    {option.label}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="shrink-0 text-accent">
                    <CheckIcon weight="bold" className="size-4" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
