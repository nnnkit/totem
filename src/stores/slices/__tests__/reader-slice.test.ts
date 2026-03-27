import { describe, expect, it, vi } from "vitest";
import { createReaderSlice } from "../reader-slice";

describe("reader slice", () => {
  it("starts with reader inactive", () => {
    const store = createReaderSlice();
    expect(store.getState().readerActive).toBe(false);
    expect(store.getState().readerTweetId).toBeNull();
  });

  it("opens reader with tweet ID", () => {
    const store = createReaderSlice();
    store.getState().actions.openReader("tweet-1");

    expect(store.getState().readerActive).toBe(true);
    expect(store.getState().readerTweetId).toBe("tweet-1");
  });

  it("closes reader and clears tweet ID", () => {
    const store = createReaderSlice();
    store.getState().actions.openReader("tweet-1");
    store.getState().actions.closeReader();

    expect(store.getState().readerActive).toBe(false);
    expect(store.getState().readerTweetId).toBeNull();
  });

  it("setReaderActive toggles active state", () => {
    const store = createReaderSlice();
    store.getState().actions.setReaderActive(true);
    expect(store.getState().readerActive).toBe(true);

    store.getState().actions.setReaderActive(false);
    expect(store.getState().readerActive).toBe(false);
    expect(store.getState().readerTweetId).toBeNull();
  });

  it("is a no-op when setting same active state", () => {
    const onReconcile = vi.fn();
    const store = createReaderSlice({ onReconcile });

    // Already false, setting false should be no-op
    store.getState().actions.setReaderActive(false);
    expect(onReconcile).not.toHaveBeenCalled();
  });

  it("calls onReconcile when reader state changes", () => {
    const onReconcile = vi.fn();
    const store = createReaderSlice({ onReconcile });

    store.getState().actions.openReader("tweet-1");
    expect(onReconcile).toHaveBeenCalledTimes(1);

    store.getState().actions.closeReader();
    expect(onReconcile).toHaveBeenCalledTimes(2);

    store.getState().actions.setReaderActive(true);
    expect(onReconcile).toHaveBeenCalledTimes(3);
  });

  it("preserves tweet ID when toggling active to true", () => {
    const store = createReaderSlice();
    store.getState().actions.openReader("tweet-1");

    // Setting active to true again should keep the tweet ID
    store.getState().actions.setReaderActive(true);
    expect(store.getState().readerTweetId).toBe("tweet-1");
  });

  it("clears tweet ID when setting active to false", () => {
    const store = createReaderSlice();
    store.getState().actions.openReader("tweet-1");

    store.getState().actions.setReaderActive(false);
    expect(store.getState().readerTweetId).toBeNull();
  });
});
