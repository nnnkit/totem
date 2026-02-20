import { useHotkeys } from "react-hotkeys-hook";
import type { Bookmark } from "../types";

export function useKeyboardNavigation(opts: {
  selectedBookmark: Bookmark | null;
  filteredBookmarks: Bookmark[];
  closeReader: () => void;
  setSelectedBookmark: (b: Bookmark) => void;
}): void {
  const { selectedBookmark, filteredBookmarks, closeReader, setSelectedBookmark } = opts;

  useHotkeys("escape", () => closeReader(), {
    enabled: !!selectedBookmark,
    preventDefault: true,
  }, [closeReader]);

  useHotkeys("j, ArrowRight", () => {
    const idx = filteredBookmarks.findIndex((b) => b.id === selectedBookmark!.id);
    if (idx < filteredBookmarks.length - 1) {
      setSelectedBookmark(filteredBookmarks[idx + 1]);
    }
  }, {
    enabled: !!selectedBookmark,
    preventDefault: true,
  }, [selectedBookmark, filteredBookmarks, setSelectedBookmark]);

  useHotkeys("k, ArrowLeft", () => {
    const idx = filteredBookmarks.findIndex((b) => b.id === selectedBookmark!.id);
    if (idx > 0) {
      setSelectedBookmark(filteredBookmarks[idx - 1]);
    }
  }, {
    enabled: !!selectedBookmark,
    preventDefault: true,
  }, [selectedBookmark, filteredBookmarks, setSelectedBookmark]);
}
