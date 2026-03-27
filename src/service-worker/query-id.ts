/**
 * Query ID resolution module.
 *
 * Extracts all query ID discovery, caching, catalog management, and resolution
 * logic from the service worker monolith into a typed, testable module.
 *
 * Resolution order (changed from original):
 *   1. Passive catalog (from real x.com traffic) — most trustworthy
 *   2. In-memory cache (10min TTL)
 *   3. Bundle scraping (broadened URL matching, multiple regex patterns)
 *   4. Tab discovery (last resort, Bookmarks only)
 */

import type { MessageRequest } from "../types/messages";
import type { HandlerMap } from "./index";
import {
  extractQueryIdForOperation,
  isQueryIdStale,
  parseGraphqlEndpoint,
} from "../lib/sw-pure";

// ── Constants ───────────────────────────────────────────────────

const QUERY_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GRAPHQL_CATALOG_STORAGE_KEY = "totem_graphql_catalog";
const GRAPHQL_CATALOG_VERSION = 1;
const MAX_GRAPHQL_ENDPOINTS = 300;
const CATALOG_FLUSH_DELAY_MS = 600;

const QUERY_ID_OPS = [
  "DeleteBookmark",
  "CreateBookmark",
  "TweetDetail",
  "Bookmarks",
] as const;

export type QueryIdOperationName = (typeof QUERY_ID_OPS)[number];

// ── Diagnostics ─────────────────────────────────────────────────

export interface QueryIdDiagnosticEntry {
  operation: string;
  stage: "catalog" | "cache" | "bundles" | "tab" | "force";
  status: "hit" | "miss" | "error";
  timestamp: number;
  reason?: string;
}

const diagnosticLog: QueryIdDiagnosticEntry[] = [];
const MAX_DIAGNOSTIC_ENTRIES = 50;

function logDiagnostic(
  operation: string,
  stage: QueryIdDiagnosticEntry["stage"],
  status: QueryIdDiagnosticEntry["status"],
  reason?: string,
) {
  diagnosticLog.push({ operation, stage, status, timestamp: Date.now(), reason });
  if (diagnosticLog.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnosticLog.splice(0, diagnosticLog.length - MAX_DIAGNOSTIC_ENTRIES);
  }
}

export function getDiagnosticLog(): readonly QueryIdDiagnosticEntry[] {
  return diagnosticLog;
}

// ── In-memory cache ─────────────────────────────────────────────

interface CacheEntry {
  id: string;
  ts: number;
}

const queryIdMemCache = new Map<string, CacheEntry>();
const queryIdCacheListeners = new Set<(operationName: string) => void>();

function queryIdCacheSet(operationName: string, entry: CacheEntry) {
  queryIdMemCache.set(operationName, entry);
  for (const fn of queryIdCacheListeners) {
    try {
      fn(operationName);
    } catch {
      // listener errors must not break cache updates
    }
  }
}

export function getCachedQueryId(operationName: string): string | null {
  const cached = queryIdMemCache.get(operationName);
  if (cached && Date.now() - cached.ts < QUERY_ID_TTL_MS) {
    return cached.id;
  }
  return null;
}

// ── GraphQL catalog ─────────────────────────────────────────────

export interface CatalogEntry {
  key: string;
  operation: string;
  queryId: string;
  path: string;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
  methods: string[];
  sampleUrl: string;
  sampleVariables: string | null;
  sampleFeatures: string | null;
  sampleFieldToggles: string | null;
}

export interface GraphqlCatalog {
  version: number;
  updatedAt: number;
  endpoints: Record<string, CatalogEntry>;
}

let graphqlCatalogCache: GraphqlCatalog | null = null;
let graphqlCatalogLoadPromise: Promise<GraphqlCatalog> | null = null;
let catalogDirty = false;
let catalogFlushTimer: ReturnType<typeof setTimeout> | null = null;

function createEmptyCatalog(): GraphqlCatalog {
  return { version: GRAPHQL_CATALOG_VERSION, updatedAt: 0, endpoints: {} };
}

