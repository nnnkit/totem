import {
  extractQueryIdForOperation,
  isQueryIdStale,
  isValidOperationName,
  isValidQueryId,
  parseGraphqlEndpoint,
} from "./pure";
import type { StorageAreaLike } from "./types";

export type CoreErrorCode =
  | "QUERY_ID_STALE"
  | "NO_QUERY_ID"
  | "AUTH_EXPIRED"
  | "RATE_LIMITED"
  | "NETWORK_UNAVAILABLE"
  | "UNKNOWN_OPERATION";

export class QueryIdStaleError extends Error {
  readonly code = "QUERY_ID_STALE";
  readonly staleQueryId: string;

  constructor(operationName: string, staleQueryId: string) {
    super("QUERY_ID_STALE: " + operationName);
    this.name = "QueryIdStaleError";
    this.staleQueryId = staleQueryId;
  }
}

export interface QueryIdStaleLike {
  name?: string;
  code?: string;
  staleQueryId?: string;
  message?: string;
}

export function isQueryIdStaleError(error: unknown): error is QueryIdStaleLike {
  if (!error || typeof error !== "object") return false;
  const value = error as QueryIdStaleLike;
  return (
    value.code === "QUERY_ID_STALE" ||
    value.name === "QueryIdStaleError" ||
    (typeof value.message === "string" &&
      value.message.startsWith("QUERY_ID_STALE"))
  );
}

export class NoQueryIdError extends Error {
  readonly code = "NO_QUERY_ID";

  constructor(operationName: string) {
    super(
      "NO_QUERY_ID: Could not resolve query ID for " +
        operationName +
        ". Open x.com in a tab and retry.",
    );
    this.name = "NoQueryIdError";
  }
}

export class AuthExpiredError extends Error {
  readonly code = "AUTH_EXPIRED";

  constructor(message = "AUTH_EXPIRED") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly retryAfterMs?: number;

