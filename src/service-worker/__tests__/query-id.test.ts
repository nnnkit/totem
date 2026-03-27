import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeChrome } from "../../test-utils/fake-chrome";
import {
  _resetForTesting,
  captureGraphqlEndpoint,
  createQueryIdHandlers,
  discoverQueryIdFromBundles,
  extractScriptUrls,
  forceRediscoverQueryId,
  getCachedQueryId,
  getDiagnosticLog,
  loadGraphqlCatalog,
  NoQueryIdError,
  resolveQueryId,
  withQueryId,
  type ResolveDeps,
} from "../query-id";
import { createMessageRouter, mergeHandlerMaps } from "../index";
import { extractQueryIdForOperation } from "../../lib/sw-pure";

// ── Helpers ─────────────────────────────────────────────────────

function makeDeps(
  fakeChrome: ReturnType<typeof createFakeChrome>,
  fetchFn?: typeof fetch,
): ResolveDeps {
  return {
    storage: fakeChrome.storage.local as unknown as typeof chrome.storage.local,
    tabs: fakeChrome.tabs as unknown as typeof chrome.tabs,
    fetchFn: fetchFn ?? ((() => Promise.resolve(new Response("", { status: 404 }))) as typeof fetch),
  };
}

/** Bundle text that contains a query ID in the standard format. */
function bundleWithQueryId(operation: string, queryId: string): string {
  // Query IDs must be 10-50 chars to match the extraction regex
  return `e.exports={queryId:"${queryId}",operationName:"${operation}",operationType:"query"}`;
}

/** Bundle text with reversed order (operationName before queryId). */
function bundleWithReversedOrder(operation: string, queryId: string): string {
  return `e.exports={operationName:"${operation}",queryId:"${queryId}",operationType:"query"}`;
}

/** HTML page that references JS bundles. */
function xcomHtmlWithScripts(scriptUrls: string[]): string {
  const tags = scriptUrls
    .map((u) => `<script src="${u}" type="text/javascript"></script>`)
    .join("\n");
  return `<html><head>${tags}</head><body></body></html>`;
}

// ── Tests ───────────────────────────────────────────────────────