function enforceCatalogLimit(catalog: GraphqlCatalog) {
  const entries = Object.values(catalog.endpoints);
  if (entries.length <= MAX_GRAPHQL_ENDPOINTS) return;
  entries
    .sort((a, b) => a.lastSeen - b.lastSeen)
    .slice(0, entries.length - MAX_GRAPHQL_ENDPOINTS)
    .forEach((entry) => {
      delete catalog.endpoints[entry.key];
    });
}

export async function loadGraphqlCatalog(
  storage: typeof chrome.storage.local = chrome.storage.local,
): Promise<GraphqlCatalog> {
  if (graphqlCatalogCache) return graphqlCatalogCache;
  if (!graphqlCatalogLoadPromise) {
    graphqlCatalogLoadPromise = storage
      .get([GRAPHQL_CATALOG_STORAGE_KEY])
      .then((stored) => {
        const existing = stored[GRAPHQL_CATALOG_STORAGE_KEY];
        if (
          existing &&
          typeof existing === "object" &&
          !Array.isArray(existing) &&
          typeof (existing as GraphqlCatalog).endpoints === "object"
        ) {
          graphqlCatalogCache = existing as GraphqlCatalog;
          return graphqlCatalogCache;
        }
        graphqlCatalogCache = createEmptyCatalog();
        return graphqlCatalogCache;
      })
      .catch(() => {
        graphqlCatalogCache = createEmptyCatalog();
        return graphqlCatalogCache;
      })
      .finally(() => {
        graphqlCatalogLoadPromise = null;
      });
  }
  return graphqlCatalogLoadPromise;
}

export async function flushGraphqlCatalog(
  storage: typeof chrome.storage.local = chrome.storage.local,
): Promise<void> {
  if (!catalogDirty || !graphqlCatalogCache) return;
  catalogDirty = false;
  try {
    await storage.set({ [GRAPHQL_CATALOG_STORAGE_KEY]: graphqlCatalogCache });
  } catch {
    catalogDirty = true;
  }
}

function scheduleCatalogFlush(
  storage: typeof chrome.storage.local = chrome.storage.local,
) {
  if (catalogFlushTimer) return;
  catalogFlushTimer = setTimeout(() => {
    catalogFlushTimer = null;
    flushGraphqlCatalog(storage);
  }, CATALOG_FLUSH_DELAY_MS);
}

/**
 * Passively capture a GraphQL endpoint from observed x.com traffic.
 * Called by the webRequest listener.
 */
export async function captureGraphqlEndpoint(
  details: { url: string; method?: string },
  storage: typeof chrome.storage.local = chrome.storage.local,
): Promise<void> {
  const parsed = parseGraphqlEndpoint(details.url);
  if (!parsed) return;

  const catalog = await loadGraphqlCatalog(storage);
  const key = `${parsed.operation}:${parsed.queryId}`;
  const now = Date.now();
  const current: CatalogEntry = catalog.endpoints[key] || {
    key,
    operation: parsed.operation,
    queryId: parsed.queryId,
    path: parsed.path,
    firstSeen: now,
    lastSeen: now,
    seenCount: 0,
    methods: [],
    sampleUrl: parsed.fullUrl,
    sampleVariables: null,
    sampleFeatures: null,
    sampleFieldToggles: null,
  };

  current.lastSeen = now;
  current.seenCount += 1;
  current.sampleUrl = parsed.fullUrl;
  current.path = parsed.path;
  if (details.method && !current.methods.includes(details.method)) {
    current.methods.push(details.method);
  }
  if (parsed.variables) current.sampleVariables = parsed.variables;
  if (parsed.features) current.sampleFeatures = parsed.features;
  if (parsed.fieldToggles) current.sampleFieldToggles = parsed.fieldToggles;

  catalog.endpoints[key] = current;
  catalog.updatedAt = now;
  enforceCatalogLimit(catalog);
  catalogDirty = true;
  scheduleCatalogFlush(storage);

  // Also update the in-memory query ID cache from passive observation
  queryIdCacheSet(parsed.operation, { id: parsed.queryId, ts: now });
}

// ── Catalog lookup ──────────────────────────────────────────────