  constructor(message = "RATE_LIMITED", retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class NetworkUnavailableError extends Error {
  readonly code = "NETWORK_UNAVAILABLE";

  constructor(message = "NETWORK_UNAVAILABLE") {
    super(message);
    this.name = "NetworkUnavailableError";
  }
}

export class UnknownOperationError extends Error {
  readonly code = "UNKNOWN_OPERATION";

  constructor(operationName: string) {
    super("UNKNOWN_OPERATION: " + operationName);
    this.name = "UnknownOperationError";
  }
}

export interface CacheEntry {
  id: string;
  ts: number;
}

export type QueryIdCatalogSource = "capture" | "bundle" | "manual" | "strategy";

export interface CatalogEntry {
  key?: string;
  operation: string;
  queryId: string;
  path?: string;
  firstSeen?: number;
  lastSeen: number;
  seenCount?: number;
  methods?: string[];
  sampleUrl?: string;
  sampleVariables?: string | null;
  sampleFeatures?: string | null;
  sampleFieldToggles?: string | null;
  source?: QueryIdCatalogSource;
  scriptUrl?: string;
}

export interface GraphqlCatalog {
  version: number;
  updatedAt: number;
  endpoints: Record<string, CatalogEntry>;
}

export interface CaptureGraphqlDetails {
  url: string;
  method?: string;
}

export interface QueryIdDiagnosticEvent {
  type:
    | "query.catalog_hit"
    | "query.catalog_miss"
    | "query.catalog_discarded"
    | "query.catalog_migrated"
    | "query.cache_hit"
    | "query.cache_miss"
    | "query.bundle_hit"
    | "query.bundle_miss"
    | "query.stale_retry"
    | "query.persist_failed"
    | "query.discovery_strategy_error"
    | "query.capture_ignored";
  operation?: string;
  source?: string;
  queryId?: string;
  elapsedMs?: number;
  reason?: string;
  error?: string;
}

export type QueryIdDiagnosticSink = (
  event: QueryIdDiagnosticEvent,
) => void | Promise<void>;

export type QueryIdDiscoveryResult =
  | string
  | {
      queryId: string;
      source?: QueryIdCatalogSource;
      scriptUrl?: string;
      sampleUrl?: string;
    }
  | null;

export interface QueryIdDiscoveryContext<OperationName extends string = string> {
  storage: StorageAreaLike;
  fetchFn: typeof fetch;
  operations: readonly OperationName[];
  force: boolean;
  staleQueryId?: string;
  getCachedQueryId(operationName: OperationName): string | null;
  waitForCacheUpdate(
    operationName: OperationName,
    timeoutMs?: number,
  ): Promise<string | null>;
  persistQueryId(
    operationName: OperationName,
    queryId: string,
    metadata?: PersistQueryIdMetadata,
  ): Promise<void>;
  emit(event: QueryIdDiagnosticEvent): void;
}

export interface QueryIdDiscoveryStrategy<OperationName extends string = string> {
  name: string;
  discover(
    operationName: OperationName,
    context: QueryIdDiscoveryContext<OperationName>,
  ): Promise<QueryIdDiscoveryResult>;
}

export interface QueryIdResolverOptions<
  Ops extends readonly string[] = readonly string[],
> {
  storageKey: string;
  operations: Ops;
  storage?: StorageAreaLike;
  ttlMs?: number;
  catalogVersion?: number;
  flushDelayMs?: number;
  flushMode?: "immediate" | "debounced";
  maxEndpoints?: number;
  fetchFn?: typeof fetch;
  captureUnknownOperations?: boolean;
  strategies?: QueryIdDiscoveryStrategy<Ops[number]>[];
  onEvent?: QueryIdDiagnosticSink;
}

export interface QueryIdCallDeps {
  storage?: StorageAreaLike;
  fetchFn?: typeof fetch;
}

interface ResolverState {
  memCache: Map<string, CacheEntry>;
  catalogCache: GraphqlCatalog | null;
  catalogLoadPromise: Promise<GraphqlCatalog> | null;
  catalogDirty: boolean;
  catalogFlushTimer: ReturnType<typeof setTimeout> | null;
  discoveryInProgress: boolean;
  cacheListeners: Set<(operationName: string, queryId: string) => void>;
}

interface PersistQueryIdMetadata {
  staleQueryId?: string;
  source?: QueryIdCatalogSource;
  scriptUrl?: string;
  sampleUrl?: string;
}

const DEFAULT_QUERY_ID_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CATALOG_VERSION = 1;
const DEFAULT_CATALOG_FLUSH_DELAY_MS = 600;
const DEFAULT_MAX_ENDPOINTS = 300;

let stateByStorage = new WeakMap<StorageAreaLike, ResolverState>();
let allStates = new Set<ResolverState>();

function createResolverState(): ResolverState {
  return {
    memCache: new Map(),
    catalogCache: null,
    catalogLoadPromise: null,
    catalogDirty: false,
    catalogFlushTimer: null,
    discoveryInProgress: false,
    cacheListeners: new Set(),
  };
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function extractScriptUrls(html: string, limit = 15): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const pattern =
    /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null && urls.length < limit) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    if (!raw) continue;

    let resolved: URL;
    try {
      resolved = new URL(raw, "https://x.com");
    } catch {
      continue;
    }

    const url = resolved.toString();
    if (
      !resolved.pathname.includes("client-web") ||
      !resolved.pathname.endsWith(".js") ||
      seen.has(url)
    ) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function createQueryIdResolver<
  const Ops extends readonly string[],
>(options: QueryIdResolverOptions<Ops>) {
  type OperationName = Ops[number];

  const ttlMs = options.ttlMs ?? DEFAULT_QUERY_ID_TTL_MS;
  const catalogVersion = options.catalogVersion ?? DEFAULT_CATALOG_VERSION;
  const flushDelayMs = options.flushDelayMs ?? DEFAULT_CATALOG_FLUSH_DELAY_MS;
  const flushMode = options.flushMode ?? "debounced";
  const maxEndpoints = options.maxEndpoints ?? DEFAULT_MAX_ENDPOINTS;
  const allowedOperations = new Set<string>(options.operations);

  function emit(event: QueryIdDiagnosticEvent): void {
    try {
      void options.onEvent?.(event);
    } catch {
      // diagnostics must not affect query-id resolution
    }
  }

  function emptyCatalog(): GraphqlCatalog {
    return { version: catalogVersion, updatedAt: 0, endpoints: {} };
  }

  function stateFor(storage: StorageAreaLike): ResolverState {
    let state = stateByStorage.get(storage);
    if (!state) {
      state = createResolverState();
      stateByStorage.set(storage, state);
      allStates.add(state);
    }
    return state;
  }

  function storageFor(deps?: QueryIdCallDeps): StorageAreaLike {
    const storage = deps?.storage ?? options.storage;
    if (!storage) {
      throw new Error("QUERY_ID_STORAGE_REQUIRED");
    }
    return storage;
  }

  function fetchFor(deps?: QueryIdCallDeps): typeof fetch {
    return deps?.fetchFn ?? options.fetchFn ?? fetch;
  }

  function assertOperation(operationName: string): OperationName {
    if (!isValidOperationName(operationName) || !allowedOperations.has(operationName)) {
      throw new UnknownOperationError(operationName);
    }
    return operationName as OperationName;
  }

  function setCache(
    state: ResolverState,
    operationName: string,
    queryId: string,
    ts: number = Date.now(),
  ) {
    state.memCache.set(operationName, { id: queryId, ts });
    for (const listener of state.cacheListeners) {
      try {
        listener(operationName, queryId);
      } catch {
        // listener failures must not break cache updates
      }
    }
  }

  function getCachedQueryIdFromState(
    state: ResolverState,
    operationName: string,
  ): string | null {
    const cached = state.memCache.get(operationName);
    if (cached && Date.now() - cached.ts < ttlMs) return cached.id;
    return null;
  }

  function coerceCatalogEntry(value: unknown): CatalogEntry | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entry = value as CatalogEntry;
    if (
      !isValidOperationName(entry.operation) ||
      !isValidQueryId(entry.queryId) ||
      typeof entry.lastSeen !== "number" ||
      !Number.isFinite(entry.lastSeen)
    ) {
      return null;
    }

    const normalizedKey = `${entry.operation}:${entry.queryId}`;
    const path =
      typeof entry.path === "string" && entry.path
        ? entry.path
        : `/i/api/graphql/${entry.queryId}/${entry.operation}`;
    const sampleUrl =
      typeof entry.sampleUrl === "string" && entry.sampleUrl
        ? entry.sampleUrl
        : `https://x.com${path}`;
    const source =
      entry.source === "capture" ||
      entry.source === "bundle" ||
      entry.source === "manual" ||
      entry.source === "strategy"
        ? entry.source
        : undefined;

    return {
      key: typeof entry.key === "string" && entry.key ? entry.key : normalizedKey,
      operation: entry.operation,
      queryId: entry.queryId,
      path,
      firstSeen:
        typeof entry.firstSeen === "number" && Number.isFinite(entry.firstSeen)
          ? entry.firstSeen
          : entry.lastSeen,
      lastSeen: entry.lastSeen,
      seenCount:
        typeof entry.seenCount === "number" && Number.isFinite(entry.seenCount)
          ? Math.max(1, Math.floor(entry.seenCount))
          : 1,
      methods: Array.isArray(entry.methods)
        ? entry.methods.filter((method): method is string => typeof method === "string")
        : [],
      sampleUrl,
      sampleVariables:
        typeof entry.sampleVariables === "string" ? entry.sampleVariables : null,
      sampleFeatures:
        typeof entry.sampleFeatures === "string" ? entry.sampleFeatures : null,
      sampleFieldToggles:
        typeof entry.sampleFieldToggles === "string"
          ? entry.sampleFieldToggles
          : null,
      source,
      scriptUrl: typeof entry.scriptUrl === "string" ? entry.scriptUrl : undefined,
    };
  }

  function validateCatalog(input: unknown): {
    catalog: GraphqlCatalog;
    changed: boolean;
    discarded: boolean;
    migrated: boolean;
  } {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {
        catalog: emptyCatalog(),
        changed: Boolean(input),
        discarded: Boolean(input),
        migrated: false,
      };
    }

    const raw = input as GraphqlCatalog;
    const endpoints: Record<string, CatalogEntry> = {};
    let changed = raw.version !== catalogVersion;
    const rawEndpoints =
      raw.endpoints && typeof raw.endpoints === "object" && !Array.isArray(raw.endpoints)
        ? raw.endpoints
        : null;

    if (!rawEndpoints) {
      return {
        catalog: emptyCatalog(),
        changed: true,
        discarded: true,
        migrated: raw.version !== catalogVersion,
      };
    }

    for (const [key, value] of Object.entries(rawEndpoints)) {
      const entry = coerceCatalogEntry(value);
      if (!entry) {
        changed = true;
        continue;
      }
      endpoints[entry.key ?? `${entry.operation}:${entry.queryId}`] = entry;
      if (entry.key !== key) changed = true;
    }

    const updatedAt =
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : 0;

    return {
      catalog: { version: catalogVersion, updatedAt, endpoints },
      changed,
      discarded: false,
      migrated: raw.version !== catalogVersion,
    };
  }

