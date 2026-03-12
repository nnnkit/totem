// ═══════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// @sync-with src/lib/constants/timing.ts — shared timing values
// @sync-with src/lib/storage-keys.ts    — storage key strings
// ═══════════════════════════════════════════════════════════

const CAPTURED_HEADERS = new Set([
  "authorization",
  "accept-language",
  "cookie",
  "x-csrf-token",
  "x-client-uuid",
  "x-client-transaction-id",
  "x-twitter-active-user",
  "x-twitter-auth-type",
  "x-twitter-client-language",
]);

// Key convention: totem_ prefix + snake_case.
// Keep in sync with src/lib/storage-keys.ts.
const GRAPHQL_CATALOG_STORAGE_KEY = "totem_graphql_catalog";
const GRAPHQL_CATALOG_VERSION = 1;
const MAX_GRAPHQL_ENDPOINTS = 300;
const MAX_CAPTURED_PARAM_LENGTH = 12000;
const CATALOG_FLUSH_DELAY_MS = 600;
const BOOKMARK_EVENTS_STORAGE_KEY = "totem_bookmark_events";
const MAX_BOOKMARK_EVENTS = 400;
const ACCOUNT_CONTEXT_STORAGE_KEY = "totem_account_context_id";
const AUTH_STATE_STORAGE_KEYS = [
  "totem_user_id",
  ACCOUNT_CONTEXT_STORAGE_KEY,
  "totem_auth_headers",
  "totem_auth_time",
  "totem_auth_state",
  "totem_auth_state_at",
  "totem_auth_state_reason",
];
const AUTH_STATE_LOGGED_OUT = "logged_out";
const AUTH_STATE_STALE = "stale";
const AUTH_STATE_AUTHENTICATED = "authenticated";
const AUTH_STATE_VALUES = new Set([
  AUTH_STATE_LOGGED_OUT,
  AUTH_STATE_STALE,
  AUTH_STATE_AUTHENTICATED,
]);
const AUTH_PROTECTED_OPERATIONS = new Set([
  "Bookmarks",
  "TweetDetail",
  "DeleteBookmark",
  "CreateBookmark",
]);
const AUTH_WEAK_NEGATIVE_WINDOW_MS = 10_000;
const AUTH_WEAK_NEGATIVE_THRESHOLD = 2;
const EXTENSION_REQUEST_TRACK_TTL_MS = 15_000;
const SYNC_ORCHESTRATOR_STORAGE_KEY = "totem_sync_orchestrator_state";
const SYNC_ORCHESTRATOR_VERSION = 1;
const SYNC_ORCHESTRATOR_LOCK_TTL_MS = 12 * 60 * 1000;
const SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS = 5 * 60 * 1000;
const SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS = 4 * 60 * 60 * 1000;
const SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS = 90_000;
const SYNC_ORCHESTRATOR_MANUAL_SUCCESS_COOLDOWN_MS = 15 * 60 * 1000;
const SYNC_ORCHESTRATOR_MANUAL_FAILURE_RETRY_MS = 30_000;
const SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_BASE_MS = 60_000;
const SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_MAX_MS = 15 * 60 * 1000;
const CACHE_SUMMARY_KEYS = [
  "totem_last_sync",
  "totem_last_light_sync",
  "totem_light_sync_needed",
  BOOKMARK_EVENTS_STORAGE_KEY,
];
const RUNTIME_AUDIT_STORAGE_KEY = "totem_runtime_audit";
const RUNTIME_STATE_V2_STORAGE_KEY = "totem_runtime_state_v2";
const RUNTIME_AUDIT_LIMIT = 60;
const WEEKLY_SW_CLEANUP_KEY = "totem_sw_cleanup_at";
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
// AUTH HELPERS
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

function getCookieHeaderValue(cookieHeader, name) {
  if (typeof cookieHeader !== "string" || !cookieHeader) return "";
  const prefix = `${name}=`;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return "";
}

let authTabId = null;
let reauthInProgress = false;
let authWeakNegativeHits = [];
const extensionInitiatedRequestMap = new Map();
const SYNC_ACCOUNT_ID_SANITIZE_RE = /[^A-Za-z0-9_-]/g;
let syncOrchestratorMutation = Promise.resolve();

function pruneTrackedExtensionRequests(now = Date.now()) {
  for (const [url, expiresAt] of extensionInitiatedRequestMap.entries()) {
    if (!url || expiresAt <= now) {
      extensionInitiatedRequestMap.delete(url);
    }
  }
}

function trackExtensionInitiatedRequest(url) {
  if (typeof url !== "string" || !url) return;
  const now = Date.now();
  pruneTrackedExtensionRequests(now);
  extensionInitiatedRequestMap.set(url, now + EXTENSION_REQUEST_TRACK_TTL_MS);
}

function isTrackedExtensionInitiatedRequest(url) {
  if (typeof url !== "string" || !url) return false;
  const now = Date.now();
  pruneTrackedExtensionRequests(now);
  const expiresAt = extensionInitiatedRequestMap.get(url);
  return typeof expiresAt === "number" && expiresAt > now;
}

function normalizeSyncAccountId(accountId) {
  if (typeof accountId !== "string") return null;
  const trimmed = accountId.trim();
  if (!trimmed) return null;
  const sanitized = trimmed.replace(SYNC_ACCOUNT_ID_SANITIZE_RE, "_").slice(0, 120);
  return sanitized || null;
}

function createEmptySyncAccountState() {
  return {
    inFlight: null,
    lastSuccessAt: 0,
    lastFullSyncAt: 0,
    lastIncrementalSyncAt: 0,
    manualCooldownUntil: 0,
    rateLimitBackoffUntil: 0,
    rateLimitConsecutive: 0,
    lastAttemptAt: 0,
    lastCompletedAt: 0,
    lastCompletedStatus: null,
    lastDecisionAt: 0,
    lastDecisionReason: null,
    lastError: null,
    lastFailureCode: null,
  };
}

function createEmptySyncOrchestratorState() {
  return {
    version: SYNC_ORCHESTRATOR_VERSION,
    accounts: {},
  };
}

