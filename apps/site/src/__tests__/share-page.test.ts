import { describe, expect, it } from "vitest";
import { openSharedTweetInTotem, resolveSharePageState } from "../share-page";

describe("resolveSharePageState", () => {
  it("returns the fallback share-page state for valid tweet ids", () => {
    expect(resolveSharePageState("/t/1234567890", "")).toEqual({
      kind: "fallback",
      tweetId: "1234567890",
      shareUrl: "https://usetotem.xyz/share/?tweetId=1234567890",
      tweetUrl: "https://x.com/i/web/status/1234567890",
    });
  });

  it("returns the invalid state for malformed links", () => {
    expect(resolveSharePageState("/t/not-valid", "")).toEqual({
      kind: "invalid",
    });
  });

  it("reports missing extension configuration when Open in Totem is unavailable", async () => {
    await expect(openSharedTweetInTotem("1234567890")).resolves.toEqual({
      ok: false,
      reason: "MISSING_EXTENSION_ID",
    });
  });
});
