// ═══════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// @sync-with src/lib/constants/timing.ts — shared timing values
// @sync-with src/lib/storage-keys.ts    — storage key strings
// ═══════════════════════════════════════════════════════════

const CAPTURED_HEADERS = new Set([
  "authorization",
  "cookie",
  "x-csrf-token",
  "x-client-uuid",
  "x-client-transaction-id",
  "x-twitter-active-user",
  "x-twitter-auth-type",
  "x-twitter-client-language",
]);

// Key convention: xbt_ prefix + snake_case.
// Keep in sync with src/lib/storage-keys.ts.
const GRAPHQL_CATALOG_STORAGE_KEY = "xbt_graphql_catalog";
const GRAPHQL_CATALOG_VERSION = 1;
const MAX_GRAPHQL_ENDPOINTS = 300;
const MAX_CAPTURED_PARAM_LENGTH = 12000;
const CATALOG_FLUSH_DELAY_MS = 600;
const BOOKMARK_EVENTS_STORAGE_KEY = "xbt_bookmark_events";
const MAX_BOOKMARK_EVENTS = 400;
const AUTH_STATE_STORAGE_KEYS = [
  "xbt_user_id",
  "xbt_auth_headers",
  "xbt_auth_time",
];
const WEEKLY_SW_CLEANUP_KEY = "xbt_sw_cleanup_at";
const WEEKLY_SW_CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;
const BOOKMARK_EVENT_RETENTION_MS = 1000 * 60 * 60 * 24 * 14;
const GRAPHQL_ENDPOINT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

const DEFAULT_FEATURES = {
  graphql_timeline_v2_bookmark_timeline: true,
  rweb_tipjar_consumption_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_uc_gql_enabled: true,
  vibe_api_enabled: true,
  responsive_web_text_conversations_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

const DETAIL_FEATURE_OVERRIDES = {
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  premium_content_api_read_enabled: false,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: true,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
};


// ═══════════════════════════════════════════════════════════
// AUTH & COOKIE HELPERS
// ═══════════════════════════════════════════════════════════

// NOTE: parseTwidUserId is intentionally duplicated in detect-user.js.
// Content scripts must be self-contained for injection.
function parseTwidUserId(rawValue) {
  if (typeof rawValue !== "string" || !rawValue) return null;

  const candidates = [rawValue];
  try {
    const decoded = decodeURIComponent(rawValue);
    if (decoded && decoded !== rawValue) {
      candidates.push(decoded);
    }
  } catch {}

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const userMatch = trimmed.match(/u=(\d+)/);
    if (userMatch?.[1]) return userMatch[1];

    const encodedMatch = trimmed.match(/u%3[Dd](\d+)/);
    if (encodedMatch?.[1]) return encodedMatch[1];

    if (/^\d+$/.test(trimmed)) return trimmed;
  }

  return null;
}

async function readUserIdFromTwidCookie() {
  try {
    const twidCookie = await chrome.cookies.get({
      url: "https://x.com",
      name: "twid",
    });
    return parseTwidUserId(twidCookie?.value || "");
  } catch {
    return null;
  }
}

async function clearAuthSessionState() {
  await chrome.storage.local.remove(AUTH_STATE_STORAGE_KEYS);
}

async function syncAuthSessionFromCookie(storedState = null) {
  const userId = await readUserIdFromTwidCookie();
  if (userId) {
    if (storedState?.xbt_user_id !== userId) {
      await chrome.storage.local.set({ xbt_user_id: userId });
    }
    return userId;
  }

  // Avoid clearing stored auth state here: cookie reads can be unavailable
  // transiently in service worker context even when the user is signed in.
  const storedUserId =
    typeof storedState?.xbt_user_id === "string" &&
    storedState.xbt_user_id
      ? storedState.xbt_user_id
      : null;
  return storedUserId;
}

let authTabId = null;
let reauthInProgress = false;

function incrementTransactionId(str) {
  if (!str) return str;
  const digits = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] >= "0" && str[i] <= "9") digits.push(i);
  }
  if (digits.length === 0) return str;
  const idx = digits[Math.floor(Math.random() * digits.length)];
  const bump = Math.floor(Math.random() * 8) + 1;
  const newDigit = ((parseInt(str[idx], 10) + bump) % 10).toString();
  return str.slice(0, idx) + newDigit + str.slice(idx + 1);
}

function reAuthSilently() {
  if (reauthInProgress) return Promise.resolve(false);
  reauthInProgress = true;

  return new Promise((resolve) => {
    let tabId = null;
    let resolved = false;

    const cleanup = () => {
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
        tabId = null;
      }
      chrome.storage.local.onChanged.removeListener(onChange);
      reauthInProgress = false;
    };

    const onChange = (changes) => {
      if (changes.xbt_auth_headers && !resolved) {
        resolved = true;
        cleanup();
        resolve(true);
      }
    };

    chrome.storage.local.onChanged.addListener(onChange);

    chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: false }, (tab) => {
      tabId = tab.id;
      authTabId = tab.id;
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(false);
      }
    }, 15000);
  });
}

