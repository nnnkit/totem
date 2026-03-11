import cleanReaderImage from "./feature-previews/clean-reader.jpg";
import highlightsNotesImage from "./feature-previews/highlights-notes.jpg";
import readingStatesImage from "./feature-previews/reading-states.jpg";
import worksOfflineImage from "./feature-previews/works-offline.jpg";
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_URL,
  SUPPORT_X_HANDLE,
  SUPPORT_X_URL,
} from "../../src/lib/constants/support";

export type FeatureItem = {
  title: string;
  body: string;
  image: string;
  alt: string;
  wide?: boolean;
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

const chromeWebStoreInstallUrl = "";
const demoVideoEmbedUrl =
  "https://www.youtube.com/embed/75RNtgMHsPA?rel=0&modestbranding=1";
const githubReleaseUrl = "https://github.com/nnnkit/totem/releases/latest";
const hasWebStoreInstall = Boolean(chromeWebStoreInstallUrl);
const installUrl = hasWebStoreInstall
  ? chromeWebStoreInstallUrl
  : githubReleaseUrl;
const installButtonLabel = hasWebStoreInstall
  ? "Install from Chrome Web Store"
  : "Install extension";
const featureItems: FeatureItem[] = [
  {
    title: "Clean reader, zero feed noise",
    body: "Read saved posts in a calmer layout made for long-form scanning.",
    image: cleanReaderImage,
    alt: "Totem clean reader view showing saved X bookmarks without feed distractions.",
  },
  {
    title: "Unread, Continue, and Read states",
    body: "Your queue auto-organizes so you always know what to pick next.",
    image: readingStatesImage,
    alt: "Totem reading states showing unread, continue, and read progress.",
  },
  {
    title: "Highlight and save notes",
    body: "Select text while reading and keep notes where the insight happened.",
    image: highlightsNotesImage,
    alt: "Totem highlights and notes feature in the reader.",
  },
  {
    title: "Keep reading offline",
    body: "Continue reading when X is unavailable or your connection drops.",
    image: worksOfflineImage,
    alt: "Totem interface running with offline-ready cached reading queue.",
  },
];

export const SITE_LINKS = {
  installUrl,
  demoVideoEmbedUrl,
  demoPageUrl: "/demo-page",
  privacyUrl: "/privacy",
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
    installLabel: "Install Totem",
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
      title: "See the experience before you install.",
      description:
        "Click the New tab button in the mock browser to open Totem. If this looks useful, install now. ",
      linkLabel: "Open full-page demo →",
      note: "Works offline after first sync and keeps your reading state local.",
    },
    features: {
      eyebrow: "Features",
      title: "Features you will love.",
      description: "Discover more once you install.",
      items: featureItems,
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
            "No. Totem uses your existing X account in the same browser profile, so just log in to X there and open it once.",
        },
        {
          question: "Does Totem upload my notes or reading history anywhere?",
          answer:
            "No. Totem has no backend of its own, and your highlights, notes, and reading progress stay on this device.",
        },
        {
          question: "Why don’t my bookmarks appear right away?",
          answer:
            "First sync can take a moment because Totem has to connect to your X account and build the local reading queue. Click Sync and give it a minute before trying again.",
        },
        {
          question:
            "Why does sync say it is already running or temporarily paused?",
          answer:
            "Totem spaces sync attempts so it does not start duplicate work or hit X too quickly. Wait a minute, then try Sync again.",
        },
        {
          question: "Why isn’t Totem opening on every new tab?",
          answer:
            "Another extension, another browser profile, or a managed browser setting may be taking over your new tab page. Check that Totem is enabled in this profile and disable any other new-tab extensions.",
        },
        {
          question: "Why does it work in one browser profile but not another?",
          answer:
            "Extensions, X logins, and optional permissions are separate per browser profile. Install Totem and log in to X in the exact profile where you want to use it.",
        },
        {
          question: "Why am I seeing “Offline mode”?",
          answer:
            "Totem is showing bookmarks already saved on this device because you are logged out of X.",
        },
        {
          question:
            "What happens to my highlights, notes, and read state if I log out of X?",
          answer:
            "Your reading state, highlights and notes will stays on the device. You can access it until you reset local data.",
        },
        {
          question:
            "Why did the browser ask for permission when I turned on Quick Links?",
          answer:
            "Quick Links uses your browser’s top sites and favicon access, so the browser asks before Totem can show that data.",
        },
        {
          question:
            "If I turn a feature off, does the browser revoke that permission automatically?",
          answer:
            "No. Turning the feature off stops Totem from using it, but the browser keeps the permission until you remove it in extension settings.",
        },
        {
          question: "How do I reset Totem on this device?",
          answer:
            "Open Settings in the new tab page, choose Reset local data, then confirm the reset. Remember you will loose all the local state like highlights, notes and reading status.",
        },
        {
          question: "What does Reset local data delete?",
          answer:
            "It clears the local bookmarks cache, highlights, notes, reading progress, and all other saved state on that device.",
        },
        {
          question: "Why did my highlights, notes, or read progress disappear?",
          answer:
            "That usually means Totem was reset, you changed browser profiles, or you are looking on a different device.",
        },
        {
          question: "What should I do if Totem looks stuck?",
          answer:
            "Open X once, return to Totem, and try Sync again. If it still does not recover, use Reset local data.",
        },
      ] satisfies FAQItem[],
      finalCtaTitle: "Ready to start reading your bookmarks?",
      finalCtaDescription:
        "No account required. No subscription. Just install and open a new tab.",
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
} as const;
