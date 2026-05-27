import { describe, expect, it } from "vitest";
import { getHydrationProgress } from "../progress";

describe("getHydrationProgress", () => {
  it("counts already-ready cached details at the start of a full export", () => {
    expect(getHydrationProgress({
      bookmarkCount: 364,
      readyCount: 30,
      queueTotal: 334,
      processed: 0,
    })).toEqual({
      done: 30,
      total: 364,
      pct: 8,
    });
  });

  it("uses the shared ready count without adding processed rows twice", () => {
    expect(getHydrationProgress({
      bookmarkCount: 364,
      readyCount: 35,
      queueTotal: 334,
      processed: 5,
    })).toEqual({
      done: 35,
      total: 364,
      pct: 10,
    });
  });

  it("clamps completed work to the bookmark count", () => {
    expect(getHydrationProgress({
      bookmarkCount: 10,
      readyCount: 13,
      queueTotal: 2,
      processed: 5,
    })).toEqual({
      done: 10,
      total: 10,
      pct: 100,
    });
  });
});
