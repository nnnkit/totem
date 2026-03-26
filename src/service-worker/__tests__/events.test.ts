import { beforeEach, describe, expect, it } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import { createEventHandlers } from "../events";
import type { MessageRequest } from "../../types/messages";

function createTestDeps() {
  const fakeChrome = createFakeChrome();
  const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
  const handlers = createEventHandlers({ storage });
  return { fakeChrome, storage, handlers };
}

describe("event queue ack pipeline", () => {
  let deps: ReturnType<typeof createTestDeps>;

  beforeEach(() => {
    deps = createTestDeps();
  });

  it("returns empty events when none exist", async () => {
    const result = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: unknown[] } };

    expect(result.data.events).toEqual([]);
  });

  it("pushes and retrieves delete bookmark events", async () => {
    // Push a delete event via BOOKMARK_MUTATION
    await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "DeleteBookmark",
        tweetId: "12345",
        source: "test",
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    const result = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: Array<{ type: string; tweetId: string }> } };

    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].type).toBe("DeleteBookmark");
    expect(result.data.events[0].tweetId).toBe("12345");
  });

  it("requires confirmation for CreateBookmark events", async () => {
    // Unconfirmed create should not push
    await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "CreateBookmark",
        tweetId: "12345",
        confirmed: false,
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    let result = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: unknown[] } };
    expect(result.data.events).toHaveLength(0);

    // Confirmed create should push
    await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "CreateBookmark",
        tweetId: "12345",
        confirmed: true,
        source: "test",
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    result = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: unknown[] } };
    expect(result.data.events).toHaveLength(1);
  });

  it("acknowledges events by ID", async () => {
    // Push two events
    await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "DeleteBookmark",
        tweetId: "111",
        source: "test",
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );
    await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "DeleteBookmark",
        tweetId: "222",
        source: "test",
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    );

    // Get events to find IDs
    const events = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: Array<{ id: string; tweetId: string }> } };
    expect(events.data.events).toHaveLength(2);

    // Ack the first event
    const firstId = events.data.events[0].id;
    const ackResult = (await deps.handlers.ACK_BOOKMARK_EVENTS(
      {
        type: "ACK_BOOKMARK_EVENTS",
        ids: [firstId],
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { removed: number; remaining: number } };

    expect(ackResult.data.removed).toBe(1);
    expect(ackResult.data.remaining).toBe(1);

    // Verify only second event remains
    const remaining = (await deps.handlers.GET_BOOKMARK_EVENTS(
      { type: "GET_BOOKMARK_EVENTS" } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { events: Array<{ tweetId: string }> } };
    expect(remaining.data.events).toHaveLength(1);
    expect(remaining.data.events[0].tweetId).toBe("222");
  });

  it("rejects invalid tweet IDs", async () => {
    const result = (await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "DeleteBookmark",
        tweetId: "not-a-number",
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { ok: boolean };

    expect(result.ok).toBe(false);
  });

  it("rejects invalid operations", async () => {
    const result = (await deps.handlers.BOOKMARK_MUTATION(
      {
        type: "BOOKMARK_MUTATION",
        operation: "InvalidOp",
        tweetId: "12345",
      } as unknown as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { ok: boolean };

    expect(result.ok).toBe(false);
  });

  it("handles empty ack gracefully", async () => {
    const result = (await deps.handlers.ACK_BOOKMARK_EVENTS(
      {
        type: "ACK_BOOKMARK_EVENTS",
        ids: [],
      } as MessageRequest,
      {} as chrome.runtime.MessageSender,
    )) as { data: { removed: number; remaining: number } };

    expect(result.data.removed).toBe(0);
    expect(result.data.remaining).toBe(0);
  });
});
