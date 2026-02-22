import { describe, it, expect } from "vitest";
import type { BookmarkChangeEvent } from "../../api/core/bookmarks";
import { resolveBookmarkEventPlan } from "../bookmark-event-plan";

function makeEvent(
  overrides: Partial<BookmarkChangeEvent> & Pick<BookmarkChangeEvent, "type">,
): BookmarkChangeEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    tweetId: "",
    at: Date.now(),
    source: "x.com",
    ...overrides,
  };
}

describe("resolveBookmarkEventPlan", () => {
  // ── Empty ──

  it("returns empty plan for no events", () => {
    const plan = resolveBookmarkEventPlan([]);
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.needsPageFetch).toBe(false);
    expect(plan.ackIds).toEqual([]);
  });

  // ── Delete: happy path ──

  it("deletes by tweetId when available", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "111" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual(["111"]);
    expect(plan.needsPageFetch).toBe(false);
    expect(plan.ackIds).toEqual(["d1"]);
  });

  it("deduplicates delete tweetIds", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "111", source: "x.com" }),
      makeEvent({ id: "d2", type: "DeleteBookmark", tweetId: "111", source: "injected-script" }),
      makeEvent({ id: "d3", type: "DeleteBookmark", tweetId: "111", source: "x.com-headers" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual(["111"]);
    expect(plan.ackIds).toEqual(["d1", "d2", "d3"]);
  });

  it("acks empty-tweetId delete events alongside real ones", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "111", source: "x.com" }),
      makeEvent({ id: "d2", type: "DeleteBookmark", tweetId: "", source: "x.com-completed" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual(["111"]);
    expect(plan.needsPageFetch).toBe(false);
    expect(plan.ackIds).toEqual(["d1", "d2"]);
  });

  // ── Delete: all empty tweetIds (rare) ──

  it("acks delete events with empty tweetIds gracefully", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual([]);
    expect(plan.needsPageFetch).toBe(false);
    expect(plan.ackIds).toEqual(["d1"]);
  });

  // ── Delete: multiple tweetIds ──

  it("collects multiple delete tweetIds", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "111" }),
      makeEvent({ id: "d2", type: "DeleteBookmark", tweetId: "222" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual(["111", "222"]);
    expect(plan.ackIds).toEqual(["d1", "d2"]);
  });

  // ── Create: fetches a small page ──

  it("triggers page fetch for create events", () => {
    const events = [
      makeEvent({ id: "c1", type: "CreateBookmark", tweetId: "333" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual([]);
    expect(plan.needsPageFetch).toBe(true);
    expect(plan.ackIds).toEqual(["c1"]);
  });

  it("triggers page fetch even with empty tweetId", () => {
    const events = [
      makeEvent({ id: "c1", type: "CreateBookmark", tweetId: "" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.needsPageFetch).toBe(true);
    expect(plan.ackIds).toEqual(["c1"]);
  });

  it("triggers page fetch for multiple rapid creates", () => {
    const events = [
      makeEvent({ id: "c1", type: "CreateBookmark", tweetId: "A" }),
      makeEvent({ id: "c2", type: "CreateBookmark", tweetId: "B" }),
      makeEvent({ id: "c3", type: "CreateBookmark", tweetId: "C" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.needsPageFetch).toBe(true);
    expect(plan.ackIds).toEqual(["c1", "c2", "c3"]);
  });

  // ── Mixed: create + delete in same batch ──

  it("handles create and delete in the same batch", () => {
    const events = [
      makeEvent({ id: "d1", type: "DeleteBookmark", tweetId: "111" }),
      makeEvent({ id: "c1", type: "CreateBookmark", tweetId: "333" }),
    ];
    const plan = resolveBookmarkEventPlan(events);

    expect(plan.idsToDelete).toEqual(["111"]);
    expect(plan.needsPageFetch).toBe(true);
    expect(plan.ackIds).toEqual(["d1", "c1"]);
  });
});
