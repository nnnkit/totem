import { describe, expect, it } from "vitest";
import {
  canonicalTweetUrl,
  extractQueryIdForOperation,
  isTweetUrl,
  parseTweetUrl,
  parseTwidUserId,
} from "./pure";

describe("pure primitives", () => {
  it("parses single and double encoded twid values", () => {
    expect(parseTwidUserId("u%3D1784032851")).toBe("1784032851");
    expect(parseTwidUserId("u%253D1784032851")).toBe("1784032851");
    expect(parseTwidUserId("1784032851")).toBe("1784032851");
  });

  it("extracts query ids from realistic bundle variants", () => {
    expect(
      extractQueryIdForOperation(
        '{queryId:"ABCDE_12345",operationName:"TweetDetail"}',
        "TweetDetail",
      ),
    ).toBe("ABCDE_12345");
    expect(
      extractQueryIdForOperation(
        '{"queryId":"ABCDE-67890","operationName":"TweetDetail"}',
        "TweetDetail",
      ),
    ).toBe("ABCDE-67890");
    expect(
      extractQueryIdForOperation(
        '{operationName:"TweetDetail",operationId:"ZYXWV_12345"}',
        "TweetDetail",
      ),
    ).toBe("ZYXWV_12345");
  });

  it("normalizes X, Twitter, and mobile Twitter status URLs", () => {
    expect(parseTweetUrl("https://x.com/nnnkit/status/123")).toMatchObject({
      handle: "nnnkit",
      id: "123",
      host: "x.com",
    });
    expect(
      parseTweetUrl("https://twitter.com/NNNKit/statuses/456?foo=bar"),
    ).toMatchObject({
      handle: "NNNKit",
      id: "456",
      host: "twitter.com",
      canonicalUrl: "https://x.com/NNNKit/status/456",
    });
    expect(isTweetUrl("https://mobile.twitter.com/nnnkit/status/789")).toBe(
      true,
    );
    expect(canonicalTweetUrl("https://twitter.com/nnnkit/status/789")).toBe(
      "https://x.com/nnnkit/status/789",
    );
    expect(parseTweetUrl("https://x.com/home")).toBeNull();
  });
});
