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

export type PolicySection =
  | {
      title: string;
      items: readonly PolicySectionItem[];
    }
  | {
      title: string;
      contactLead: string;
      email: string;
      contactTail: string;
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
    tagline: "Read your X bookmarks, not the feed.",
    navAriaLabel: "Footer links",
    privacyLabel: "Privacy Policy",
    contactLabel: "Email",
    xLabel: SUPPORT_X_HANDLE,
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
          question: "Why does sync say it is already running or temporarily paused?",
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
      supportTitle: "Still stuck?",
      supportLead: "Email ",
      supportMiddle: " or message ",
      supportTail:
        " with a screenshot and what your browser or Totem is showing.",
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
    eyebrow: "Totem Legal",
    title: "Privacy Policy",
    lastUpdatedLabel: "Last updated:",
    lastUpdated: "March 2, 2026",
    sections: [
      {
        title: "1. Data Totem accesses and stores",
        items: [
          "X authentication headers captured from your own authenticated x.com GraphQL requests (including authorization, cookie, x-csrf-token, and related X client headers when present).",
          "X user ID derived from your existing session cookie.",
          "Bookmark data and tweet detail content fetched from X so you can read saved posts in Totem.",
          "Bookmark mutation signals from x.com (CreateBookmark / DeleteBookmark events, and tweet IDs when available) to keep local data in sync.",
          "Reading progress, highlights, notes, and local preferences (for example theme, search engine choice, quick-link settings, and other new-tab UI state).",
          "If you enable quick links: top-site URLs from Chrome's topSites API and favicon URLs generated by Chrome.",
        ],
      },
      {
        title: "2. Where data is stored",
        items: [
          "IndexedDB stores bookmarks, tweet detail cache, reading progress, and highlights/notes.",
          "chrome.storage.local stores runtime/auth state (including captured auth headers), mutation event queue, and GraphQL endpoint catalog metadata.",
          "chrome.storage.sync stores theme and settings (when sync storage is available).",
          "localStorage stores small local UI keys (for example selected reading tab and wallpaper index).",
          "Totem does not operate a backend database for your extension data.",
        ],
      },
      {
        title: "3. Network use and sharing",
        items: [
          "Totem sends authenticated API requests to x.com to fetch bookmarks and tweet details, and to delete bookmarks when you choose to unbookmark in Totem.",
          "Totem may fetch x.com / abs.twimg.com bundles to discover GraphQL query IDs when needed for compatibility.",
          "Search queries are sent directly to your chosen search provider (or browser default search) when you submit a search.",
          "Totem does not send analytics or behavioral telemetry to a Totem-operated server, does not sell personal data, and does not share data with ad/tracking platforms.",
        ],
      },
      {
        title: "4. Why permissions are used",
        items: [
          {
            label: "storage",
            text: "stores local bookmarks/cache/progress, auth/runtime state, and settings.",
          },
          {
            label: "webRequest / declarativeNetRequest",
            text: "enables capture of required auth/request metadata and authenticated requests to X.",
          },
          {
            label: "host permission (x.com)",
            text: "required to read your own bookmark data, run content scripts on x.com, and detect account context.",
          },
          {
            label: "optional permissions",
            text: "topSites, favicon, and search are requested on demand when you enable related features.",
          },
        ],
      },
      {
        title: "5. Data retention",
        items: [
          "Tweet detail cache: up to 30 days, then removed by cleanup logic.",
          "Bookmark mutation event cache: up to 14 days.",
          "GraphQL endpoint catalog entries: up to 30 days.",
          "Auth headers are refreshed from live x.com traffic and may remain in local storage until session/auth state changes or you remove the extension.",
        ],
      },
      {
        title: "6. Your control",
        items: [
          "You can remove the extension at any time.",
          "You can reset Totem local data from settings.",
          "Optional permission grants are managed by Chrome. Turning a feature off in Totem stops using it, but does not automatically revoke the permission from Chrome.",
          "To revoke optional permissions, use Chrome extension permission controls for Totem.",
          "Reset local data clears bookmark/content caches and most local state, but currently preserves auth/query metadata used for account continuity.",
        ],
      },
      {
        title: "7. Contact",
        contactLead: "For privacy questions, email ",
        email: SUPPORT_EMAIL,
        contactTail: ".",
      },
    ] satisfies PolicySection[],
  },
  demoPage: {
    loadingEyebrow: "Totem Demo",
    loadingText: "Loading preview...",
  },
} as const;
