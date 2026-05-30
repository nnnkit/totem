import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  tryAcquire,
  heartbeat,
  release,
  readLock,
  LOCK_KEY,
  STALE_THRESHOLD_MS,
  type LockStorage,
} from "../lock";

function createFakeStorage(): LockStorage & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(data, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete data[key];
    }),
  };
}

describe("HydrationLock", () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it("acquires lock when no lock exists", async () => {
    const result = await tryAcquire("tab-1", storage);
    expect(result).toBe(true);
    const lock = await readLock(storage);
    expect(lock?.holderId).toBe("tab-1");
  });

  it("same holder can re-acquire", async () => {
    await tryAcquire("tab-1", storage);
    const result = await tryAcquire("tab-1", storage);
    expect(result).toBe(true);
  });

  it("different holder is rejected when lock is fresh", async () => {
    await tryAcquire("tab-1", storage);
    const result = await tryAcquire("tab-2", storage);
    expect(result).toBe(false);
  });

  it("steals stale lock", async () => {
    await tryAcquire("tab-1", storage);
    const lock = storage.data[LOCK_KEY] as Record<string, unknown>;
    lock.lastTickAt = Date.now() - STALE_THRESHOLD_MS - 1;

    const result = await tryAcquire("tab-2", storage);
    expect(result).toBe(true);
    const current = await readLock(storage);
    expect(current?.holderId).toBe("tab-2");
  });

  it("does not steal lock that is within threshold", async () => {
    await tryAcquire("tab-1", storage);
    const lock = storage.data[LOCK_KEY] as Record<string, unknown>;
    lock.lastTickAt = Date.now() - STALE_THRESHOLD_MS + 5000;

    const result = await tryAcquire("tab-2", storage);
    expect(result).toBe(false);
  });

  it("heartbeat updates lastTickAt for holder", async () => {
    await tryAcquire("tab-1", storage);
    const beforeTick = (await readLock(storage))!.lastTickAt;
    await new Promise((r) => setTimeout(r, 10));
    const result = await heartbeat("tab-1", storage);
    expect(result).toBe(true);
    const afterTick = (await readLock(storage))!.lastTickAt;
    expect(afterTick).toBeGreaterThanOrEqual(beforeTick);
  });

  it("heartbeat fails for non-holder", async () => {
    await tryAcquire("tab-1", storage);
    const result = await heartbeat("tab-2", storage);
    expect(result).toBe(false);
  });

  it("release clears lock for holder", async () => {
    await tryAcquire("tab-1", storage);
    await release("tab-1", storage);
    const lock = await readLock(storage);
    expect(lock).toBeNull();
  });

  it("release is no-op for non-holder", async () => {
    await tryAcquire("tab-1", storage);
    await release("tab-2", storage);
    const lock = await readLock(storage);
    expect(lock?.holderId).toBe("tab-1");
  });

  it("two tabs contend — loser waits, wins after stale", async () => {
    await tryAcquire("tab-1", storage);
    expect(await tryAcquire("tab-2", storage)).toBe(false);

    const lock = storage.data[LOCK_KEY] as Record<string, unknown>;
    lock.lastTickAt = Date.now() - STALE_THRESHOLD_MS - 1;

    expect(await tryAcquire("tab-2", storage)).toBe(true);
    expect((await readLock(storage))?.holderId).toBe("tab-2");
  });

  it("readLock returns null when empty", async () => {
    const lock = await readLock(storage);
    expect(lock).toBeNull();
  });
});
