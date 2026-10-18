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

  it("signals stopOnEmptyResponse when instructions array is empty (zero-bookmark account)", () => {
    const result = parseBookmarkPagePayload(makePayload([]));
    expect(result).toEqual({
      bookmarks: [],
      cursor: null,
      stopOnEmptyResponse: true,
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

describe("note tweet rich text", () => {
  function parseNote(note: Record<string, unknown>) {
    const tweet = makeTweetResult("tweet-7", true) as Record<string, unknown>;
    tweet.note_tweet = { note_tweet_results: { result: note } };
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "tweet-7",
            sortIndex: "7",
            content: { itemContent: { tweet_results: { result: tweet } } },
          },
        ],
      },
    ]);
    return parseBookmarkPagePayload(payload).bookmarks[0];
  }

  it("maps bold/italic ranges onto the expanded, decoded text", () => {
    const bookmark = parseNote({
      text: "Tom &amp; Jerry https://t.co/x Bold end",
      entity_set: { urls: [{ url: "https://t.co/x", expanded_url: "https://example.com/long" }] },
      richtext: {
        richtext_tags: [
          { from_index: 0, to_index: 15, richtext_types: ["Bold"] },
          { from_index: 31, to_index: 35, richtext_types: ["Bold", "Italic"] },
        ],
      },
    });
    expect(bookmark.text).toBe("Tom & Jerry https://example.com/long Bold end");
    const slices = bookmark.textStyles!.map((r) => [r.style, bookmark.text.slice(r.start, r.end)]);
    expect(slices).toHaveLength(3);
    expect(slices).toEqual(
      expect.arrayContaining([
        ["bold", "Tom & Jerry"],
        ["bold", "Bold"],
        ["italic", "Bold"],
      ]),
    );
  });

  it("omits styles when the note has no rich text", () => {
    expect(parseNote({ text: "plain", entity_set: {} }).textStyles).toBeUndefined();
  });
});