async function buildHeaders() {
  const stored = await chrome.storage.local.get(["xbt_auth_headers"]);
  const auth = stored.xbt_auth_headers;
  if (!auth?.authorization) throw new Error("NO_AUTH");

  const headers = {
    authorization: auth["authorization"],
    "x-csrf-token": auth["x-csrf-token"],
    "x-twitter-active-user": auth["x-twitter-active-user"] || "yes",
    "x-twitter-auth-type": auth["x-twitter-auth-type"] || "OAuth2Session",
    "x-twitter-client-language": auth["x-twitter-client-language"] || "en",
    "content-type": "application/json",
  };

  if (auth["cookie"]) headers["cookie"] = auth["cookie"];
  if (auth["x-client-uuid"]) headers["x-client-uuid"] = auth["x-client-uuid"];
  if (auth["x-client-transaction-id"]) {
    headers["x-client-transaction-id"] = incrementTransactionId(
      auth["x-client-transaction-id"]
    );
  }

  return headers;
}

// ═══════════════════════════════════════════════════════════
// QUERY ID DISCOVERY — fetch x.com JS bundles to extract query IDs
// ═══════════════════════════════════════════════════════════

const queryIdMemCache = new Map(); // operationName → { id, ts }
const QUERY_ID_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isQueryIdStale(json) {
  if (!json?.errors) return false;
  return json.errors.some(
    (e) => e?.extensions?.code === "GRAPHQL_VALIDATION_FAILED",
  );
}

function invalidateQueryIdCache(operationName) {
  queryIdMemCache.delete(operationName);
}

