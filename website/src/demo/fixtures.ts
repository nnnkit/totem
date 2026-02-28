import type {
  Bookmark,
  ThreadTweet,
  Author,
  Metrics,
  TweetUrl,
  ReadingProgress,
  UserSettings,
} from "../../../src/types";
import type { ThemePreference } from "../../../src/hooks/useTheme";

export interface DemoDetailEntry {
  focalTweet: Bookmark | null;
  thread: ThreadTweet[];
  fetchedAt?: number;
}

export interface DemoPayload {
  generatedAt?: string;
  source?: string;
  bookmarks: Bookmark[];
  detailByTweetId: Record<string, DemoDetailEntry>;
  threadByTweetId?: Record<string, ThreadTweet[]>;
  readingProgress?: ReadingProgress[];
  settings?: Partial<UserSettings>;
  themePreference?: ThemePreference;
}

export const DEFAULT_DEMO_SETTINGS: UserSettings = {
  showTopSites: false,
  showSearchBar: true,
  topSitesLimit: 5,
  backgroundMode: "images",
  searchEngine: "google",
};

interface BookmarkSeed {
  tweetId: string;
  createdAt: number;
  author: Author;
  text: string;
  article?: {
    title: string;
    plainText: string;
    coverImageUrl?: string;
  };
  urls?: TweetUrl[];
  media?: Bookmark["media"];
  quotedTweet?: Bookmark["quotedTweet"];
  retweetedTweet?: Bookmark["retweetedTweet"];
  isThread?: boolean;
  tweetKind?: Bookmark["tweetKind"];
  metrics?: Partial<Metrics>;
}

const now = Date.now();

const authors = {
  maya: {
    name: "Maya Chen",
    screenName: "maya_builds",
    profileImageUrl: "/icons/icon-128.png",
    verified: true,
    bio: "Design engineer writing about focus systems and product craft.",
  } satisfies Author,
  aman: {
    name: "Aman Gupta",
    screenName: "amangpt",
    profileImageUrl: "/icons/icon-48.png",
    verified: false,
    bio: "Product systems, frontend architecture, and developer workflows.",
  } satisfies Author,
  rhea: {
    name: "Rhea Dsouza",
    screenName: "rhea_reads",
    profileImageUrl: "/icons/icon-16.png",
    verified: true,
    bio: "Internet culture + long-form reading experiments.",
  } satisfies Author,
};

const DEFAULT_METRICS: Metrics = {
  likes: 842,
  retweets: 123,
  replies: 29,
  views: 28043,
  bookmarks: 911,
};

function sortIndexFromTimestamp(timestamp: number): string {
  return String(timestamp);
}

function createBookmark(seed: BookmarkSeed): Bookmark {
  const metrics: Metrics = {
    ...DEFAULT_METRICS,
    ...(seed.metrics ?? {}),
  };

  return {
    id: `demo-${seed.tweetId}`,
    tweetId: seed.tweetId,
    text: seed.text,
    createdAt: seed.createdAt,
    sortIndex: sortIndexFromTimestamp(seed.createdAt),
    author: seed.author,
    metrics,
    media: seed.media ?? [],
    urls: seed.urls ?? [],
    isThread: Boolean(seed.isThread),
    hasImage: (seed.media ?? []).some((item) => item.type === "photo"),
    hasVideo: (seed.media ?? []).some((item) => item.type === "video" || item.type === "animated_gif"),
    hasLink: Boolean(seed.urls?.length),
    quotedTweet: seed.quotedTweet ?? null,
    retweetedTweet: seed.retweetedTweet,
    article: seed.article
      ? {
          title: seed.article.title,
          plainText: seed.article.plainText,
          coverImageUrl: seed.article.coverImageUrl,
        }
      : null,
    tweetKind: seed.tweetKind,
  };
}