function lookupCatalog(
  catalog: GraphqlCatalog,
  operationName: string,
): string | null {
  // Find the most recently seen entry for this operation
  let best: CatalogEntry | null = null;
  for (const entry of Object.values(catalog.endpoints)) {
    if (entry && entry.operation === operationName && entry.queryId) {
      if (!best || entry.lastSeen > best.lastSeen) {
        best = entry;
      }
    }
  }
  return best ? best.queryId : null;
}

// ── Bundle scraping (hardened) ──────────────────────────────────

/** Broadened script URL patterns — not limited to abs.twimg.com */
const BUNDLE_SCRIPT_PATTERNS = [
  /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web[^"]+\.js)"/g,
  /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web-legacy[^"]+\.js)"/g,
  /src="(https:\/\/[^"]+\/client-web[^"]+\.js)"/g,
];

export async function discoverQueryIdFromBundles(
  operationName: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  let html: string;
  try {
    const resp = await fetchFn("https://x.com", { credentials: "include" });
    if (!resp.ok) return null;
    html = await resp.text();
  } catch {
    return null;
  }

  const scriptUrls = extractScriptUrls(html);

  for (const url of scriptUrls) {
    try {
      const jsResp = await fetchFn(url);
      if (!jsResp.ok) continue;
      const text = await jsResp.text();
      const qid = extractQueryIdForOperation(text, operationName);
      if (qid) return qid;
    } catch {
      continue;
    }
  }
  return null;
}

/** Extract unique script URLs from HTML using multiple patterns. */
export function extractScriptUrls(html: string, limit = 15): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const pattern of BUNDLE_SCRIPT_PATTERNS) {
    // Reset lastIndex for each pattern (they have /g flag)
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null && urls.length < limit) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
    if (urls.length >= limit) break;
  }

  return urls;
}

// ── Tab-based discovery ─────────────────────────────────────────

let queryIdTabDiscoveryInFlight: Promise<string | null> | null = null;

export async function discoverQueryIdViaTab(
  tabs: typeof chrome.tabs = chrome.tabs,
): Promise<string | null> {
  if (queryIdTabDiscoveryInFlight) return queryIdTabDiscoveryInFlight;
  queryIdTabDiscoveryInFlight = _doDiscoverQueryIdViaTab(tabs);
  try {
    return await queryIdTabDiscoveryInFlight;
  } finally {
    queryIdTabDiscoveryInFlight = null;
  }
}

async function _doDiscoverQueryIdViaTab(
  tabs: typeof chrome.tabs,
): Promise<string | null> {
  let tabId: number | null = null;
  try {
    const tab = await tabs.create({
      url: "https://x.com/i/bookmarks",
      active: false,
    });
    tabId = tab?.id ?? null;
  } catch {
    return null;
  }

  const safeTabId = tabId;

  try {
    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 15000);

      function onCacheUpdated(opName: string) {
        if (opName !== "Bookmarks") return;
        const cached = queryIdMemCache.get("Bookmarks");
        if (cached && typeof cached.id === "string" && cached.id) {
          cleanup();
          resolve(cached.id);
        }
      }

      function onTabRemoved(removedId: number) {
        if (removedId === safeTabId) {
          cleanup();
          resolve(null);
        }
      }

      function cleanup() {
        clearTimeout(timeout);
        queryIdCacheListeners.delete(onCacheUpdated);
        tabs.onRemoved.removeListener(onTabRemoved);
      }

      queryIdCacheListeners.add(onCacheUpdated);
      tabs.onRemoved.addListener(onTabRemoved);

      // Check if already resolved while setting up
      const cached = queryIdMemCache.get("Bookmarks");
      if (cached && typeof cached.id === "string" && cached.id) {
        cleanup();
        resolve(cached.id);
      }
    });
  } finally {
    if (safeTabId) tabs.remove(safeTabId).catch(() => {});
  }
}

// ── Resolution chain ────────────────────────────────────────────

export interface ResolveDeps {
  storage: typeof chrome.storage.local;
  tabs: typeof chrome.tabs;
  fetchFn: typeof fetch;
}

