import { describe, expect, it } from "vitest";
import { parseBookmarkPagePayload } from "../parsers";

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
});
