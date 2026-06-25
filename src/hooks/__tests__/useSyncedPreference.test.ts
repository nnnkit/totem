// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome, type FakeChrome } from "../../test-utils/fake-chrome";
import { act, flushAsync, renderHook } from "../../test-utils/render-hook";
import { hasChromeStorageSync } from "../../lib/chrome";
import { SYNC_SETTINGS, SYNC_THEME } from "../../lib/storage-keys";
import { useSyncedPreference } from "../useSyncedPreference";
import { useSettings } from "../useSettings";
import { useTheme } from "../useTheme";

const KEY = "totem:test-pref";

const normalize = (raw: unknown): string =>
  typeof raw === "string" ? raw : "default";

let fakeChrome: FakeChrome;

beforeEach(() => {
  fakeChrome = createFakeChrome();
  vi.stubGlobal("chrome", fakeChrome);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function deferGet(): (value: Record<string, unknown>) => void {
  let resolveGet!: (value: Record<string, unknown>) => void;
  fakeChrome.storage.sync.get = vi.fn(
    () =>
      new Promise<Record<string, unknown>>((resolve) => {
        resolveGet = resolve;
      }),
  );
  return (value) => resolveGet(value);
}

describe("useSyncedPreference", () => {
  it("loads the stored value from storage.sync on mount", async () => {
    await fakeChrome.storage.sync.set({ [KEY]: "stored-value" });

    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();

    expect(result.current[0]).toBe("stored-value");
  });

  it("keeps the default when storage.sync has no value", async () => {
    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();

    expect(result.current[0]).toBe("default");
  });

  it("does not write to storage.sync on mount, even under StrictMode", async () => {
    const setSpy = vi.spyOn(fakeChrome.storage.sync, "set");

    await renderHook(() => useSyncedPreference(KEY, normalize, "default"), {
      strictMode: true,
    });
    await flushAsync();

    expect(setSpy).not.toHaveBeenCalled();
  });

  it("fires storage.sync.set exactly once per set, even under StrictMode", async () => {
    const setSpy = vi.spyOn(fakeChrome.storage.sync, "set");
    const { result } = await renderHook(
      () => useSyncedPreference(KEY, normalize, "default"),
      { strictMode: true },
    );
    await flushAsync();
    setSpy.mockClear();

    await act(async () => {
      result.current[1]("chosen");
    });
    await flushAsync();

    // The write lives outside the setState updater, so StrictMode's double
    // invoke of the updater can't persist twice.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe("chosen");
  });

  it("drops the initial load when the hook unmounts before it resolves", async () => {
    const normalizeSpy = vi.fn(normalize);
    const resolveGet = deferGet();

    const { result, unmount } = await renderHook(() =>
      useSyncedPreference(KEY, normalizeSpy, "default"),
    );
    expect(result.current[0]).toBe("default");
    expect(normalizeSpy).not.toHaveBeenCalled();

    await unmount();
    resolveGet({ [KEY]: "late-value" });
    await flushAsync();

    // The cancelled guard short-circuits before normalize/setValue run.
    expect(normalizeSpy).not.toHaveBeenCalled();
  });

  it("applies a cross-tab change from the sync area", async () => {
    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();
    expect(result.current[0]).toBe("default");

    await act(async () => {
      await fakeChrome.storage.sync.set({ [KEY]: "from-other-tab" });
    });
    await flushAsync();

    expect(result.current[0]).toBe("from-other-tab");
  });

  it("ignores a change from a non-sync area", async () => {
    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();

    await act(async () => {
      await fakeChrome.storage.local.set({ [KEY]: "local-only" });
    });
    await flushAsync();

    expect(result.current[0]).toBe("default");
  });

  it("ignores a sync change for a different key", async () => {
    // Start from a non-default value so a spurious update would be observable:
    // softening the changes[key] guard to change?.newValue would normalize
    // undefined back to "default" and flip this.
    await fakeChrome.storage.sync.set({ [KEY]: "real-value" });
    const normalizeSpy = vi.fn(normalize);
    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalizeSpy, "default"),
    );
    await flushAsync();
    expect(result.current[0]).toBe("real-value");
    normalizeSpy.mockClear();

    await act(async () => {
      await fakeChrome.storage.sync.set({ "totem:other-pref": "unrelated" });
    });
    await flushAsync();

    expect(normalizeSpy).not.toHaveBeenCalled();
    expect(result.current[0]).toBe("real-value");
  });

  it("attaches a catch to a rejected storage.sync.set so it never leaks", async () => {
    // Deterministic alternative to watching for an unhandled rejection (which
    // surfaces non-deterministically): assert setSyncedValue actually attaches a
    // rejection handler to the promise it gets back from set().
    let catchHandlers = 0;
    fakeChrome.storage.sync.set = vi.fn(() => {
      const rejected = Promise.reject(new Error("quota exceeded"));
      const realCatch = rejected.catch.bind(rejected);
      rejected.catch = ((onRejected?: (reason: unknown) => unknown) => {
        catchHandlers += 1;
        return realCatch(onRejected);
      }) as typeof rejected.catch;
      return rejected;
    });

    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();

    await act(async () => {
      result.current[1]("optimistic");
    });
    await flushAsync();

    expect(result.current[0]).toBe("optimistic");
    expect(fakeChrome.storage.sync.set).toHaveBeenCalledWith({
      [KEY]: "optimistic",
    });
    expect(catchHandlers).toBeGreaterThan(0);
  });

  it("is a no-op writer when storage.sync is unavailable", async () => {
    vi.stubGlobal("chrome", { storage: {} });
    expect(hasChromeStorageSync()).toBe(false);

    const { result } = await renderHook(() =>
      useSyncedPreference(KEY, normalize, "default"),
    );
    await flushAsync();
    expect(result.current[0]).toBe("default");

    // Setting still updates local state without throwing on the missing area.
    await act(async () => {
      result.current[1]("local-only");
    });
    await flushAsync();

    expect(result.current[0]).toBe("local-only");
  });
});

describe("useSyncedPreference consumers — skipInitialLoad", () => {
  it("useSettings keeps a user patch made before the initial load resolves", async () => {
    const resolveGet = deferGet();

    const { result } = await renderHook(() => useSettings());
    await act(async () => {
      result.current.updateSettings({ showSearchBar: false });
    });

    resolveGet({ [SYNC_SETTINGS]: { showSearchBar: true } });
    await flushAsync();

    expect(result.current.settings.showSearchBar).toBe(false);
  });

  it("useTheme keeps a theme chosen before the initial load resolves", async () => {
    const resolveGet = deferGet();

    const { result } = await renderHook(() => useTheme());
    await act(async () => {
      result.current.setThemePreference("dark");
    });

    resolveGet({ [SYNC_THEME]: "light" });
    await flushAsync();

    expect(result.current.themePreference).toBe("dark");
  });
});
