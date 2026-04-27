import cleanReaderImage from "./feature-previews/clean-reader.jpg";
import highlightsNotesImage from "./feature-previews/highlights-notes.jpg";
import readingStatesImage from "./feature-previews/reading-states.jpg";
import worksOfflineImage from "./feature-previews/works-offline.jpg";
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_URL,
  SUPPORT_X_HANDLE,
  SUPPORT_X_URL,
} from "../../../src/lib/constants/support";

export type FeatureItem = {
  title: string;
  body: string;
  image: string;
  alt: string;
};

export type PrivacyFeatureCard = {
  title: string;
  body: string;
  bullets: readonly string[];
  linkLabel: string;
};

export type FAQItem = {
  question: string;
  answer: string;
};

export type PolicySectionItem =
  | string
  | {
      label: string;
      text: string;
    };

export type PolicySection = {
  title: string;
  items: readonly PolicySectionItem[];
};

export type PrivacySummaryItem = {
  title: string;
  body: string;
};

export type PrivacyPermission = {
  name: string;
  reason: string;
  use: string;
  access: string;
};

export type TransitRoute = {
  id: string;
  name: string;
  color: string;
  description: string;
};

export type TransitStation = {
  id: string;
  name: string;
  short: string;
  x: number;
  y: number;
  kind: "source" | "hub" | "store" | "ui" | "policy";
  routes: string[];
  neighbors: string[];
  /** Files in the repo that implement this station. */
  files: string[];
  /** Storage keys (or schemas) this station is the writer for. May be empty. */
  writes: string[];
  /** Things this station reads. May be empty. */
  reads: string[];
  detail: string;
};

export type TransitSegment = {
  route: string;
  /** Ordered list of station ids this segment passes through. */
  path: string[];
  /** Optional one-line caption for what travels along this segment. */
  label?: string;
};

export type TransitFlowStep = {
  stationId: string;
  note: string;
};

export type TransitFlow = {
  id: string;
  label: string;
  summary: string;
  steps: TransitFlowStep[];
};

const chromeWebStoreInstallUrl =
  "https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo?utm_source=usetotem.xyz&utm_medium=referral&utm_campaign=site_install";
const demoVideoEmbedUrl =
  "https://www.youtube.com/embed/75RNtgMHsPA?rel=0&modestbranding=1";
const githubReleaseUrl = "https://github.com/nnnkit/totem/releases/latest";
const hasWebStoreInstall = Boolean(chromeWebStoreInstallUrl);
const installUrl = hasWebStoreInstall
  ? chromeWebStoreInstallUrl
  : githubReleaseUrl;
const installButtonLabel = "Add to Chrome — Free";
const featureHero: FeatureItem = {
  title: "Pick up where you left off.",
  body: "Unread. In progress. Done. Your queue tracks reading state across every saved post — even mid-thread, even after a week away.",
  image: readingStatesImage,
  alt: "Totem reading list showing unread, in-progress, and finished tabs with per-post progress.",
};

const featureHighlights: FeatureItem = {
  title: "Highlight. Note. Done.",
  body: "Drag-select any tweet. Add a note. Saved to this device, indexed to the post.",
  image: highlightsNotesImage,
  alt: "Totem reader with a passage highlighted and an inline note attached.",
};

const featureClean: FeatureItem = {
  title: "No sidebar. No feed.",
  body: "Every saved post in a focused reader. Just the writing — no trending, no ads, no rabbit hole.",
  image: cleanReaderImage,
  alt: "Totem clean reader rendering a saved X thread without feed chrome.",
};

const featureOffline: FeatureItem = {
  title: "Works on a plane.",
  body: "Bookmarks cache locally on first sync. Read 200 saved posts with zero signal.",
  image: worksOfflineImage,
  alt: "Totem reading list operating in offline mode with cached bookmarks visible.",
};

const featurePrivacy: PrivacyFeatureCard = {
  title: "No account. No tracking.",
  body: "Totem reads from your existing X session. Notes, highlights, and reading state stay in your browser — there's no Totem server to leak them.",
  bullets: [
    "No password — uses the X login you already have",
    "No backend — nothing to sync, nothing to breach",
    "No telemetry — we can't see what you read",
  ],
  linkLabel: "Read the privacy policy →",
};

