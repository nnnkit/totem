import { describe, expect, it } from "vitest";
import { computeStreak } from "../streak-tracker";
import type { ReadLogEntry } from "../../types";

function entry(bookmarkId: string, markedReadAt: number): ReadLogEntry {
  return { bookmarkId, markedReadAt };
}

function localNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

function localTimestamp(dateStr: string, hours: number, minutes = 0): number {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

describe("computeStreak", () => {
  it("returns zeros for empty log", () => {
    const result = computeStreak([], localNoon("2026-04-17"));
    expect(result).toEqual({ current: 0, longest: 0, isAtRisk: false, earnedToday: false });
  });

  it("single read today does not earn a streak day", () => {
    const today = localNoon("2026-04-17");
    const log = [entry("bk-1", localTimestamp("2026-04-17", 9))];
    const result = computeStreak(log, today);
    expect(result.current).toBe(0);
    expect(result.earnedToday).toBe(false);
  });

  it("two reads today earns streak day", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-17", 9)),
      entry("bk-2", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.earnedToday).toBe(true);
  });

  it("three reads today still counts as one streak day", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-17", 8)),
      entry("bk-2", localTimestamp("2026-04-17", 9)),
      entry("bk-3", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.earnedToday).toBe(true);
  });

  it("consecutive days build a streak", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-15", 9)),
      entry("bk-2", localTimestamp("2026-04-15", 10)),
      entry("bk-3", localTimestamp("2026-04-16", 9)),
      entry("bk-4", localTimestamp("2026-04-16", 10)),
      entry("bk-5", localTimestamp("2026-04-17", 9)),
      entry("bk-6", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
    expect(result.earnedToday).toBe(true);
  });

  it("missing a full day resets current streak to 0", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-14", 9)),
      entry("bk-2", localTimestamp("2026-04-14", 10)),
      entry("bk-3", localTimestamp("2026-04-15", 9)),
      entry("bk-4", localTimestamp("2026-04-15", 10)),
      // skipped 2026-04-16
      entry("bk-5", localTimestamp("2026-04-17", 9)),
      entry("bk-6", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(2);
    expect(result.earnedToday).toBe(true);
  });

  it("longest is preserved even when current resets", () => {
    const today = localNoon("2026-04-17");
    const log = [
      // 5-day streak in early April
      ...Array.from({ length: 5 }, (_, i) => [
        entry(`a-${i}`, localTimestamp(`2026-04-0${i + 1}`, 9)),
        entry(`b-${i}`, localTimestamp(`2026-04-0${i + 1}`, 10)),
      ]).flat(),
      // gap then today
      entry("bk-x", localTimestamp("2026-04-17", 9)),
      entry("bk-y", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(5);
  });

  it("single-read days do not count toward streak", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-15", 9)),
      entry("bk-2", localTimestamp("2026-04-15", 10)),
      // only 1 read on the 16th
      entry("bk-3", localTimestamp("2026-04-16", 9)),
      entry("bk-4", localTimestamp("2026-04-17", 9)),
      entry("bk-5", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.earnedToday).toBe(true);
  });

  it("yesterday-only streak is current if no reads today", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-16", 9)),
      entry("bk-2", localTimestamp("2026-04-16", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.earnedToday).toBe(false);
    expect(result.isAtRisk).toBe(true);
  });

  it("streak from two days ago with no yesterday or today is broken", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-15", 9)),
      entry("bk-2", localTimestamp("2026-04-15", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(0);
    expect(result.earnedToday).toBe(false);
    expect(result.isAtRisk).toBe(false);
  });

  it("isAtRisk is true when yesterday qualified but today has not yet", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-15", 9)),
      entry("bk-2", localTimestamp("2026-04-15", 10)),
      entry("bk-3", localTimestamp("2026-04-16", 9)),
      entry("bk-4", localTimestamp("2026-04-16", 10)),
      // only 1 read today
      entry("bk-5", localTimestamp("2026-04-17", 9)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(2);
    expect(result.earnedToday).toBe(false);
    expect(result.isAtRisk).toBe(true);
  });

  it("isAtRisk is false when today is already earned", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-16", 9)),
      entry("bk-2", localTimestamp("2026-04-16", 10)),
      entry("bk-3", localTimestamp("2026-04-17", 9)),
      entry("bk-4", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.earnedToday).toBe(true);
    expect(result.isAtRisk).toBe(false);
  });

  it("handles midnight boundary — reads at 23:59 and 00:01 are different days", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-16", 23, 58)),
      entry("bk-2", localTimestamp("2026-04-16", 23, 59)),
      entry("bk-3", localTimestamp("2026-04-17", 0, 1)),
      entry("bk-4", localTimestamp("2026-04-17", 0, 2)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(2);
    expect(result.earnedToday).toBe(true);
  });

  it("duplicate bookmark reads still count toward threshold", () => {
    const today = localNoon("2026-04-17");
    const log = [
      entry("bk-1", localTimestamp("2026-04-17", 9)),
      entry("bk-1", localTimestamp("2026-04-17", 10)),
    ];
    const result = computeStreak(log, today);
    expect(result.current).toBe(1);
    expect(result.earnedToday).toBe(true);
  });
});
