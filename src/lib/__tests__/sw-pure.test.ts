import { describe, expect, it } from "vitest";
import {
  parseTwidUserId,
  getCookieHeaderValue,
  normalizeAuthState,
  extractQueryIdForOperation,
  isQueryIdStale,
  extractGraphqlOperationName,
  parseGraphqlEndpoint,
  parseBookmarkMutation,
  extractTweetIdFromVariables,
  extractTweetIdFromReferer,
  normalizeSyncAccountId,
  getSyncBlockedReason,
} from "../sw-pure";

// ---------------------------------------------------------------------------
// parseTwidUserId
// ---------------------------------------------------------------------------

describe("parseTwidUserId", () => {
  it("extracts user ID from u=<digits> format", () => {
    expect(parseTwidUserId("u=123456789")).toBe("123456789");
  });

  it("extracts from URL-encoded u%3D format", () => {
    expect(parseTwidUserId("u%3D987654321")).toBe("987654321");
    expect(parseTwidUserId("u%3d111222333")).toBe("111222333");
  });

  it("extracts bare numeric string", () => {
    expect(parseTwidUserId("42")).toBe("42");
  });

  it("handles percent-encoded full value", () => {
    expect(parseTwidUserId("u%3D55555")).toBe("55555");
  });

  it("returns null for empty or invalid input", () => {
    expect(parseTwidUserId("")).toBeNull();
    expect(parseTwidUserId(null)).toBeNull();
    expect(parseTwidUserId(undefined)).toBeNull();
    expect(parseTwidUserId(42)).toBeNull();
    expect(parseTwidUserId("no-digits-here")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parseTwidUserId("  u=999  ")).toBe("999");
  });
});

// ---------------------------------------------------------------------------
// getCookieHeaderValue
// ---------------------------------------------------------------------------

