import { describe, expect, it, vi } from "vitest";
import { UNINSTALL_FEEDBACK_URL } from "../../lib/constants/growth";
import { registerReleaseFoundationHooks } from "../index";

describe("release foundation hooks", () => {
  it("sets the uninstall feedback URL when hooks are registered", () => {
    const setUninstallURL = vi.fn((_url: string, callback?: () => void) => {
      callback?.();
    });
    const runtime = {
      getURL(path: string) {
        return `chrome-extension://fake/${path}`;
      },
      setUninstallURL,
    };

    registerReleaseFoundationHooks(runtime, undefined, vi.fn());

    expect(setUninstallURL).toHaveBeenCalledWith(
      UNINSTALL_FEEDBACK_URL,
      expect.any(Function),
    );
  });

  it("requests onboarding and opens the first-launch tab only on install", async () => {
    let installListener:
      | ((details: chrome.runtime.InstalledDetails) => void)
      | null = null;
    const setUninstallURL = vi.fn((_url: string, callback?: () => void) => {
      callback?.();
    });
    const runtime = {
      getURL(path: string) {
        return `chrome-extension://fake/${path}`;
      },
      setUninstallURL,
      onInstalled: {
        addListener(listener: (details: chrome.runtime.InstalledDetails) => void) {
          installListener = listener;
        },
      },
    };
    const tabs = {
      create: vi.fn(() => Promise.resolve({ id: 1 })),
    };
    const requestOnboarding = vi.fn(() => Promise.resolve());

    registerReleaseFoundationHooks(runtime, tabs, requestOnboarding);

    const listener = installListener as
      | ((details: chrome.runtime.InstalledDetails) => void)
      | null;
    if (!listener) throw new Error("install listener was not registered");
    listener({ reason: "update" } as chrome.runtime.InstalledDetails);
    await Promise.resolve();

    expect(requestOnboarding).not.toHaveBeenCalled();
    expect(tabs.create).not.toHaveBeenCalled();

    listener({ reason: "install" } as chrome.runtime.InstalledDetails);
    await Promise.resolve();
    await Promise.resolve();

    expect(requestOnboarding).toHaveBeenCalledTimes(1);
    expect(tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://fake/newtab.html?onboarding=1&utm_source=extension&utm_medium=oninstall&utm_campaign=first_launch",
      active: true,
    });
    expect(setUninstallURL).toHaveBeenCalledTimes(3);
  });
});