  async function loadCatalog(storage: StorageAreaLike): Promise<GraphqlCatalog> {
    const state = stateFor(storage);
    if (state.catalogCache) return state.catalogCache;
    if (!state.catalogLoadPromise) {
      state.catalogLoadPromise = storage
        .get([options.storageKey])
        .then(async (stored) => {
          const validation = validateCatalog(stored[options.storageKey]);
          state.catalogCache = validation.catalog;
          if (validation.discarded) {
            emit({ type: "query.catalog_discarded", reason: "invalid_schema" });
          } else if (validation.migrated || validation.changed) {
            emit({ type: "query.catalog_migrated", reason: "schema_normalized" });
          }
          if (validation.changed || validation.discarded || validation.migrated) {
            try {
              await storage.set({ [options.storageKey]: validation.catalog });
            } catch (error) {
              emit({
                type: "query.persist_failed",
                reason: "catalog_migration",
                error: extractErrorMessage(error),
              });
            }
          }
          return state.catalogCache;
        })
        .catch(() => {
          state.catalogCache = emptyCatalog();
          return state.catalogCache;
        })
        .finally(() => {
          state.catalogLoadPromise = null;
        });
    }
    return state.catalogLoadPromise;
  }

  function enforceLimit(catalog: GraphqlCatalog) {
    const entries = Object.entries(catalog.endpoints);
    if (entries.length <= maxEndpoints) return;
    entries
      .sort((a, b) => a[1].lastSeen - b[1].lastSeen)
      .slice(0, entries.length - maxEndpoints)
      .forEach(([key]) => {
        delete catalog.endpoints[key];
      });
  }

