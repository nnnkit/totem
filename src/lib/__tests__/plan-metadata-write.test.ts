import { describe, it, expect } from "vitest";
import { planMetadataWrite } from "../today-queue";
import type { BookmarkQueueMetadata } from "../../types";

const NOW = 1_700_000_000_000;

function meta(overrides: Partial<BookmarkQueueMetadata> = {}): BookmarkQueueMetadata {
  return {
    tweetId: "t1",
    intent: "unset",
    snoozedUntil: null,
    updatedAt: 1,
    ...overrides,
  };
}

describe("planMetadataWrite — setIntent", () => {
  it("upserts and maps a reference intent to the 'reference' exposure", () => {
    const plan = planMetadataWrite(
      { type: "setIntent", tweetId: "t1", intent: "reference" },
      null,
      NOW,
    );
    expect(plan.action).toBe("upsert");
    expect(plan.row).toMatchObject({ tweetId: "t1", intent: "reference", snoozedUntil: null, updatedAt: NOW });
    expect(plan.exposure).toBe("reference");
  });

  it("keeps an existing snooze when setIntent passes an explicit null (null is treated as absent)", () => {
    const existing = meta({ intent: "unset", snoozedUntil: "2026-07-01" });
    const plan = planMetadataWrite(
      { type: "setIntent", tweetId: "t1", intent: "unset" },
      existing,
      NOW,
    );
    expect(plan.action).toBe("upsert");
    expect(plan.row?.snoozedUntil).toBe("2026-07-01");
    expect(plan.exposure).toBe("opened");
  });

  it("deletes when the merged row collapses to neutral (unset + no snooze)", () => {
    const plan = planMetadataWrite(
      { type: "setIntent", tweetId: "t1", intent: "unset" },
      meta({ intent: "reference" }),
      NOW,
    );
    expect(plan.action).toBe("delete");
    expect(plan.row).toBeUndefined();
    expect(plan.exposure).toBe("opened");
  });

  it("produces a fresh row on a null existing for a write intent", () => {
    const plan = planMetadataWrite(
      { type: "setIntent", tweetId: "t1", intent: "act" },
      null,
      NOW,
    );
    expect(plan.action).toBe("upsert");
    expect(plan.row).toMatchObject({ intent: "act", snoozedUntil: null });
    expect(plan.exposure).toBe("act");
  });

  it("deletes on a null existing for an unset intent (neutral, no throw)", () => {
    const plan = planMetadataWrite(
      { type: "setIntent", tweetId: "t1", intent: "unset" },
      null,
      NOW,
    );
    expect(plan.action).toBe("delete");
  });
});

describe("planMetadataWrite — snooze", () => {
  it("forces intent unset, sets snoozedUntil, upserts with the 'snoozed' exposure", () => {
    const plan = planMetadataWrite(
      { type: "snooze", tweetId: "t1", snoozedUntil: "2026-07-02" },
      null,
      NOW,
    );
    expect(plan.action).toBe("upsert");
    expect(plan.row).toMatchObject({ intent: "unset", snoozedUntil: "2026-07-02", updatedAt: NOW });
    expect(plan.exposure).toBe("snoozed");
  });

  it("overwrites a prior reference intent to unset (does not inherit it)", () => {
    const plan = planMetadataWrite(
      { type: "snooze", tweetId: "t1", snoozedUntil: "2026-07-02" },
      meta({ intent: "reference" }),
      NOW,
    );
    expect(plan.row?.intent).toBe("unset");
  });
});

describe("planMetadataWrite — addToTodayRead", () => {
  it("preserves a read_soon intent but drops a stale snooze (upsert, intent kept)", () => {
    const existing = meta({ intent: "read_soon", snoozedUntil: "2026-07-03", updatedAt: 5 });
    const plan = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: true },
      existing,
      NOW,
    );
    expect(plan.action).toBe("upsert");
    expect(plan.row).toMatchObject({ intent: "read_soon", snoozedUntil: null, updatedAt: NOW });
    expect(plan.exposure).toBe("added");
  });

  it("returns 'keep' (no row, no updatedAt re-stamp) for read_soon without a snooze", () => {
    const existing = meta({ intent: "read_soon", snoozedUntil: null, updatedAt: 5 });
    const plan = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: true },
      existing,
      NOW,
    );
    expect(plan.action).toBe("keep");
    expect(plan.row).toBeUndefined();
  });

  it("deletes a non-read_soon row even when preserve is on (preserve only protects read_soon)", () => {
    const plan = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: true },
      meta({ intent: "reference" }),
      NOW,
    );
    expect(plan.action).toBe("delete");
  });

  it("deletes even a read_soon row when preserve is off (manual add starts fresh)", () => {
    const plan = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: false },
      meta({ intent: "read_soon", snoozedUntil: "2026-07-03" }),
      NOW,
    );
    expect(plan.action).toBe("delete");
  });

  it("always reports the 'added' exposure across keep / delete / upsert outcomes", () => {
    const keep = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: true },
      meta({ intent: "read_soon" }),
      NOW,
    );
    const del = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: false },
      null,
      NOW,
    );
    const upsert = planMetadataWrite(
      { type: "addToTodayRead", tweetId: "t1", preserveReadSoonIntent: true },
      meta({ intent: "read_soon", snoozedUntil: "2026-07-03" }),
      NOW,
    );
    expect([keep.action, del.action, upsert.action]).toEqual(["keep", "delete", "upsert"]);
    expect([keep.exposure, del.exposure, upsert.exposure]).toEqual(["added", "added", "added"]);
  });
});