describe("getCookieHeaderValue", () => {
  it("extracts named cookie from header string", () => {
    expect(getCookieHeaderValue("a=1; twid=u%3D100; b=2", "twid")).toBe(
      "u%3D100",
    );
  });

  it("returns first matching cookie", () => {
    expect(getCookieHeaderValue("x=1; x=2", "x")).toBe("1");
  });

  it("returns empty string when cookie not found", () => {
    expect(getCookieHeaderValue("a=1; b=2", "missing")).toBe("");
  });

  it("returns empty string for non-string input", () => {
    expect(getCookieHeaderValue(null, "a")).toBe("");
    expect(getCookieHeaderValue(undefined, "a")).toBe("");
    expect(getCookieHeaderValue(123, "a")).toBe("");
  });

  it("handles cookie with no spaces after semicolons", () => {
    expect(getCookieHeaderValue("a=1;b=2;c=3", "b")).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// normalizeAuthState
// ---------------------------------------------------------------------------

describe("normalizeAuthState", () => {
  it("returns valid auth state as-is", () => {
    expect(normalizeAuthState("logged_out", false)).toBe("logged_out");
    expect(normalizeAuthState("stale", true)).toBe("stale");
    expect(normalizeAuthState("authenticated", true)).toBe("authenticated");
  });

  it("returns stale when unknown state but has auth header", () => {
    expect(normalizeAuthState("garbage", true)).toBe("stale");
    expect(normalizeAuthState(undefined, true)).toBe("stale");
    expect(normalizeAuthState(null, true)).toBe("stale");
  });

  it("returns logged_out when unknown state and no auth header", () => {
    expect(normalizeAuthState("garbage", false)).toBe("logged_out");
    expect(normalizeAuthState(undefined, false)).toBe("logged_out");
    expect(normalizeAuthState(null, false)).toBe("logged_out");
  });
});

// ---------------------------------------------------------------------------
// extractQueryIdForOperation
// ---------------------------------------------------------------------------

describe("extractQueryIdForOperation", () => {
  it("extracts query ID from queryId,operationName order", () => {
    const text = 'e.exports={queryId:"ABcDeFgHiJkL",operationName:"Bookmarks"}';
    expect(extractQueryIdForOperation(text, "Bookmarks")).toBe("ABcDeFgHiJkL");
  });

  it("extracts query ID from operationName,queryId reversed order", () => {
    const text =
      'e.exports={operationName:"TweetDetail",queryId:"ZyXwVuTsRqPo"}';
    expect(extractQueryIdForOperation(text, "TweetDetail")).toBe(
      "ZyXwVuTsRqPo",
    );
  });

  it("handles operationId instead of queryId in reversed order", () => {
    const text =
      'e.exports={operationName:"DeleteBookmark",operationId:"OpId1234567890"}';
    expect(extractQueryIdForOperation(text, "DeleteBookmark")).toBe(
      "OpId1234567890",
    );
  });

  it("returns null when operation not found", () => {
    const text = 'e.exports={queryId:"abc123abcdef",operationName:"Other"}';
    expect(extractQueryIdForOperation(text, "Bookmarks")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(extractQueryIdForOperation("", "Bookmarks")).toBeNull();
  });

  it("escapes special regex characters in operation name", () => {
    const text =
      'e.exports={queryId:"SpecialChars12",operationName:"Test.Op"}';
    expect(extractQueryIdForOperation(text, "Test.Op")).toBe("SpecialChars12");
    // Dot should not match arbitrary character
    expect(extractQueryIdForOperation(text, "TestXOp")).toBeNull();
  });

  it("handles single-quoted values", () => {
    const text =
      "e.exports={queryId:'SingleQuote123',operationName:'Bookmarks'}";
    expect(extractQueryIdForOperation(text, "Bookmarks")).toBe(
      "SingleQuote123",
    );
  });
});

// ---------------------------------------------------------------------------
// isQueryIdStale
// ---------------------------------------------------------------------------

describe("isQueryIdStale", () => {
  it("returns true when GRAPHQL_VALIDATION_FAILED error present", () => {
    const json = {
      errors: [{ extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }],
    };
    expect(isQueryIdStale(json)).toBe(true);
  });

  it("returns false when no errors", () => {
    expect(isQueryIdStale({ data: {} })).toBe(false);
    expect(isQueryIdStale({})).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isQueryIdStale(null)).toBe(false);
    expect(isQueryIdStale(undefined)).toBe(false);
  });

  it("returns false for other error codes", () => {
    const json = { errors: [{ extensions: { code: "RATE_LIMITED" } }] };
    expect(isQueryIdStale(json)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractGraphqlOperationName
// ---------------------------------------------------------------------------

describe("extractGraphqlOperationName", () => {
  it("extracts operation name from graphql URL", () => {
    expect(
      extractGraphqlOperationName(
        "https://x.com/i/api/graphql/abc123/Bookmarks?variables=%7B%7D",
      ),
    ).toBe("Bookmarks");
  });

  it("returns empty string for non-graphql URL", () => {
    expect(extractGraphqlOperationName("https://x.com/home")).toBe("");
  });

  it("handles empty/null input", () => {
    expect(extractGraphqlOperationName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseGraphqlEndpoint
// ---------------------------------------------------------------------------

describe("parseGraphqlEndpoint", () => {
  it("parses a full graphql endpoint URL", () => {
    const result = parseGraphqlEndpoint(
      "https://x.com/i/api/graphql/qid123/Bookmarks?variables=%7B%7D&features=%7B%7D",
    );
    expect(result).toMatchObject({
      queryId: "qid123",
      operation: "Bookmarks",
    });
    expect(result?.variables).toBe("{}");
    expect(result?.features).toBe("{}");
  });

  it("returns null for non-graphql URL", () => {
    expect(parseGraphqlEndpoint("https://x.com/home")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(parseGraphqlEndpoint("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseBookmarkMutation
// ---------------------------------------------------------------------------

describe("parseBookmarkMutation", () => {
  it("parses DeleteBookmark mutation", () => {
    const result = parseBookmarkMutation(
      "https://x.com/i/api/graphql/qid456/DeleteBookmark?variables={}",
    );
    expect(result).toEqual({ queryId: "qid456", operation: "DeleteBookmark" });
  });

  it("parses CreateBookmark mutation", () => {
    const result = parseBookmarkMutation(
      "https://x.com/i/api/graphql/qid789/CreateBookmark",
    );
    expect(result).toEqual({ queryId: "qid789", operation: "CreateBookmark" });
  });

  it("returns null for non-mutation URLs", () => {
    expect(
      parseBookmarkMutation("https://x.com/i/api/graphql/qid/Bookmarks"),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractTweetIdFromVariables
// ---------------------------------------------------------------------------

describe("extractTweetIdFromVariables", () => {
  it("extracts from tweet_id", () => {
    expect(extractTweetIdFromVariables({ tweet_id: "111" })).toBe("111");
  });

  it("extracts from tweetId", () => {
    expect(extractTweetIdFromVariables({ tweetId: "222" })).toBe("222");
  });

  it("extracts from focalTweetId", () => {
    expect(extractTweetIdFromVariables({ focalTweetId: "333" })).toBe("333");
  });

  it("extracts from target_tweet_id", () => {
    expect(extractTweetIdFromVariables({ target_tweet_id: "444" })).toBe("444");
  });

  it("extracts from targetTweetId", () => {
    expect(extractTweetIdFromVariables({ targetTweetId: "555" })).toBe("555");
  });

  it("returns null for missing or non-string values", () => {
    expect(extractTweetIdFromVariables({})).toBeNull();
    expect(extractTweetIdFromVariables(null)).toBeNull();
    expect(extractTweetIdFromVariables({ tweet_id: 123 })).toBeNull();
    expect(extractTweetIdFromVariables({ tweet_id: "" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractTweetIdFromReferer
// ---------------------------------------------------------------------------

describe("extractTweetIdFromReferer", () => {
  it("extracts tweet ID from status URL", () => {
    expect(
      extractTweetIdFromReferer("https://x.com/user/status/1234567890"),
    ).toBe("1234567890");
  });

  it("returns null for non-status URLs", () => {
    expect(extractTweetIdFromReferer("https://x.com/home")).toBeNull();
  });

  it("returns null for null/empty input", () => {
    expect(extractTweetIdFromReferer(null)).toBeNull();
    expect(extractTweetIdFromReferer("")).toBeNull();
    expect(extractTweetIdFromReferer(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeSyncAccountId
// ---------------------------------------------------------------------------

describe("normalizeSyncAccountId", () => {
  it("passes through clean alphanumeric IDs", () => {
    expect(normalizeSyncAccountId("acct-123_abc")).toBe("acct-123_abc");
  });

  it("sanitizes special characters to underscores", () => {
    expect(normalizeSyncAccountId("user@domain.com")).toBe("user_domain_com");
  });

  it("trims whitespace", () => {
    expect(normalizeSyncAccountId("  abc  ")).toBe("abc");
  });

  it("truncates to 120 characters", () => {
    const long = "a".repeat(200);
    expect(normalizeSyncAccountId(long)?.length).toBe(120);
  });

  it("returns null for empty/non-string", () => {
    expect(normalizeSyncAccountId("")).toBeNull();
    expect(normalizeSyncAccountId("   ")).toBeNull();
    expect(normalizeSyncAccountId(null)).toBeNull();
    expect(normalizeSyncAccountId(undefined)).toBeNull();
    expect(normalizeSyncAccountId(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSyncBlockedReason
// ---------------------------------------------------------------------------

describe("getSyncBlockedReason", () => {
  const readySession = {
    sessionState: "logged_in",
    capability: { bookmarksApi: "ready" },
  };

  const now = Date.now();

  it("returns no_account when accountKey is null", () => {
    expect(getSyncBlockedReason(readySession, null, null, now)).toBe(
      "no_account",
    );
  });

  it("returns not_ready when not logged in", () => {
    const session = {
      sessionState: "logged_out",
      capability: { bookmarksApi: "ready" },
    };
    expect(getSyncBlockedReason(session, null, "acct-1", now)).toBe(
      "not_ready",
    );
  });

  it("returns not_ready when bookmarks API not ready", () => {
    const session = {
      sessionState: "logged_in",
      capability: { bookmarksApi: "unknown" },
    };
    expect(getSyncBlockedReason(session, null, "acct-1", now)).toBe(
      "not_ready",
    );
  });

  it("returns rate_limited when backoff is in the future", () => {
    const account = { rateLimitBackoffUntil: now + 60_000 };
    expect(getSyncBlockedReason(readySession, account, "acct-1", now)).toBe(
      "rate_limited",
    );
  });

  it("returns in_flight when a recent sync is in progress", () => {
    const account = { inFlight: { startedAt: now - 10_000 } };
    expect(getSyncBlockedReason(readySession, account, "acct-1", now)).toBe(
      "in_flight",
    );
  });

  it("ignores stale in-flight locks older than reclaim threshold", () => {
    const account = { inFlight: { startedAt: now - 100_000 } };
    expect(
      getSyncBlockedReason(readySession, account, "acct-1", now),
    ).toBeNull();
  });

  it("returns cooldown when manual cooldown is active", () => {
    const account = { manualCooldownUntil: now + 30_000 };
    expect(getSyncBlockedReason(readySession, account, "acct-1", now)).toBe(
      "cooldown",
    );
  });

  it("returns null when everything is ready", () => {
    expect(
      getSyncBlockedReason(readySession, null, "acct-1", now),
    ).toBeNull();
    expect(
      getSyncBlockedReason(readySession, {}, "acct-1", now),
    ).toBeNull();
  });
});
