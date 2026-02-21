import { ArrowRightIcon } from "@phosphor-icons/react";

interface Props {
  onOpenFullPage: () => void;
}

export function PopupFooter({ onOpenFullPage }: Props) {
  return (
    <div className="shrink-0 border-t border-x-border px-3 py-2.5">
      <button
        type="button"
        onClick={onOpenFullPage}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/5"
      >
        Open full page
        <ArrowRightIcon className="size-3.5" />
      </button>
    </div>
  );
}
