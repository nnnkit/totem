import { describe, it, expect, beforeEach } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import {
  registerHandlers,
  _handlers,
  _dispatch,
  type Handler,
  type HandlerMap,
} from "../index";

// Install fake chrome globally so the router can use it
const fakeChrome = createFakeChrome();

beforeEach(() => {
  // Wire fake chrome.runtime.onMessage to use the dispatch function
  fakeChrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return _dispatch(
      message as { type?: string } & Record<string, unknown>,
      sender,
      sendResponse,
    );
  });
});

describe("service worker message router", () => {
  it("dispatches PING to the built-in no-op handler", async () => {
    const response = await fakeChrome.runtime.sendMessage({ type: "PING" });
    expect(response).toEqual({ ok: true, pong: true });
  });

  it("returns undefined for unknown message types", async () => {
    const response = await fakeChrome.runtime.sendMessage({
      type: "UNKNOWN_TYPE",
    });
    expect(response).toBeUndefined();
  });

  it("routes a custom registered handler", async () => {
    const echoHandler: Handler = (msg) => ({
      echo: msg.payload,
    });

    registerHandlers({ ECHO: echoHandler });

    const response = await fakeChrome.runtime.sendMessage({
      type: "ECHO",
      payload: "hello",
    });
    expect(response).toEqual({ echo: "hello" });
  });

  it("routes an async handler and returns the response", async () => {
    const asyncHandler: Handler = async (msg) => {
      return { doubled: (msg.value as number) * 2 };
    };

    registerHandlers({ DOUBLE: asyncHandler });

    const response = await fakeChrome.runtime.sendMessage({
      type: "DOUBLE",
      value: 21,
    });
    expect(response).toEqual({ doubled: 42 });
  });

  it("catches async handler errors and returns error response", async () => {
    const failHandler: Handler = async () => {
      throw new Error("BOOM");
    };

    registerHandlers({ FAIL_ASYNC: failHandler });

    const response = (await fakeChrome.runtime.sendMessage({
      type: "FAIL_ASYNC",
    })) as { error: string };
    expect(response.error).toBe("BOOM");
  });

  it("catches sync handler errors and returns error response", async () => {
    const failSync: Handler = () => {
      throw new Error("SYNC_BOOM");
    };

    registerHandlers({ FAIL_SYNC: failSync });

    const response = (await fakeChrome.runtime.sendMessage({
      type: "FAIL_SYNC",
    })) as { error: string };
    expect(response.error).toBe("SYNC_BOOM");
  });

  it("merges multiple handler maps", () => {
    const mapA: HandlerMap = { A: () => "a" };
    const mapB: HandlerMap = { B: () => "b" };

    registerHandlers(mapA, mapB);

    expect("A" in _handlers).toBe(true);
    expect("B" in _handlers).toBe(true);
  });
});

describe("fake chrome.storage.local", () => {
  it("set, get, and remove work correctly", async () => {
    const storage = fakeChrome.storage.local;

    await storage.set({ foo: "bar", num: 42 });
    const result = await storage.get(["foo", "num"]);
    expect(result).toEqual({ foo: "bar", num: 42 });

    await storage.remove("foo");
    const after = await storage.get(["foo", "num"]);
    expect(after).toEqual({ num: 42 });
  });

  it("onChanged fires on set", async () => {
    const storage = fakeChrome.storage.local;
    const changes: Record<string, chrome.storage.StorageChange>[] = [];
    storage.onChanged.addListener((c) => changes.push(c));

    await storage.set({ key: "value" });
    expect(changes).toHaveLength(1);
    expect(changes[0].key.newValue).toBe("value");
  });
});

describe("fake chrome.tabs", () => {
  it("create returns a tab with incrementing id", async () => {
    fakeChrome.tabs._reset();
    const tab1 = await fakeChrome.tabs.create({ url: "https://example.com" });
    const tab2 = await fakeChrome.tabs.create({ url: "https://test.com" });
    expect(tab1.id).toBe(1);
    expect(tab2.id).toBe(2);
    expect(fakeChrome.tabs._createdTabs()).toHaveLength(2);
  });
});

describe("end-to-end: send → dispatch → response", () => {
  it("sends a message via fake chrome, router dispatches to handler, response returned", async () => {
    // Register a handler that simulates a real service worker operation
    registerHandlers({
      GREET: (msg) => ({
        ok: true,
        greeting: `Hello, ${msg.name}!`,
      }),
    });

    // Wire the router dispatch into fake chrome's runtime
    // (already done in beforeEach, but handlers persist across tests)

    // Send message through the fake chrome runtime
    const response = (await fakeChrome.runtime.sendMessage({
      type: "GREET",
      name: "World",
    })) as { ok: boolean; greeting: string };

    // Verify the full cycle
    expect(response.ok).toBe(true);
    expect(response.greeting).toBe("Hello, World!");
  });
});