export const SITE_LINKS = {
  installUrl,
  demoVideoEmbedUrl,
  demoPageUrl: "/demo/",
  howItWorksUrl: "/how-it-works/",
  privacyUrl: "/privacy/",
  supportEmail: SUPPORT_EMAIL,
  supportEmailUrl: SUPPORT_EMAIL_URL,
  supportXHandle: SUPPORT_X_HANDLE,
  supportXUrl: SUPPORT_X_URL,
  githubRepoUrl: "https://github.com/nnnkit/totem",
} as const;

export const SITE_COPY = {
  header: {
    brandName: "Totem",
    brandAriaLabel: "Totem homepage",
    installLabel: "Add to Chrome",
    demoLabel: "See Demo",
    navAriaLabel: "Primary",
  },
  footer: {
    brandAriaLabel: "Totem homepage",
    navAriaLabel: "Footer links",
    privacyLabel: "Privacy Policy",
    githubLabel: "GitHub",
    copyright: "© 2026 Totem",
  },
  landing: {
    hero: {
      eyebrow: "Chrome Extension",
      title: "Read your X bookmarks, not the feed.",
      description:
        "Open a new tab to read your saved posts. No feed, no algorithmic noise.",
      installButtonLabel: installButtonLabel,
      videoTitle: "Totem quick walkthrough video",
      chips: ["No account", "No backend", "Local-first"],
    },
    demo: {
      eyebrow: "Live demo",
      title: "See it in action.",
      description:
        "This is what every new tab looks like.",
      linkLabel: "Full-page demo →",
      note: "Runs on your existing X session. Nothing leaves your browser.",
    },
    features: {
      eyebrow: "Features",
      title: "Built for reading, not scrolling.",
      description: "Everything you need. Nothing you don't.",
      hero: featureHero,
      highlights: featureHighlights,
      clean: featureClean,
      offline: featureOffline,
      privacy: featurePrivacy,
    },
    faq: {
      title: "FAQ",
      introBefore:
        "Totem does not ask for your X password and does not run its own backend. Your notes and reading state stay local on this device. For the full breakdown of permissions and storage, read the ",
      introLinkLabel: "privacy page",
      introAfter: ".",
      items: [
        {
          question: "Does Totem need my X password?",
          answer:
            "No. It uses your existing X session in the same browser profile — just log in to X there and open a new tab.",
        },
        {
          question: "Does Totem upload my notes or reading history anywhere?",
          answer:
            "No. There is no backend — your highlights, notes, and reading progress stay on this device.",
        },
        {
          question: "Why don’t my bookmarks appear right away?",
          answer:
            "The first sync needs a moment to connect to your X account and build the local reading queue. Click Sync and give it a minute before trying again.",
        },
        {
          question:
            "Why does sync say it is already running or temporarily paused?",
          answer:
            "Sync attempts are spaced out to avoid duplicate work or hitting X too quickly. Wait a minute, then try Sync again.",
        },
        {
          question: "Why isn’t Totem opening on every new tab?",
          answer:
            "Another extension, another browser profile, or a managed browser setting may be taking over your new tab page. Make sure the extension is enabled in this profile and disable any other new-tab extensions.",
        },
        {
          question: "Why does it work in one browser profile but not another?",
          answer:
            "Extensions, X logins, and optional permissions are separate per browser profile. Install and log in to X in the exact profile where you want to use it.",
        },
        {
          question: "Why am I seeing “Offline mode”?",
          answer:
            "You are logged out of X, so only bookmarks already saved on this device are visible.",
        },
        {
          question:
            "What happens to my highlights, notes, and read state if I log out of X?",
          answer:
            "Your reading state, highlights, and notes stay on the device. You can access them until you reset local data.",
        },
        {
          question:
            "Why did the browser ask for permission when I turned on Quick Links?",
          answer:
            "Quick Links uses your browser’s top sites and favicon access, so the browser asks before that data can be shown.",
        },
        {
          question:
            "If I turn a feature off, does the browser revoke that permission automatically?",
          answer:
            "No. Turning the feature off stops it from being used, but the browser keeps the permission until you remove it in extension settings.",
        },
        {
          question: "How do I reset Totem on this device?",
          answer:
            "Open Settings in the new tab page, choose Reset local data, then confirm. Note that you will lose all local state like highlights, notes, and reading status.",
        },
        {
          question: "What does Reset local data delete?",
          answer:
            "It clears the local bookmarks cache, highlights, notes, reading progress, and all other saved state on that device.",
        },
        {
          question: "Why did my highlights, notes, or read progress disappear?",
          answer:
            "That usually means local data was reset, you changed browser profiles, or you are looking on a different device.",
        },
        {
          question: "What should I do if Totem looks stuck?",
          answer:
            "Open X once, come back, and try Sync again. If it still does not recover, use Reset local data.",
        },
      ] satisfies FAQItem[],
      finalCtaTitle: "Stop saving. Start reading.",
      finalCtaDescription:
        "You already saved them. Now actually read them.",
      finalCtaButtonLabel: installButtonLabel,
    },
  },
  browser: {
    defaultTabTitle: "Totem",
    newTabTitle: "New Tab",
    demoTabTitlePrefix: "Totem Demo",
    closeTabLabel: "Close tab",
    launcherLabel: "Open new tab",
    launcherText: "New tab",
    fullPageDemoAriaLabel: "Open full-page demo",
    fullPageDemoTitle: "Open full-page demo",
    closedHint: 'Click "New tab" above',
    frameTitle: "Totem New Tab demo",
    loadingEyebrow: "Totem Demo",
    loadingText: "Loading preview...",
  },
  privacy: {
    eyebrow: "Privacy Policy",
    title: "Your data never leaves your browser.",
    lastUpdatedLabel: "Last updated:",
    lastUpdated: "March 11, 2026",
    introTitle:
      "Totem is local-first. There is no Totem backend, no account to create, and no data to sync to our servers — because we don't have any.",
    introBody:
      "Totem reads your own X bookmarks from your existing browser session and turns them into a reading queue right inside your new tab. Everything stays on your device.",
    summaryTitle: "Short version",
    summaryItems: [
      {
        title: "Stored on your device",
        body: "Bookmarks cache, tweet details, reading progress, highlights, notes, settings, and the auth/runtime metadata Totem needs to stay connected.",
      },
      {
        title: "Sent to X only",
        body: "Authenticated requests to x.com to fetch your bookmarks, fetch tweet details, and delete a bookmark when you do that inside Totem. Nothing goes anywhere else.",
      },
      {
        title: "Sent only when you search",
        body: "Your query goes directly to your chosen search provider, or to Chrome's default search if you enable that option and submit a search.",
      },
      {
        title: "Optional features",
        body: "Quick Links uses optional topSites and favicon permissions. Default-search integration uses the optional search permission.",
      },
    ] satisfies PrivacySummaryItem[],
    reassuranceTitle: "No backend. No tracking. No exceptions.",
    reassuranceItems: [
      "No Totem-operated server ever sees your data.",
      "No analytics or behavioral telemetry is collected.",
      "No personal data is sold or shared with third parties.",
      "No X password is ever requested — Totem uses your existing session.",
    ] as const,
    permissionsTitle: "Permissions explained",
    permissionsIntro:
      "Each permission maps to a specific feature. Optional permissions are requested only when you turn on the feature that needs them.",
    permissions: [
      {
        name: "storage",
        reason:
          "Totem needs local storage so your reading queue and notes work like an on-device app.",
        use:
          "Stores bookmarks and tweet detail cache, reading progress, highlights, notes, settings, and runtime/auth metadata in browser storage.",
        access: "Always on",
      },
      {
        name: "webRequest",
        reason:
          "Totem needs to read the auth headers already present in your own x.com session.",
        use:
          "Observes your x.com requests so Totem can capture the authorization, cookie, and CSRF headers required to load your own bookmarks locally.",
        access: "Always on",
      },
      {
        name: "declarativeNetRequest",
        reason:
          "Totem needs its X requests to match the authenticated browser session you already have.",
        use:
          "Applies the required request headers when Totem asks x.com for bookmarks, tweet details, or bookmark deletions.",
        access: "Always on",
      },
      {
        name: "https://x.com/*",
        reason:
          "Totem only works against your own account on x.com, so it needs permission to operate there.",
        use:
          "Lets Totem run content scripts on x.com, detect account context, and observe bookmark activity needed to keep local data in sync.",
        access: "Always on",
      },
      {
        name: "topSites",
        reason:
          "Quick Links can show the sites you visit most often on the new tab page.",
        use:
          "Reads Chrome's top-sites list only after you enable Quick Links.",
        access: "Optional",
      },
      {
        name: "favicon",
        reason:
          "Quick Links are easier to scan when Chrome can show each site's icon.",
        use:
          "Lets Chrome provide favicon images for the sites shown in Quick Links.",
        access: "Optional",
      },
      {
        name: "search",
        reason:
          "Some people want Totem's search bar to use Chrome's default search engine instead of a fixed provider.",
        use:
          "Lets Totem hand your search query to Chrome's default search only when you choose that mode and submit a search.",
        access: "Optional",
      },
    ] satisfies PrivacyPermission[],
    fullPolicyTitle: "Full policy",
    sections: [
      {
        title: "What Totem stores",
        items: [
          "IndexedDB stores bookmarks, tweet detail cache, reading progress, highlights, and notes.",
          "chrome.storage.local stores runtime and auth state, including captured auth headers, bookmark mutation queue data, and GraphQL endpoint catalog metadata.",
          "chrome.storage.sync stores theme and settings when Chrome sync storage is available.",
          "localStorage stores small UI preferences such as the selected reading tab and wallpaper choice.",
          "Totem does not run a backend database for extension data.",
        ],
      },
      {
        title: "What Totem sends over the network",
        items: [
          "Totem sends authenticated API requests to x.com to fetch bookmarks and tweet details, and to delete bookmarks when you choose to unbookmark inside Totem.",
          "Totem may fetch x.com or abs.twimg.com bundles to discover GraphQL query IDs when needed to stay compatible with X.",
          "Search queries are sent directly to your chosen search provider, or to Chrome's default search if you enable that integration and submit a search.",
          "Totem does not send analytics or behavioral telemetry to a Totem-operated server.",
          "Totem does not sell personal data or share it with advertising or tracking platforms.",
        ],
      },
      {
        title: "How long data stays",
        items: [
          "Tweet detail cache stays for up to 30 days, then cleanup logic removes older entries.",
          "Bookmark mutation event cache stays for up to 14 days.",
          "GraphQL endpoint catalog entries stay for up to 30 days.",
          "Auth headers are refreshed from live x.com traffic and may remain in local storage until session/auth state changes or you remove the extension.",
        ],
      },
      {
        title: "Your controls",
        items: [
          "You can remove the extension at any time.",
          "You can reset Totem local data from settings.",
          "Reset local data clears bookmark and content caches plus most local state, but currently preserves auth and query metadata used for account continuity.",
          "Optional permission grants are managed by Chrome. Turning a feature off in Totem stops using it, but does not automatically revoke the permission from Chrome.",
          "To revoke optional permissions, use Chrome extension permission controls for Totem.",
          "If you use Totem in another browser profile, that profile has its own X login, extension data, and optional permission grants.",
        ],
      },
    ] satisfies PolicySection[],
  },
  demoPage: {
    loadingEyebrow: "Totem Demo",
    loadingText: "Loading preview...",
  },
  howItWorks: {
    eyebrow: "How it works",
    title: "How Totem works.",
    intro:
      "Each station is a real module in the codebase. Each line is a real path data takes. Click a station for its files and storage keys, click a line to isolate it, or pick a flow to walk through a real interaction.",
    legendTitle: "Lines",
    bookmarkBaseId: "service-worker",
    routes: [
      {
        id: "auth",
        name: "Auth Line",
        color: "#ef4444",
        description:
          "User identity and auth headers, captured passively from your own x.com traffic.",
      },
      {
        id: "sync",
        name: "Sync Line",
        color: "#3b82f6",
        description:
          "Manual / scheduled sync. Service worker is the single writer for sync state.",
      },
      {
        id: "render",
        name: "Render Line",
        color: "#10b981",
        description:
          "IndexedDB hydrates the runtime store, which feeds the new-tab UI.",
      },
      {
        id: "reader",
        name: "Reader Line",
        color: "#8b5cf6",
        description:
          "The reader page reads tweet details and writes highlights/notes back to IndexedDB.",
      },
    ] satisfies TransitRoute[],
    stations: [
      {
        id: "x-session",
        name: "x.com",
        short: "your X session",
        x: 110,
        y: 260,
        kind: "source",
        routes: ["auth", "sync"],
        neighbors: ["detect-user", "service-worker"],
        files: [],
        writes: [],
        reads: [],
        detail:
          "The session you already have in this browser profile. Totem never asks for a password — it reuses the cookies, CSRF token, and headers attached to your own requests.",
      },
      {
        id: "detect-user",
        name: "detect-user",
        short: "content script",
        x: 280,
        y: 180,
        kind: "policy",
        routes: ["auth"],
        neighbors: ["x-session", "chrome-storage", "service-worker"],
        files: ["src/content/detect-user.ts"],
        writes: ["totem_user_id", "CS_ACCOUNT_CONTEXT_ID"],
        reads: ["twid cookie on x.com"],
        detail:
          "Runs at document_start in an isolated world on x.com. Parses the twid cookie, scopes the local cache to that account, and relays bookmark mutation events from the page to the service worker.",
      },
      {
        id: "service-worker",
        name: "Service Worker",
        short: "MV3 background",
        x: 460,
        y: 260,
        kind: "hub",
        routes: ["auth", "sync"],
        neighbors: ["x-session", "detect-user", "chrome-storage", "runtime-store"],
        files: [
          "src/service-worker/index.ts",
          "src/service-worker/auth.ts",
          "src/service-worker/sync.ts",
          "src/service-worker/api-proxy.ts",
          "src/service-worker/query-id.ts",
          "src/service-worker/events.ts",
        ],
        writes: [
          "totem_auth_headers",
          "totem_auth_state",
          "totem_sync_orchestrator_state",
          "totem_runtime_state_v2",
          "totem_graphql_catalog",
        ],
        reads: ["x.com webRequest traffic", "messages from runtime"],
        detail:
          "The hub. webRequest captures auth headers from x.com/i/api/graphql/* traffic. sync.ts hands out a sync lease and writes orchestrator state. api-proxy.ts makes the actual GraphQL calls on the runtime's behalf. It is the single writer for every sync and runtime-snapshot key.",
      },
      {
        id: "chrome-storage",
        name: "chrome.storage",
        short: "reactive bus",
        x: 460,
        y: 410,
        kind: "store",
        routes: ["auth", "sync"],
        neighbors: ["service-worker", "detect-user", "runtime-store"],
        files: ["src/lib/storage-keys.ts", "src/service-worker/storage-keys-sw.ts"],
        writes: [],
        reads: ["pushes from the service worker and content script"],
        detail:
          "Holds auth headers, the runtime snapshot, sync orchestrator state, captured bookmark events, and the GraphQL query-id catalog. The runtime never writes here — it subscribes to chrome.storage.onChanged so cross-tab updates land without re-running boot.",
      },
      {
        id: "indexeddb",
        name: "IndexedDB",
        short: "account-scoped",
        x: 660,
        y: 260,
        kind: "store",
        routes: ["sync", "render", "reader"],
        neighbors: ["runtime-store", "reader"],
        files: ["src/db/index.ts"],
        writes: [],
        reads: ["writes from runtime-store and reader actions"],
        detail:
          "Per-account database (totem_acct_<id>) with four stores: bookmarks, tweet_details, reading_progress, highlights. All durable reading state lives here. The runtime opens and closes handles in response to account-context changes broadcast over chrome.storage.",
      },
      {
        id: "runtime-store",
        name: "Runtime Store",
        short: "Zustand",
        x: 830,
        y: 260,
        kind: "hub",
        routes: ["sync", "render", "reader"],
        neighbors: ["service-worker", "chrome-storage", "indexeddb", "new-tab", "reader"],
        files: [
          "src/stores/runtime-store.ts",
          "src/stores/selectors.ts",
          "src/stores/prefetch-controller.ts",
          "src/runtime/RuntimeProvider.tsx",
        ],
        writes: ["IndexedDB stores (bookmarks, tweet_details, reading_progress, highlights)"],
        reads: ["chrome.storage runtime snapshot", "IndexedDB on boot"],
        detail:
          "A single Zustand store. Holds nothing persistent — auth comes from the SW snapshot, data is hydrated from IndexedDB on boot. Components subscribe through selectors. RuntimeProvider runs the boot, heartbeat, and chrome.storage.onChanged plumbing.",
      },
      {
        id: "new-tab",
        name: "New Tab",
        short: "newtab.html",
        x: 990,
        y: 170,
        kind: "ui",
        routes: ["render"],
        neighbors: ["runtime-store"],
        files: [
          "newtab.html",
          "src/components/NewTabHome.tsx",
          "src/components/BookmarksList.tsx",
        ],
        writes: [],
        reads: ["selectors on the runtime store"],
        detail:
          "The new-tab page. Renders home, search, the virtualized reading list, and the sync footer. Reads only from selectors — never directly from IndexedDB or chrome.storage.",
      },
      {
        id: "reader",
        name: "Reader",
        short: "reader.html",
        x: 990,
        y: 350,
        kind: "ui",
        routes: ["reader"],
        neighbors: ["runtime-store", "indexeddb"],
        files: [
          "reader.html",
          "src/components/BookmarkReader.tsx",
          "src/hooks/useHighlights.ts",
          "src/hooks/useReadingProgress.ts",
        ],
        writes: [],
        reads: ["tweet detail and highlights from IndexedDB (via runtime store)"],
        detail:
          "Separate page, not an overlay. Drag to highlight, type to annotate. Highlights and reading progress flow back through useHighlights/useReadingProgress, which call runtime-store actions that persist to IndexedDB.",
      },
    ] satisfies TransitStation[],
    segments: [
      // Auth Line — passive identity + header capture
      {
        route: "auth",
        path: ["x-session", "detect-user", "chrome-storage"],
        label: "twid cookie → totem_user_id",
      },
      {
        route: "auth",
        path: ["x-session", "service-worker", "chrome-storage"],
        label: "webRequest → totem_auth_headers",
      },
      // Sync Line — runtime asks SW, SW calls x.com, runtime writes IDB
      {
        route: "sync",
        path: ["new-tab", "runtime-store", "service-worker"],
        label: "reserveSyncRun()",
      },
      {
        route: "sync",
        path: ["service-worker", "x-session"],
        label: "api-proxy GraphQL fetch",
      },
      {
        route: "sync",
        path: ["service-worker", "chrome-storage"],
        label: "totem_sync_orchestrator_state",
      },
      {
        route: "sync",
        path: ["runtime-store", "indexeddb"],
        label: "upsertBookmarks",
      },
      // Render Line — IDB → store → UI
      {
        route: "render",
        path: ["indexeddb", "runtime-store", "new-tab"],
        label: "hydrate + selectors",
      },
      // Reader Line — UI → reader → store → IDB
      {
        route: "reader",
        path: ["new-tab", "reader"],
        label: "open in reader.html",
      },
      {
        route: "reader",
        path: ["reader", "runtime-store", "indexeddb"],
        label: "saveHighlight / saveReadingProgress",
      },
    ] satisfies TransitSegment[],
    flows: [
      {
        id: "first-sync",
        label: "First sync",
        summary:
          "You sign into x.com, open a new tab, and Totem builds the local queue from scratch.",
        steps: [
          {
            stationId: "x-session",
            note: "You sign in to x.com in this profile.",
          },
          {
            stationId: "detect-user",
            note: "Content script reads the twid cookie and writes totem_user_id.",
          },
          {
            stationId: "service-worker",
            note: "webRequest captures auth headers; query-id discovers GraphQL operation IDs from real traffic.",
          },
          {
            stationId: "chrome-storage",
            note: "totem_auth_headers, totem_auth_state, and totem_runtime_state_v2 land here.",
          },
          {
            stationId: "runtime-store",
            note: "On new-tab boot the runtime calls reserveSyncRun(); SW returns mode=full because lastFullSyncAt is 0.",
          },
          {
            stationId: "indexeddb",
            note: "Pages of bookmarks are reconciled and persisted to the account-scoped DB.",
          },
          {
            stationId: "new-tab",
            note: "Reading list renders. Prefetch starts pulling tweet details in the background.",
          },
        ],
      },
      {
        id: "open-tab",
        label: "Open a new tab",
        summary:
          "You already have data. Opening a new tab should never block on the network.",
        steps: [
          {
            stationId: "new-tab",
            note: "newtab.html mounts. RuntimeProvider runs boot().",
          },
          {
            stationId: "chrome-storage",
            note: "checkAuth() reads the runtime snapshot pushed by the service worker.",
          },
          {
            stationId: "indexeddb",
            note: "setActiveAccountId() opens the right DB; bookmarks and detail IDs are hydrated.",
          },
          {
            stationId: "runtime-store",
            note: "Selectors derive the runtime mode (online_ready or offline_cached).",
          },
          {
            stationId: "new-tab",
            note: "List renders before any network call returns.",
          },
        ],
      },
      {
        id: "sync-now",
        label: "Manual sync",
        summary:
          "You click Sync. The SW gates concurrency, paginates X, and the runtime writes the diff.",
        steps: [
          {
            stationId: "new-tab",
            note: "actions.sync() is called from the footer button.",
          },
          {
            stationId: "service-worker",
            note: "reserveSyncRun() returns a lease + mode=incremental (lastFullSyncAt > 0).",
          },
          {
            stationId: "x-session",
            note: "api-proxy makes authenticated GraphQL calls using captured headers + query IDs.",
          },
          {
            stationId: "indexeddb",
            note: "reconcile.ts upserts new bookmarks and tombstones removed ones.",
          },
          {
            stationId: "chrome-storage",
            note: "completeSyncRun writes lastSuccessAt and a 15-min manualCooldownUntil.",
          },
        ],
      },
      {
        id: "highlight",
        label: "Highlight a post",
        summary:
          "You drag-select text in the reader. The highlight is keyed to the post and saved locally.",
        steps: [
          {
            stationId: "reader",
            note: "Selection toolbar fires; a highlight color is picked.",
          },
          {
            stationId: "runtime-store",
            note: "useHighlights → store action saveHighlight(tweetId, range, color).",
          },
          {
            stationId: "indexeddb",
            note: "highlights store gets a new row, indexed by tweetId.",
          },
          {
            stationId: "reader",
            note: "Re-render shows the highlight in place. Nothing leaves your device.",
          },
        ],
      },
      {
        id: "offline",
        label: "Going offline",
        summary:
          "Connection drops. The new tab keeps working with whatever you already cached.",
        steps: [
          {
            stationId: "service-worker",
            note: "Heartbeat / 401-403 path flips totem_auth_state to logged_out or stale.",
          },
          {
            stationId: "chrome-storage",
            note: "Runtime snapshot pushed to onChanged subscribers.",
          },
          {
            stationId: "runtime-store",
            note: "applyAuthPayload() stops sync, switches mode to offline_cached.",
          },
          {
            stationId: "new-tab",
            note: "List filters to bookmarks whose tweet detail is already in IndexedDB.",
          },
        ],
      },
    ] satisfies TransitFlow[],
  },
} as const;