async function discoverQueryIdFromBundles(operationName) {
  const resp = await fetch("https://x.com", { credentials: "include" });
  if (!resp.ok) return null;
  const html = await resp.text();

  const scriptUrls = [];
  const scriptRegex = /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web[^"]+\.js)"/g;
  let m;
  while ((m = scriptRegex.exec(html)) !== null && scriptUrls.length < 15) {
    scriptUrls.push(m[1]);
  }

  for (const url of scriptUrls) {
    try {
      const jsResp = await fetch(url);
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

function extractQueryIdForOperation(text, operationName) {
  // Match queryId immediately paired with the operationName in the same export
  const pattern = new RegExp(
    'queryId\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']\\s*,\\s*operationName\\s*:\\s*["\']' +
      operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      '["\']',
  );
  const match = text.match(pattern);
  return match ? match[1] : null;
}

// ═══════════════════════════════════════════════════════════
// QUERY ID RESOLUTION — unified fallback chain
// ═══════════════════════════════════════════════════════════

async function resolveQueryId(operationName, storageKey) {
  // 1. Check short-lived in-memory cache
  const cached = queryIdMemCache.get(operationName);
  if (cached && Date.now() - cached.ts < QUERY_ID_TTL_MS) {
    return cached.id;
  }

  // 2. Check chrome.storage.local (populated by passive capture)
  const stored = await chrome.storage.local.get([storageKey]);
  if (stored[storageKey]) {
    queryIdMemCache.set(operationName, { id: stored[storageKey], ts: Date.now() });
    return stored[storageKey];
  }

  // 3. Check GraphQL catalog
  const catalog = await loadGraphqlCatalog();
  for (const entry of Object.values(catalog.endpoints || {})) {
    if (entry && entry.operation === operationName && entry.queryId) {
      queryIdMemCache.set(operationName, { id: entry.queryId, ts: Date.now() });
      chrome.storage.local.set({ [storageKey]: entry.queryId });
      return entry.queryId;
    }
  }

  // 4. Discover from x.com JS bundles
  const discovered = await discoverQueryIdFromBundles(operationName).catch(() => null);
  if (discovered) {
    queryIdMemCache.set(operationName, { id: discovered, ts: Date.now() });
    chrome.storage.local.set({ [storageKey]: discovered });
    return discovered;
  }

  return null;
}

async function forceRediscoverQueryId(operationName, storageKey) {
  invalidateQueryIdCache(operationName);
  await chrome.storage.local.remove([storageKey]);

  const freshId = await discoverQueryIdFromBundles(operationName).catch(
    () => null,
  );
  if (freshId) {
    queryIdMemCache.set(operationName, { id: freshId, ts: Date.now() });
    await chrome.storage.local.set({ [storageKey]: freshId });
  }
  return freshId;
}

// ═══════════════════════════════════════════════════════════
// PROACTIVE BATCH DISCOVERY — find all missing query IDs
// ═══════════════════════════════════════════════════════════

let discoveryInProgress = false;

const QUERY_ID_OPS = [
  { operation: "DeleteBookmark", storageKey: "xbt_delete_query_id" },
  { operation: "CreateBookmark", storageKey: "xbt_create_query_id" },
  { operation: "TweetDetail", storageKey: "xbt_detail_query_id" },
];

async function discoverAllMissingQueryIds() {
  if (discoveryInProgress) return;
  discoveryInProgress = true;

  try {
    const keys = QUERY_ID_OPS.map((op) => op.storageKey);
    const stored = await chrome.storage.local.get(keys);
    const missing = QUERY_ID_OPS.filter((op) => !stored[op.storageKey]);
    if (missing.length === 0) return;

    // Check catalog before hitting the network
    const catalog = await loadGraphqlCatalog();
    const updates = {};
    const stillMissing = [];

    for (const op of missing) {
      let found = false;
      for (const entry of Object.values(catalog.endpoints || {})) {
        if (entry && entry.operation === op.operation && entry.queryId) {
          updates[op.storageKey] = entry.queryId;
          found = true;
          break;
        }
      }
      if (!found) stillMissing.push(op);
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }

    if (stillMissing.length === 0) return;

    // Batch fetch bundles — one fetch per bundle, search all missing ops
    const resp = await fetch("https://x.com", { credentials: "include" });
    if (!resp.ok) return;
    const html = await resp.text();

    const scriptUrls = [];
    const scriptRegex = /src="(https:\/\/abs\.twimg\.com\/responsive-web\/client-web[^"]+\.js)"/g;
    let m;
    while ((m = scriptRegex.exec(html)) !== null && scriptUrls.length < 15) {
      scriptUrls.push(m[1]);
    }

    const remaining = new Map(stillMissing.map((op) => [op.operation, op]));
    const bundleUpdates = {};

    for (const url of scriptUrls) {
      if (remaining.size === 0) break;
      try {
        const jsResp = await fetch(url);
        if (!jsResp.ok) continue;
        const text = await jsResp.text();

        for (const [opName, op] of remaining) {
          const qid = extractQueryIdForOperation(text, opName);
          if (qid) {
            bundleUpdates[op.storageKey] = qid;
            remaining.delete(opName);
          }
        }
      } catch {
        continue;
      }
    }

    if (Object.keys(bundleUpdates).length > 0) {
      await chrome.storage.local.set(bundleUpdates);
    }
  } finally {
    discoveryInProgress = false;
  }
}

// ═══════════════════════════════════════════════════════════
// GRAPHQL CATALOG
// ═══════════════════════════════════════════════════════════

let graphqlCatalogCache = null;
let graphqlCatalogLoadPromise = null;
let catalogDirty = false;
let catalogFlushTimer = null;

function createEmptyCatalog() {
  return {
    version: GRAPHQL_CATALOG_VERSION,
    updatedAt: 0,
    endpoints: {},
  };
}

function trimCapturedParam(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= MAX_CAPTURED_PARAM_LENGTH) return value;
  const overflow = value.length - MAX_CAPTURED_PARAM_LENGTH;
  return `${value.slice(0, MAX_CAPTURED_PARAM_LENGTH)}... [truncated ${overflow} chars]`;
}

function parseGraphqlEndpoint(urlString) {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/i\/api\/graphql\/([^/]+)\/([^/]+)/);
    if (!match) return null;
    return {
      queryId: decodeURIComponent(match[1]),
      operation: decodeURIComponent(match[2]),
      variables: trimCapturedParam(url.searchParams.get("variables")),
      features: trimCapturedParam(url.searchParams.get("features")),
      fieldToggles: trimCapturedParam(url.searchParams.get("fieldToggles")),
      path: url.pathname,
      fullUrl: url.toString(),
    };
  } catch {
    return null;
  }
}

function enforceCatalogLimit(catalog) {
  const entries = Object.values(catalog.endpoints || {});
  if (entries.length <= MAX_GRAPHQL_ENDPOINTS) return;
  entries
    .sort((a, b) => a.lastSeen - b.lastSeen)
    .slice(0, entries.length - MAX_GRAPHQL_ENDPOINTS)
    .forEach((entry) => {
      delete catalog.endpoints[entry.key];
    });
}

