import { describe, expect, it } from "vitest";
import { classifyDetailError } from "../detail-error";

describe("classifyDetailError", () => {
  it("classifies auth errors explicitly", () => {
    expect(classifyDetailError("NO_AUTH")).toBe("auth");
    expect(classifyDetailError("AUTH_EXPIRED")).toBe("auth");
  });

  it("classifies RATE_LIMITED as its own kind (not generic 'other')", () => {
    // Distinct kind so the reader UI can hide a useless Retry and point to
    // the canonical fallback (View on X) instead.
    expect(classifyDetailError("RATE_LIMITED")).toBe("rate_limited");
  });

  it("classifies DETAIL_NOT_FOUND as its own kind (not generic 'other')", () => {
    // Distinct kind so the reader UI can suppress Retry — the tweet is gone.
    expect(classifyDetailError("DETAIL_NOT_FOUND")).toBe("not_found");
  });

  it("prefers terminal codes over the offline hint", () => {
    // If the SW told us NO_AUTH, that takes precedence over navigator state —
    // the right action is Log in, not "you're offline".
    expect(classifyDetailError("NO_AUTH", { isOnline: false })).toBe("auth");
    expect(classifyDetailError("RATE_LIMITED", { isOnline: false })).toBe(
      "rate_limited",
    );
  });

  it("classifies network-like failures as offline", () => {
    expect(classifyDetailError("Failed to fetch")).toBe("offline");
    expect(classifyDetailError("ERR_INTERNET_DISCONNECTED")).toBe("offline");
  });

  it("uses connectivity hint when browser reports offline", () => {
    expect(classifyDetailError("DETAIL_ERROR_500", { isOnline: false })).toBe(
      "offline",
    );
  });

  it("keeps non-network server failures in generic error bucket", () => {
    expect(classifyDetailError("DETAIL_ERROR_500: upstream")).toBe("other");
  });
});