function normalizeSyncOrchestratorState(raw) {
  const fallback = createEmptySyncOrchestratorState();
  if (!raw || typeof raw !== "object") return fallback;
  const root = raw;
  const accountsRaw =
    root.accounts && typeof root.accounts === "object" ? root.accounts : {};
  const state = {
    version:
      typeof root.version === "number" && Number.isFinite(root.version)
        ? root.version
        : SYNC_ORCHESTRATOR_VERSION,
    accounts: {},
  };

  for (const [key, value] of Object.entries(accountsRaw)) {
    const accountKey = normalizeSyncAccountId(key);
    if (!accountKey) continue;
    const account = value && typeof value === "object" ? value : {};
    const inFlightRaw = account.inFlight && typeof account.inFlight === "object"
      ? account.inFlight
      : null;
    const inFlight =
      inFlightRaw && typeof inFlightRaw.leaseId === "string" && inFlightRaw.leaseId
        ? {
            leaseId: inFlightRaw.leaseId,
            mode:
              inFlightRaw.mode === "full"
                ? "full"
                : inFlightRaw.mode === "quick"
                  ? "quick"
                  : "incremental",
            trigger: inFlightRaw.trigger === "manual" ? "manual" : "auto",
            reason:
              typeof inFlightRaw.reason === "string" && inFlightRaw.reason
                ? inFlightRaw.reason
                : "background_stale",
            startedAt:
              typeof inFlightRaw.startedAt === "number" &&
              Number.isFinite(inFlightRaw.startedAt)
                ? inFlightRaw.startedAt
                : 0,
          }
        : null;

    state.accounts[accountKey] = {
      inFlight,
      lastSuccessAt:
        typeof account.lastSuccessAt === "number" && Number.isFinite(account.lastSuccessAt)
          ? account.lastSuccessAt
          : 0,
      lastFullSyncAt:
        typeof account.lastFullSyncAt === "number" && Number.isFinite(account.lastFullSyncAt)
          ? account.lastFullSyncAt
          : 0,
      lastIncrementalSyncAt:
        typeof account.lastIncrementalSyncAt === "number" &&
        Number.isFinite(account.lastIncrementalSyncAt)
          ? account.lastIncrementalSyncAt
          : 0,
      manualCooldownUntil:
        typeof account.manualCooldownUntil === "number" &&
        Number.isFinite(account.manualCooldownUntil)
          ? account.manualCooldownUntil
          : 0,
      rateLimitBackoffUntil:
        typeof account.rateLimitBackoffUntil === "number" &&
        Number.isFinite(account.rateLimitBackoffUntil)
          ? account.rateLimitBackoffUntil
          : 0,
      rateLimitConsecutive:
        typeof account.rateLimitConsecutive === "number" &&
        Number.isFinite(account.rateLimitConsecutive)
          ? account.rateLimitConsecutive
          : 0,
      lastAttemptAt:
        typeof account.lastAttemptAt === "number" && Number.isFinite(account.lastAttemptAt)
          ? account.lastAttemptAt
          : 0,
      lastCompletedAt:
        typeof account.lastCompletedAt === "number" && Number.isFinite(account.lastCompletedAt)
          ? account.lastCompletedAt
          : 0,
      lastCompletedStatus:
        typeof account.lastCompletedStatus === "string" ? account.lastCompletedStatus : null,
      lastDecisionAt:
        typeof account.lastDecisionAt === "number" && Number.isFinite(account.lastDecisionAt)
          ? account.lastDecisionAt
          : 0,
      lastDecisionReason:
        typeof account.lastDecisionReason === "string" ? account.lastDecisionReason : null,
      lastError: typeof account.lastError === "string" ? account.lastError : null,
      lastFailureCode:
        typeof account.lastFailureCode === "string" ? account.lastFailureCode : null,
    };
  }

  return state;
}

async function readSyncOrchestratorState() {
  const stored = await chrome.storage.local.get([SYNC_ORCHESTRATOR_STORAGE_KEY]);
  return normalizeSyncOrchestratorState(stored[SYNC_ORCHESTRATOR_STORAGE_KEY]);
}

async function writeSyncOrchestratorState(state) {
  await chrome.storage.local.set({
    [SYNC_ORCHESTRATOR_STORAGE_KEY]: state,
  });
}

