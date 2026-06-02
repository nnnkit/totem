import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createQueryIdResolver,
  extractScriptUrls,
  isQueryIdStaleError,
  QueryIdStaleError,
  UnknownOperationError,
} from "./query-id";
import { createFakeStorageArea } from "./test-utils";

const OPS = ["TweetDetail", "Bookmarks"] as const;

function bundleWithQueryId(operation: string, queryId: string): string {
  return `e.exports={queryId:"${queryId}",operationName:"${operation}"}`;
}

function xcomHtmlWithScripts(scriptUrls: string[]): string {
  return scriptUrls.map((url) => `<script src="${url}"></script>`).join("\n");
}

describe("query-id resolver", () => {
  beforeEach(() => {
    createQueryIdResolver({
      storageKey: "unused",
      operations: OPS,
    }).resetForTesting();
  });

  it("extracts scripts with single quotes, whitespace, and relative URLs", () => {
    expect(
      extractScriptUrls(`
        <script src = 'https://abs.twimg.com/responsive-web/client-web/main.js'></script>
        <script src="/responsive-web/client-web/chunk.js"></script>
        <script src="https://example.com/not-client/main.js"></script>
      `),
    ).toEqual([
      "https://abs.twimg.com/responsive-web/client-web/main.js",
      "https://x.com/responsive-web/client-web/chunk.js",
    ]);
  });

  it("persists bundle discoveries on the normal resolve path", async () => {
    const storage = createFakeStorageArea();
    const resolver = createQueryIdResolver({
      storage,
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
    });
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url === "https://x.com") {
        return new Response(
          xcomHtmlWithScripts([
            "https://abs.twimg.com/responsive-web/client-web/main.js",
          ]),
        );
      }
      if (url.includes("main.js")) {
        return new Response(bundleWithQueryId("TweetDetail", "BUNDLE_QID_123"));
      }
      return new Response("", { status: 404 });
    });

    await expect(
      resolver.resolveQueryId("TweetDetail", { fetchFn }),
    ).resolves.toBe("BUNDLE_QID_123");

    resolver.resetForTesting();
    await expect(
      resolver.resolveQueryId("TweetDetail", {
        fetchFn: vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 404 })),
      }),
    ).resolves.toBe("BUNDLE_QID_123");

    const catalog = storage.dump().catalog as {
      endpoints: Record<string, { queryId: string; source: string; sampleUrl: string }>;
    };
    expect(catalog.endpoints["TweetDetail:BUNDLE_QID_123"]).toMatchObject({
      queryId: "BUNDLE_QID_123",
      source: "bundle",
      sampleUrl: "https://x.com/i/api/graphql/BUNDLE_QID_123/TweetDetail",
    });
  });

  it("immediately persists passive captures and rejects unknown operations", async () => {
    const storage = createFakeStorageArea();
    const resolver = createQueryIdResolver({
      storage,
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
    });

    await resolver.captureGraphqlEndpoint({
      url: "https://x.com/i/api/graphql/CAPTURE_QID_1/Bookmarks?variables=%7B%7D",
      method: "GET",
    });
    await resolver.captureGraphqlEndpoint({
      url: "https://x.com/i/api/graphql/UNKNOWN_QID_1/HomeTimeline",
      method: "GET",
    });

    const catalog = storage.dump().catalog as {
      endpoints: Record<string, { queryId: string }>;
    };
    expect(catalog.endpoints["Bookmarks:CAPTURE_QID_1"]?.queryId).toBe(
      "CAPTURE_QID_1",
    );
    expect(catalog.endpoints["HomeTimeline:UNKNOWN_QID_1"]).toBeUndefined();
    await expect(
      resolver.resolveQueryId("HomeTimeline" as "TweetDetail"),
    ).rejects.toThrow(UnknownOperationError);
  });

  it("drops corrupt catalog entries deterministically", async () => {
    const storage = createFakeStorageArea({
      catalog: {
        version: 0,
        updatedAt: "bad",
        endpoints: {
          "TweetDetail:bad": {
            operation: "TweetDetail",
            queryId: "../bad",
            lastSeen: 1,
          },
          "TweetDetail:GOOD_QID_1": {
            operation: "TweetDetail",
            queryId: "GOOD_QID_1",
            lastSeen: 2,
          },
        },
      },
    });
    const resolver = createQueryIdResolver({
      storage,
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
    });

    await expect(resolver.resolveQueryId("TweetDetail")).resolves.toBe(
      "GOOD_QID_1",
    );
    const catalog = storage.dump().catalog as {
      version: number;
      endpoints: Record<string, unknown>;
    };
    expect(catalog.version).toBe(1);
    expect(catalog.endpoints["TweetDetail:bad"]).toBeUndefined();
  });

  it("scopes resolver state by storage area", async () => {
    const storageA = createFakeStorageArea({
      catalog: {
        version: 1,
        updatedAt: 1,
        endpoints: {
          "TweetDetail:STORAGE_A_QID": {
            operation: "TweetDetail",
            queryId: "STORAGE_A_QID",
            lastSeen: 1,
          },
        },
      },
    });
    const storageB = createFakeStorageArea({
      catalog: {
        version: 1,
        updatedAt: 1,
        endpoints: {
          "TweetDetail:STORAGE_B_QID": {
            operation: "TweetDetail",
            queryId: "STORAGE_B_QID",
            lastSeen: 1,
          },
        },
      },
    });
    const resolver = createQueryIdResolver({
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
    });

    await expect(
      resolver.resolveQueryId("TweetDetail", { storage: storageA }),
    ).resolves.toBe("STORAGE_A_QID");
    await expect(
      resolver.resolveQueryId("TweetDetail", { storage: storageB }),
    ).resolves.toBe("STORAGE_B_QID");
  });

  it("accepts consumer-provided discovery strategies and emits diagnostics", async () => {
    const storage = createFakeStorageArea();
    const events: string[] = [];
    const resolver = createQueryIdResolver({
      storage,
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
      onEvent: (event) => {
        events.push(event.type);
      },
      strategies: [
        {
          name: "bookmarks-tab",
          async discover(operationName) {
            return operationName === "Bookmarks"
              ? { queryId: "TAB_QID_12345", source: "strategy" }
              : null;
          },
        },
      ],
    });
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("", { status: 404 }),
    );

    await expect(resolver.resolveQueryId("Bookmarks", { fetchFn })).resolves.toBe(
      "TAB_QID_12345",
    );

    const catalog = storage.dump().catalog as {
      endpoints: Record<string, { source: string; queryId: string }>;
    };
    expect(catalog.endpoints["Bookmarks:TAB_QID_12345"]).toMatchObject({
      queryId: "TAB_QID_12345",
      source: "strategy",
    });
    expect(events).toContain("query.catalog_miss");
    expect(events).toContain("query.bundle_miss");
  });

  it("retries stale query ids using structural guards", async () => {
    const storage = createFakeStorageArea({
      catalog: {
        version: 1,
        updatedAt: 1,
        endpoints: {
          "TweetDetail:STALE_QID_1": {
            operation: "TweetDetail",
            queryId: "STALE_QID_1",
            lastSeen: 1,
          },
        },
      },
    });
    const resolver = createQueryIdResolver({
      storage,
      storageKey: "catalog",
      operations: OPS,
      flushMode: "immediate",
    });
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url === "https://x.com") {
        return new Response(
          xcomHtmlWithScripts([
            "https://abs.twimg.com/responsive-web/client-web/main.js",
          ]),
        );
      }
      if (url.includes("main.js")) {
        return new Response(bundleWithQueryId("TweetDetail", "FRESH_QID_2"));
      }
      return new Response("", { status: 404 });
    });
    const fn = vi.fn(async (queryId: string) => {
      if (queryId === "STALE_QID_1") {
        throw { code: "QUERY_ID_STALE", staleQueryId: queryId };
      }
      return { queryId };
    });

    expect(isQueryIdStaleError(new QueryIdStaleError("TweetDetail", "x"))).toBe(
      true,
    );
    await expect(
      resolver.withQueryId("TweetDetail", fn, { fetchFn }),
    ).resolves.toEqual({ queryId: "FRESH_QID_2" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