describe("query-id module", () => {
  let fakeChrome: ReturnType<typeof createFakeChrome>;

  beforeEach(() => {
    fakeChrome = createFakeChrome();
    _resetForTesting();
  });

  // ── extractScriptUrls ───────────────────────────────────────

  describe("extractScriptUrls", () => {
    it("extracts standard abs.twimg.com client-web scripts", () => {
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/main.abc123.js",
        "https://abs.twimg.com/responsive-web/client-web/vendors~main.def456.js",
      ]);
      const urls = extractScriptUrls(html);
      expect(urls).toEqual([
        "https://abs.twimg.com/responsive-web/client-web/main.abc123.js",
        "https://abs.twimg.com/responsive-web/client-web/vendors~main.def456.js",
      ]);
    });

    it("extracts client-web scripts from alternative CDN hosts", () => {
      const html = xcomHtmlWithScripts([
        "https://cdn.x.com/client-web/bundle.js",
      ]);
      const urls = extractScriptUrls(html);
      expect(urls).toContain("https://cdn.x.com/client-web/bundle.js");
    });

    it("deduplicates URLs across patterns", () => {
      // This URL matches both the abs.twimg.com pattern and the generic client-web pattern
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/main.js",
        "https://abs.twimg.com/responsive-web/client-web/main.js",
      ]);
      const urls = extractScriptUrls(html);
      expect(urls).toHaveLength(1);
    });

    it("respects the limit parameter", () => {
      const scripts = Array.from(
        { length: 20 },
        (_, i) => `https://abs.twimg.com/responsive-web/client-web/chunk${i}.js`,
      );
      const html = xcomHtmlWithScripts(scripts);
      const urls = extractScriptUrls(html, 5);
      expect(urls).toHaveLength(5);
    });
  });

  // ── Catalog ─────────────────────────────────────────────────

  describe("GraphQL catalog", () => {
    it("loads empty catalog when storage is empty", async () => {
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      const catalog = await loadGraphqlCatalog(storage);
      expect(catalog.version).toBe(1);
      expect(catalog.endpoints).toEqual({});
    });

    it("loads existing catalog from storage", async () => {
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      const existing = {
        version: 1,
        updatedAt: 1000,
        endpoints: {
          "Bookmarks:abc123": {
            key: "Bookmarks:abc123",
            operation: "Bookmarks",
            queryId: "abc123",
            path: "/i/api/graphql/abc123/Bookmarks",
            firstSeen: 1000,
            lastSeen: 1000,
            seenCount: 1,
            methods: ["GET"],
            sampleUrl: "https://x.com/i/api/graphql/abc123/Bookmarks",
            sampleVariables: null,
            sampleFeatures: null,
            sampleFieldToggles: null,
          },
        },
      };
      await storage.set({ totem_graphql_catalog: existing });

      // Reset to force reload from storage
      _resetForTesting();
      const catalog = await loadGraphqlCatalog(storage);
      expect(catalog.endpoints["Bookmarks:abc123"].queryId).toBe("abc123");
    });

    it("captures endpoints from observed traffic", async () => {
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      await captureGraphqlEndpoint(
        {
          url: "https://x.com/i/api/graphql/QID_123/Bookmarks?variables=%7B%7D",
          method: "GET",
        },
        storage,
      );

      // The catalog should now contain the captured endpoint
      const catalog = await loadGraphqlCatalog(storage);
      const entry = catalog.endpoints["Bookmarks:QID_123"];
      expect(entry).toBeDefined();
      expect(entry.queryId).toBe("QID_123");
      expect(entry.operation).toBe("Bookmarks");
      expect(entry.seenCount).toBe(1);
    });
  });

  // ── Resolution chain ──────────────────────────────────────────

  describe("resolveQueryId", () => {
    it("resolves from catalog (tier 1)", async () => {
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      // Seed catalog
      await captureGraphqlEndpoint(
        { url: "https://x.com/i/api/graphql/CATALOG_ID/Bookmarks?variables=%7B%7D" },
        storage,
      );
      // Reset cache so catalog is the only source
      _resetForTesting();
      await storage.set({
        totem_graphql_catalog: {
          version: 1,
          updatedAt: Date.now(),
          endpoints: {
            "Bookmarks:CATALOG_ID": {
              key: "Bookmarks:CATALOG_ID",
              operation: "Bookmarks",
              queryId: "CATALOG_ID",
              path: "/i/api/graphql/CATALOG_ID/Bookmarks",
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              seenCount: 5,
              methods: ["GET"],
              sampleUrl: "https://x.com/i/api/graphql/CATALOG_ID/Bookmarks",
              sampleVariables: null,
              sampleFeatures: null,
              sampleFieldToggles: null,
            },
          },
        },
      });

      const deps = makeDeps(fakeChrome);
      const result = await resolveQueryId("Bookmarks", deps);
      expect(result).toBe("CATALOG_ID");

      const log = getDiagnosticLog();
      expect(log.some((e) => e.stage === "catalog" && e.status === "hit")).toBe(true);
    });

    it("falls through to bundle scraping when catalog and cache miss", async () => {
      const bundleJs = bundleWithQueryId("TweetDetail", "BUNDLE_QID_42xx");
      const htmlPage = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/main.js",
      ]);

      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url === "https://x.com") {
          return new Response(htmlPage, { status: 200 });
        }
        if (url.includes("main.js")) {
          return new Response(bundleJs, { status: 200 });
        }
        return new Response("", { status: 404 });
      });

      const deps = makeDeps(fakeChrome, fetchFn);
      const result = await resolveQueryId("TweetDetail", deps);
      expect(result).toBe("BUNDLE_QID_42xx");
    });

    it("returns null when all tiers fail (non-Bookmarks)", async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("", { status: 404 }),
      );
      const deps = makeDeps(fakeChrome, fetchFn);
      const result = await resolveQueryId("TweetDetail", deps);
      expect(result).toBeNull();
    });
  });

  // ── discoverQueryIdFromBundles ────────────────────────────────

  describe("discoverQueryIdFromBundles", () => {
    it("discovers from standard queryId:operationName format", async () => {
      const bundleJs = bundleWithQueryId("Bookmarks", "std_QID_99xx");
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/chunk.js",
      ]);

      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url === "https://x.com") return new Response(html, { status: 200 });
        if (url.includes("chunk.js")) return new Response(bundleJs, { status: 200 });
        return new Response("", { status: 404 });
      });

      const result = await discoverQueryIdFromBundles("Bookmarks", fetchFn);
      expect(result).toBe("std_QID_99xx");
    });

    it("discovers from reversed operationName:queryId format", async () => {
      const bundleJs = bundleWithReversedOrder("DeleteBookmark", "rev_QID_88xx");
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/api.js",
      ]);

      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url === "https://x.com") return new Response(html, { status: 200 });
        if (url.includes("api.js")) return new Response(bundleJs, { status: 200 });
        return new Response("", { status: 404 });
      });

      const result = await discoverQueryIdFromBundles("DeleteBookmark", fetchFn);
      expect(result).toBe("rev_QID_88xx");
    });

    it("returns null when x.com is unreachable", async () => {
      const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new Error("network error"));
      const result = await discoverQueryIdFromBundles("Bookmarks", fetchFn);
      expect(result).toBeNull();
    });
  });

  // ── withQueryId ───────────────────────────────────────────────

  describe("withQueryId", () => {
    it("resolves query ID and calls the function", async () => {
      // Seed catalog
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_graphql_catalog: {
          version: 1,
          updatedAt: Date.now(),
          endpoints: {
            "Bookmarks:WQI_1": {
              key: "Bookmarks:WQI_1",
              operation: "Bookmarks",
              queryId: "WQI_1",
              path: "/i/api/graphql/WQI_1/Bookmarks",
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              seenCount: 1,
              methods: ["GET"],
              sampleUrl: "https://x.com/i/api/graphql/WQI_1/Bookmarks",
              sampleVariables: null,
              sampleFeatures: null,
              sampleFieldToggles: null,
            },
          },
        },
      });

      const deps = makeDeps(fakeChrome);
      const fn = vi.fn().mockResolvedValue({ data: { bookmarks: [] } });

      const result = await withQueryId("Bookmarks", fn, deps);
      expect(fn).toHaveBeenCalledWith("WQI_1");
      expect(result).toEqual({ data: { bookmarks: [] } });
    });

    it("retries with fresh ID on GRAPHQL_VALIDATION_FAILED", async () => {
      const storage = fakeChrome.storage.local as unknown as typeof chrome.storage.local;
      await storage.set({
        totem_graphql_catalog: {
          version: 1,
          updatedAt: Date.now(),
          endpoints: {
            "TweetDetail:STALE_ID": {
              key: "TweetDetail:STALE_ID",
              operation: "TweetDetail",
              queryId: "STALE_ID",
              path: "/i/api/graphql/STALE_ID/TweetDetail",
              firstSeen: Date.now(),
              lastSeen: Date.now(),
              seenCount: 1,
              methods: ["GET"],
              sampleUrl: "https://x.com/i/api/graphql/STALE_ID/TweetDetail",
              sampleVariables: null,
              sampleFeatures: null,
              sampleFieldToggles: null,
            },
          },
        },
      });

      const freshBundle = bundleWithQueryId("TweetDetail", "FRESH_ID_xxx");
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/main.js",
      ]);

      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url === "https://x.com") return new Response(html, { status: 200 });
        if (url.includes("main.js")) return new Response(freshBundle, { status: 200 });
        return new Response("", { status: 404 });
      });

      const deps: ResolveDeps = {
        storage: storage,
        tabs: fakeChrome.tabs as unknown as typeof chrome.tabs,
        fetchFn,
      };

      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            errors: [{ extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }],
          };
        }
        return { data: { tweet: {} } };
      });

      const result = await withQueryId("TweetDetail", fn, deps);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenNthCalledWith(1, "STALE_ID");
      expect(fn).toHaveBeenNthCalledWith(2, "FRESH_ID_xxx");
      expect(result).toEqual({ data: { tweet: {} } });
    });

    it("throws NoQueryIdError when resolution fails entirely", async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("", { status: 404 }),
      );
      const deps = makeDeps(fakeChrome, fetchFn);

      await expect(
        withQueryId("TweetDetail", async () => ({}), deps),
      ).rejects.toThrow(NoQueryIdError);

      await expect(
        withQueryId("TweetDetail", async () => ({}), deps),
      ).rejects.toThrow("Try opening x.com in a tab and retry");
    });
  });

  // ── forceRediscoverQueryId ────────────────────────────────────

  describe("forceRediscoverQueryId", () => {
    it("clears cache and rediscovers from bundles", async () => {
      const bundleJs = bundleWithQueryId("TweetDetail", "FORCE_QID_xx");
      const html = xcomHtmlWithScripts([
        "https://abs.twimg.com/responsive-web/client-web/main.js",
      ]);

      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url === "https://x.com") return new Response(html, { status: 200 });
        if (url.includes("main.js")) return new Response(bundleJs, { status: 200 });
        return new Response("", { status: 404 });
      });

      const deps = makeDeps(fakeChrome, fetchFn);
      const result = await forceRediscoverQueryId("TweetDetail", deps);
      expect(result).toBe("FORCE_QID_xx");
    });
  });

  // ── Handler map integration ───────────────────────────────────

  describe("handler map", () => {
    it("STORE_QUERY_IDS stores IDs in memory cache", async () => {
      const deps = makeDeps(fakeChrome);
      const handlers = createQueryIdHandlers(deps);
      const router = createMessageRouter(mergeHandlerMaps(handlers));
      fakeChrome.runtime.onMessage.addListener(router);

      const response = await fakeChrome.runtime.sendMessage({
        type: "STORE_QUERY_IDS",
        ids: { Bookmarks: "stored_qid", TweetDetail: "detail_qid" },
      });
      expect(response).toEqual({ ok: true });

      expect(getCachedQueryId("Bookmarks")).toBe("stored_qid");
      expect(getCachedQueryId("TweetDetail")).toBe("detail_qid");
    });

    it("DISCOVER_QUERY_IDS triggers batch discovery", async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("", { status: 404 }),
      );
      const deps = makeDeps(fakeChrome, fetchFn);
      const handlers = createQueryIdHandlers(deps);
      const router = createMessageRouter(mergeHandlerMaps(handlers));
      fakeChrome.runtime.onMessage.addListener(router);

      const response = await fakeChrome.runtime.sendMessage({
        type: "DISCOVER_QUERY_IDS",
      });
      expect(response).toEqual({ ok: true });
    });
  });

  // ── Diagnostics ───────────────────────────────────────────────

  describe("diagnostics", () => {
    it("logs resolution attempts", async () => {
      const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("", { status: 404 }),
      );
      const deps = makeDeps(fakeChrome, fetchFn);
      await resolveQueryId("TweetDetail", deps);

      const log = getDiagnosticLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.some((e) => e.stage === "catalog" && e.status === "miss")).toBe(true);
      expect(log.some((e) => e.stage === "cache" && e.status === "miss")).toBe(true);
    });
  });

  // ── Fixture-based regex tests ─────────────────────────────────

  describe("fixture: real X.com bundle patterns", () => {
    // These fixtures simulate actual patterns found in X.com JavaScript bundles

    it("extracts from minified webpack module export", () => {
      const bundle = `t.exports={queryId:"xQ7ARB2wjy9MEew",operationName:"Bookmarks",operationType:"query",metadata:{featureSwitches:[]}}`;
      expect(extractQueryIdForOperation(bundle, "Bookmarks")).toBe("xQ7ARB2wjy9MEew");
    });

    it("extracts from single-quoted bundle", () => {
      const bundle = `t.exports={queryId:'aB3cD4eF5gH6iJ7',operationName:'TweetDetail',operationType:'query'}`;
      expect(extractQueryIdForOperation(bundle, "TweetDetail")).toBe("aB3cD4eF5gH6iJ7");
    });

    it("extracts from reversed order with operationId alias", () => {
      const bundle = `e.exports={operationName:"DeleteBookmark",operationId:"kL8mN9oP0qR1sT2"}`;
      expect(extractQueryIdForOperation(bundle, "DeleteBookmark")).toBe("kL8mN9oP0qR1sT2");
    });

    it("handles query IDs with hyphens and underscores", () => {
      const bundle = `e.exports={queryId:"xQ7_ARB-2wjy9ME",operationName:"CreateBookmark",operationType:"mutation"}`;
      expect(extractQueryIdForOperation(bundle, "CreateBookmark")).toBe("xQ7_ARB-2wjy9ME");
    });

    it("does not match partial operation names", () => {
      const bundle = `e.exports={queryId:"abc123def456gh78",operationName:"BookmarksTimeline"}`;
      expect(extractQueryIdForOperation(bundle, "Bookmarks")).toBeNull();
    });

    it("handles whitespace variations in minified bundles", () => {
      const bundle = `e.exports={queryId : "uV3wX4yZ5aB6cD7" , operationName : "Bookmarks"}`;
      expect(extractQueryIdForOperation(bundle, "Bookmarks")).toBe("uV3wX4yZ5aB6cD7");
    });
  });
});
