import { describe, expect, it } from "vitest";
import { classifyDetailError } from "../detail-error";

describe("classifyDetailError", () => {
  it("classifies auth errors explicitly", () => {
    expect(classifyDetailError("NO_AUTH")).toBe("auth");
    expect(classifyDetailError("AUTH_EXPIRED")).toBe("auth");
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