function defaultDeps(): ResolveDeps {
  // Access globals lazily — they may not exist in test environments
  const g = globalThis as Record<string, unknown>;
  return {
    storage: (g.chrome as { storage: { local: typeof chrome.storage.local } })
      ?.storage?.local,
    tabs: (g.chrome as { tabs: typeof chrome.tabs })?.tabs,
    fetchFn: (g.fetch as typeof fetch) ?? (() => Promise.reject(new Error("fetch unavailable"))),
  };
}

/**
 * Resolve a query ID through the full fallback chain:
 *   1. Passive catalog (most trustworthy — from real x.com traffic)
 *   2. In-memory cache (10min TTL)
 *   3. Bundle scraping (broadened patterns)
 *   4. Tab discovery (Bookmarks only, last resort)
 */
export async function resolveQueryId(
  operationName: string,
  deps: ResolveDeps = defaultDeps(),
): Promise<string | null> {
  // 1. Passive catalog — primary source (promoted from tier 2)
  try {
    const catalog = await loadGraphqlCatalog(deps.storage);
    const catalogId = lookupCatalog(catalog, operationName);
    if (catalogId) {
      logDiagnostic(operationName, "catalog", "hit");
      queryIdCacheSet(operationName, { id: catalogId, ts: Date.now() });
      return catalogId;
    }
    logDiagnostic(operationName, "catalog", "miss");
  } catch (err) {
    logDiagnostic(operationName, "catalog", "error", String(err));
  }

  // 2. In-memory cache
  const cached = getCachedQueryId(operationName);
  if (cached) {
    logDiagnostic(operationName, "cache", "hit");
    return cached;
  }
  logDiagnostic(operationName, "cache", "miss");

  // 3. Bundle scraping (hardened)
  try {
    const discovered = await discoverQueryIdFromBundles(
      operationName,
      deps.fetchFn,
    );
    if (discovered) {
      logDiagnostic(operationName, "bundles", "hit");
      queryIdCacheSet(operationName, { id: discovered, ts: Date.now() });
      return discovered;
    }
    logDiagnostic(operationName, "bundles", "miss");
  } catch (err) {
    logDiagnostic(operationName, "bundles", "error", String(err));
  }

  // 4. Tab discovery — last resort, Bookmarks only
  if (operationName === "Bookmarks") {
    try {
      const tabDiscovered = await discoverQueryIdViaTab(deps.tabs);
      if (tabDiscovered) {
        logDiagnostic(operationName, "tab", "hit");
        return tabDiscovered;
      }
      logDiagnostic(operationName, "tab", "miss");
    } catch (err) {
      logDiagnostic(operationName, "tab", "error", String(err));
    }
  }

  return null;
}

/**
 * Force rediscovery — clears cache and tries bundle scraping + tab discovery.
 */
export async function forceRediscoverQueryId(
  operationName: string,
  deps: ResolveDeps = defaultDeps(),
): Promise<string | null> {
  queryIdMemCache.delete(operationName);

  try {
    const freshId = await discoverQueryIdFromBundles(
      operationName,
      deps.fetchFn,
    );
    if (freshId) {
      logDiagnostic(operationName, "force", "hit", "bundles");
      queryIdCacheSet(operationName, { id: freshId, ts: Date.now() });
      return freshId;
    }
  } catch {
    // fall through to tab discovery
  }

  if (operationName === "Bookmarks") {
    try {
      const tabDiscovered = await discoverQueryIdViaTab(deps.tabs);
      if (tabDiscovered) {
        logDiagnostic(operationName, "force", "hit", "tab");
        return tabDiscovered;
      }
    } catch {
      // exhausted all options
    }
  }

  logDiagnostic(operationName, "force", "miss", "all tiers exhausted");
  return null;
}

// ── withQueryId wrapper ─────────────────────────────────────────

export class NoQueryIdError extends Error {
  constructor(operationName: string) {
    super(
      `NO_QUERY_ID: Could not resolve query ID for "${operationName}". ` +
        `Try opening x.com in a tab and retry.`,
    );
    this.name = "NoQueryIdError";
  }
}

/**
 * Wraps a function that needs a query ID, handling:
 *   - Initial resolution
 *   - Retry on stale (GRAPHQL_VALIDATION_FAILED) with force rediscovery
 *   - Retry on HTTP 400 with force rediscovery
 *   - Actionable error message when all tiers fail
 *
 * Replaces the copy-pasted `_queryIdRetried` pattern in each API handler.
 */
