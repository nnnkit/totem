/**
 * In-memory fakes for Chrome extension APIs.
 * Shared test infrastructure for integration tests.
 */

type StorageData = Record<string, unknown>;

interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

type StorageChangeCallback = (
  changes: Record<string, StorageChange>,
) => void;

type GlobalStorageChangeCallback = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

type GetKeys = string | string[] | Record<string, unknown> | null | undefined;

type MessageCallback = (
  message: unknown,
  sender: { id?: string },
  sendResponse: (response: unknown) => void,
) => boolean | void;

export function createFakeChrome() {
  // Storage. Each area is independent; mutations notify the area's own
  // onChanged listeners (single-arg) and the global chrome.storage.onChanged
  // listeners (with areaName), matching the real extension API.
  const globalStorageChangeListeners: GlobalStorageChangeCallback[] = [];

  function notifyGlobal(
    changes: Record<string, StorageChange>,
    areaName: string,
  ) {
    for (const listener of globalStorageChangeListeners) {
      listener(changes, areaName);
    }
  }

  function createStorageArea(areaName: string) {
    let data: StorageData = {};
    const areaListeners: StorageChangeCallback[] = [];

    function emit(changes: Record<string, StorageChange>) {
      for (const listener of areaListeners) listener(changes);
      notifyGlobal(changes, areaName);
    }

    const area = {
      async get(keys?: GetKeys): Promise<StorageData> {
        if (keys === undefined || keys === null) return { ...data };
        if (typeof keys === "string") {
          return keys in data ? { [keys]: data[keys] } : {};
        }
        if (Array.isArray(keys)) {
          const result: StorageData = {};
          for (const key of keys) {
            if (key in data) result[key] = data[key];
          }
          return result;
        }
        // Object form: each value is the default returned when the key is absent.
        const result: StorageData = {};
        for (const [key, fallback] of Object.entries(keys)) {
          result[key] = key in data ? data[key] : fallback;
        }
        return result;
      },

      async set(items: StorageData): Promise<void> {
        const changes: Record<string, StorageChange> = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { oldValue: data[key], newValue: value };
          data[key] = value;
        }
        emit(changes);
      },

      async remove(keys: string | string[]): Promise<void> {
        const keyList = typeof keys === "string" ? [keys] : keys;
        const changes: Record<string, StorageChange> = {};
        for (const key of keyList) {
          if (key in data) {
            changes[key] = { oldValue: data[key], newValue: undefined };
            delete data[key];
          }
        }
        if (Object.keys(changes).length > 0) emit(changes);
      },

      onChanged: {
        addListener(fn: StorageChangeCallback) {
          areaListeners.push(fn);
        },
        removeListener(fn: StorageChangeCallback) {
          const idx = areaListeners.indexOf(fn);
          if (idx >= 0) areaListeners.splice(idx, 1);
        },
      },
    };

    function reset() {
      data = {};
      areaListeners.length = 0;
    }

    return { area, reset };
  }

  const local = createStorageArea("local");
  const sync = createStorageArea("sync");

  const storage = {
    local: local.area,
    sync: sync.area,
    onChanged: {
      addListener(fn: GlobalStorageChangeCallback) {
        globalStorageChangeListeners.push(fn);
      },
      removeListener(fn: GlobalStorageChangeCallback) {
        const idx = globalStorageChangeListeners.indexOf(fn);
        if (idx >= 0) globalStorageChangeListeners.splice(idx, 1);
      },
    },
  };

  // Runtime messaging
  const messageListeners: MessageCallback[] = [];

  const runtime = {
    async sendMessage(message: unknown): Promise<unknown> {
      const sendToListener = (index: number): Promise<unknown> => {
        const listener = messageListeners[index];
        if (!listener) return Promise.resolve(undefined);

        return new Promise<unknown>((resolve) => {
          const result = listener(
            message,
            { id: "fake-extension-id" },
            (resp) => resolve(resp),
          );
          // If listener returned false or did not handle the message,
          // resolve with undefined and try the next listener.
          if (result !== true) {
            resolve(undefined);
          }
        }).then((response) =>
          response !== undefined ? response : sendToListener(index + 1),
        );
      };

      return sendToListener(0);
    },

    onMessage: {
      addListener(fn: MessageCallback) {
        messageListeners.push(fn);
      },
      removeListener(fn: MessageCallback) {
        const idx = messageListeners.indexOf(fn);
        if (idx >= 0) messageListeners.splice(idx, 1);
      },
    },
  };

  // Tabs
  let tabIdCounter = 1;
  const tabRemoveListeners: ((tabId: number) => void)[] = [];

  const tabs = {
    async create(props: {
      url?: string;
      active?: boolean;
    }): Promise<{ id: number; url?: string }> {
      return { id: tabIdCounter++, url: props.url };
    },

    async remove(tabId: number): Promise<void> {
      for (const listener of tabRemoveListeners) {
        listener(tabId);
      }
    },

    onRemoved: {
      addListener(fn: (tabId: number) => void) {
        tabRemoveListeners.push(fn);
      },
      removeListener(fn: (tabId: number) => void) {
        const idx = tabRemoveListeners.indexOf(fn);
        if (idx >= 0) tabRemoveListeners.splice(idx, 1);
      },
    },
  };

  // Reset all state for test isolation
  function reset() {
    local.reset();
    sync.reset();
    globalStorageChangeListeners.length = 0;
    messageListeners.length = 0;
    tabIdCounter = 1;
    tabRemoveListeners.length = 0;
  }

  return { storage, runtime, tabs, reset };
}

export type FakeChrome = ReturnType<typeof createFakeChrome>;
