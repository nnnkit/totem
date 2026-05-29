export interface HydrationLock {
  holderId: string;
  token: string;
  acquiredAt: number;
  lastTickAt: number;
}

const LOCK_KEY = "hydration_lock";
const STALE_THRESHOLD_MS = 60_000;
const ACQUIRE_VERIFY_DELAY_MS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function createLockToken(holderId: string): string {
  return `${holderId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
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
  const token = createLockToken(holderId);
  await storage.set({
    [LOCK_KEY]: { holderId, token, acquiredAt: now, lastTickAt: now } satisfies HydrationLock,
  });
  // chrome.storage.session has no compare-and-swap, so a tab acquiring at the
  // same instant can overwrite our write in the gap between set and read-back.
  // Wait a jittered moment so both contenders settle on the same final write,
  // then confirm our token actually survived before claiming the lock. This
  // collapses simultaneous acquirers to a single winner (last writer wins);
  // heartbeat + steal-on-stale remain the backstops.
  await sleep(
    ACQUIRE_VERIFY_DELAY_MS + Math.floor(Math.random() * ACQUIRE_VERIFY_DELAY_MS),
  );
  const stored = await readLock(storage);
  return stored?.holderId === holderId && stored.token === token;
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