  async function flushCatalog(storage: StorageAreaLike) {
    const state = stateFor(storage);
    if (!state.catalogDirty || !state.catalogCache) return;
    state.catalogDirty = false;
    try {
      await storage.set({ [options.storageKey]: state.catalogCache });
    } catch (error) {
      state.catalogDirty = true;
      emit({
        type: "query.persist_failed",
        reason: "catalog_flush",
        error: extractErrorMessage(error),
      });
    }
  }

  function scheduleFlush(storage: StorageAreaLike) {
    const state = stateFor(storage);
    if (state.catalogFlushTimer) return;
    state.catalogFlushTimer = setTimeout(() => {
      state.catalogFlushTimer = null;
      void flushCatalog(storage);
    }, flushDelayMs);
  }

  async function persistIfNeeded(storage: StorageAreaLike): Promise<void> {
    if (flushMode === "immediate") {
      await flushCatalog(storage);
      return;
    }
    scheduleFlush(storage);
  }

  function lookupCatalog(catalog: GraphqlCatalog, operationName: string): string | null {
    let best: CatalogEntry | null = null;
    for (const entry of Object.values(catalog.endpoints)) {
      if (entry.operation === operationName && entry.queryId) {
        if (!best || entry.lastSeen > best.lastSeen) best = entry;
      }
    }
    return best ? best.queryId : null;
  }

