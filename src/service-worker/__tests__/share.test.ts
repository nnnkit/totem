import { describe, expect, it, vi } from "vitest";
import type { SessionSnapshot } from "../../types/auth";
import {
  SHARE_OPEN,
  SHARE_PING,
  createShareExternalListener,
  isAllowedShareSender,
  parseShareMessage,
  respondToShareRequest,
} from "../share";

function makeSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    userId: "1",
    accountContextId: "1",
    authState: "authenticated",
    sessionState: "logged_in",
    capability: { bookmarksApi: "ready", detailApi: "ready" },
    hasAuthHeader: true,
    ...overrides,
  };
}

function makeDeps(snapshot = makeSnapshot()) {
  return {
    getVersion: () => "1.2.8",
    getSessionSnapshot: vi.fn(async () => snapshot),
    openReader: vi.fn(async () => {}),
  };
}

describe("isAllowedShareSender", () => {
  it("accepts the site and its subdomains over https only", () => {
    expect(isAllowedShareSender("https://usetotem.xyz/t/123")).toBe(true);
    expect(isAllowedShareSender("https://www.usetotem.xyz/t/123")).toBe(true);
    expect(isAllowedShareSender("http://usetotem.xyz/t/123")).toBe(false);
    expect(isAllowedShareSender("https://usetotem.xyz.evil.com/t/123")).toBe(false);
    expect(isAllowedShareSender("https://notusetotem.xyz/t/123")).toBe(false);
    expect(isAllowedShareSender(undefined)).toBe(false);
  });
});

describe("parseShareMessage", () => {
  const from = "https://usetotem.xyz/t/1234567890";

  it("parses ping and open requests", () => {
    expect(parseShareMessage({ type: SHARE_PING }, from)).toEqual({ kind: "ping" });
    expect(parseShareMessage({ type: SHARE_OPEN, tweetId: "123" }, from)).toEqual({
      kind: "open",
      tweetId: "123",
    });
  });

  it("rejects foreign senders, unknown types and bad tweet ids", () => {
    expect(parseShareMessage({ type: SHARE_PING }, "https://evil.com/")).toBeNull();
    expect(parseShareMessage({ type: "SOMETHING_ELSE" }, from)).toBeNull();
    expect(parseShareMessage({ type: SHARE_OPEN, tweetId: "../../etc" }, from)).toBeNull();
    expect(parseShareMessage({ type: SHARE_OPEN }, from)).toBeNull();
    expect(parseShareMessage("nope", from)).toBeNull();
  });
});

describe("respondToShareRequest", () => {
  it("reports that a thread can be opened when the session is ready", async () => {
    const response = await respondToShareRequest({ kind: "ping" }, 7, makeDeps());
    expect(response).toEqual({ installed: true, version: "1.2.8", canOpenThread: true });
  });

  it("reports that a thread cannot be opened without an X session", async () => {
    const deps = makeDeps(makeSnapshot({ authState: "logged_out", hasAuthHeader: false }));
    const response = await respondToShareRequest({ kind: "ping" }, 7, deps);
    expect(response).toMatchObject({ installed: true, canOpenThread: false });
  });

  it("reports that a thread cannot be opened when the detail API is blocked", async () => {
    const deps = makeDeps(
      makeSnapshot({ capability: { bookmarksApi: "ready", detailApi: "blocked" } }),
    );
    const response = await respondToShareRequest({ kind: "ping" }, 7, deps);
    expect(response).toMatchObject({ canOpenThread: false });
  });

  it("opens the reader in the sending tab", async () => {
    const deps = makeDeps();
    const response = await respondToShareRequest(
      { kind: "open", tweetId: "1234567890" },
      7,
      deps,
    );
    expect(deps.openReader).toHaveBeenCalledWith("1234567890", 7);
    expect(response).toEqual({ opened: true });
  });
});

describe("createShareExternalListener", () => {
  it("ignores messages it does not own", () => {
    const listener = createShareExternalListener(makeDeps());
    const handled = listener(
      { type: "SOMETHING_ELSE" },
      { url: "https://usetotem.xyz/t/1" } as chrome.runtime.MessageSender,
      () => {},
    );
    expect(handled).toBe(false);
  });

  it("responds asynchronously to a ping", async () => {
    const listener = createShareExternalListener(makeDeps());
    const sendResponse = vi.fn();
    const handled = listener(
      { type: SHARE_PING },
      { url: "https://usetotem.xyz/t/1", tab: { id: 3 } } as chrome.runtime.MessageSender,
      sendResponse,
    );
    expect(handled).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ installed: true }),
    );
  });

  it("reports an error instead of throwing when the navigation fails", async () => {
    const deps = makeDeps();
    deps.openReader = vi.fn(async () => {
      throw new Error("NO_TAB");
    });
    const listener = createShareExternalListener(deps);
    const sendResponse = vi.fn();
    listener(
      { type: SHARE_OPEN, tweetId: "1234567890" },
      { url: "https://usetotem.xyz/t/1" } as chrome.runtime.MessageSender,
      sendResponse,
    );
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
    expect(sendResponse).toHaveBeenCalledWith({ error: "NO_TAB" });
  });
});
