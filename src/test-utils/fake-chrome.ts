// In-memory fakes for Chrome extension APIs used in tests

type StorageChangeCallback = (
  changes: Record<string, chrome.storage.StorageChange>,
) => void;

// ── chrome.storage.local ─────────────────────────────────────

export function createFakeStorageLocal() {
  let store: Record<string, unknown> = {};
  const listeners: StorageChangeCallback[] = [];

  function notifyListeners(
    changes: Record<string, chrome.storage.StorageChange>,
  ) {
    for (const listener of listeners) {
      listener(changes);
    }
  }

  return {
    get(keys: string | string[] | null): Promise<Record<string, unknown>> {
      if (keys === null) return Promise.resolve({ ...store });
      const keyList = typeof keys === "string" ? [keys] : keys;
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key in store) result[key] = store[key];
      }
      return Promise.resolve(result);
    },

    set(items: Record<string, unknown>): Promise<void> {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        const oldValue = store[key];
        changes[key] = { oldValue, newValue: value };
        store[key] = value;
      }
      notifyListeners(changes);
      return Promise.resolve();
    },

    remove(keys: string | string[]): Promise<void> {
      const keyList = typeof keys === "string" ? [keys] : keys;
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const key of keyList) {
        if (key in store) {
          changes[key] = { oldValue: store[key], newValue: undefined };
          delete store[key];
        }
      }
      if (Object.keys(changes).length > 0) notifyListeners(changes);
      return Promise.resolve();
    },

    onChanged: {
      addListener(cb: StorageChangeCallback) {
        listeners.push(cb);
      },
      removeListener(cb: StorageChangeCallback) {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      },
    },

    /** Test helper: reset all stored data */
    _reset() {
      store = {};
    },

    /** Test helper: read raw store */
    _dump(): Record<string, unknown> {
      return { ...store };
    },
  };
}

// ── chrome.runtime.sendMessage ───────────────────────────────

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

export function createFakeRuntime() {
  const listeners: MessageListener[] = [];

  return {
    onMessage: {
      addListener(cb: MessageListener) {
        listeners.push(cb);
      },
      removeListener(cb: MessageListener) {
        const idx = listeners.indexOf(cb);
        if (idx !== -1) listeners.splice(idx, 1);
      },
    },

    sendMessage(message: unknown): Promise<unknown> {
      return new Promise((resolve) => {
        const sender: chrome.runtime.MessageSender = {};
        let responded = false;
        const sendResponse = (response?: unknown) => {
          if (!responded) {
            responded = true;
            resolve(response);
          }
        };
        for (const listener of listeners) {
          const result = listener(message, sender, sendResponse);
          if (result === true) return; // async — listener will call sendResponse
          if (responded) return;
        }
        // No listener handled it
        if (!responded) resolve(undefined);
      });
    },

    getURL(path: string): string {
      return `chrome-extension://fake-id/${path}`;
    },
  };
}

// ── chrome.tabs.create ───────────────────────────────────────

export function createFakeTabs() {
  let nextTabId = 1;
  const createdTabs: Array<{ id: number; url?: string; active?: boolean }> = [];

  return {
    create(
      props: { url?: string; active?: boolean },
      callback?: (tab: { id: number }) => void,
    ) {
      const tab = { id: nextTabId++, url: props.url, active: props.active };
      createdTabs.push(tab);
      if (callback) callback(tab);
      return Promise.resolve(tab);
    },

    remove(_tabId: number) {
      return Promise.resolve();
    },

    /** Test helper: get all tabs that were created */
    _createdTabs() {
      return [...createdTabs];
    },

    /** Test helper: reset */
    _reset() {
      createdTabs.length = 0;
      nextTabId = 1;
    },
  };
}

// ── Assemble a complete fake chrome object ───────────────────

export function createFakeChrome() {
  const storageLocal = createFakeStorageLocal();
  const runtime = createFakeRuntime();
  const tabs = createFakeTabs();

  return {
    storage: {
      local: storageLocal,
    },
    runtime,
    tabs,
  };
}

export type FakeChrome = ReturnType<typeof createFakeChrome>;