  async function persistResolvedQueryId(
    operationName: OperationName,
    queryId: string,
    storage: StorageAreaLike,
    metadata: PersistQueryIdMetadata = {},
  ): Promise<void> {
    if (!isValidQueryId(queryId)) return;

    const state = stateFor(storage);
    const catalog = await loadCatalog(storage);
    if (metadata.staleQueryId) {
      for (const [key, entry] of Object.entries(catalog.endpoints)) {
        if (
          entry.operation === operationName &&
          entry.queryId === metadata.staleQueryId
        ) {
          delete catalog.endpoints[key];
        }
      }
    }

    const now = Date.now();
    const key = operationName + ":" + queryId;
    const existing = catalog.endpoints[key];
    const path = `/i/api/graphql/${queryId}/${operationName}`;
    catalog.endpoints[key] = {
      key,
      operation: operationName,
      queryId,
      path: existing?.path ?? path,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
      seenCount: (existing?.seenCount ?? 0) + 1,
      methods: existing?.methods ?? [],
      sampleUrl:
        metadata.sampleUrl ??
        existing?.sampleUrl ??
        `https://x.com/i/api/graphql/${queryId}/${operationName}`,
      sampleVariables: existing?.sampleVariables ?? null,
      sampleFeatures: existing?.sampleFeatures ?? null,
      sampleFieldToggles: existing?.sampleFieldToggles ?? null,
      source: metadata.source ?? existing?.source ?? "manual",
      scriptUrl: metadata.scriptUrl ?? existing?.scriptUrl,
    };
    catalog.updatedAt = now;
    enforceLimit(catalog);
    state.catalogDirty = true;
    setCache(state, operationName, queryId, now);
    await persistIfNeeded(storage);
  }

  async function captureGraphqlEndpoint(
    details: CaptureGraphqlDetails,
    deps?: QueryIdCallDeps,
  ): Promise<void> {
    const parsed = parseGraphqlEndpoint(details.url);
    if (!parsed) return;

    if (!isValidOperationName(parsed.operation) || !isValidQueryId(parsed.queryId)) {
      emit({
        type: "query.capture_ignored",
        operation: parsed.operation,
        queryId: parsed.queryId,
        reason: "invalid_endpoint",
      });
      return;
    }

    if (!allowedOperations.has(parsed.operation) && !options.captureUnknownOperations) {
      emit({
        type: "query.capture_ignored",
        operation: parsed.operation,
        queryId: parsed.queryId,
        reason: "unknown_operation",
      });
      return;
    }

    const operationName = parsed.operation as OperationName;
    const storage = storageFor(deps);
    const state = stateFor(storage);
    const catalog = await loadCatalog(storage);
    const key = operationName + ":" + parsed.queryId;
    const now = Date.now();
    const current: CatalogEntry = catalog.endpoints[key] || {
      key,
      operation: operationName,
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
      source: "capture",
    };

    current.key = key;
    current.operation = operationName;
    current.queryId = parsed.queryId;
    current.path = parsed.path;
    current.lastSeen = now;
    current.seenCount = (current.seenCount ?? 0) + 1;
    current.sampleUrl = parsed.fullUrl;
    current.source = "capture";
    if (!current.methods) current.methods = [];
    if (details.method && !current.methods.includes(details.method)) {
      current.methods.push(details.method);
    }
    if (parsed.variables) current.sampleVariables = parsed.variables;
    if (parsed.features) current.sampleFeatures = parsed.features;
    if (parsed.fieldToggles) current.sampleFieldToggles = parsed.fieldToggles;

    catalog.endpoints[key] = current;
    catalog.updatedAt = now;
    enforceLimit(catalog);
    state.catalogDirty = true;
    setCache(state, operationName, parsed.queryId, now);
    await persistIfNeeded(storage);
  }

