import { beforeEach, describe, expect, it } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import {
  createMessageRouter,
  mergeHandlerMaps,
  pingHandler,
  type HandlerMap,
} from "../index";

describe("service worker message router", () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>;

  beforeEach(() => {
    fakeChrome = createFakeChrome();
  });

  it("dispatches a message to the correct handler", async () => {
    const router = createMessageRouter(pingHandler);
    fakeChrome.runtime.onMessage.addListener(router);

    const response = await fakeChrome.runtime.sendMessage({ type: "PING" });
    expect(response).toEqual({ ok: true, pong: true });
  });

  it("returns undefined for unregistered message types", async () => {
    const router = createMessageRouter(pingHandler);
    fakeChrome.runtime.onMessage.addListener(router);

    const response = await fakeChrome.runtime.sendMessage({ type: "UNKNOWN" });
    expect(response).toBeUndefined();
  });

  it("returns undefined for non-object messages", async () => {
    const router = createMessageRouter(pingHandler);
    fakeChrome.runtime.onMessage.addListener(router);

    const response = await fakeChrome.runtime.sendMessage("not an object");
    expect(response).toBeUndefined();
  });

  it("returns error response when handler throws", async () => {
    const handlers: HandlerMap = {
      FAIL: async () => {
        throw new Error("SOMETHING_BROKE");
      },
    };
    const router = createMessageRouter(handlers);
    fakeChrome.runtime.onMessage.addListener(router);

    const response = await fakeChrome.runtime.sendMessage({ type: "FAIL" });
    expect(response).toEqual({ error: "SOMETHING_BROKE" });
  });

  it("dispatches merged handler maps", async () => {
    const extra: HandlerMap = {
      ECHO: async (msg) => ({ echo: (msg as unknown as { value: string }).value }),
    };
    const merged = mergeHandlerMaps(pingHandler, extra);
    const router = createMessageRouter(merged);
    fakeChrome.runtime.onMessage.addListener(router);

    const ping = await fakeChrome.runtime.sendMessage({ type: "PING" });
    expect(ping).toEqual({ ok: true, pong: true });

    const echo = await fakeChrome.runtime.sendMessage({
      type: "ECHO",
      value: "hello",
    });
    expect(echo).toEqual({ echo: "hello" });
  });
});

describe("mergeHandlerMaps", () => {
  it("merges multiple handler maps", () => {
    const a: HandlerMap = { A: async () => ({}) };
    const b: HandlerMap = { B: async () => ({}) };
    const merged = mergeHandlerMaps(a, b);
    expect(Object.keys(merged).sort()).toEqual(["A", "B"]);
  });

  it("throws on duplicate message type keys", () => {
    const a: HandlerMap = { A: async () => ({}) };
    const dup: HandlerMap = { A: async () => ({}) };
    expect(() => mergeHandlerMaps(a, dup)).toThrow(
      "Duplicate handler for message type: A",
    );
  });
});

describe("fake chrome storage", () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>;

  beforeEach(() => {
    fakeChrome = createFakeChrome();
  });

  it("supports get/set/remove", async () => {
    await fakeChrome.storage.local.set({ foo: "bar", baz: 42 });
    const result = await fakeChrome.storage.local.get(["foo", "baz"]);
    expect(result).toEqual({ foo: "bar", baz: 42 });

    await fakeChrome.storage.local.remove("foo");
    const after = await fakeChrome.storage.local.get(["foo", "baz"]);
    expect(after).toEqual({ baz: 42 });
  });

  it("fires onChanged listeners on set", async () => {
    const changes: Record<string, unknown>[] = [];
    fakeChrome.storage.local.onChanged.addListener((c) => changes.push(c));

    await fakeChrome.storage.local.set({ key: "value" });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      key: { oldValue: undefined, newValue: "value" },
    });
  });
});

describe("fake chrome tabs", () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>;

  beforeEach(() => {
    fakeChrome = createFakeChrome();
  });

  it("creates tabs with incrementing IDs", async () => {
    const tab1 = await fakeChrome.tabs.create({ url: "https://x.com" });
    const tab2 = await fakeChrome.tabs.create({ url: "https://example.com" });
    expect(tab1.id).toBe(1);
    expect(tab2.id).toBe(2);
  });

  it("fires onRemoved listeners", async () => {
    const removed: number[] = [];
    fakeChrome.tabs.onRemoved.addListener((id) => removed.push(id));

    await fakeChrome.tabs.remove(42);
    expect(removed).toEqual([42]);
  });
});
