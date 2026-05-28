import type { StorageAreaLike } from "./types";

export type FakeStorageArea = StorageAreaLike & {
  dump(): Record<string, unknown>;
};

export function createFakeStorageArea(
  initial: Record<string, unknown> = {},
): FakeStorageArea {
  const data: Record<string, unknown> = { ...initial };

  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return { ...data };
      if (typeof keys === "string") return { [keys]: data[keys] };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data[key]]));
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [
          key,
          key in data ? data[key] : fallback,
        ]),
      );
    },
    async set(items: Record<string, unknown>) {
      Object.assign(data, items);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
    },
    dump() {
      return { ...data };
    },
  };
}