  async function discoverFromBundles(
    operationName: OperationName,
    fetchFn: typeof fetch,
  ): Promise<{ queryId: string; scriptUrl: string } | null> {
    let html: string;
    try {
      const resp = await fetchFn("https://x.com", { credentials: "include" });
      if (!resp.ok) return null;
      html = await resp.text();
    } catch {
      return null;
    }

    for (const url of extractScriptUrls(html)) {
      try {
        const response = await fetchFn(url);
        if (!response.ok) continue;
        const text = await response.text();
        const queryId = extractQueryIdForOperation(text, operationName);
        if (queryId && isValidQueryId(queryId)) {
          return { queryId, scriptUrl: url };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  function waitForCacheUpdate(
    storage: StorageAreaLike,
    operationName: OperationName,
    timeoutMs = 15_000,
  ): Promise<string | null> {
    const state = stateFor(storage);
    const cached = getCachedQueryIdFromState(state, operationName);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      const listener = (updatedOperation: string, queryId: string) => {
        if (updatedOperation !== operationName) return;
        cleanup();
        resolve(queryId);
      };

      function cleanup() {
        clearTimeout(timeout);
        state.cacheListeners.delete(listener);
      }

      state.cacheListeners.add(listener);
    });
  }

  function makeContext(
    storage: StorageAreaLike,
    fetchFn: typeof fetch,
    force: boolean,
    staleQueryId?: string,
  ): QueryIdDiscoveryContext<OperationName> {
    return {
      storage,
      fetchFn,
      operations: options.operations,
      force,
      staleQueryId,
      getCachedQueryId: (operationName) =>
        getCachedQueryIdFromState(stateFor(storage), operationName),
      waitForCacheUpdate: (operationName, timeoutMs) =>
        waitForCacheUpdate(storage, operationName, timeoutMs),
      persistQueryId: (operationName, queryId, metadata) =>
        persistResolvedQueryId(operationName, queryId, storage, {
          ...metadata,
          staleQueryId: metadata?.staleQueryId ?? staleQueryId,
        }),
      emit,
    };
  }

  async function runStrategy(
    strategy: QueryIdDiscoveryStrategy<OperationName>,
    operationName: OperationName,
    context: QueryIdDiscoveryContext<OperationName>,
  ): Promise<QueryIdDiscoveryResult> {
    const startedAt = Date.now();
    try {
      const result = await strategy.discover(operationName, context);
      const queryId = typeof result === "string" ? result : result?.queryId;
      const elapsedMs = Date.now() - startedAt;
      if (queryId) {
        if (strategy.name === "catalog") {
          emit({
            type: "query.catalog_hit",
            operation: operationName,
            source: strategy.name,
            queryId,
            elapsedMs,
          });
        } else if (strategy.name === "cache") {
          emit({
            type: "query.cache_hit",
            operation: operationName,
            source: strategy.name,
            queryId,
            elapsedMs,
          });
        } else if (strategy.name === "bundle") {
          emit({
            type: "query.bundle_hit",
            operation: operationName,
            source: strategy.name,
            queryId,
            elapsedMs,
          });
        }
        return result;
      }

      if (strategy.name === "catalog") {
        emit({
          type: "query.catalog_miss",
          operation: operationName,
          source: strategy.name,
          elapsedMs,
        });
      } else if (strategy.name === "cache") {
        emit({
          type: "query.cache_miss",
          operation: operationName,
          source: strategy.name,
          elapsedMs,
        });
      } else if (strategy.name === "bundle") {
        emit({
          type: "query.bundle_miss",
          operation: operationName,
          source: strategy.name,
          elapsedMs,
        });
      }
      return null;
    } catch (error) {
      emit({
        type: "query.discovery_strategy_error",
        operation: operationName,
        source: strategy.name,
        error: extractErrorMessage(error),
      });
      return null;
    }
  }

  const catalogStrategy: QueryIdDiscoveryStrategy<OperationName> = {
    name: "catalog",
    async discover(operationName, context) {
      if (context.force) return null;
      const catalog = await loadCatalog(context.storage);
      return lookupCatalog(catalog, operationName);
    },
  };

  const cacheStrategy: QueryIdDiscoveryStrategy<OperationName> = {
    name: "cache",
    async discover(operationName, context) {
      if (context.force) return null;
      return context.getCachedQueryId(operationName);
    },
  };

  const bundleStrategy: QueryIdDiscoveryStrategy<OperationName> = {
    name: "bundle",
    async discover(operationName, context) {
      const discovered = await discoverFromBundles(operationName, context.fetchFn);
      if (!discovered) return null;
      return {
        queryId: discovered.queryId,
        source: "bundle",
        scriptUrl: discovered.scriptUrl,
        sampleUrl: `https://x.com/i/api/graphql/${discovered.queryId}/${operationName}`,
      };
    },
  };

  async function runPipeline(
    operationName: OperationName,
    deps: QueryIdCallDeps | undefined,
    force: boolean,
    staleQueryId?: string,
  ): Promise<QueryIdDiscoveryResult> {
    const storage = storageFor(deps);
    const fetchFn = fetchFor(deps);
    const context = makeContext(storage, fetchFn, force, staleQueryId);
    const strategies = force
      ? [bundleStrategy, ...(options.strategies ?? [])]
      : [
          catalogStrategy,
          cacheStrategy,
          bundleStrategy,
          ...(options.strategies ?? []),
        ];

    for (const strategy of strategies) {
      const result = await runStrategy(strategy, operationName, context);
      const queryId = typeof result === "string" ? result : result?.queryId;
      if (!queryId || !isValidQueryId(queryId)) continue;
      const objectResult = typeof result === "string" ? null : result;

      const source =
        typeof result === "string"
          ? strategy.name === "bundle"
            ? "bundle"
            : strategy.name === "catalog" || strategy.name === "cache"
              ? undefined
              : "strategy"
          : objectResult?.source ??
            (strategy.name === "bundle" ? "bundle" : strategy.name === "catalog" || strategy.name === "cache" ? undefined : "strategy");

      setCache(stateFor(storage), operationName, queryId);
      if (source) {
        await persistResolvedQueryId(operationName, queryId, storage, {
          source,
          staleQueryId,
          scriptUrl: objectResult?.scriptUrl,
          sampleUrl: objectResult?.sampleUrl,
        });
      }
      return result;
    }

    return null;
  }

  async function resolveQueryId(
    operationNameInput: OperationName,
    deps?: QueryIdCallDeps,
  ): Promise<string | null> {
    const operationName = assertOperation(operationNameInput);
    const result = await runPipeline(operationName, deps, false);
    return typeof result === "string" ? result : result?.queryId ?? null;
  }

  async function forceRediscoverQueryId(
    operationNameInput: OperationName,
    deps?: QueryIdCallDeps,
    staleQueryId?: string,
  ): Promise<string | null> {
    const operationName = assertOperation(operationNameInput);
    const storage = storageFor(deps);
    stateFor(storage).memCache.delete(operationName);
    const result = await runPipeline(operationName, deps, true, staleQueryId);
    return typeof result === "string" ? result : result?.queryId ?? null;
  }

  async function withQueryId<T>(
    operationNameInput: OperationName,
    fn: (queryId: string) => Promise<T>,
    deps?: QueryIdCallDeps,
  ): Promise<T> {
    const operationName = assertOperation(operationNameInput);
    const queryId = await resolveQueryId(operationName, deps);
    if (!queryId) throw new NoQueryIdError(operationName);

    let result: T;
    try {
      result = await fn(queryId);
    } catch (err) {
      if (isQueryIdStaleError(err)) {
        emit({
          type: "query.stale_retry",
          operation: operationName,
          queryId,
          reason: "throw",
        });
        const fresh = await forceRediscoverQueryId(
          operationName,
          deps,
          err.staleQueryId || queryId,
        );
        if (!fresh || fresh === queryId) throw err;
        return fn(fresh);
      }
      throw err;
    }

    if (result && typeof result === "object" && isQueryIdStale(result)) {
      emit({
        type: "query.stale_retry",
        operation: operationName,
        queryId,
        reason: "graphql_validation_failed",
      });
      const fresh = await forceRediscoverQueryId(operationName, deps, queryId);
      if (!fresh) throw new NoQueryIdError(operationName);
      return fn(fresh);
    }
    return result;
  }

  async function discoverAllMissingQueryIds(deps?: QueryIdCallDeps): Promise<void> {
    const storage = storageFor(deps);
    const state = stateFor(storage);
    if (state.discoveryInProgress) return;
    state.discoveryInProgress = true;
    try {
      const now = Date.now();
      const missing = options.operations.filter((op) => {
        const cached = state.memCache.get(op);
        return !cached || now - cached.ts >= ttlMs;
      });
      if (missing.length === 0) return;

      const catalog = await loadCatalog(storage);
      const stillMissing: OperationName[] = [];
      for (const op of missing) {
        const fromCatalog = lookupCatalog(catalog, op);
        if (fromCatalog) setCache(state, op, fromCatalog, now);
        else stillMissing.push(op);
      }
      if (stillMissing.length === 0) return;

      const fetchFn = fetchFor(deps);
      let html: string;
      try {
        const resp = await fetchFn("https://x.com", { credentials: "include" });
        if (!resp.ok) return;
        html = await resp.text();
      } catch {
        return;
      }

      const remaining = new Set<OperationName>(stillMissing);
      for (const url of extractScriptUrls(html)) {
        if (remaining.size === 0) break;
        try {
          const response = await fetchFn(url);
          if (!response.ok) continue;
          const text = await response.text();
          for (const op of [...remaining]) {
            const queryId = extractQueryIdForOperation(text, op);
            if (queryId && isValidQueryId(queryId)) {
              await persistResolvedQueryId(op, queryId, storage, {
                source: "bundle",
                scriptUrl: url,
                sampleUrl: `https://x.com/i/api/graphql/${queryId}/${op}`,
              });
              remaining.delete(op);
            }
          }
        } catch {
          continue;
        }
      }
    } finally {
      state.discoveryInProgress = false;
    }
  }

  async function storeQueryIds(
    ids: Partial<Record<OperationName, string>>,
    deps?: QueryIdCallDeps,
  ): Promise<void> {
    const storage = storageFor(deps);
    for (const [op, id] of Object.entries(ids)) {
      const operationName = assertOperation(op);
      if (!isValidQueryId(id)) {
        emit({
          type: "query.capture_ignored",
          operation: operationName,
          queryId: typeof id === "string" ? id : undefined,
          reason: "invalid_query_id",
        });
        continue;
      }
      await persistResolvedQueryId(operationName, id, storage, {
        source: "manual",
      });
    }
  }

  function getCachedQueryId(operationNameInput: OperationName): string | null {
    const operationName = assertOperation(operationNameInput);
    const storage = options.storage;
    if (!storage) {
      for (const state of allStates) {
        const cached = getCachedQueryIdFromState(state, operationName);
        if (cached) return cached;
      }
      return null;
    }
    return getCachedQueryIdFromState(stateFor(storage), operationName);
  }

  function resetForTesting() {
    for (const state of allStates) {
      state.memCache.clear();
      state.catalogCache = null;
      state.catalogLoadPromise = null;
      state.catalogDirty = false;
      if (state.catalogFlushTimer) {
        clearTimeout(state.catalogFlushTimer);
        state.catalogFlushTimer = null;
      }
      state.discoveryInProgress = false;
      state.cacheListeners.clear();
    }
    stateByStorage = new WeakMap();
    allStates = new Set();
  }

  return {
    captureGraphqlEndpoint,
    discoverAllMissingQueryIds,
    extractScriptUrls,
    flushCatalog,
    forceRediscoverQueryId,
    getCachedQueryId,
    loadCatalog,
    resetForTesting,
    resolveQueryId,
    storeQueryIds,
    waitForCacheUpdate: (operationName: OperationName, deps?: QueryIdCallDeps, timeoutMs?: number) =>
      waitForCacheUpdate(storageFor(deps), assertOperation(operationName), timeoutMs),
    withQueryId,
  };
}