async function loadGraphqlCatalog() {
  if (graphqlCatalogCache) return graphqlCatalogCache;
  if (!graphqlCatalogLoadPromise) {
    graphqlCatalogLoadPromise = chrome.storage.local
      .get([GRAPHQL_CATALOG_STORAGE_KEY])
      .then((stored) => {
        const existing = stored[GRAPHQL_CATALOG_STORAGE_KEY];
        if (
          existing &&
          typeof existing === "object" &&
          !Array.isArray(existing) &&
          typeof existing.endpoints === "object"
        ) {
          graphqlCatalogCache = existing;
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

async function flushGraphqlCatalog() {
  if (!catalogDirty || !graphqlCatalogCache) return;
  catalogDirty = false;
  try {
    await chrome.storage.local.set({
      [GRAPHQL_CATALOG_STORAGE_KEY]: graphqlCatalogCache,
    });
  } catch {
    // Keep dirty so the next request attempts to flush again.
    catalogDirty = true;
  }
}

function scheduleCatalogFlush() {
  if (catalogFlushTimer) return;
  catalogFlushTimer = setTimeout(() => {
    catalogFlushTimer = null;
    flushGraphqlCatalog();
  }, CATALOG_FLUSH_DELAY_MS);
}

async function captureGraphqlEndpoint(details) {
  const parsed = parseGraphqlEndpoint(details.url);
  if (!parsed) return;

  const catalog = await loadGraphqlCatalog();
  const key = `${parsed.operation}:${parsed.queryId}`;
  const now = Date.now();
  const current = catalog.endpoints[key] || {
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
  scheduleCatalogFlush();
}

// NOTE: parseJsonMaybe is intentionally duplicated — similar to parseMaybeJson
// in the app source. Service workers cannot import from src/.
function parseJsonMaybe(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// BOOKMARK EVENTS
// ═══════════════════════════════════════════════════════════

async function pushBookmarkEvent(type, tweetId, source) {
  const normalizedTweetId = typeof tweetId === "string" ? tweetId : "";
  const now = Date.now();
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const existing = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  const next = existing
    .filter(
      (event) =>
        !(
          event &&
          event.tweetId === normalizedTweetId &&
          event.type === type &&
          now - Number(event.at || 0) < 1000
        ),
    )
    .concat({
      id: `${now}-${type}-${normalizedTweetId || "unknown"}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      tweetId: normalizedTweetId,
      at: now,
      source,
    });

  if (next.length > MAX_BOOKMARK_EVENTS) {
    next.splice(0, next.length - MAX_BOOKMARK_EVENTS);
  }

  await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: next });
}

async function handleDrainBookmarkEvents() {
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  if (events.length > 0) {
    await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: [] });
  }

  return { data: { events } };
}

async function handleGetBookmarkEvents() {
  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];
  return { data: { events } };
}

async function handleAckBookmarkEvents(ids) {
  const ackSet = new Set(
    Array.isArray(ids)
      ? ids.filter((id) => typeof id === "string" && id.length > 0)
      : [],
  );
  if (ackSet.size === 0) {
    return { data: { removed: 0, remaining: 0 } };
  }

  const stored = await chrome.storage.local.get([BOOKMARK_EVENTS_STORAGE_KEY]);
  const events = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  const next = events.filter((event) => {
    if (!event || typeof event !== "object") return false;
    const id = typeof event.id === "string" ? event.id : "";
    return id ? !ackSet.has(id) : true;
  });

  await chrome.storage.local.set({ [BOOKMARK_EVENTS_STORAGE_KEY]: next });
  return {
    data: {
      removed: events.length - next.length,
      remaining: next.length,
    },
  };
}

async function handleBookmarkMutationMessage(message) {
  const operation =
    message?.operation === "CreateBookmark" || message?.operation === "DeleteBookmark"
      ? message.operation
      : null;
  if (!operation) return { ok: false };

  // CreateBookmark events are only pushed from onCompleted (after x.com
  // confirms success). Pushing here would trigger a page fetch before
  // x.com has processed the bookmark, finding nothing new.
  if (operation === "CreateBookmark") return { ok: true };

  const tweetId = typeof message?.tweetId === "string" ? message.tweetId : "";
  const source = typeof message?.source === "string" ? message.source : "content-script";
  await pushBookmarkEvent(operation, tweetId, source);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════
// BOOKMARK MUTATION CAPTURE (webRequest)
// ═══════════════════════════════════════════════════════════

function decodeBodyBytes(bytes) {
  if (!bytes) return "";
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

function extractTweetIdFromVariables(variables) {
  if (!variables || typeof variables !== "object") return null;
  const tweetId =
    variables.tweet_id ||
    variables.tweetId ||
    variables.focalTweetId ||
    variables.target_tweet_id ||
    variables.targetTweetId;
  return typeof tweetId === "string" && tweetId ? tweetId : null;
}

function extractTweetIdFromRequestBody(requestBody) {
  if (!requestBody) return null;

  if (requestBody.formData) {
    const formData = requestBody.formData;
    const direct = formData.tweet_id || formData.tweetId;
    if (Array.isArray(direct) && typeof direct[0] === "string" && direct[0]) {
      return direct[0];
    }

    const variablesRaw = Array.isArray(formData.variables)
      ? formData.variables[0]
      : null;
    const parsed = parseJsonMaybe(variablesRaw);
    const tweetId = extractTweetIdFromVariables(parsed);
    if (tweetId) return tweetId;
  }

  const rawParts = Array.isArray(requestBody.raw) ? requestBody.raw : [];
  for (const part of rawParts) {
    const text = decodeBodyBytes(part.bytes).trim();
    if (!text) continue;

    const parsedJson = parseJsonMaybe(text);
    if (parsedJson && typeof parsedJson === "object") {
      const direct = extractTweetIdFromVariables(parsedJson.variables);
      if (direct) return direct;
      const nested = extractTweetIdFromVariables(parsedJson);
      if (nested) return nested;
    }

    const search = new URLSearchParams(text);
    const varsFromQuery = parseJsonMaybe(search.get("variables"));
    const fromVars = extractTweetIdFromVariables(varsFromQuery);
    if (fromVars) return fromVars;
    const direct = search.get("tweet_id") || search.get("tweetId");
    if (direct) return direct;
  }

  return null;
}

function parseBookmarkMutation(urlString) {
  const match = urlString.match(
    /\/i\/api\/graphql\/([^/]+)\/(DeleteBookmark|CreateBookmark)(?:\?|$)/,
  );
  if (!match) return null;
  return {
    queryId: match[1],
    operation: match[2],
  };
}

function getHeaderValue(headers, name) {
  if (!Array.isArray(headers)) return "";
  const target = String(name || "").toLowerCase();
  for (const header of headers) {
    if (!header || typeof header !== "object") continue;
    if (String(header.name || "").toLowerCase() === target) {
      return typeof header.value === "string" ? header.value : "";
    }
  }
  return "";
}

function extractTweetIdFromReferer(referer) {
  if (!referer || typeof referer !== "string") return null;
  const match = referer.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function isExtensionInitiated(details) {
  return (
    typeof details?.initiator === "string" &&
    details.initiator.startsWith("chrome-extension://")
  );
}

async function captureBookmarkMutation(details) {
  if (isExtensionInitiated(details)) return;
  const mutation = parseBookmarkMutation(details.url);
  if (!mutation) return;

  const tweetId = extractTweetIdFromRequestBody(details.requestBody) || "";

  if (mutation.operation === "DeleteBookmark") {
    await chrome.storage.local.set({ xbt_delete_query_id: mutation.queryId });
    await pushBookmarkEvent("DeleteBookmark", tweetId, "x.com");
  }

  if (mutation.operation === "CreateBookmark") {
    await chrome.storage.local.set({ xbt_create_query_id: mutation.queryId });
    // Don't push the event here — onBeforeRequest fires BEFORE x.com
    // processes the request. The page fetch would find nothing new.
    // CreateBookmark events are pushed from onCompleted instead.
  }
}

// ═══════════════════════════════════════════════════════════
// WEEKLY CLEANUP
// ═══════════════════════════════════════════════════════════

async function runWeeklyServiceWorkerCleanup() {
  const now = Date.now();
  const stored = await chrome.storage.local.get([
    WEEKLY_SW_CLEANUP_KEY,
    BOOKMARK_EVENTS_STORAGE_KEY,
    GRAPHQL_CATALOG_STORAGE_KEY,
  ]);
  const lastCleanupAt = Number(stored[WEEKLY_SW_CLEANUP_KEY] || 0);
  if (now - lastCleanupAt < WEEKLY_SW_CLEANUP_INTERVAL_MS) {
    return;
  }

  const updates = {
    [WEEKLY_SW_CLEANUP_KEY]: now,
  };

  const existingEvents = Array.isArray(stored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? stored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];
  const eventsCutoff = now - BOOKMARK_EVENT_RETENTION_MS;
  const prunedEvents = existingEvents.filter(
    (event) => Number(event?.at || 0) >= eventsCutoff,
  );
  if (prunedEvents.length !== existingEvents.length) {
    updates[BOOKMARK_EVENTS_STORAGE_KEY] = prunedEvents;
  }

  const existingCatalog = stored[GRAPHQL_CATALOG_STORAGE_KEY];
  if (
    existingCatalog &&
    typeof existingCatalog === "object" &&
    !Array.isArray(existingCatalog) &&
    typeof existingCatalog.endpoints === "object" &&
    existingCatalog.endpoints
  ) {
    const endpointCutoff = now - GRAPHQL_ENDPOINT_RETENTION_MS;
    const nextEndpoints = {};
    let changed = false;

    for (const [key, entry] of Object.entries(existingCatalog.endpoints)) {
      if (!entry || typeof entry !== "object") {
        changed = true;
        continue;
      }

      const lastSeen = Number(entry.lastSeen || 0);
      if (lastSeen < endpointCutoff) {
        changed = true;
        continue;
      }

      nextEndpoints[key] = entry;
    }

    if (changed) {
      const nextCatalog = {
        ...existingCatalog,
        endpoints: nextEndpoints,
        updatedAt: now,
      };
      updates[GRAPHQL_CATALOG_STORAGE_KEY] = nextCatalog;
      graphqlCatalogCache = nextCatalog;
      catalogDirty = false;
    }
  }

  await chrome.storage.local.set(updates);
}

// ═══════════════════════════════════════════════════════════
// ONE-TIME MIGRATION: tw_ → xbt_ storage keys
// ═══════════════════════════════════════════════════════════

const TW_TO_XBT_KEY_MAP = {
  tw_graphql_catalog: "xbt_graphql_catalog",
  tw_auth_headers: "xbt_auth_headers",
  tw_auth_time: "xbt_auth_time",
  tw_query_id: "xbt_query_id",
  tw_features: "xbt_features",
  tw_detail_query_id: "xbt_detail_query_id",
  tw_delete_query_id: "xbt_delete_query_id",
  tw_create_query_id: "xbt_create_query_id",
  tw_bookmark_events: "xbt_bookmark_events",
  current_user_id: "xbt_user_id",
  tw_weekly_cleanup_at: "xbt_sw_cleanup_at",
  tw_seen_tweet_display_types: "xbt_seen_display_types",
};

async function migrateOldStorageKeys() {
  const oldKeys = Object.keys(TW_TO_XBT_KEY_MAP);
  const newKeys = Object.values(TW_TO_XBT_KEY_MAP);
  const stored = await chrome.storage.local.get([...oldKeys, ...newKeys]);
  const updates = {};
  const toRemove = [];

  for (const [oldKey, newKey] of Object.entries(TW_TO_XBT_KEY_MAP)) {
    if (stored[oldKey] !== undefined) {
      // Only migrate if the new key doesn't already have data
      if (stored[newKey] === undefined) {
        updates[newKey] = stored[oldKey];
      }
      toRemove.push(oldKey);
    }
  }

  if (toRemove.length > 0) {
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
    await chrome.storage.local.remove(toRemove);
  }
}

migrateOldStorageKeys().catch(() => {});

// ═══════════════════════════════════════════════════════════
// API REQUEST HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleCheckAuth() {
  const stored = await chrome.storage.local.get([
    "xbt_user_id",
    "xbt_auth_headers",
    "xbt_auth_time",
    "xbt_query_id",
  ]);

  const userId = await syncAuthSessionFromCookie(stored);
  const hasAuthHeader = !!stored.xbt_auth_headers?.authorization;
  const hasUser = Boolean(userId || hasAuthHeader);

  return {
    hasUser,
    hasAuth: hasAuthHeader,
    hasQueryId: !!stored.xbt_query_id,
    userId,
  };
}

async function handleFetchBookmarks(cursor, count, _retried = false, _queryIdRetried = false) {
  const stored = await chrome.storage.local.get([
    "xbt_auth_headers",
    "xbt_features",
  ]);

  if (!stored.xbt_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("Bookmarks", "xbt_query_id");
  if (!queryId) throw new Error("NO_QUERY_ID");

  const pageCount = typeof count === "number" && count > 0 ? count : 100;
  const variables = { count: pageCount, includePromotedContent: true };
  if (cursor) variables.cursor = cursor;

  const features = stored.xbt_features || JSON.stringify(DEFAULT_FEATURES);

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: features,
  });

  const url = `https://x.com/i/api/graphql/${queryId}/Bookmarks?${params}`;
  const requestHeaders = await buildHeaders();

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: requestHeaders,
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["xbt_auth_headers", "xbt_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleFetchBookmarks(cursor, count, true, _queryIdRetried);
    }
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json();

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("Bookmarks", "xbt_query_id");
    if (freshId) return handleFetchBookmarks(cursor, count, _retried, true);
  }

  return { data: json };
}

async function handleDeleteBookmark(tweetId, _retried = false, _queryIdRetried = false) {
  if (!tweetId) throw new Error("MISSING_TWEET_ID");

  const stored = await chrome.storage.local.get(["xbt_auth_headers"]);
  if (!stored.xbt_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("DeleteBookmark", "xbt_delete_query_id");
  if (!queryId) throw new Error("NO_QUERY_ID");
  const requestHeaders = await buildHeaders();

  const url = `https://x.com/i/api/graphql/${queryId}/DeleteBookmark`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: requestHeaders,
    body: JSON.stringify({
      variables: { tweet_id: tweetId },
      queryId,
    }),
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["xbt_auth_headers", "xbt_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleDeleteBookmark(tweetId, true, _queryIdRetried);
    }
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DELETE_BOOKMARK_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json().catch(() => null);

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("DeleteBookmark", "xbt_delete_query_id");
    if (freshId) return handleDeleteBookmark(tweetId, _retried, true);
  }

  return { ok: true, queryId, data: json };
}

function parseFeatureSet(raw) {
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return {};
}

function collectTweetDisplayTypes(payload) {
  const found = new Set();
  const stack = [payload];
  const seen = new Set();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === "tweetDisplayType" && typeof value === "string") {
        found.add(value);
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return Array.from(found).sort();
}

async function persistSeenTweetDisplayTypes(payload) {
  const incoming = collectTweetDisplayTypes(payload);
  if (incoming.length === 0) return;

  const stored = await chrome.storage.local.get(["xbt_seen_display_types"]);
  const existing = Array.isArray(stored.xbt_seen_display_types)
    ? stored.xbt_seen_display_types.filter((item) => typeof item === "string")
    : [];

  const merged = Array.from(new Set([...existing, ...incoming])).sort();
  if (merged.length === existing.length && merged.every((item, idx) => item === existing[idx])) {
    return;
  }

  await chrome.storage.local.set({ xbt_seen_display_types: merged });
}

async function handleFetchTweetDetail(tweetId, _retried = false, _queryIdRetried = false) {
  const stored = await chrome.storage.local.get([
    "xbt_auth_headers",
    "xbt_features",
  ]);

  if (!stored.xbt_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("TweetDetail", "xbt_detail_query_id");
  if (!queryId) throw new Error("NO_QUERY_ID");

  const featureSet = {
    ...DEFAULT_FEATURES,
    ...parseFeatureSet(stored.xbt_features),
    ...DETAIL_FEATURE_OVERRIDES,
  };

  const variables = {
    focalTweetId: tweetId,
    referrer: "bookmarks",
    with_rux_injections: false,
    rankingMode: "Relevance",
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  };
  const requestHeaders = await buildHeaders();
  const fieldToggles = {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false,
  };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(featureSet),
    fieldToggles: JSON.stringify(fieldToggles),
  });

  const url = `https://x.com/i/api/graphql/${queryId}/TweetDetail?${params}`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: requestHeaders,
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["xbt_auth_headers", "xbt_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleFetchTweetDetail(tweetId, true, _queryIdRetried);
    }
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`DETAIL_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json();

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("TweetDetail", "xbt_detail_query_id");
    if (freshId) return handleFetchTweetDetail(tweetId, _retried, true);
  }

  persistSeenTweetDisplayTypes(json).catch(() => {});
  return { data: json };
}

// ═══════════════════════════════════════════════════════════
// LIGHT SYNC SIGNAL
// ═══════════════════════════════════════════════════════════

const LIGHT_SYNC_DEBOUNCE_MS = 60_000;
const LIGHT_SYNC_THROTTLE_MS = 1000 * 60 * 30;
let lastLightSyncSignalAt = 0;

function maybeSignalLightSync() {
  const now = Date.now();
  if (now - lastLightSyncSignalAt < LIGHT_SYNC_DEBOUNCE_MS) return;
  lastLightSyncSignalAt = now;

  chrome.storage.local.get(["xbt_last_light_sync"], (stored) => {
    const lastSync = Number(stored.xbt_last_light_sync || 0);
    if (now - lastSync < LIGHT_SYNC_THROTTLE_MS) return;
    chrome.storage.local.set({ xbt_light_sync_needed: now });
  });
}

// ═══════════════════════════════════════════════════════════
// WEB REQUEST LISTENERS
// ═══════════════════════════════════════════════════════════

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) return;

    const headers = {};
    for (const header of details.requestHeaders) {
      const name = header.name.toLowerCase();
      if (CAPTURED_HEADERS.has(name)) {
        headers[name] = header.value;
      }
    }

    if (headers["authorization"] && headers["cookie"] && headers["x-csrf-token"]) {
      chrome.storage.local.set({
        xbt_auth_headers: headers,
        xbt_auth_time: Date.now(),
      });
      discoverAllMissingQueryIds().catch(() => {});
    }

    captureGraphqlEndpoint(details);

    // Capture bookmarks query ID + features
    const match = details.url.match(/\/i\/api\/graphql\/([^/]+)\/Bookmarks\?(.+)/);
    if (match) {
      const queryId = match[1];
      try {
        const params = new URLSearchParams(match[2]);
        const toStore = { xbt_query_id: queryId };
        const features = params.get("features");
        if (features) toStore.xbt_features = features;
        chrome.storage.local.set(toStore);
      } catch {
        chrome.storage.local.set({ xbt_query_id: queryId });
      }
    }

    // Capture TweetDetail query ID
    const detailMatch = details.url.match(/\/i\/api\/graphql\/([^/]+)\/TweetDetail/);
    if (detailMatch) {
      chrome.storage.local.set({ xbt_detail_query_id: detailMatch[1] });
    }

    const deleteMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/DeleteBookmark(?:\?|$)/,
    );
    if (deleteMatch) {
      chrome.storage.local.set({ xbt_delete_query_id: deleteMatch[1] });
    }

    const createMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/CreateBookmark(?:\?|$)/,
    );
    if (createMatch) {
      chrome.storage.local.set({ xbt_create_query_id: createMatch[1] });
    }

    const mutation = parseBookmarkMutation(details.url);
    if (mutation && !isExtensionInitiated(details)) {
      const referer = getHeaderValue(details.requestHeaders, "referer");
      const tweetId = extractTweetIdFromReferer(referer) || "";
      chrome.storage.local
        .set({
          xbt_last_mutation: {
            at: Date.now(),
            operation: mutation.operation,
            url: details.url,
            referer,
            tweetId,
            initiator: details.initiator || "",
          },
        })
        .catch(() => {});
      // Only push delete events here — they just need the tweetId for
      // local removal. Create events are pushed from onCompleted after
      // x.com confirms success so the page fetch finds the new bookmark.
      if (mutation.operation === "DeleteBookmark") {
        pushBookmarkEvent("DeleteBookmark", tweetId, "x.com-headers").catch(
          () => {},
        );
      }
    }

    if (!isExtensionInitiated(details)) {
      maybeSignalLightSync();
    }
  },
  { urls: ["https://x.com/i/api/graphql/*"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    captureBookmarkMutation(details).catch(() => {});
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
  ["requestBody"],
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    if (details.statusCode < 200 || details.statusCode >= 300) return;
    const mutation = parseBookmarkMutation(details.url);
    if (!mutation) return;

    chrome.storage.local
      .set({
        xbt_last_mutation_done: {
          at: Date.now(),
          operation: mutation.operation,
          url: details.url,
          statusCode: details.statusCode,
          initiator: details.initiator || "",
        },
      })
      .catch(() => {});

    // For creates, this is the right time to push the event — x.com has
    // confirmed the bookmark was created, so a page fetch will find it.
    // For deletes, onBeforeRequest already pushed the event with the
    // tweetId (targeted local removal, no API call needed).
    if (mutation.operation === "CreateBookmark") {
      pushBookmarkEvent("CreateBookmark", "", "x.com-completed").catch(() => {});
    }
  },
  {
    urls: [
      "https://x.com/i/api/graphql/*/DeleteBookmark*",
      "https://x.com/i/api/graphql/*/CreateBookmark*",
    ],
  },
);

// ═══════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHECK_AUTH") {
    handleCheckAuth().then(sendResponse);
    return true;
  }
  if (message.type === "START_AUTH_CAPTURE") {
    if (authTabId) {
      chrome.tabs.remove(authTabId).catch(() => {});
    }
    chrome.tabs.create({ url: "https://x.com/i/bookmarks", active: false }, (tab) => {
      authTabId = tab.id;
      sendResponse({ tabId: tab.id });
    });
    return true;
  }
  if (message.type === "CLOSE_AUTH_TAB") {
    if (authTabId) {
      chrome.tabs.remove(authTabId).catch(() => {});
      authTabId = null;
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "FETCH_BOOKMARKS") {
    handleFetchBookmarks(message.cursor, message.count)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "FETCH_TWEET_DETAIL") {
    handleFetchTweetDetail(message.tweetId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "DELETE_BOOKMARK") {
    handleDeleteBookmark(message.tweetId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "BOOKMARK_MUTATION") {
    handleBookmarkMutationMessage(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "DRAIN_BOOKMARK_EVENTS") {
    handleDrainBookmarkEvents()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "GET_BOOKMARK_EVENTS") {
    handleGetBookmarkEvents()
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "ACK_BOOKMARK_EVENTS") {
    handleAckBookmarkEvents(message.ids)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "STORE_QUERY_IDS") {
    const updates = {};
    if (typeof message.ids?.DeleteBookmark === "string" && message.ids.DeleteBookmark) {
      updates.xbt_delete_query_id = message.ids.DeleteBookmark;
    }
    if (typeof message.ids?.CreateBookmark === "string" && message.ids.CreateBookmark) {
      updates.xbt_create_query_id = message.ids.CreateBookmark;
    }
    if (typeof message.ids?.TweetDetail === "string" && message.ids.TweetDetail) {
      updates.xbt_detail_query_id = message.ids.TweetDetail;
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    } else {
      sendResponse({ ok: true });
    }
    return true;
  }
  if (message.type === "REAUTH_STATUS") {
    sendResponse({ inProgress: reauthInProgress });
    return false;
  }
  if (message.type === "RESET_SW_STATE") {
    graphqlCatalogCache = null;
    graphqlCatalogLoadPromise = null;
    catalogDirty = false;
    if (catalogFlushTimer) {
      clearTimeout(catalogFlushTimer);
      catalogFlushTimer = null;
    }
    if (authTabId) {
      chrome.tabs.remove(authTabId).catch(() => {});
      authTabId = null;
    }
    reauthInProgress = false;
    lastLightSyncSignalAt = 0;
    discoveryInProgress = false;
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// ═══════════════════════════════════════════════════════════
// COOKIE LISTENER & STARTUP
// ═══════════════════════════════════════════════════════════

chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo?.cookie;
  if (!cookie || cookie.name !== "twid") return;

  const domain = String(cookie.domain || "")
    .replace(/^\./, "")
    .toLowerCase();
  if (!domain.endsWith("x.com")) return;

  // Ignore remove events caused by overwrite to avoid flicker while the new value is set.
  if (changeInfo.removed && changeInfo.cause === "overwrite") return;

  syncAuthSessionFromCookie().catch(() => {});
});

runWeeklyServiceWorkerCleanup().catch(() => {});

// On startup, proactively discover missing query IDs if auth headers exist
chrome.storage.local.get(["xbt_auth_headers"], (stored) => {
  if (stored.xbt_auth_headers?.authorization) {
    discoverAllMissingQueryIds().catch(() => {});
  }
});
