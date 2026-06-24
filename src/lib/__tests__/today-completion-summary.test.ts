import { describe, it, expect } from "vitest";
import { deriveTodayCompletionSummary } from "../today-queue";
import type { TodayQueueHandledReason } from "../today-queue";

const ORDER: TodayQueueHandledReason[] = ["read", "snoozed", "action", "archived"];

const handled = (...reasons: TodayQueueHandledReason[]) =>
  reasons.map((reason) => ({ reason }));

describe("deriveTodayCompletionSummary", () => {
  it("orders entries by the supplied order, not by handled insertion order", () => {
    const result = deriveTodayCompletionSummary(
      handled("action", "read", "snoozed"),
      ORDER,
    );
    expect(result.map((entry) => entry.reason)).toEqual(["read", "snoozed", "action"]);
  });

  it("counts each reason exactly and omits zero-count reasons", () => {
    const result = deriveTodayCompletionSummary(
      handled("read", "read", "read", "archived"),
      ORDER,
    );
    expect(result).toEqual([
      { reason: "read", count: 3 },
      { reason: "archived", count: 1 },
    ]);
  });

  it("returns [] for empty handledItems", () => {
    expect(deriveTodayCompletionSummary([], ORDER)).toEqual([]);
  });

  it("ignores reasons absent from the order allow-list and does not mutate inputs", () => {
    const items = handled("read", "snoozed");
    const partialOrder: TodayQueueHandledReason[] = ["read"];
    const first = deriveTodayCompletionSummary(items, partialOrder);
    const second = deriveTodayCompletionSummary(items, partialOrder);
    expect(first).toEqual([{ reason: "read", count: 1 }]);
    // "snoozed" is not allow-listed by partialOrder → dropped, no throw.
    expect(first).toEqual(second);
    // inputs untouched across calls.
    expect(items).toEqual([{ reason: "read" }, { reason: "snoozed" }]);
  });
});
