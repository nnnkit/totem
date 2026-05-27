/**
 * API proxy module — bookmark and tweet detail API handlers.
 *
 * Extracted from the SW monolith. Uses `withQueryId` from the query ID
 * module instead of manual retry logic.
 *
 * Handler map for FETCH_BOOKMARKS, DELETE_BOOKMARK, FETCH_TWEET_DETAIL.
 */

import type { MessageRequest } from "../types/messages";
import type { HandlerMap } from "./index";
import { parseCapturedAuthHeaders } from "@make/x-twitter-extension-core/auth";
import {
  AuthExpiredError,
  RateLimitError,
} from "@make/x-twitter-extension-core/query-id";
import { QueryIdStaleError, withQueryId } from "./query-id";
import {
  ensureAuthCapture,
  markAuthAuthenticated,
  markAuthLoggedOut,
} from "./auth";
import { CS_VIEWER_PROFILE } from "../lib/storage-keys";

// ── Constants ───────────────────────────────────────────────────

const DEFAULT_FEATURES: Record<string, boolean> = {
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

const DETAIL_FEATURE_OVERRIDES: Record<string, boolean> = {
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

// ── Auth helpers ────────────────────────────────────────────────

async function buildHeaders(
  storage: typeof chrome.storage.local,
): Promise<Record<string, string>> {
  const stored = await storage.get(["totem_auth_headers"]);
  const parsedAuth = parseCapturedAuthHeaders(stored.totem_auth_headers);
  if (!parsedAuth.ok) throw new Error("NO_AUTH");
  const auth = parsedAuth.headers;

  const headers: Record<string, string> = {
    accept: "*/*",
    authorization: parsedAuth.authorization,
    "x-csrf-token": parsedAuth.csrfToken,
    "x-twitter-active-user": auth["x-twitter-active-user"] || "yes",
    "x-twitter-auth-type": auth["x-twitter-auth-type"] || "OAuth2Session",
    "x-twitter-client-language":
      auth["x-twitter-client-language"] || "en",
    "content-type": "application/json",
  };

  if (auth["accept-language"]) headers["accept-language"] = auth["accept-language"];
  if (auth["cookie"]) headers["cookie"] = auth["cookie"];
  if (auth["x-client-uuid"]) headers["x-client-uuid"] = auth["x-client-uuid"];
  if (auth["x-client-transaction-id"]) {
    headers["x-client-transaction-id"] = auth["x-client-transaction-id"];
  }

  return headers;
}

async function reAuthSilently(
  storage: typeof chrome.storage.local,
  tabs: typeof chrome.tabs,
): Promise<boolean> {
  const result = await ensureAuthCapture(
    { storage, tabs },
    { interactive: false, reason: "api_auth_retry" },
  );
  return result.ok;
}

function parseFeatureSet(raw: unknown): Record<string, boolean> {
  if (raw && typeof raw === "object") return raw as Record<string, boolean>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return {};
}

// ── Handler implementations ─────────────────────────────────────

interface ApiProxyDeps {
  storage?: typeof chrome.storage.local;
  tabs?: typeof chrome.tabs;
  fetchFn?: typeof fetch;
}

function defaultChromeStorage(): typeof chrome.storage.local {
  const g = globalThis as Record<string, unknown>;
  return (g.chrome as { storage: { local: typeof chrome.storage.local } })
    ?.storage?.local;
}

function defaultChromeTabs(): typeof chrome.tabs {
  const g = globalThis as Record<string, unknown>;
  return (g.chrome as { tabs: typeof chrome.tabs })?.tabs;
}

export function createApiProxyHandlers(deps: ApiProxyDeps = {}): HandlerMap {
  const storage = deps.storage ?? defaultChromeStorage();
  const tabs = deps.tabs ?? defaultChromeTabs();
  const fetchFn = deps.fetchFn ?? fetch;

  async function handleFetchBookmarks(
    message: MessageRequest,
    _retried = false,
  ): Promise<unknown> {
    const msg = message as unknown as Record<string, unknown>;
    const cursor = typeof msg.cursor === "string" ? msg.cursor : undefined;
    const count =
      typeof msg.count === "number" && msg.count > 0
        ? msg.count
        : 100;

    return withQueryId("Bookmarks", async (queryId) => {
      const stored = await storage.get(["totem_auth_headers", "totem_features"]);
      if (!parseCapturedAuthHeaders(stored.totem_auth_headers).ok) {
        throw new Error("NO_AUTH");
      }

      const variables: Record<string, unknown> = {
        count,
        includePromotedContent: true,
      };
      if (cursor) variables.cursor = cursor;

      const features =
        (stored.totem_features as string) || JSON.stringify(DEFAULT_FEATURES);

      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        features,
      });

      const url = `https://x.com/i/api/graphql/${queryId}/Bookmarks?${params}`;
      const requestHeaders = await buildHeaders(storage);

      const response = await fetchFn(url, {
        method: "GET",
        credentials: "include",
        headers: requestHeaders,
      });

      if (response.status === 401 || response.status === 403) {
        await storage.remove(["totem_auth_headers", "totem_auth_time"]);
        if (!_retried) {
          const success = await reAuthSilently(storage, tabs);
          if (success) return handleFetchBookmarks(message, true);
        }
        await markAuthLoggedOut(
          `bookmarks_${response.status}`,
          true,
          storage,
        );
        throw new AuthExpiredError();
      }

      if (!response.ok) {
        if (response.status === 429) throw new RateLimitError();
        if (response.status === 400) {
          throw new QueryIdStaleError("Bookmarks", queryId);
        }
        const body = await response.text().catch(() => "");
        throw new Error(
          `API_ERROR_${response.status}: ${body.slice(0, 200)}`,
        );
      }

      const json = await response.json();
      await markAuthAuthenticated("bookmarks_ok", storage);
      return { data: json };
    });
  }

  async function handleDeleteBookmark(
    message: MessageRequest,
    _retried = false,
  ): Promise<unknown> {
    const msg = message as unknown as Record<string, unknown>;
    const tweetId = typeof msg.tweetId === "string" ? msg.tweetId : "";
    if (!tweetId) throw new Error("MISSING_TWEET_ID");

    return withQueryId("DeleteBookmark", async (queryId) => {
      const stored = await storage.get(["totem_auth_headers"]);
      if (!parseCapturedAuthHeaders(stored.totem_auth_headers).ok) {
        throw new Error("NO_AUTH");
      }

      const url = `https://x.com/i/api/graphql/${queryId}/DeleteBookmark`;
      const requestHeaders = await buildHeaders(storage);

      const response = await fetchFn(url, {
        method: "POST",
        credentials: "include",
        headers: requestHeaders,
        body: JSON.stringify({
          variables: { tweet_id: tweetId },
          queryId,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        await storage.remove(["totem_auth_headers", "totem_auth_time"]);
        if (!_retried) {
          const success = await reAuthSilently(storage, tabs);
          if (success) return handleDeleteBookmark(message, true);
        }
        await markAuthLoggedOut(
          `delete_${response.status}`,
          true,
          storage,
        );
        throw new AuthExpiredError();
      }

      if (!response.ok) {
        if (response.status === 400) {
          throw new QueryIdStaleError("DeleteBookmark", queryId);
        }
        const body = await response.text().catch(() => "");
        throw new Error(
          `DELETE_BOOKMARK_${response.status}: ${body.slice(0, 200)}`,
        );
      }

      const json = await response.json().catch(() => null);
      await markAuthAuthenticated("delete_ok", storage);
      return { ok: true, queryId, data: json };
    });
  }

  async function handleFetchTweetDetail(
    message: MessageRequest,
    _retried = false,
  ): Promise<unknown> {
    const msg = message as unknown as Record<string, unknown>;
    const tweetId = typeof msg.tweetId === "string" ? msg.tweetId : "";
    if (!tweetId) throw new Error("MISSING_TWEET_ID");

    return withQueryId("TweetDetail", async (queryId) => {
      const stored = await storage.get([
        "totem_auth_headers",
        "totem_features",
      ]);
      if (!parseCapturedAuthHeaders(stored.totem_auth_headers).ok) {
        throw new Error("NO_AUTH");
      }

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
      const requestHeaders = await buildHeaders(storage);

      const response = await fetchFn(url, {
        method: "GET",
        credentials: "include",
        headers: requestHeaders,
      });

      if (response.status === 401 || response.status === 403) {
        await storage.remove(["totem_auth_headers", "totem_auth_time"]);
        if (!_retried) {
          const success = await reAuthSilently(storage, tabs);
          if (success) return handleFetchTweetDetail(message, true);
        }
        await markAuthLoggedOut(
          `detail_${response.status}`,
          true,
          storage,
        );
        throw new AuthExpiredError();
      }

      if (!response.ok) {
        if (response.status === 400) {
          throw new QueryIdStaleError("TweetDetail", queryId);
        }
        const body = await response.text().catch(() => "");
        throw new Error(
          `DETAIL_ERROR_${response.status}: ${body.slice(0, 200)}`,
        );
      }

      const json = await response.json();
      await markAuthAuthenticated("detail_ok", storage);
      return { data: json };
    });
  }

  async function handleFetchViewerProfile(): Promise<unknown> {
    return withQueryId("UserByRestId", async (queryId) => {
      const stored = await storage.get([
        "totem_auth_headers",
        "totem_user_id",
        "totem_features",
      ]);

      const userId =
        typeof stored.totem_user_id === "string" ? stored.totem_user_id : "";
      if (!userId) throw new Error("NO_USER_ID");

      if (!parseCapturedAuthHeaders(stored.totem_auth_headers).ok) {
        throw new Error("NO_AUTH");
      }

      const features =
        (stored.totem_features as string) || JSON.stringify(DEFAULT_FEATURES);

      const params = new URLSearchParams({
        variables: JSON.stringify({
          userId,
          withSafetyModeUserFields: true,
        }),
        features,
        fieldToggles: JSON.stringify({
          withAuxiliaryUserLabels: false,
        }),
      });

      const url = `https://x.com/i/api/graphql/${queryId}/UserByRestId?${params}`;
      const requestHeaders = await buildHeaders(storage);

      const response = await fetchFn(url, {
        method: "GET",
        credentials: "include",
        headers: requestHeaders,
      });

      if (!response.ok) {
        if (response.status === 400) {
          throw new QueryIdStaleError("UserByRestId", queryId);
        }
        const body = await response.text().catch(() => "");
        throw new Error(
          `VIEWER_PROFILE_${response.status}: ${body.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as unknown;
      const profile = extractViewerProfile(userId, json);
      if (!profile) throw new Error("VIEWER_PROFILE_PARSE_FAILED");

      await storage.set({ [CS_VIEWER_PROFILE]: profile });
      return { ok: true, profile };
    });
  }

  return {
    FETCH_BOOKMARKS: (msg) => handleFetchBookmarks(msg),
    DELETE_BOOKMARK: (msg) => handleDeleteBookmark(msg),
    FETCH_TWEET_DETAIL: (msg) => handleFetchTweetDetail(msg),
    FETCH_VIEWER_PROFILE: () => handleFetchViewerProfile(),
  };
}

interface ViewerProfilePayload {
  userId: string;
  screenName: string;
  name: string;
  profileImageUrl: string;
  capturedAt: number;
}

function extractViewerProfile(
  userId: string,
  payload: unknown,
): ViewerProfilePayload | null {
  if (!payload || typeof payload !== "object") return null;

  const data = (payload as Record<string, unknown>).data;
  const user =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).user
      : null;
  const result =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).result
      : null;
  if (!result || typeof result !== "object") return null;

  const resultRec = result as Record<string, unknown>;
  const legacy =
    resultRec.legacy && typeof resultRec.legacy === "object"
      ? (resultRec.legacy as Record<string, unknown>)
      : {};
  const core =
    resultRec.core && typeof resultRec.core === "object"
      ? (resultRec.core as Record<string, unknown>)
      : {};
  const avatar =
    resultRec.avatar && typeof resultRec.avatar === "object"
      ? (resultRec.avatar as Record<string, unknown>)
      : {};

  const pickString = (value: unknown): string =>
    typeof value === "string" ? value : "";

  const screenName =
    pickString(legacy.screen_name) || pickString(core.screen_name);
  const name = pickString(legacy.name) || pickString(core.name);
  const profileImageUrl =
    pickString(legacy.profile_image_url_https) ||
    pickString(avatar.image_url) ||
    pickString(legacy.profile_image_url);

  if (!screenName && !profileImageUrl) return null;

  return {
    userId,
    screenName,
    name,
    profileImageUrl,
    capturedAt: Date.now(),
  };
}

export const apiProxyHandlers: HandlerMap = createApiProxyHandlers();