export const DEMO_BOOKMARKS: Bookmark[] = [
  createBookmark({
    tweetId: "1881000000000000001",
    createdAt: now - 1000 * 60 * 18,
    author: authors.maya,
    tweetKind: "article",
    text: "I wrote a practical guide for building a calm reading workflow on top of noisy social apps.",
    article: {
      title: "Designing A Calm Reading Queue",
      plainText:
        "Most people do not have a bookmarking problem. They have a retrieval problem. Saved posts disappear under urgency loops, so intent decays before reading starts. A better system keeps the queue visible in everyday contexts and removes feed-level triggers.\n\nThe key principle is progressive commitment: one card to start, one clean reader to continue, one explicit action to finish. No infinite list, no noisy metrics, no recommendation rail. When completion is explicit, trust in the queue increases. When trust increases, users stop hoarding and start reading.",
      coverImageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1400&q=80",
    },
    urls: [
      {
        url: "https://journal.example.com/calm-reading-queue",
        displayUrl: "journal.example.com/calm-reading-queue",
        expandedUrl: "https://journal.example.com/calm-reading-queue",
        card: {
          title: "Designing A Calm Reading Queue",
          description: "A product guide for turning saved links into completed reading.",
          domain: "journal.example.com",
        },
      },
    ],
    metrics: { likes: 1290, replies: 56, bookmarks: 2013, views: 44212 },
  }),
  createBookmark({
    tweetId: "1881000000000000002",
    createdAt: now - 1000 * 60 * 42,
    author: authors.aman,
    tweetKind: "thread",
    isThread: true,
    text: "A thread on shipping one UI to two runtimes (extension + web demo) without copy-pasting components.",
    metrics: { likes: 672, replies: 33, bookmarks: 544, retweets: 97, views: 21988 },
  }),
  createBookmark({
    tweetId: "1881000000000000003",
    createdAt: now - 1000 * 60 * 80,
    author: authors.rhea,
    tweetKind: "quote",
    text: "This line changed how I think about attention: your queue should feel like a desk, not a casino.",
    quotedTweet: {
      tweetId: "1881000000000001999",
      text: "Apps should help you return to your own intent, not hijack it.",
      createdAt: now - 1000 * 60 * 90,
      author: authors.maya,
      media: [],
      urls: [],
      article: null,
    },
    metrics: { likes: 438, replies: 21, bookmarks: 371, retweets: 52, views: 15410 },
  }),
  createBookmark({
    tweetId: "1881000000000000004",
    createdAt: now - 1000 * 60 * 145,
    author: authors.maya,
    tweetKind: "tweet",
    text: "Useful reminder: if your product says \"read later\", it should show me one thing to read now.",
    metrics: { likes: 352, replies: 18, bookmarks: 299, retweets: 41, views: 12403 },
  }),
  createBookmark({
    tweetId: "1881000000000000005",
    createdAt: now - 1000 * 60 * 190,
    author: authors.aman,
    tweetKind: "article",
    text: "Notes from testing local-first architecture for browser extensions.",
    article: {
      title: "Local-First Browser Products: Notes From Production",
      plainText:
        "If the core workflow depends on your server, the product can disappear overnight. Browser-native products should treat local storage as the source of truth and network calls as synchronization, not identity.\n\nDesign for interruption: partial sync must still leave useful state, and read progress should survive auth outages. This is less glamorous than growth loops, but it is what turns a tool into infrastructure for users.",
      coverImageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=80",
    },
    urls: [
      {
        url: "https://engineering.example.com/local-first-browser-products",
        displayUrl: "engineering.example.com/local-first-browser-products",
        expandedUrl: "https://engineering.example.com/local-first-browser-products",
        card: {
          title: "Local-First Browser Products: Notes From Production",
          description: "A field guide for resilient extension architecture.",
          domain: "engineering.example.com",
        },
      },
    ],
    metrics: { likes: 891, replies: 47, bookmarks: 1022, retweets: 138, views: 33120 },
  }),
].sort((a, b) => b.sortIndex.localeCompare(a.sortIndex));

const THREAD_LOOKUP: Record<string, ThreadTweet[]> = {
  "1881000000000000002": [
    {
      tweetId: "1881000000000000101",
      text: "1/ Start by separating UI composition from transport APIs. Components should not know whether data came from chrome.runtime or a fixture file.",
      createdAt: now - 1000 * 60 * 41,
      author: authors.aman,
      media: [],
      urls: [],
      article: null,
      tweetKind: "thread",
      isThread: true,
    },
    {
      tweetId: "1881000000000000102",
      text: "2/ Keep one rendering layer. Build an adapter for runtime-specific behavior: auth, sync, and permissions. That adapter is the only thing you swap.",
      createdAt: now - 1000 * 60 * 40,
      author: authors.aman,
      media: [],
      urls: [],
      article: null,
      tweetKind: "thread",
      isThread: true,
    },
    {
      tweetId: "1881000000000000103",
      text: "3/ Add an interactive demo page that consumes the same components. Every visual improvement now ships to both extension and marketing instantly.",
      createdAt: now - 1000 * 60 * 39,
      author: authors.aman,
      media: [],
      urls: [],
      article: null,
      tweetKind: "thread",
      isThread: true,
    },
  ],
};

export const DEMO_FALLBACK_PAYLOAD: DemoPayload = {
  generatedAt: new Date(now).toISOString(),
  source: "totem-demo-fixtures",
  bookmarks: DEMO_BOOKMARKS,
  detailByTweetId: Object.fromEntries(
    DEMO_BOOKMARKS.map((bookmark) => [
      bookmark.tweetId,
      {
        focalTweet: bookmark,
        thread: THREAD_LOOKUP[bookmark.tweetId] ?? [],
        fetchedAt: now,
      },
    ]),
  ),
  threadByTweetId: THREAD_LOOKUP,
  readingProgress: [
    {
      tweetId: DEMO_BOOKMARKS[0]?.tweetId ?? "",
      openedAt: now - 1000 * 60 * 14,
      lastReadAt: now - 1000 * 60 * 14,
      scrollY: 540,
      scrollHeight: 2400,
      completed: true,
    },
    {
      tweetId: DEMO_BOOKMARKS[1]?.tweetId ?? "",
      openedAt: now - 1000 * 60 * 7,
      lastReadAt: now - 1000 * 60 * 5,
      scrollY: 320,
      scrollHeight: 1900,
      completed: false,
    },
  ].filter((entry) => Boolean(entry.tweetId)),
  settings: DEFAULT_DEMO_SETTINGS,
  themePreference: "system",
};
