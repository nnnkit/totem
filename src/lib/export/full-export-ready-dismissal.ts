import { LS_FULL_EXPORT_READY_DISMISSED } from "../storage-keys";

export interface FullExportReadyCounts {
  bookmarkCount: number;
  readyCount: number;
}

function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function isFullExportReadyForCurrentLibrary({
  bookmarkCount,
  readyCount,
}: FullExportReadyCounts): boolean {
  const bookmarks = count(bookmarkCount);
  return bookmarks > 0 && count(readyCount) >= bookmarks;
}

export function getFullExportReadyDismissalSignature({
  bookmarkCount,
  readyCount,
}: FullExportReadyCounts): string {
  const bookmarks = count(bookmarkCount);
  const ready = Math.min(count(readyCount), bookmarks);
  return `${bookmarks}:${ready}`;
}

export function readFullExportReadyDismissal(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(LS_FULL_EXPORT_READY_DISMISSED);
  } catch {
    return null;
  }
}

export function writeFullExportReadyDismissal(signature: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(LS_FULL_EXPORT_READY_DISMISSED, signature);
  } catch {}
}
