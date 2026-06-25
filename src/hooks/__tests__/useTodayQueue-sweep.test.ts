// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountDb } from "../../db";
import type { TodayQueueBudgetMinutes } from "../../types";
import { flushAsync, renderHook } from "../../test-utils/render-hook";

// useTodayQueue resolves its DB handle through useAccountDb(); the per-account
// sweep dedup (module-scoped sweptAccountIds) and the account-switch behaviour
// can only be exercised by driving that handle. hoisted() keeps the registry
// reachable from the (hoisted) vi.mock factory.
const harness = vi.hoisted(() => {
  type FakeDb = {
    getTodayQueueSnapshot: ReturnType<typeof vi.fn>;
    getAllQueueBookmarkMetadata: ReturnType<typeof vi.fn>;
    getTodayQueueExposuresSince: ReturnType<typeof vi.fn>;
    sweepStaleTodayQueueSnapshots: ReturnType<typeof vi.fn>;
  };
  const dbHandles = new Map<string, FakeDb>();
  const state: { activeAccount: string | null } = { activeAccount: null };

  function getFakeDb(accountId: string | null): FakeDb {
    const key = accountId ?? "local";
    let handle = dbHandles.get(key);
    if (!handle) {
      handle = {
        getTodayQueueSnapshot: vi.fn(async () => null),
        getAllQueueBookmarkMetadata: vi.fn(async () => []),
        getTodayQueueExposuresSince: vi.fn(async () => []),
        sweepStaleTodayQueueSnapshots: vi.fn(async () => undefined),
      };
      dbHandles.set(key, handle);
    }
    return handle;
  }

  return { getFakeDb, state };
});

vi.mock("../../stores/selectors", () => ({
  useAccountDb: () =>
    harness.getFakeDb(harness.state.activeAccount) as unknown as AccountDb,
}));

import { useTodayQueue } from "../useTodayQueue";

// Empty bookmarks short-circuit refresh() before any queue build, so the four
// stubbed methods above are all the hook touches besides the sweep.
function input(accountId: string | null) {
  return {
    enabled: true,
    accountId,
    bookmarks: [],
    readingProgress: [],
    detailedTweetIds: new Set<string>(),
    budgetMinutes: 15 as TodayQueueBudgetMinutes,
    restrictToCachedDetails: false,
  };
}

function activate(accountId: string | null) {
  harness.state.activeAccount = accountId;
}

function sweepSpy(accountId: string | null) {
  return harness.getFakeDb(accountId).sweepStaleTodayQueueSnapshots;
}

afterEach(() => {
  vi.clearAllMocks();
});

// sweptAccountIds in the hook module is page-load-scoped and never reset across
// tests, so every case uses a distinct accountId to stay independent.
describe("useTodayQueue stale-snapshot sweep wiring", () => {
  it("sweeps an account's per-account DB exactly once per page load", async () => {
    const account = "acc-62-dedup";
    activate(account);

    const { rerender, unmount } = await renderHook(
      (props: ReturnType<typeof input>) => useTodayQueue(props),
      { initialProps: input(account) },
    );
    await flushAsync();
    expect(sweepSpy(account)).toHaveBeenCalledTimes(1);

    // A re-render with the same account must not sweep again.
    await rerender(input(account));
    await flushAsync();
    expect(sweepSpy(account)).toHaveBeenCalledTimes(1);

    // Nor a fresh mount of the hook for the same account in the same page load.
    await unmount();
    activate(account);
    await renderHook(
      (props: ReturnType<typeof input>) => useTodayQueue(props),
      { initialProps: input(account) },
    );
    await flushAsync();
    expect(sweepSpy(account)).toHaveBeenCalledTimes(1);
  });

  it("sweeps the newly-active account's DB after an in-session account switch", async () => {
    const first = "acc-62-switch-1";
    const second = "acc-62-switch-2";

    activate(first);
    const { rerender } = await renderHook(
      (props: ReturnType<typeof input>) => useTodayQueue(props),
      { initialProps: input(first) },
    );
    await flushAsync();
    expect(sweepSpy(first)).toHaveBeenCalledTimes(1);
    expect(sweepSpy(second)).not.toHaveBeenCalled();

    activate(second);
    await rerender(input(second));
    await flushAsync();
    // The switch sweeps the second account's distinct handle, not the first's.
    expect(sweepSpy(second)).toHaveBeenCalledTimes(1);
    expect(sweepSpy(first)).toHaveBeenCalledTimes(1);
  });

  it("sweeps the local DB when accountId is null", async () => {
    activate(null);
    await renderHook(
      (props: ReturnType<typeof input>) => useTodayQueue(props),
      { initialProps: input(null) },
    );
    await flushAsync();
    expect(sweepSpy(null)).toHaveBeenCalledTimes(1);
  });

  it("does not sweep while the queue is disabled", async () => {
    const account = "acc-62-disabled";
    activate(account);
    await renderHook(
      (props: ReturnType<typeof input>) => useTodayQueue(props),
      { initialProps: { ...input(account), enabled: false } },
    );
    await flushAsync();
    expect(sweepSpy(account)).not.toHaveBeenCalled();
  });
});
