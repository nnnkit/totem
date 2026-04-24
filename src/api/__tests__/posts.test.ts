import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTweetDetailCache: vi.fn(),
  upsertTweetDetailCache: vi.fn(),
  parseTweetDetailPayload: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("../../db", () => ({
  getTweetDetailCache: mocks.getTweetDetailCache,
  upsertTweetDetailCache: mocks.upsertTweetDetailCache,
}));

vi.mock("../parsers", () => ({
  parseTweetDetailPayload: mocks.parseTweetDetailPayload,
}));

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: mocks.sendMessage,
    },
  });
  mocks.getTweetDetailCache.mockResolvedValue(null);
  mocks.upsertTweetDetailCache.mockResolvedValue(undefined);
  mocks.parseTweetDetailPayload.mockImplementation((_data: unknown, tweetId: string) => ({
    focalTweet: {
      id: tweetId,
      tweetId,
      text: "body",
    },
    thread: [],
  }));

  const mod = await import("../core/posts");
  mod._clearInflightForTesting();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTweetDetail — dedup", () => {
  it("collapses two concurrent callers for the same tweetId into one sendMessage round-trip", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    let resolveFetch: (value: unknown) => void = () => {};
    mocks.sendMessage.mockImplementation(
      () => new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const first = fetchTweetDetail("123");
    const second = fetchTweetDetail("123");

    // fetchTweetDetail awaits getTweetDetailCache first — let the IDB-check
    // microtask resolve for both callers before asserting, otherwise the
    // dedup check hasn't run yet on either call.
    await Promise.resolve();
    await Promise.resolve();

    // Only one round-trip fired despite two callers.
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);

    resolveFetch({ data: { some: "payload" } });
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
  });

  it("re-fires after the previous fetch settled (map is cleared on finally)", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage.mockResolvedValue({ data: { some: "payload" } });

    await fetchTweetDetail("123");
    await fetchTweetDetail("123");

    // The cache hit short-circuit uses getTweetDetailCache which still
    // returns null in this test, so a second fetch goes to the network.
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("returns from IDB without invoking sendMessage when cache has a usable entry", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.getTweetDetailCache.mockResolvedValue({
      focalTweet: { id: "123", tweetId: "123", text: "cached" },
      thread: [],
    });

    const result = await fetchTweetDetail("123");
    expect(result.focalTweet).toMatchObject({ tweetId: "123", text: "cached" });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});

describe("fetchTweetDetail — classify / retry", () => {
  it("propagates NO_AUTH immediately without a second sendMessage", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage.mockResolvedValue({ error: "NO_AUTH" });

    await expect(fetchTweetDetail("123")).rejects.toThrow("NO_AUTH");
    // Terminal error envelope → no transport retry.
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("propagates AUTH_EXPIRED immediately without a second sendMessage", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage.mockResolvedValue({ error: "AUTH_EXPIRED" });

    await expect(fetchTweetDetail("123")).rejects.toThrow("AUTH_EXPIRED");
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("propagates RATE_LIMITED immediately without a second sendMessage", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage.mockResolvedValue({ error: "RATE_LIMITED" });

    await expect(fetchTweetDetail("123")).rejects.toThrow("RATE_LIMITED");
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("retries once if sendMessage THROWS (transport-layer failure), then succeeds", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage
      .mockRejectedValueOnce(new Error("PORT_CLOSED"))
      .mockResolvedValueOnce({ data: { recovered: true } });

    const result = await fetchTweetDetail("123");
    expect(result.focalTweet).toMatchObject({ tweetId: "123" });
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("surfaces the original transport error if BOTH attempts throw", async () => {
    const { fetchTweetDetail } = await import("../core/posts");

    mocks.sendMessage
      .mockRejectedValueOnce(new Error("PORT_CLOSED"))
      .mockRejectedValueOnce(new Error("PORT_STILL_CLOSED"));

    // First error wins — the user sees the same message regardless of which
    // attempt actually returned. Consistent UX even as we retry internally.
    await expect(fetchTweetDetail("123")).rejects.toThrow("PORT_CLOSED");
    expect(mocks.sendMessage).toHaveBeenCalledTimes(2);
  });
});
