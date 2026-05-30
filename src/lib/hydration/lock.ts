export interface HydrationLock {
  holderId: string;
  acquiredAt: number;
  lastTickAt: number;
}

const LOCK_KEY = "hydration_lock";
const STALE_THRESHOLD_MS = 60_000;

export interface LockStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

function defaultStorage(): LockStorage {
  return {
    get: (key) => chrome.storage.session.get(key),
    set: (items) => chrome.storage.session.set(items),
    remove: (key) => chrome.storage.session.remove(key),
  };
}

export async function readLock(
  storage: LockStorage = defaultStorage(),
): Promise<HydrationLock | null> {
  const result = await storage.get(LOCK_KEY);
  return (result[LOCK_KEY] as HydrationLock) ?? null;
}

export async function tryAcquire(
  holderId: string,
  storage: LockStorage = defaultStorage(),
): Promise<boolean> {
  const existing = await readLock(storage);

  if (existing) {
    if (existing.holderId === holderId) return true;
    if (Date.now() - existing.lastTickAt < STALE_THRESHOLD_MS) return false;
  }

  const now = Date.now();
  await storage.set({
    [LOCK_KEY]: { holderId, acquiredAt: now, lastTickAt: now } satisfies HydrationLock,
  });
  return true;
}

export async function heartbeat(
  holderId: string,
  storage: LockStorage = defaultStorage(),
): Promise<boolean> {
  const existing = await readLock(storage);
  if (!existing || existing.holderId !== holderId) return false;

  await storage.set({
    [LOCK_KEY]: { ...existing, lastTickAt: Date.now() } satisfies HydrationLock,
  });
  return true;
}

export async function release(
  holderId: string,
  storage: LockStorage = defaultStorage(),
): Promise<void> {
  const existing = await readLock(storage);
  if (existing?.holderId === holderId) {
    await storage.remove(LOCK_KEY);
  }
}

export { LOCK_KEY, STALE_THRESHOLD_MS };
