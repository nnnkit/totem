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

type MessageCallback = (
  message: unknown,
  sender: { id?: string },
  sendResponse: (response: unknown) => void,
) => boolean | void;

export function createFakeChrome() {
  // Storage
  let storageData: StorageData = {};
  const storageChangeListeners: StorageChangeCallback[] = [];

  const storage = {
    local: {
      async get(keys?: string | string[] | null): Promise<StorageData> {
        if (!keys) return { ...storageData };
        const keyList = typeof keys === "string" ? [keys] : keys;
        const result: StorageData = {};
        for (const key of keyList) {
          if (key in storageData) {
            result[key] = storageData[key];
          }
        }
        return result;
      },

      async set(items: StorageData): Promise<void> {
        const changes: Record<string, StorageChange> = {};
        for (const [key, value] of Object.entries(items)) {
          changes[key] = { oldValue: storageData[key], newValue: value };
          storageData[key] = value;
        }
        for (const listener of storageChangeListeners) {
          listener(changes);
        }
      },

      async remove(keys: string | string[]): Promise<void> {
        const keyList = typeof keys === "string" ? [keys] : keys;
        const changes: Record<string, StorageChange> = {};
        for (const key of keyList) {
          if (key in storageData) {
            changes[key] = { oldValue: storageData[key], newValue: undefined };
            delete storageData[key];
          }
        }
        if (Object.keys(changes).length > 0) {
          for (const listener of storageChangeListeners) {
            listener(changes);
          }
        }
      },

      onChanged: {
        addListener(fn: StorageChangeCallback) {
          storageChangeListeners.push(fn);
        },
        removeListener(fn: StorageChangeCallback) {
          const idx = storageChangeListeners.indexOf(fn);
          if (idx >= 0) storageChangeListeners.splice(idx, 1);
        },
      },
    },
  };

  // Runtime messaging
  const messageListeners: MessageCallback[] = [];

  const runtime = {
    async sendMessage(message: unknown): Promise<unknown> {
      for (const listener of messageListeners) {
        const response = await new Promise<unknown>((resolve) => {
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
        });
        if (response !== undefined) return response;
      }
      return undefined;
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
    storageData = {};
    storageChangeListeners.length = 0;
    messageListeners.length = 0;
    tabIdCounter = 1;
    tabRemoveListeners.length = 0;
  }

  return { storage, runtime, tabs, reset };
}

export type FakeChrome = ReturnType<typeof createFakeChrome>;