export async function withQueryId<T>(
  operationName: string,
  fn: (queryId: string) => Promise<T>,
  deps: ResolveDeps = defaultDeps(),
): Promise<T> {
  const queryId = await resolveQueryId(operationName, deps);
  if (!queryId) {
    throw new NoQueryIdError(operationName);
  }

  const result = await fn(queryId);

  // Check if the response indicates a stale query ID
  if (result && typeof result === "object" && isQueryIdStale(result)) {
    const freshId = await forceRediscoverQueryId(operationName, deps);
    if (!freshId) {
      throw new NoQueryIdError(operationName);
    }
    return fn(freshId);
  }

  return result;
}

// ── Proactive batch discovery ───────────────────────────────────

let discoveryInProgress = false;

export async function discoverAllMissingQueryIds(
  deps: ResolveDeps = defaultDeps(),
): Promise<void> {
  if (discoveryInProgress) return;
  discoveryInProgress = true;

  try {
    const now = Date.now();
    const missing = QUERY_ID_OPS.filter((op) => {
      const cached = queryIdMemCache.get(op);
      return !cached || now - cached.ts >= QUERY_ID_TTL_MS;
    });
    if (missing.length === 0) return;

    // Check catalog first
    const catalog = await loadGraphqlCatalog(deps.storage);
    const stillMissing: string[] = [];

    for (const op of missing) {
      const catalogId = lookupCatalog(catalog, op);
      if (catalogId) {
        queryIdCacheSet(op, { id: catalogId, ts: now });
      } else {
        stillMissing.push(op);
      }
    }

    if (stillMissing.length === 0) return;

    // Batch fetch bundles
    let html: string;
    try {
      const resp = await deps.fetchFn("https://x.com", {
        credentials: "include",
      });
      if (!resp.ok) return;
      html = await resp.text();
    } catch {
      return;
    }

    const scriptUrls = extractScriptUrls(html);
    const remaining = new Set(stillMissing);

    for (const url of scriptUrls) {
      if (remaining.size === 0) break;
      try {
        const jsResp = await deps.fetchFn(url);
        if (!jsResp.ok) continue;
        const text = await jsResp.text();

        for (const opName of remaining) {
          const qid = extractQueryIdForOperation(text, opName);
          if (qid) {
            queryIdCacheSet(opName, { id: qid, ts: Date.now() });
            remaining.delete(opName);
          }
        }
      } catch {
        continue;
      }
    }
  } finally {
    discoveryInProgress = false;
  }
}

// ── Handler map ─────────────────────────────────────────────────

export function createQueryIdHandlers(
  deps?: ResolveDeps,
): HandlerMap {
  return {
    STORE_QUERY_IDS: async (message: MessageRequest) => {
      const msg = message as MessageRequest & { type: "STORE_QUERY_IDS" };
      const now = Date.now();
      const ids = msg.ids;
      if (ids && typeof ids === "object") {
        for (const [op, id] of Object.entries(ids)) {
          if (typeof id === "string" && id) {
            queryIdCacheSet(op, { id, ts: now });
          }
        }
      }
      return { ok: true };
    },

    DISCOVER_QUERY_IDS: async () => {
      await discoverAllMissingQueryIds(deps);
      return { ok: true };
    },
  };
}

/** Default handlers using global chrome/fetch — for production use. */
export const queryIdHandlers: HandlerMap = createQueryIdHandlers();

// ── Test utilities ──────────────────────────────────────────────

/** Reset all module state — for testing only. */
export function _resetForTesting() {
  queryIdMemCache.clear();
  queryIdCacheListeners.clear();
  graphqlCatalogCache = null;
  graphqlCatalogLoadPromise = null;
  catalogDirty = false;
  if (catalogFlushTimer) {
    clearTimeout(catalogFlushTimer);
    catalogFlushTimer = null;
  }
  discoveryInProgress = false;
  queryIdTabDiscoveryInFlight = null;
  diagnosticLog.length = 0;
}
