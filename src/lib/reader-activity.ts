import { LS_READER_ACTIVITY } from "./storage-keys";

const STORAGE_KEY = LS_READER_ACTIVITY;
const EVENT_NAME = "totem-reader-activity";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 150;

export function emitReaderActivity(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const stamp = `${Date.now()}`;

    try {
      localStorage.setItem(STORAGE_KEY, stamp);
    } catch {}

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: stamp }));
    }
  }, DEBOUNCE_MS);
}

export function subscribeToReaderActivity(onActivity: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onActivity();
    }
  };

  const handleLocal = (_event: Event) => {
    onActivity();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT_NAME, handleLocal);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT_NAME, handleLocal);
  };
}
