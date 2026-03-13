const STORAGE_KEY = "totem_reader_activity";
const EVENT_NAME = "totem-reader-activity";

export function emitReaderActivity(): void {
  const stamp = `${Date.now()}`;

  try {
    localStorage.setItem(STORAGE_KEY, stamp);
  } catch {}

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: stamp }));
  }
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

  const handleLocal = () => {
    onActivity();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT_NAME, handleLocal as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT_NAME, handleLocal as EventListener);
  };
}
