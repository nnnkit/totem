import { describe, expect, it } from "vitest";
import {
  getNewTabView,
  getNewTabUrl,
  getReaderReturnSurface,
  getReaderTweetId,
  getReaderUrl,
  isReaderRoute,
} from "../reader-navigation";

describe("reader-navigation", () => {
  it("builds reader urls with encoded tweet ids", () => {
    expect(
      getReaderUrl(
        "tweet/with space",
        "chrome-extension://abc123/newtab.html",
        "reading",
      ),
    ).toBe(
      "chrome-extension://abc123/reader.html?read=tweet%2Fwith+space&from=reading",
    );
  });

  it("builds clean and reading-targeted new tab urls", () => {
    expect(getNewTabUrl("chrome-extension://abc123/reader.html?read=1")).toBe(
      "chrome-extension://abc123/newtab.html",
    );
    expect(
      getNewTabUrl(
        "chrome-extension://abc123/reader.html?read=1&from=reading",
        "reading",
      ),
    ).toBe("chrome-extension://abc123/newtab.html?view=reading");
  });

  it("parses reader params and route shape", () => {
    expect(getReaderTweetId("?read=42")).toBe("42");
    expect(getReaderTweetId("")).toBeNull();
    expect(getReaderReturnSurface("?read=42&from=reading")).toBe("reading");
    expect(getReaderReturnSurface("?read=42")).toBe("home");
    expect(getNewTabView("?view=reading")).toBe("reading");
    expect(getNewTabView("")).toBeNull();
    expect(isReaderRoute("/reader.html")).toBe(true);
    expect(isReaderRoute("/newtab.html")).toBe(false);
  });
});