// Card and reply fixtures are trimmed from real Bookmarks/Search/Home payloads.
describe("cards, polls and reply prefixes", () => {
  type Binding = [string, string | boolean];

  function parseWith(patch: (tweet: Record<string, any>) => void) {
    const tweet = makeTweetResult("tweet-9", true) as Record<string, any>;
    patch(tweet);
    const payload = makePayload([
      {
        type: "TimelineAddEntries",
        entries: [
          {
            entryId: "tweet-9",
            sortIndex: "9",
            content: { itemContent: { tweet_results: { result: tweet } } },
          },
        ],
      },
    ]);
    return parseBookmarkPagePayload(payload).bookmarks[0];
  }

  function card(name: string, bindings: Binding[]) {
    return {
      legacy: {
        name,
        binding_values: bindings.map(([key, value]) => ({
          key,
          value: typeof value === "boolean" ? { type: "BOOLEAN", boolean_value: value } : { type: "STRING", string_value: value },
        })),
      },
    };
  }

  it("parses a closed poll with final counts", () => {
    const bookmark = parseWith((tweet) => {
      tweet.card = card("poll3choice_text_only", [
        ["choice1_label", "BOYNEXTDOOR"],
        ["choice2_label", "SOYEON"],
        ["end_datetime_utc", "2026-10-04T11:28:08Z"],
        ["counts_are_final", true],
        ["choice2_count", "10"],
        ["choice1_count", "1034"],
        ["choice3_count", "20"],
        ["choice3_label", "ALLDAY PROJECT"],
        ["api", "capi://passthrough/1"],
        ["card_url", "https://twitter.com"],
      ]);
    });
    expect(bookmark.poll).toEqual({
      choices: [
        { label: "BOYNEXTDOOR", count: 1034 },
        { label: "SOYEON", count: 10 },
        { label: "ALLDAY PROJECT", count: 20 },
      ],
      ended: true,
      endsAt: "2026-10-04T11:28:08Z",
    });
  });

  it("parses an open poll and keeps zero counts", () => {
    const bookmark = parseWith((tweet) => {
      tweet.card = card("poll4choice_text_only", [
        ["choice1_label", "deepseek v4.1 flash"],
        ["choice2_label", "reflection beam"],
        ["end_datetime_utc", "2026-10-19T07:10:47Z"],
        ["counts_are_final", false],
        ["choice2_count", "0"],
        ["choice1_count", "0"],
        ["choice4_label", "none, chatgpt for life"],
        ["choice3_count", "0"],
        ["choice4_count", "0"],
        ["choice3_label", "gemini 4 argon"],
      ]);
    });
    expect(bookmark.poll?.ended).toBe(false);
    expect(bookmark.poll?.choices.map((c) => c.label)).toEqual([
      "deepseek v4.1 flash",
      "reflection beam",
      "gemini 4 argon",
      "none, chatgpt for life",
    ]);
    expect(bookmark.urls).toEqual([]);
  });

  it("attaches player cards like summary cards", () => {
    const bookmark = parseWith((tweet) => {
      tweet.legacy.full_text = "https://t.co/XYt9IE6unA";
      tweet.legacy.entities.urls = [
        {
          url: "https://t.co/XYt9IE6unA",
          display_url: "youtube.com/watch?v=P0TE0p…",
          expanded_url: "https://www.youtube.com/watch?v=P0TE0pJQBEs",
        },
      ];
      tweet.card = card("player", [
        ["player_url", "https://www.youtube.com/embed/P0TE0pJQBEs"],
        ["description", "AEW Women's World Champion Mercedes Moné defends against former cha..."],
        ["domain", "www.youtube.com"],
        ["vanity_url", "youtube.com"],
        ["title", "Mercedes Moné vs Thekla - AEW Women's World Championship | AEW..."],
        ["card_url", "https://t.co/XYt9IE6unA"],
      ]);
      tweet.card.legacy.binding_values.push({
        key: "player_image_original",
        value: { type: "IMAGE", image_value: { url: "https://pbs.twimg.com/card_img/2111723264058052608/-iuOW1-h?format=jpg&name=orig" } },
      });
    });
    expect(bookmark.urls[0].card).toMatchObject({
      title: "Mercedes Moné vs Thekla - AEW Women's World Championship | AEW...",
      domain: "youtube.com",
      cardType: "player",
      imageUrl: "https://pbs.twimg.com/card_img/2111723264058052608/-iuOW1-h?format=jpg&name=orig",
    });
  });

  it("turns a unified_card website destination into a link card", () => {
    const unified = {
      type: "image_website",
      component_objects: {
        details_1: {
          type: "details",
          data: {
            title: { content: "Buy Now!", is_rtl: false },
            subtitle: { content: "amazon.in", is_rtl: false },
            destination: "browser_1",
          },
        },
        media_1: { type: "media", data: { id: "3_2111465050452185088", destination: "browser_1" } },
      },
      destination_objects: {
        browser_1: {
          type: "browser",
          data: { url_data: { url: "https://link.amazon/B09xLtApZ", vanity: "amazon.in" } },
        },
      },
    };
    const bookmark = parseWith((tweet) => {
      tweet.card = card("unified_card", [
        ["unified_card", JSON.stringify(unified)],
        ["card_url", "https://twitter.com"],
      ]);
    });
    expect(bookmark.urls).toEqual([
      {
        url: "https://link.amazon/B09xLtApZ",
        displayUrl: "amazon.in",
        expandedUrl: "https://link.amazon/B09xLtApZ",
        card: { title: "Buy Now!", domain: "amazon.in", cardType: "unified_card" },
      },
    ]);
  });

  it("drops leading reply handles hidden by display_text_range", () => {
    const bookmark = parseWith((tweet) => {
      tweet.legacy.full_text = "@0xblacklight @mattpocockuk fixed!";
      tweet.legacy.display_text_range = [28, 34];
      tweet.legacy.in_reply_to_screen_name = "0xblacklight";
      tweet.legacy.in_reply_to_status_id_str = "2087579979181887989";
    });
    expect(bookmark.text).toBe("fixed!");
    expect(bookmark.inReplyToScreenName).toBe("0xblacklight");
  });

  it("keeps the text when the hidden prefix is not just handles", () => {
    const bookmark = parseWith((tweet) => {
      tweet.legacy.full_text = "RT this @a: hi";
      tweet.legacy.display_text_range = [11, 14];
    });
    expect(bookmark.text).toBe("RT this @a: hi");
  });
});
