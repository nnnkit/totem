import { describe, expect, it } from "vitest";
import {
  getNewTabView,
  getNewTabUrl,
  getReaderReturnSurface,
  getReaderTweetId,
  getReaderUrl,
  isReaderRoute,
  isValidTweetId,
  parseTweetIdFromHref,
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

  describe("parseTweetIdFromHref", () => {
    it("extracts tweet id from full status url", () => {
      expect(parseTweetIdFromHref("https://x.com/user/status/1234567890")).toBe("1234567890");
    });

    it("extracts tweet id from relative path", () => {
      expect(parseTweetIdFromHref("/user/status/9876543210")).toBe("9876543210");
    });

    it("extracts tweet id when url has query params", () => {
      expect(parseTweetIdFromHref("https://x.com/user/status/111?s=20")).toBe("111");
    });

    it("returns empty string for non-status urls", () => {
      expect(parseTweetIdFromHref("https://x.com/user")).toBe("");
      expect(parseTweetIdFromHref("https://x.com/home")).toBe("");
    });

    it("returns empty string for empty or invalid input", () => {
      expect(parseTweetIdFromHref("")).toBe("");
      expect(parseTweetIdFromHref("not a url %%%")).toBe("");
    });
  });

  describe("isValidTweetId", () => {
    it("accepts numeric ids up to 20 digits", () => {
      expect(isValidTweetId("1")).toBe(true);
      expect(isValidTweetId("12345678901234567890")).toBe(true);
    });

    it("rejects non-numeric or oversized ids", () => {
      expect(isValidTweetId("")).toBe(false);
      expect(isValidTweetId("abc")).toBe(false);
      expect(isValidTweetId("123456789012345678901")).toBe(false);
      expect(isValidTweetId("123-456")).toBe(false);
    });
  });
});