function withSyncOrchestratorLock(task) {
  const run = syncOrchestratorMutation.then(task, task);
  syncOrchestratorMutation = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function createSyncLeaseId(accountKey, now) {
  return `${accountKey}:${now}:${Math.random().toString(36).slice(2, 10)}`;
}

async function appendRuntimeAudit(entry) {
  const now = Date.now();
  const safeEntry = entry && typeof entry === "object" ? entry : {};
  const stored = await chrome.storage.local.get([RUNTIME_AUDIT_STORAGE_KEY]);
  const existing = Array.isArray(stored[RUNTIME_AUDIT_STORAGE_KEY])
    ? stored[RUNTIME_AUDIT_STORAGE_KEY]
    : [];
  const next = existing.concat({
    at: now,
    ...safeEntry,
  });
  if (next.length > RUNTIME_AUDIT_LIMIT) {
    next.splice(0, next.length - RUNTIME_AUDIT_LIMIT);
  }
  await chrome.storage.local.set({
    [RUNTIME_AUDIT_STORAGE_KEY]: next,
  });
}

async function hasCachedQueryIdNoNetwork(operationName) {
  const cached = queryIdMemCache.get(operationName);
  const now = Date.now();
  if (
    cached &&
    typeof cached.id === "string" &&
    cached.id &&
    now - Number(cached.ts || 0) < QUERY_ID_TTL_MS
  ) {
    return true;
  }

  const catalog = await loadGraphqlCatalog();
  const entries = Object.values(catalog.endpoints || {});
  for (const entry of entries) {
    if (
      entry &&
      entry.operation === operationName &&
      typeof entry.queryId === "string" &&
      entry.queryId
    ) {
      queryIdMemCache.set(operationName, { id: entry.queryId, ts: now });
      return true;
    }
  }
  return false;
}

async function getSessionSnapshot() {
  const stored = await chrome.storage.local.get([
    "totem_user_id",
    ACCOUNT_CONTEXT_STORAGE_KEY,
    "totem_auth_headers",
    "totem_auth_state",
    "totem_auth_state_at",
  ]);

  let userId =
    typeof stored.totem_user_id === "string" && stored.totem_user_id
      ? stored.totem_user_id
      : null;
  const hasAuthHeader = Boolean(stored.totem_auth_headers?.authorization);
  if (!userId && typeof stored.totem_auth_headers?.cookie === "string") {
    const twidRaw = getCookieHeaderValue(stored.totem_auth_headers.cookie, "twid");
    const parsedUserId = parseTwidUserId(twidRaw);
    if (parsedUserId) {
      userId = parsedUserId;
      chrome.storage.local
        .set({
          totem_user_id: parsedUserId,
          [ACCOUNT_CONTEXT_STORAGE_KEY]: parsedUserId,
        })
        .catch(() => {});
    }
  }
  const storedAccountContextId =
    typeof stored[ACCOUNT_CONTEXT_STORAGE_KEY] === "string" &&
    stored[ACCOUNT_CONTEXT_STORAGE_KEY]
      ? stored[ACCOUNT_CONTEXT_STORAGE_KEY]
      : null;
  const accountContextId = userId || storedAccountContextId;
  if (userId && storedAccountContextId !== userId) {
    chrome.storage.local.set({ [ACCOUNT_CONTEXT_STORAGE_KEY]: userId }).catch(() => {});
  }

  const authState = normalizeAuthState(stored.totem_auth_state, hasAuthHeader);
  const sessionState = authState === AUTH_STATE_LOGGED_OUT
    ? "logged_out"
    : hasAuthHeader || authState === AUTH_STATE_AUTHENTICATED
      ? "logged_in"
      : "unknown";

  const bookmarksReady = sessionState === "logged_in"
    ? await hasCachedQueryIdNoNetwork("Bookmarks").catch(() => false)
    : false;

  return {
    userId,
    accountContextId,
    authState,
    sessionState,
    capability: {
      bookmarksApi: sessionState === "logged_in"
        ? (bookmarksReady ? "ready" : "blocked")
        : "unknown",
      detailApi: "unknown",
    },
    hasAuthHeader,
  };
}

function deriveAuthPhaseFromSession(sessionState) {
  if (sessionState === "logged_out") return "need_login";
  if (sessionState === "logged_in") return "ready";
  return "connecting";
}

function getSyncBlockedReason(sessionSnapshot, account, accountKey, now) {
  if (!accountKey) return "no_account";

  if (
    sessionSnapshot.sessionState !== "logged_in" ||
    sessionSnapshot.capability.bookmarksApi !== "ready"
  ) {
    return "not_ready";
  }

  if (account && Number(account.rateLimitBackoffUntil || 0) > now) {
    return "rate_limited";
  }

  if (account?.inFlight) {
    const startedAt = Number(account.inFlight.startedAt || 0);
    const lockAge = now - startedAt;
    if (lockAge < SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS) {
      return "in_flight";
    }
  }

  if (
    account &&
    Number(account.manualCooldownUntil || 0) > now
  ) {
    return "cooldown";
  }

  return null;
}

async function buildRuntimeSnapshot(stateOverride = null, accountContextOverride = null) {
  const now = Date.now();
  const sessionSnapshot = await getSessionSnapshot();
  const requestedAccountContextId = normalizeSyncAccountId(accountContextOverride);
  const accountContextId = requestedAccountContextId || sessionSnapshot.accountContextId;
  const accountKey = normalizeSyncAccountId(accountContextId);
  const state = stateOverride || (await readSyncOrchestratorState());
  const account = accountKey
    ? state.accounts[accountKey] || createEmptySyncAccountState()
    : null;
  const blockedReason = getSyncBlockedReason(
    sessionSnapshot,
    account,
    accountKey,
    now,
  );

  const cacheStored = await chrome.storage.local.get(CACHE_SUMMARY_KEYS);
  const events = Array.isArray(cacheStored[BOOKMARK_EVENTS_STORAGE_KEY])
    ? cacheStored[BOOKMARK_EVENTS_STORAGE_KEY]
    : [];

  return {
    sessionState: sessionSnapshot.sessionState,
    authPhase: deriveAuthPhaseFromSession(sessionSnapshot.sessionState),
    accountContextId,
    capability: sessionSnapshot.capability,
    syncPolicy: {
      accountKey,
      inFlight: account?.inFlight
        ? {
            leaseId: account.inFlight.leaseId,
            mode:
              account.inFlight.mode === "full"
                ? "full"
                : account.inFlight.mode === "quick"
                  ? "quick"
                  : "incremental",
            trigger: account.inFlight.trigger === "manual" ? "manual" : "auto",
            startedAt: Number(account.inFlight.startedAt || 0),
          }
        : null,
      lastAttemptAt: Number(account?.lastAttemptAt || 0),
      lastSuccessAt: Number(account?.lastSuccessAt || 0),
      blockedReason,
    },
    blockedReason,
    cacheSummary: {
      lastSyncAt: Number(cacheStored.totem_last_sync || 0),
      lastSoftSyncAt: Number(cacheStored.totem_last_light_sync || 0),
      lightSyncNeededAt: Number(cacheStored.totem_light_sync_needed || 0),
      pendingBookmarkEventCount: events.length,
    },
  };
}

async function persistRuntimeStateV2(snapshot) {
  const payload = snapshot && typeof snapshot === "object" ? snapshot : {};
  const safeCapability =
    payload.capability && typeof payload.capability === "object"
      ? payload.capability
      : { bookmarksApi: "unknown", detailApi: "unknown" };
  const safeSyncPolicy =
    payload.syncPolicy && typeof payload.syncPolicy === "object"
      ? payload.syncPolicy
      : {
          accountKey: null,
          inFlight: null,
          lastAttemptAt: 0,
          lastSuccessAt: 0,
          blockedReason: null,
        };
  const safeCacheSummary =
    payload.cacheSummary && typeof payload.cacheSummary === "object"
      ? payload.cacheSummary
      : {
          lastSyncAt: 0,
          lastSoftSyncAt: 0,
          lightSyncNeededAt: 0,
          pendingBookmarkEventCount: 0,
        };

  await chrome.storage.local.set({
    [RUNTIME_STATE_V2_STORAGE_KEY]: {
      version: 2,
      updatedAt: Date.now(),
      ...payload,
      auth: {
        sessionState: payload.sessionState || "unknown",
        authPhase: payload.authPhase || "connecting",
        capability: safeCapability,
      },
      accountContext: {
        id: payload.accountContextId || null,
      },
      sync: {
        policy: safeSyncPolicy,
        blockedReason:
          typeof payload.blockedReason === "string" ? payload.blockedReason : null,
      },
      cacheSummary: safeCacheSummary,
      // Jobs registry scaffold: add future jobs here without changing auth/sync
      // reducers that consume the top-level compatibility payload.
      jobs: {
        bookmark_sync: {
          kind: "bookmark_sync",
          accountKey:
            typeof safeSyncPolicy.accountKey === "string"
              ? safeSyncPolicy.accountKey
              : null,
          inFlight: safeSyncPolicy.inFlight || null,
          lastAttemptAt: Number(safeSyncPolicy.lastAttemptAt || 0),
          lastSuccessAt: Number(safeSyncPolicy.lastSuccessAt || 0),
        },
      },
      auditLog: {
        storageKey: RUNTIME_AUDIT_STORAGE_KEY,
        limit: RUNTIME_AUDIT_LIMIT,
      },
    },
  });
}

async function normalizeRuntimeStateV2OnStartup() {
  const stored = await chrome.storage.local.get([RUNTIME_STATE_V2_STORAGE_KEY]);
  const existing = stored[RUNTIME_STATE_V2_STORAGE_KEY];
  if (
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    existing.version === 2 &&
    typeof existing.sessionState === "string"
  ) {
    return;
  }

  const snapshot = await buildRuntimeSnapshot().catch(() => null);
  if (snapshot) {
    await persistRuntimeStateV2(snapshot).catch(() => {});
  }
}

async function handleSyncPolicyReserve(message = {}) {
  return withSyncOrchestratorLock(async () => {
    const now = Date.now();
    const trigger = message.trigger === "manual" ? "manual" : "auto";
    const requestedMode =
      message.requestedMode === "incremental"
        ? "incremental"
        : message.requestedMode === "quick"
          ? "quick"
          : message.requestedMode === "full"
            ? "full"
            : null;
    const localCount =
      typeof message.localCount === "number" && Number.isFinite(message.localCount)
        ? message.localCount
        : 0;

    const state = await readSyncOrchestratorState();
    let sessionSnapshot = await getSessionSnapshot();
    const accountKey = normalizeSyncAccountId(
      message.accountId || sessionSnapshot.accountContextId,
    );

    const retryAfterFor = (reason, account) => {
      if (!account || typeof account !== "object") return 0;
      if (reason === "cooldown") {
        return Math.max(0, Number(account.manualCooldownUntil || 0) - now);
      }
      if (reason === "rate_limited") {
        return Math.max(0, Number(account.rateLimitBackoffUntil || 0) - now);
      }
      if (reason === "in_flight" && account.inFlight) {
        const startedAt = Number(account.inFlight.startedAt || 0);
        if (!startedAt) return 0;
        if (trigger === "manual") {
          return Math.max(0, startedAt + SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS - now);
        }
        return Math.max(0, startedAt + SYNC_ORCHESTRATOR_LOCK_TTL_MS - now);
      }
      if (reason === "auto_backoff") {
        return Math.max(
          0,
          Number(account.lastAttemptAt || 0) + SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS - now,
        );
      }
      if (reason === "fresh_cache") {
        return Math.max(
          0,
          Number(account.lastSuccessAt || 0) + SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS - now,
        );
      }
      return 0;
    };

    const returnBlocked = async (reason, account) => {
      const safeAccountKey = accountKey || "__none__";
      const retryAfterMs = retryAfterFor(reason, account);
      if (accountKey) {
        state.accounts[accountKey] = {
          ...(account || createEmptySyncAccountState()),
          lastDecisionAt: now,
          lastDecisionReason: reason,
        };
        await writeSyncOrchestratorState(state);
      }
      const snapshot = await buildRuntimeSnapshot(state).catch(() => null);
      if (snapshot) {
        await persistRuntimeStateV2(snapshot).catch(() => {});
      }
      await appendRuntimeAudit({
        kind: "sync_reserve",
        allow: false,
        trigger,
        reason,
        accountKey: safeAccountKey,
        retryAfterMs,
      }).catch(() => {});
      return {
        ok: true,
        allow: false,
        mode: null,
        reason,
        accountKey: safeAccountKey,
        retryAfterMs,
      };
    };

    if (!accountKey) {
      return returnBlocked("no_account");
    }

    let account = state.accounts[accountKey] || createEmptySyncAccountState();
    if (
      trigger === "manual" &&
      sessionSnapshot.sessionState === "logged_in" &&
      sessionSnapshot.capability.bookmarksApi !== "ready"
    ) {
      await discoverAllMissingQueryIds().catch(() => {});
      sessionSnapshot = await getSessionSnapshot();
    }

    if (
      sessionSnapshot.sessionState !== "logged_in" ||
      sessionSnapshot.capability.bookmarksApi !== "ready"
    ) {
      return returnBlocked("not_ready", account);
    }

    if (
      account.inFlight &&
      now - Number(account.inFlight.startedAt || 0) >= SYNC_ORCHESTRATOR_LOCK_TTL_MS
    ) {
      account = { ...account, inFlight: null };
    }

    if (account.inFlight) {
      const canReclaimManualLock =
        trigger === "manual" &&
        now - Number(account.inFlight.startedAt || 0) >=
          SYNC_ORCHESTRATOR_MANUAL_RECLAIM_MS;
      if (canReclaimManualLock) {
        account = { ...account, inFlight: null };
      } else {
        return returnBlocked("in_flight", account);
      }
    }

    if (Number(account.rateLimitBackoffUntil || 0) > now) {
      return returnBlocked("rate_limited", account);
    }

    if (
      trigger === "manual" &&
      Number(account.manualCooldownUntil || 0) > now
    ) {
      return returnBlocked("cooldown", account);
    }

    let mode = null;
    let reason = "fresh_cache";

    if (trigger === "manual") {
      mode = requestedMode || "quick";
      reason = "manual";
    } else if (localCount <= 0) {
      if (
        account.lastAttemptAt > 0 &&
        now - account.lastAttemptAt < SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS
      ) {
        return returnBlocked("auto_backoff", account);
      }
      mode = "full";
      reason = "bootstrap_empty";
    } else {
      if (
        account.lastSuccessAt > 0 &&
        now - account.lastSuccessAt < SYNC_ORCHESTRATOR_AUTO_INTERVAL_MS
      ) {
        return returnBlocked("fresh_cache", account);
      }
      if (
        account.lastAttemptAt > 0 &&
        now - account.lastAttemptAt < SYNC_ORCHESTRATOR_AUTO_BACKOFF_MS
      ) {
        return returnBlocked("auto_backoff", account);
      }
      mode = "incremental";
      reason = "background_stale";
    }

    const leaseId = createSyncLeaseId(accountKey, now);
    state.accounts[accountKey] = {
      ...account,
      inFlight: {
        leaseId,
        mode,
        trigger,
        reason,
        startedAt: now,
      },
      lastAttemptAt: now,
      lastDecisionAt: now,
      lastDecisionReason: reason,
    };
    await writeSyncOrchestratorState(state);
    const snapshot = await buildRuntimeSnapshot(state).catch(() => null);
    if (snapshot) {
      await persistRuntimeStateV2(snapshot).catch(() => {});
    }
    await appendRuntimeAudit({
      kind: "sync_reserve",
      allow: true,
      trigger,
      reason,
      mode,
      leaseId,
      accountKey,
    }).catch(() => {});

    return { ok: true, allow: true, mode, reason, leaseId, accountKey };
  });
}

async function handleSyncPolicyComplete(message = {}) {
  return withSyncOrchestratorLock(async () => {
    const accountKey = normalizeSyncAccountId(message.accountId);
    if (!accountKey) return { ok: true, ignored: true, reason: "no_account" };

    const leaseId = typeof message.leaseId === "string" ? message.leaseId : "";
    const trigger = message.trigger === "manual" ? "manual" : "auto";
    const mode =
      message.mode === "full"
        ? "full"
        : message.mode === "quick"
          ? "quick"
          : "incremental";
    const status =
      message.status === "success" ||
      message.status === "failure" ||
      message.status === "timeout" ||
      message.status === "skipped"
        ? message.status
        : "failure";
    const errorCode =
      typeof message.errorCode === "string" && message.errorCode
        ? message.errorCode.slice(0, 120)
        : "";
    const isRateLimited = errorCode === "RATE_LIMITED";
    const isIncompleteFullSync = errorCode === "INCOMPLETE_FULL_SYNC";

    const state = await readSyncOrchestratorState();
    const account = state.accounts[accountKey];
    if (!account || !account.inFlight) {
      const snapshot = await buildRuntimeSnapshot(state).catch(() => null);
      if (snapshot) {
        await persistRuntimeStateV2(snapshot).catch(() => {});
      }
      await appendRuntimeAudit({
        kind: "sync_complete",
        ignored: true,
        reason: "missing_inflight",
        accountKey,
      }).catch(() => {});
      return { ok: true, ignored: true, reason: "missing_inflight" };
    }
    if (!leaseId || account.inFlight.leaseId !== leaseId) {
      const snapshot = await buildRuntimeSnapshot(state).catch(() => null);
      if (snapshot) {
        await persistRuntimeStateV2(snapshot).catch(() => {});
      }
      await appendRuntimeAudit({
        kind: "sync_complete",
        ignored: true,
        reason: "lease_mismatch",
        accountKey,
      }).catch(() => {});
      return { ok: true, ignored: true, reason: "lease_mismatch" };
    }

    const now = Date.now();
    const next = {
      ...account,
      inFlight: null,
      lastCompletedAt: now,
      lastCompletedStatus: status,
    };

    if (status === "success") {
      next.lastSuccessAt = now;
      if (mode === "full") {
        next.lastFullSyncAt = now;
      } else {
        next.lastIncrementalSyncAt = now;
      }
      if (trigger === "manual") {
        next.manualCooldownUntil = now + SYNC_ORCHESTRATOR_MANUAL_SUCCESS_COOLDOWN_MS;
      }
      next.rateLimitConsecutive = 0;
      next.rateLimitBackoffUntil = 0;
      next.lastError = null;
      next.lastFailureCode = null;
    } else if (status !== "skipped") {
      next.lastError = status;
      next.lastFailureCode = errorCode || null;
      if (trigger === "manual" && !isIncompleteFullSync) {
        next.manualCooldownUntil = Math.max(
          Number(next.manualCooldownUntil || 0),
          now + SYNC_ORCHESTRATOR_MANUAL_FAILURE_RETRY_MS,
        );
      }
      if (isRateLimited) {
        const nextStreak = Math.max(1, Number(next.rateLimitConsecutive || 0) + 1);
        const backoffMs = Math.min(
          SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(2, nextStreak - 1),
          SYNC_ORCHESTRATOR_RATE_LIMIT_BACKOFF_MAX_MS,
        );
        next.rateLimitConsecutive = nextStreak;
        next.rateLimitBackoffUntil = now + backoffMs;
        next.manualCooldownUntil = Math.max(
          Number(next.manualCooldownUntil || 0),
          next.rateLimitBackoffUntil,
        );
      } else {
        next.rateLimitConsecutive = 0;
        next.rateLimitBackoffUntil = 0;
      }
    }

    state.accounts[accountKey] = next;
    await writeSyncOrchestratorState(state);
    const snapshot = await buildRuntimeSnapshot(state).catch(() => null);
    if (snapshot) {
      await persistRuntimeStateV2(snapshot).catch(() => {});
    }
    await appendRuntimeAudit({
      kind: "sync_complete",
      ignored: false,
      status,
      mode,
      trigger,
      errorCode: errorCode || null,
      leaseId,
      accountKey,
    }).catch(() => {});
    return { ok: true };
  });
}

function normalizeAuthState(state, hasAuthHeader) {
  if (AUTH_STATE_VALUES.has(state)) return state;
  return hasAuthHeader ? AUTH_STATE_STALE : AUTH_STATE_LOGGED_OUT;
}

async function setAuthState(state, reason, options = {}) {
  const now = Date.now();
  const safeReason = typeof reason === "string" && reason ? reason.slice(0, 120) : "";
  const updates = {
    totem_auth_state: state,
    totem_auth_state_at: now,
    totem_auth_state_reason: safeReason,
  };
  if (options.clearAuth) {
    await Promise.all([
      chrome.storage.local.set(updates),
      chrome.storage.local.remove(["totem_auth_headers", "totem_auth_time"]),
    ]);
    return;
  }
  await chrome.storage.local.set(updates);
}

function resetWeakAuthSignals() {
  authWeakNegativeHits = [];
}

function extractGraphqlOperationName(urlString) {
  const match = String(urlString || "").match(/\/i\/api\/graphql\/[^/]+\/([^/?]+)/);
  return match?.[1] || "";
}

function isAuthProtectedGraphqlOperation(urlString) {
  const operation = extractGraphqlOperationName(urlString);
  return AUTH_PROTECTED_OPERATIONS.has(operation);
}

async function markAuthAuthenticated(reason = "auth_signal") {
  resetWeakAuthSignals();
  await setAuthState(AUTH_STATE_AUTHENTICATED, reason);
}

async function markAuthLoggedOut(reason = "auth_missing", clearAuth = true) {
  resetWeakAuthSignals();
  await setAuthState(AUTH_STATE_LOGGED_OUT, reason, { clearAuth });
}

function recordWeakAuthNegativeSignal(reason) {
  const now = Date.now();
  authWeakNegativeHits = authWeakNegativeHits.filter(
    (ts) => now - ts <= AUTH_WEAK_NEGATIVE_WINDOW_MS,
  );
  authWeakNegativeHits.push(now);
  if (authWeakNegativeHits.length < AUTH_WEAK_NEGATIVE_THRESHOLD) {
    return Promise.resolve();
  }
  authWeakNegativeHits = [];
  return markAuthLoggedOut(reason, true).catch(() => {});
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
      const authHeaders = changes.totem_auth_headers?.newValue;
      const hasAuth = Boolean(
        authHeaders &&
        typeof authHeaders === "object" &&
        authHeaders.authorization,
      );
      if (hasAuth && !resolved) {
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

async function buildHeaders(options = {}) {
  const stored = await chrome.storage.local.get(["totem_auth_headers"]);
  const auth = stored.totem_auth_headers;
  if (!auth?.authorization) throw new Error("NO_AUTH");

  const includeClientTransactionId = options.includeClientTransactionId !== false;
  const headers = {
    accept: "*/*",
    authorization: auth["authorization"],
    "x-csrf-token": auth["x-csrf-token"],
    "x-twitter-active-user": auth["x-twitter-active-user"] || "yes",
    "x-twitter-auth-type": auth["x-twitter-auth-type"] || "OAuth2Session",
    "x-twitter-client-language": auth["x-twitter-client-language"] || "en",
    "content-type": "application/json",
  };

  if (auth["accept-language"]) headers["accept-language"] = auth["accept-language"];
  if (auth["cookie"]) headers["cookie"] = auth["cookie"];
  if (auth["x-client-uuid"]) headers["x-client-uuid"] = auth["x-client-uuid"];
  // x.com generates this token. Replaying the captured value is safer than
  // mutating it into an opaque value the mutation endpoint can reject.
  if (includeClientTransactionId && auth["x-client-transaction-id"]) {
    headers["x-client-transaction-id"] = auth["x-client-transaction-id"];
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

function hasGraphqlErrors(json) {
  return Array.isArray(json?.errors) && json.errors.length > 0;
}

function summarizeGraphqlErrors(json) {
  if (!hasGraphqlErrors(json)) return "";
  return json.errors
    .map((error) => {
      if (!error || typeof error !== "object") return "";
      const message =
        typeof error.message === "string" && error.message
          ? error.message
          : typeof error.code === "string" && error.code
            ? error.code
            : "";
      const extensionCode =
        typeof error.extensions?.code === "string" ? error.extensions.code : "";
      return extensionCode && extensionCode !== message
        ? `${extensionCode}: ${message}`.trim()
        : message;
    })
    .filter(Boolean)
    .join("; ")
    .slice(0, 240);
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
  const escaped = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match queryId:"<id>",operationName:"<name>"
  const pattern = new RegExp(
    'queryId\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']\\s*,\\s*operationName\\s*:\\s*["\']' +
      escaped +
      '["\']',
  );
  const match = text.match(pattern);
  if (match) return match[1];
  // Also try reversed order: operationName:"<name>",...,queryId:"<id>"
  const reversed = new RegExp(
    'operationName\\s*:\\s*["\']' +
      escaped +
      '["\']\\s*,\\s*(?:queryId|operationId)\\s*:\\s*["\']([A-Za-z0-9_\\-]{10,50})["\']',
  );
  const revMatch = text.match(reversed);
  return revMatch ? revMatch[1] : null;
}

// ═══════════════════════════════════════════════════════════
// QUERY ID RESOLUTION — unified fallback chain
// ═══════════════════════════════════════════════════════════

async function resolveQueryId(operationName) {
  // 1. Check in-memory cache (10min TTL, reset each SW wake)
  const cached = queryIdMemCache.get(operationName);
  if (cached && Date.now() - cached.ts < QUERY_ID_TTL_MS) {
    return cached.id;
  }

  // 2. Check GraphQL catalog (passively captured from x.com requests)
  const catalog = await loadGraphqlCatalog();
  for (const entry of Object.values(catalog.endpoints || {})) {
    if (entry && entry.operation === operationName && entry.queryId) {
      queryIdMemCache.set(operationName, { id: entry.queryId, ts: Date.now() });
      return entry.queryId;
    }
  }

  // 3. Discover from x.com JS bundles (network fetch, 2-5s)
  const discovered = await discoverQueryIdFromBundles(operationName).catch(() => null);
  if (discovered) {
    queryIdMemCache.set(operationName, { id: discovered, ts: Date.now() });
    return discovered;
  }

  return null;
}

async function forceRediscoverQueryId(operationName) {
  queryIdMemCache.delete(operationName);

  const freshId = await discoverQueryIdFromBundles(operationName).catch(
    () => null,
  );
  if (freshId) {
    queryIdMemCache.set(operationName, { id: freshId, ts: Date.now() });
  }
  return freshId;
}

// ═══════════════════════════════════════════════════════════
// PROACTIVE BATCH DISCOVERY — find all missing query IDs
// ═══════════════════════════════════════════════════════════

let discoveryInProgress = false;

const QUERY_ID_OPS = ["DeleteBookmark", "CreateBookmark", "TweetDetail", "Bookmarks"];

async function discoverAllMissingQueryIds() {
  if (discoveryInProgress) return;
  discoveryInProgress = true;

  try {
    // Only discover operations not already in the in-memory cache
    const now = Date.now();
    const missing = QUERY_ID_OPS.filter((op) => {
      const cached = queryIdMemCache.get(op);
      return !cached || now - cached.ts >= QUERY_ID_TTL_MS;
    });
    if (missing.length === 0) return;

    // Check GraphQL catalog first (passively captured from real x.com requests)
    const catalog = await loadGraphqlCatalog();
    const stillMissing = [];

    for (const op of missing) {
      let found = false;
      for (const entry of Object.values(catalog.endpoints || {})) {
        if (entry && entry.operation === op && entry.queryId) {
          queryIdMemCache.set(op, { id: entry.queryId, ts: now });
          found = true;
          break;
        }
      }
      if (!found) stillMissing.push(op);
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

    const remaining = new Set(stillMissing);

    for (const url of scriptUrls) {
      if (remaining.size === 0) break;
      try {
        const jsResp = await fetch(url);
        if (!jsResp.ok) continue;
        const text = await jsResp.text();

        for (const opName of remaining) {
          const qid = extractQueryIdForOperation(text, opName);
          if (qid) {
            queryIdMemCache.set(opName, { id: qid, ts: Date.now() });
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
  const confirmed = message?.confirmed === true;

  // CreateBookmark events are only pushed from onCompleted (after x.com
  // confirms success). Pushing here would trigger a page fetch before
  // x.com has processed the bookmark, finding nothing new.
  if (operation === "CreateBookmark") {
    if (!confirmed) return { ok: true };
    const tweetId = typeof message?.tweetId === "string" ? message.tweetId : "";
    const source = typeof message?.source === "string" ? message.source : "content-script";
    await pushBookmarkEvent(operation, tweetId, source);
    return { ok: true };
  }

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
  const byInitiator = (
    typeof details?.initiator === "string" &&
    details.initiator.startsWith("chrome-extension://")
  );
  if (byInitiator) return true;
  return isTrackedExtensionInitiatedRequest(details?.url);
}

async function captureBookmarkMutation(details) {
  if (isExtensionInitiated(details)) return;
  const mutation = parseBookmarkMutation(details.url);
  if (!mutation) return;

  const tweetId = extractTweetIdFromRequestBody(details.requestBody) || "";

  // Cache the query ID from live x.com traffic — most trustworthy source
  queryIdMemCache.set(mutation.operation, { id: mutation.queryId, ts: Date.now() });

  if (mutation.operation === "DeleteBookmark") {
    await pushBookmarkEvent("DeleteBookmark", tweetId, "x.com");
  }

  // Don't push CreateBookmark event here — onBeforeRequest fires BEFORE x.com
  // processes the request. The page fetch would find nothing new.
  // CreateBookmark events are pushed from onCompleted instead.
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
// ONE-TIME MIGRATION: tw_ / xbt_ → totem_ storage keys
// ═══════════════════════════════════════════════════════════

const TW_TO_TOTEM_KEY_MAP = {
  tw_graphql_catalog: "totem_graphql_catalog",
  tw_auth_headers: "totem_auth_headers",
  tw_auth_time: "totem_auth_time",
  tw_auth_state: "totem_auth_state",
  tw_query_id: "totem_query_id",
  tw_features: "totem_features",
  tw_detail_query_id: "totem_detail_query_id",
  tw_delete_query_id: "totem_delete_query_id",
  tw_create_query_id: "totem_create_query_id",
  tw_bookmark_events: "totem_bookmark_events",
  current_user_id: "totem_user_id",
  tw_weekly_cleanup_at: "totem_sw_cleanup_at",
};

const XBT_TO_TOTEM_KEY_MAP = {
  xbt_graphql_catalog: "totem_graphql_catalog",
  xbt_auth_headers: "totem_auth_headers",
  xbt_auth_time: "totem_auth_time",
  xbt_auth_state: "totem_auth_state",
  xbt_query_id: "totem_query_id",
  xbt_features: "totem_features",
  xbt_detail_query_id: "totem_detail_query_id",
  xbt_delete_query_id: "totem_delete_query_id",
  xbt_create_query_id: "totem_create_query_id",
  xbt_bookmark_events: "totem_bookmark_events",
  xbt_user_id: "totem_user_id",
  xbt_sw_cleanup_at: "totem_sw_cleanup_at",
  xbt_db_cleanup_at: "totem_db_cleanup_at",
  xbt_last_reconcile: "totem_last_reconcile",
  xbt_last_sync: "totem_last_sync",
  xbt_last_light_sync: "totem_last_light_sync",
  xbt_light_sync_needed: "totem_light_sync_needed",
  xbt_sync_orchestrator_state: "totem_sync_orchestrator_state",
  xbt_last_mutation: "totem_last_mutation",
  xbt_last_mutation_done: "totem_last_mutation_done",
};

async function migrateOldStorageKeys() {
  const legacyKeyMap = {
    ...TW_TO_TOTEM_KEY_MAP,
    ...XBT_TO_TOTEM_KEY_MAP,
  };

  const oldKeys = Object.keys(legacyKeyMap);
  const newKeys = Object.values(legacyKeyMap);
  const stored = await chrome.storage.local.get([...oldKeys, ...newKeys]);
  const updates = {};
  const toRemove = [];

  for (const [oldKey, newKey] of Object.entries(legacyKeyMap)) {
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
  const snapshot = await getSessionSnapshot();
  const responseUserId = snapshot.sessionState === "logged_out" ? null : snapshot.userId;
  const hasUser =
    snapshot.sessionState !== "logged_out" &&
    Boolean(responseUserId || snapshot.hasAuthHeader);

  return {
    hasUser,
    hasAuth: snapshot.sessionState === "logged_in" && snapshot.hasAuthHeader,
    hasQueryId: snapshot.capability.bookmarksApi === "ready",
    userId: responseUserId,
    accountContextId: snapshot.accountContextId,
    authState: snapshot.authState,
    sessionState: snapshot.sessionState,
    capability: snapshot.capability,
  };
}

async function handleGetRuntimeSnapshot(message = {}) {
  const requestedAccountId =
    typeof message.accountId === "string" ? message.accountId : null;
  const snapshot = await buildRuntimeSnapshot(null, requestedAccountId);
  if (!requestedAccountId) {
    await persistRuntimeStateV2(snapshot).catch(() => {});
  }
  return { ok: true, data: snapshot };
}

async function handleSetAccountContext(message = {}) {
  const accountContextId = normalizeSyncAccountId(message.accountId);
  if (!accountContextId) {
    return { ok: false, error: "INVALID_ACCOUNT_CONTEXT" };
  }

  await chrome.storage.local.set({
    [ACCOUNT_CONTEXT_STORAGE_KEY]: accountContextId,
  });
  const snapshot = await buildRuntimeSnapshot(null, accountContextId).catch(() => null);
  if (snapshot) {
    await persistRuntimeStateV2(snapshot).catch(() => {});
  }
  return { ok: true, accountContextId };
}

async function handleFetchBookmarks(cursor, count, _retried = false, _queryIdRetried = false) {
  const stored = await chrome.storage.local.get([
    "totem_auth_headers",
    "totem_features",
  ]);

  if (!stored.totem_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("Bookmarks");
  if (!queryId) throw new Error("NO_QUERY_ID");

  const pageCount = typeof count === "number" && count > 0 ? count : 100;
  const variables = { count: pageCount, includePromotedContent: true };
  if (cursor) variables.cursor = cursor;

  const features = stored.totem_features || JSON.stringify(DEFAULT_FEATURES);

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: features,
  });

  const url = `https://x.com/i/api/graphql/${queryId}/Bookmarks?${params}`;
  const requestHeaders = await buildHeaders();

  trackExtensionInitiatedRequest(url);
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: requestHeaders,
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["totem_auth_headers", "totem_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleFetchBookmarks(cursor, count, true, _queryIdRetried);
    }
    await markAuthLoggedOut(`bookmarks_${response.status}`, true);
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    if (!_queryIdRetried && response.status === 400) {
      const freshId = await forceRediscoverQueryId("Bookmarks");
      if (freshId && freshId !== queryId) return handleFetchBookmarks(cursor, count, _retried, true);
    }
    const body = await response.text().catch(() => "");
    throw new Error(`API_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  await markAuthAuthenticated("bookmarks_ok");

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("Bookmarks");
    if (freshId) return handleFetchBookmarks(cursor, count, _retried, true);
  }

  return { data: json };
}

async function handleDeleteBookmark(tweetId, _retried = false, _queryIdRetried = false) {
  if (!tweetId) throw new Error("MISSING_TWEET_ID");

  const stored = await chrome.storage.local.get(["totem_auth_headers"]);
  if (!stored.totem_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("DeleteBookmark");
  if (!queryId) throw new Error("NO_QUERY_ID");
  const requestHeaders = await buildHeaders();

  const url = `https://x.com/i/api/graphql/${queryId}/DeleteBookmark`;
  trackExtensionInitiatedRequest(url);
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
      await chrome.storage.local.remove(["totem_auth_headers", "totem_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleDeleteBookmark(tweetId, true, _queryIdRetried);
    }
    await markAuthLoggedOut(`delete_${response.status}`, true);
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    // HTTP 400 from a wrong query ID — force rediscover and retry once
    if (!_queryIdRetried && response.status === 400) {
      const freshId = await forceRediscoverQueryId("DeleteBookmark");
      if (freshId && freshId !== queryId) return handleDeleteBookmark(tweetId, _retried, true);
    }
    const body = await response.text().catch(() => "");
    throw new Error(`DELETE_BOOKMARK_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json().catch(() => null);
  await markAuthAuthenticated("delete_ok");

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("DeleteBookmark");
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

async function handleFetchTweetDetail(tweetId, _retried = false, _queryIdRetried = false) {
  const stored = await chrome.storage.local.get([
    "totem_auth_headers",
    "totem_features",
  ]);

  if (!stored.totem_auth_headers?.authorization) throw new Error("NO_AUTH");

  const queryId = await resolveQueryId("TweetDetail");
  if (!queryId) throw new Error("NO_QUERY_ID");

  const featureSet = {
    ...DEFAULT_FEATURES,
    ...parseFeatureSet(stored.totem_features),
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
  trackExtensionInitiatedRequest(url);
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: requestHeaders,
  });

  if (response.status === 401 || response.status === 403) {
    if (!_retried) {
      await chrome.storage.local.remove(["totem_auth_headers", "totem_auth_time"]);
      const success = await reAuthSilently();
      if (success) return handleFetchTweetDetail(tweetId, true, _queryIdRetried);
    }
    await markAuthLoggedOut(`detail_${response.status}`, true);
    throw new Error("AUTH_EXPIRED");
  }

  if (!response.ok) {
    if (!_queryIdRetried && response.status === 400) {
      const freshId = await forceRediscoverQueryId("TweetDetail");
      if (freshId && freshId !== queryId) return handleFetchTweetDetail(tweetId, _retried, true);
    }
    const body = await response.text().catch(() => "");
    throw new Error(`DETAIL_ERROR_${response.status}: ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  await markAuthAuthenticated("detail_ok");

  if (!_queryIdRetried && isQueryIdStale(json)) {
    const freshId = await forceRediscoverQueryId("TweetDetail");
    if (freshId) return handleFetchTweetDetail(tweetId, _retried, true);
  }

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

  chrome.storage.local.get(["totem_last_light_sync"], (stored) => {
    const lastSync = Number(stored.totem_last_light_sync || 0);
    if (now - lastSync < LIGHT_SYNC_THROTTLE_MS) return;
    chrome.storage.local.set({ totem_light_sync_needed: now });
  });
}

// ═══════════════════════════════════════════════════════════
// WEB REQUEST LISTENERS
// ═══════════════════════════════════════════════════════════

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) return;
    const extensionInitiated = isExtensionInitiated(details);

    const headers = {};
    for (const header of details.requestHeaders) {
      const name = header.name.toLowerCase();
      if (CAPTURED_HEADERS.has(name)) {
        headers[name] = header.value;
      }
    }

    const twidRaw = getCookieHeaderValue(headers["cookie"], "twid");
    const userIdFromHeader = parseTwidUserId(twidRaw);
    if (userIdFromHeader) {
      chrome.storage.local
        .set({
          totem_user_id: userIdFromHeader,
          [ACCOUNT_CONTEXT_STORAGE_KEY]: userIdFromHeader,
        })
        .catch(() => {});
    }

    const protectedOperation = isAuthProtectedGraphqlOperation(details.url);
    const hasAuthTrio = Boolean(
      headers["authorization"] &&
      headers["cookie"] &&
      headers["x-csrf-token"],
    );
    if (protectedOperation) {
      if (hasAuthTrio && !extensionInitiated) {
        markAuthAuthenticated("headers_trio").catch(() => {});
      } else if (!extensionInitiated) {
        recordWeakAuthNegativeSignal("headers_missing_auth_trio").catch(() => {});
      }
    }

    if (
      !extensionInitiated &&
      headers["authorization"] &&
      headers["cookie"] &&
      headers["x-csrf-token"]
    ) {
      chrome.storage.local.set({
        totem_auth_headers: headers,
        totem_auth_time: Date.now(),
      });
      discoverAllMissingQueryIds().catch(() => {});
    }

    captureGraphqlEndpoint(details);

    // Capture bookmarks query ID (in-memory) + features (persisted for request params)
    const match = details.url.match(/\/i\/api\/graphql\/([^/]+)\/Bookmarks\?(.+)/);
    if (match) {
      queryIdMemCache.set("Bookmarks", { id: match[1], ts: Date.now() });
      try {
        const params = new URLSearchParams(match[2]);
        const features = params.get("features");
        if (features) chrome.storage.local.set({ totem_features: features });
      } catch {}
    }

    // Passively capture query IDs into in-memory cache from live x.com traffic
    const detailMatch = details.url.match(/\/i\/api\/graphql\/([^/]+)\/TweetDetail/);
    if (detailMatch) {
      queryIdMemCache.set("TweetDetail", { id: detailMatch[1], ts: Date.now() });
    }

    const deleteMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/DeleteBookmark(?:\?|$)/,
    );
    if (deleteMatch) {
      queryIdMemCache.set("DeleteBookmark", { id: deleteMatch[1], ts: Date.now() });
    }

    const createMatch = details.url.match(
      /\/i\/api\/graphql\/([^/]+)\/CreateBookmark(?:\?|$)/,
    );
    if (createMatch) {
      queryIdMemCache.set("CreateBookmark", { id: createMatch[1], ts: Date.now() });
    }

    const mutation = parseBookmarkMutation(details.url);
    if (mutation && !extensionInitiated) {
      const referer = getHeaderValue(details.requestHeaders, "referer");
      const tweetId = extractTweetIdFromReferer(referer) || "";
      chrome.storage.local
        .set({
          totem_last_mutation: {
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

    if (!extensionInitiated) {
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
        totem_last_mutation_done: {
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

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isExtensionInitiated(details)) return;
    if (!isAuthProtectedGraphqlOperation(details.url)) return;
    if (details.statusCode === 401 || details.statusCode === 403) {
      markAuthLoggedOut(`completed_${details.statusCode}`, true).catch(() => {});
      return;
    }
    if (details.statusCode >= 200 && details.statusCode < 300) {
      markAuthAuthenticated("completed_ok").catch(() => {});
    }
  },
  {
    urls: ["https://x.com/i/api/graphql/*"],
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
  if (message.type === "GET_RUNTIME_SNAPSHOT") {
    handleGetRuntimeSnapshot(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "SET_ACCOUNT_CONTEXT") {
    handleSetAccountContext(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "REQUEST_SYNC" || message.type === "SYNC_POLICY_RESERVE") {
    handleSyncPolicyReserve(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
  if (message.type === "COMPLETE_SYNC" || message.type === "SYNC_POLICY_COMPLETE") {
    handleSyncPolicyComplete(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
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
  if (message.type === "OPEN_TOTEM_READER") {
    const tweetId = typeof message.tweetId === "string" ? message.tweetId : "";
    const readParam = tweetId ? `?read=${encodeURIComponent(tweetId)}` : "";
    chrome.tabs.create({
      url: chrome.runtime.getURL(`reader.html${readParam}`),
      active: true,
    }, (tab) => {
      sendResponse({ ok: true, tabId: tab?.id });
    });
    return true;
  }
  if (message.type === "BOOKMARK_MUTATION") {
    handleBookmarkMutationMessage(message)
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
    const now = Date.now();
    if (typeof message.ids?.DeleteBookmark === "string" && message.ids.DeleteBookmark) {
      queryIdMemCache.set("DeleteBookmark", { id: message.ids.DeleteBookmark, ts: now });
    }
    if (typeof message.ids?.CreateBookmark === "string" && message.ids.CreateBookmark) {
      queryIdMemCache.set("CreateBookmark", { id: message.ids.CreateBookmark, ts: now });
    }
    if (typeof message.ids?.TweetDetail === "string" && message.ids.TweetDetail) {
      queryIdMemCache.set("TweetDetail", { id: message.ids.TweetDetail, ts: now });
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === "SESSION_USER_MISSING") {
    chrome.storage.local.remove("totem_user_id").catch(() => {});
    chrome.storage.local
      .get(["totem_auth_headers"])
      .then((stored) => {
        const hasAuthHeader = Boolean(stored.totem_auth_headers?.authorization);
        if (hasAuthHeader) {
          // Missing twid on x.com is a strong logout signal. Keep captured
          // headers for diagnostics but move runtime session to logged_out.
          return setAuthState(AUTH_STATE_LOGGED_OUT, "content_no_twid", { clearAuth: false });
        }
        return markAuthLoggedOut("content_no_twid", true);
      })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
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
    authWeakNegativeHits = [];
    lastLightSyncSignalAt = 0;
    extensionInitiatedRequestMap.clear();
    syncOrchestratorMutation = Promise.resolve();
    chrome.storage.local
      .remove([
        SYNC_ORCHESTRATOR_STORAGE_KEY,
        RUNTIME_AUDIT_STORAGE_KEY,
        RUNTIME_STATE_V2_STORAGE_KEY,
      ])
      .catch(() => {});
    discoveryInProgress = false;
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// ═══════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════

runWeeklyServiceWorkerCleanup().catch(() => {});
normalizeRuntimeStateV2OnStartup().catch(() => {});

// On startup, proactively discover query IDs into in-memory cache.
// Nothing is persisted — IDs are always fresh per service worker session.
chrome.storage.local.get(["totem_auth_headers", "totem_auth_state"], (stored) => {
  const hasAuthHeader = Boolean(stored.totem_auth_headers?.authorization);
  const state = normalizeAuthState(stored.totem_auth_state, hasAuthHeader);
  if (hasAuthHeader) {
    if (state !== AUTH_STATE_AUTHENTICATED && state !== AUTH_STATE_STALE) {
      setAuthState(AUTH_STATE_STALE, "startup_has_auth").catch(() => {});
    }
    discoverAllMissingQueryIds().catch(() => {});
    return;
  }
  if (state !== AUTH_STATE_LOGGED_OUT) {
    setAuthState(AUTH_STATE_LOGGED_OUT, "startup_no_auth", { clearAuth: false }).catch(() => {});
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
});
