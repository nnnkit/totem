import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalData } from "../reset";
import {
  LS_BOOT_SYNC_POLICY,
  LS_READING_SORTS,
  LS_READING_TAB,
  LS_RETURN_SURFACE,
} from "../storage-keys";

const mocks = vi.hoisted(() => ({
  closeDb: vi.fn(),
}));

vi.mock("../../db", () => ({
  closeDb: mocks.closeDb,
}));

function createLocalStorageMock(seed: Record<string, string> = {}) {
  const storage = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resetLocalData", () => {
  it("clears all known local storage keys, including the legacy boot policy key", async () => {
    const localStorageMock = createLocalStorageMock({
      [LS_BOOT_SYNC_POLICY]: "manual_only_until_seeded",
      [LS_READING_TAB]: "unread",
      [LS_READING_SORTS]: JSON.stringify({
        unread: "oldest",
        continue: "recent",
        read: "annotated",
      }),
      [LS_RETURN_SURFACE]: "reading",
    });
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({ ok: true })),
      },
      storage: {
        local: {
          remove: vi.fn(async () => undefined),
        },
        sync: {
          remove: vi.fn(async () => undefined),
        },
      },
    });

    vi.stubGlobal("indexedDB", {
      databases: vi.fn(async () => []),
      deleteDatabase: vi.fn(() => {
        const request = {
          onsuccess: null as null | (() => void),
          onerror: null as null | (() => void),
          onblocked: null as null | (() => void),
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }),
    });

    await resetLocalData();

    expect(mocks.closeDb).toHaveBeenCalled();
    expect(localStorage.getItem(LS_BOOT_SYNC_POLICY)).toBeNull();
    expect(localStorage.getItem(LS_READING_TAB)).toBeNull();
    expect(localStorage.getItem(LS_READING_SORTS)).toBeNull();
    expect(localStorage.getItem(LS_RETURN_SURFACE)).toBeNull();
  });

  it("sends RESET_SW_STATE to the service worker and awaits its ack", async () => {
    const localStorageMock = createLocalStorageMock();
    vi.stubGlobal("localStorage", localStorageMock);
    const sendMessage = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("chrome", {
      runtime: { sendMessage },
      storage: {
        local: { remove: vi.fn(async () => undefined) },
        sync: { remove: vi.fn(async () => undefined) },
      },
    });
    vi.stubGlobal("indexedDB", {
      databases: vi.fn(async () => []),
      deleteDatabase: vi.fn(() => {
        const request = {
          onsuccess: null as null | (() => void),
          onerror: null as null | (() => void),
          onblocked: null as null | (() => void),
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      }),
    });

    await resetLocalData();

    expect(sendMessage).toHaveBeenCalledWith({ type: "RESET_SW_STATE" });
  });
});
