import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { TodayQueueSnapshot } from "../../types";
import { TODAY_QUEUE } from "../../lib/constants/scoring";
import {
  clearAllLocalData,
  getAllTodayQueueSnapshots,
  sweepStaleTodayQueueSnapshots,
  upsertTodayQueueSnapshots,
} from "../index";

function snapshot(key: string, version: number): TodayQueueSnapshot {
  return {
    key,
    localDate: "2026-06-08",
    budgetMinutes: 15,
    version,
    tweetIds: ["a"],
    generatedAt: 0,
  };
}

describe("sweepStaleTodayQueueSnapshots", () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it("deletes only records whose version differs from the current scoring version", async () => {
    await upsertTodayQueueSnapshots([
      snapshot("2026-06-08:15:stale", TODAY_QUEUE.version - 1),
      snapshot("2026-06-08:15:current", TODAY_QUEUE.version),
      snapshot("2026-06-07:30:stale", TODAY_QUEUE.version - 1),
    ]);

    await sweepStaleTodayQueueSnapshots();

    expect((await getAllTodayQueueSnapshots()).map((row) => row.key)).toEqual([
      "2026-06-08:15:current",
    ]);
  });

  it("is a no-op when there are no records", async () => {
    await expect(sweepStaleTodayQueueSnapshots()).resolves.toBeUndefined();
    expect(await getAllTodayQueueSnapshots()).toEqual([]);
  });

  it("keeps every record when all are the current version", async () => {
    await upsertTodayQueueSnapshots([
      snapshot("2026-06-08:15:current", TODAY_QUEUE.version),
      snapshot("2026-06-08:30:current", TODAY_QUEUE.version),
    ]);

    await sweepStaleTodayQueueSnapshots();

    expect(await getAllTodayQueueSnapshots()).toHaveLength(2);
  });
});
