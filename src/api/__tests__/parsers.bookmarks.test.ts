import { describe, expect, it } from "vitest";
import { parseBookmarkPagePayload, parseTweetDetailPayload } from "../parsers";

function makePayload(instructions: unknown[]): unknown {
  return {
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions,
        },
      },
    },
  };
}

function makeTweetResult(tweetId: string, bookmarked: boolean): unknown {
  return {
    __typename: "Tweet",
    rest_id: tweetId,
    legacy: {
      id_str: tweetId,
      created_at: "Tue Feb 17 17:49:39 +0000 2026",
      full_text: "Hello from Totem",
      conversation_id_str: tweetId,
      bookmark_count: 3,
      bookmarked,
      favorite_count: 7,
      retweet_count: 2,
      reply_count: 1,
      entities: {
        urls: [],
      },
    },
    core: {
      user_results: {
        result: {
          legacy: {
            name: "Author",
            screen_name: "author",
            profile_image_url_https: "https://pbs.twimg.com/profile_images/totem_normal.jpg",
            verified: false,
          },
        },
      },
    },
  };
}

describe("parseBookmarkPagePayload", () => {
  it("extracts bottom cursor from later instruction entries", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "tweet-1",
            content: {},
          },
        ],
      },
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-bottom-1",
            content: {
              value: "CURSOR_LATER",
              stopOnEmptyResponse: true,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_LATER");
    expect(result.stopOnEmptyResponse).toBe(true);
  });

  it("extracts cursor from instruction.entry payloads", () => {
    const payload = makePayload([
      {
        type: "TimelinePinEntry",
        entry: {
          entryId: "cursor-bottom-single",
          content: {
            value: "CURSOR_SINGLE",
            stopOnEmptyResponse: false,
          },
        },
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_SINGLE");
    expect(result.stopOnEmptyResponse).toBe(false);
  });

  it("uses cursorType bottom fallback when entryId format differs", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-unknown-shape",
            content: {
              cursorType: "Bottom",
              value: "CURSOR_FALLBACK",
              stopOnEmptyResponse: true,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_FALLBACK");
    expect(result.stopOnEmptyResponse).toBe(true);
  });

  it("reads cursor from nested cursor payload shape", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-bottom-0",
            content: {
              cursorType: "Bottom",
              value: {
                cursor: "CURSOR_NESTED",
              },
              stopOnEmptyResponse: true,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_NESTED");
    expect(result.stopOnEmptyResponse).toBe(true);
  });

  it("reads nested operation cursor payload", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "tweet-1",
            content: {
              itemType: "TimelineTweet",
            },
          },
          {
            entryId: "cursor-0",
            content: {
              operation: {
                cursor: {
                  value: "CURSOR_OP",
                },
              },
              stopOnEmptyResponse: false,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_OP");
    expect(result.stopOnEmptyResponse).toBe(false);
  });

  it("ignores non-cursor operation payloads", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-unknown-shape",
            content: {
              operation: {
                foo: {
                  value: "NOT_A_CURSOR",
                },
              },
              stopOnEmptyResponse: false,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBeNull();
    expect(result.stopOnEmptyResponse).toBe(false);
  });

  it("reads cursor from TimelineTimelineCursor entry type", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "some-entry",
            content: {
              __typename: "TimelineTimelineCursor",
              value: {
                value: "CURSOR_TYPE_ENTRY",
              },
              stopOnEmptyResponse: true,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_TYPE_ENTRY");
    expect(result.stopOnEmptyResponse).toBe(true);
  });

  it("falls back to Top cursor when Bottom cursor is unavailable", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-top-0",
            content: {
              cursorType: "Top",
              value: {
                cursor: "CURSOR_TOP",
              },
              stopOnEmptyResponse: false,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_TOP");
    expect(result.stopOnEmptyResponse).toBe(false);
  });

  it("prefers Bottom cursor over Top when both are present", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "cursor-top-0",
            content: {
              cursorType: "Top",
              value: "CURSOR_TOP",
              stopOnEmptyResponse: false,
            },
          },
          {
            entryId: "cursor-bottom-0",
            content: {
              value: "CURSOR_BOTTOM",
              stopOnEmptyResponse: false,
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.cursor).toBe("CURSOR_BOTTOM");
  });

  it("returns empty result when timeline payload is missing", () => {
    const result = parseBookmarkPagePayload({});
    expect(result).toEqual({
      bookmarks: [],
      cursor: null,
      stopOnEmptyResponse: false,
    });
  });

  it("preserves bookmarked state from bookmark timeline rows", () => {
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "tweet-1",
            sortIndex: "999",
            content: {
              itemContent: {
                tweet_results: {
                  result: makeTweetResult("tweet-1", true),
                },
              },
            },
          },
        ],
      },
    ]);

    const result = parseBookmarkPagePayload(payload);
    expect(result.bookmarks[0]?.bookmarked).toBe(true);
  });
});

describe("parseTweetDetailPayload", () => {
  it("preserves bookmarked state from direct tweet detail payloads", () => {
    const result = parseTweetDetailPayload({
      data: {
        tweetResult: {
          result: makeTweetResult("tweet-42", false),
        },
      },
    }, "tweet-42");

    expect(result.focalTweet?.tweetId).toBe("tweet-42");
    expect(result.focalTweet?.bookmarked).toBe(false);
    expect(result.thread).toEqual([]);
  });
});
