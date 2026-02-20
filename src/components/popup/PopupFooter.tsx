interface Props {
  onOpenFullPage: () => void;
}

export function PopupFooter({ onOpenFullPage }: Props) {
  return (
    <div className="border-t border-x-border px-4 py-3">
      <button
        type="button"
        onClick={onOpenFullPage}
        className="flex w-full items-center justify-center gap-1 text-sm font-medium text-x-blue transition-opacity hover:opacity-80"
      >
        Open full bookmarks page
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M12.293 5.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L16.586 13H5a1 1 0 1 1 0-2h11.586l-4.293-4.293a1 1 0 0 1 0-1.414z" />
        </svg>
      </button>
    </div>
  );
}
