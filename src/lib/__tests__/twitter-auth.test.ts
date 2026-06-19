import { describe, expect, it, vi } from "vitest";
import {
  classifyTwidCookieChange,
  getTwitterAuthStatus,
  normalizeHeaders,
  parseCapturedAuthHeaders,
  readLiveTwid,
} from "../twitter-auth";

function createFakeStorageArea(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (!keys) return Object.fromEntries(data);
      if (typeof keys === "string") return { [keys]: data.get(keys) };
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((key) => [key, data.get(key)]));
      }
      return Object.fromEntries(
        Object.entries(keys).map(([key, fallback]) => [
          key,
          data.has(key) ? data.get(key) : fallback,
        ]),
      );
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        data.delete(key);
      }
    },
  };
}

describe("twitter auth helpers", () => {
  it("normalizes header names and validates captured auth identity", () => {
    const parsed = parseCapturedAuthHeaders(
      {
        Authorization: "Bearer token",
        Cookie: "twid=u%3D12345; ct0=csrf",
        "X-CSRF-Token": "csrf",
      },
      { liveUserId: "12345" },
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.userId).toBe("12345");
      expect(parsed.headers.authorization).toBe("Bearer token");
    }
  });

  it("fails closed for malformed headers and csrf/cookie mismatch", () => {
    expect(normalizeHeaders({ authorization: "ok", cookie: 1 })).toBeNull();
    expect(
      parseCapturedAuthHeaders({
        authorization: "Bearer token",
        cookie: "twid=u%3D12345; ct0=from-cookie",
        "x-csrf-token": "from-header",
      }),
    ).toMatchObject({ ok: false, reason: "csrf_ct0_mismatch" });
    expect(
      parseCapturedAuthHeaders(
        {
          authorization: "Bearer token",
          cookie: "twid=u%3D12345; ct0=csrf",
          "x-csrf-token": "csrf",
        },
        { liveUserId: "999" },
      ),
    ).toMatchObject({ ok: false, reason: "live_twid_mismatch" });
  });

  it("distinguishes live twid present, missing, unavailable, and errors", async () => {
    await expect(
      readLiveTwid({
        get: async () => ({ value: "u%3D42" }),
      }),
    ).resolves.toMatchObject({ state: "present", userId: "42" });

    await expect(
      readLiveTwid({
        get: async () => null,
      }),
    ).resolves.toEqual({ state: "missing" });

    await expect(readLiveTwid(undefined)).resolves.toMatchObject({
      state: "unavailable",
    });

    await expect(
      readLiveTwid({
        get: async () => {
          throw new Error("denied");
        },
      }),
    ).resolves.toMatchObject({ state: "error" });
  });

  it("classifies twid cookie overwrite removals as non-logout events", () => {
    expect(
      classifyTwidCookieChange({
        removed: true,
        cause: "overwrite",
        cookie: { name: "twid", domain: ".x.com", value: "" },
      }),
    ).toEqual({ action: "ignore", reason: "overwrite_removed" });

    expect(
      classifyTwidCookieChange({
        removed: true,
        cause: "explicit",
        cookie: { name: "twid", domain: ".x.com", value: "" },
      }),
    ).toEqual({ action: "verify_missing", reason: "cookie_twid_explicit" });

    expect(
      classifyTwidCookieChange({
        removed: false,
        cookie: { name: "twid", domain: ".x.com", value: "u%3D789" },
      }),
    ).toEqual({ action: "present", userId: "789" });
  });

  it("does not treat authorization alone as usable auth", async () => {
    const storage = createFakeStorageArea({
      userId: "123",
      authHeaders: { authorization: "Bearer token" },
      authState: "authenticated",
    });
    const markLoggedOut = vi.fn(async () => {});

    const status = await getTwitterAuthStatus({
      storage,
      cookies: { get: async () => ({ value: "u%3D123" }) },
      keys: {
        userId: "userId",
        authHeaders: "authHeaders",
        authState: "authState",
      },
      markLoggedOut,
    });

    expect(status.hasAuth).toBe(false);
    expect(status.authState).toBe("stale");
    expect(markLoggedOut).not.toHaveBeenCalled();
  });
});
