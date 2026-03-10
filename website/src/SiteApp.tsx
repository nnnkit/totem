import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "../../src/lib/cn";
import { TotemLogo } from "../../src/components/TotemLogo";
import cleanReaderImage from "./feature-previews/clean-reader.jpg";
import highlightsNotesImage from "./feature-previews/highlights-notes.jpg";
import keyboardShortcutsImage from "./feature-previews/keyboard-shortcuts.jpg";
import readingStatesImage from "./feature-previews/reading-states.jpg";
import worksOfflineImage from "./feature-previews/works-offline.jpg";

// ─── Icons ────────────────────────────────────────────────────────────────────

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export type SitePage = "landing" | "privacy" | "demo";

interface SiteAppProps {
  page: SitePage;
}

// Set this once the Chrome Web Store listing is live. Falls back to GitHub release path when empty.
const CHROME_WEB_STORE_INSTALL_URL = "";
const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=dummy";
const DEMO_VIDEO_EMBED_URL =
  "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1";
const GITHUB_RELEASE_URL = "https://github.com/nnnkit/totem/releases/latest";
const HAS_WEB_STORE_INSTALL = Boolean(CHROME_WEB_STORE_INSTALL_URL);
const INSTALL_URL = HAS_WEB_STORE_INSTALL
  ? CHROME_WEB_STORE_INSTALL_URL
  : GITHUB_RELEASE_URL;

const INSTALL_BUTTON_LABEL = HAS_WEB_STORE_INSTALL
  ? "Install from Chrome Web Store"
  : "Install extension";

const FINAL_INSTALL_BUTTON_LABEL = HAS_WEB_STORE_INSTALL
  ? "Install from Chrome Web Store"
  : "Install extension";

type FeatureItem = {
  title: string;
  body: string;
  image: string;
  alt: string;
  wide?: boolean;
};

type FAQItem = {
  question: string;
  answer: string;
};

const FEATURES: FeatureItem[] = [
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

const FAQ_ITEMS: FAQItem[] = [
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
];

type SiteButtonVariant = "primary" | "secondary";
type SiteButtonSize = "default" | "pill";
type SiteHeadingSize = "hero" | "section" | "page" | "card";

const siteButtonBaseClass =
  "inline-flex items-center justify-center gap-2 no-underline font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

const siteButtonVariantClasses: Record<SiteButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-700",
  secondary:
    "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100",
};

const siteButtonSizeClasses: Record<SiteButtonSize, string> = {
  default: "h-11 rounded-xl px-6 text-sm",
  pill: "h-10 rounded-full px-4 text-sm",
};

const siteHeadingClasses: Record<SiteHeadingSize, string> = {
  hero: "text-balance text-5xl leading-tight",
  section: "text-balance text-4xl leading-tight",
  page: "text-balance text-4xl leading-tight",
  card: "text-2xl leading-tight",
};

const siteBodyLinkClass =
  "font-medium text-neutral-900 underline underline-offset-4 transition-colors duration-200 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

const siteFooterLinkClass =
  "rounded-sm text-xs text-neutral-600 no-underline transition-colors duration-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

function SiteButtonLink({
  variant = "primary",
  size = "default",
  className,
  target,
  rel,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: SiteButtonVariant;
  size?: SiteButtonSize;
  children: ReactNode;
}) {
  const safeRel = target === "_blank" ? (rel ?? "noopener noreferrer") : rel;

  return (
    <a
      {...props}
      target={target}
      rel={safeRel}
      className={cn(
        siteButtonBaseClass,
        siteButtonVariantClasses[variant],
        siteButtonSizeClasses[size],
        className,
      )}
    >
      {children}
    </a>
  );
}

function SiteBodyLink({
  className,
  target,
  rel,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  const safeRel = target === "_blank" ? (rel ?? "noopener noreferrer") : rel;

  return (
    <a
      {...props}
      target={target}
      rel={safeRel}
      className={cn(siteBodyLinkClass, className)}
    >
      {children}
    </a>
  );
}

function SiteEyebrow({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "muted" | "inverse";
  className?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "inverse"
      ? "text-white/60"
      : tone === "muted"
        ? "text-neutral-500"
        : "text-neutral-400";

  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-widest",
        toneClass,
        className,
      )}
    >
      {children}
    </p>
  );
}

function SiteHeading({
  as,
  size = "section",
  tone = "default",
  className,
  children,
}: {
  as?: ElementType;
  size?: SiteHeadingSize;
  tone?: "default" | "inverse";
  className?: string;
  children: ReactNode;
}) {
  const Component = (as ?? "h2") as ElementType;

  return (
    <Component
      className={cn(
        "font-serif tracking-tight",
        siteHeadingClasses[size],
        tone === "inverse" ? "text-white" : "text-neutral-900",
        className,
      )}
    >
      {children}
    </Component>
  );
}

function SiteSection({
  id,
  className,
  containerClassName,
  children,
}: {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={className}>
      <div className={cn("mx-auto w-full max-w-5xl px-6", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

function SiteCard({
  as,
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white shadow-site-card",
        className,
      )}
    >
      {children}
    </Component>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function SiteLayout({
  page,
  children,
}: {
  page: SitePage;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const demoHref = page === "landing" ? "#demo" : "/#demo";

  useEffect(() => {
    let rafId = 0;
    let ticking = false;

    const updateScrollState = () => {
      ticking = false;
      setScrolled((current) => {
        const next = window.scrollY > 20;
        return current === next ? current : next;
      });
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(updateScrollState);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-white font-site-sans text-neutral-900">
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-neutral-200 transition-colors duration-200",
          scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-2.5">
          <a
            href="/"
            className="flex items-center gap-2.5 no-underline"
            aria-label="Totem homepage"
          >
            <TotemLogo className="size-7" />
            <span className="text-sm font-bold tracking-tight text-neutral-900">
              Totem
            </span>
          </a>

          <nav className="flex items-center gap-2" aria-label="Primary">
            <SiteButtonLink
              href={INSTALL_URL}
              target="_blank"
              variant="primary"
              size="pill"
            >
              Install Totem
            </SiteButtonLink>
            <SiteButtonLink href={demoHref} variant="secondary" size="pill">
              See Demo
            </SiteButtonLink>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <a
              href="/"
              className="flex items-center gap-2 no-underline"
              aria-label="Totem homepage"
            >
              <TotemLogo className="size-5" />
              <span className="text-xs font-semibold tracking-tight text-neutral-700">
                Totem
              </span>
            </a>
            <p className="text-xs text-neutral-500">
              Read your X bookmarks, not the feed.
            </p>
          </div>

          <nav className="flex items-center gap-5" aria-label="Footer links">
            <a href="/privacy" className={siteFooterLinkClass}>
              Privacy Policy
            </a>
            <a
              href="mailto:support@usetotem.app"
              className={siteFooterLinkClass}
            >
              Contact
            </a>
            <a
              href="https://github.com/nnnkit/totem"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                siteFooterLinkClass,
                "inline-flex items-center gap-1.5",
              )}
            >
              <GitHubIcon className="size-3.5" />
              GitHub
            </a>
          </nav>

          <p className="text-xs text-neutral-500">&copy; 2026 Totem</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Demo Browser Mockup ──────────────────────────────────────────────────────

function DemoBrowser() {
  const [opened, setOpened] = useState(true);
  const [frameReady, setFrameReady] = useState(false);
  const [tabTitle, setTabTitle] = useState("Totem");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!opened) {
      setTabTitle("Totem");
      setFrameReady(false);
      return;
    }

    const interval = window.setInterval(() => {
      try {
        const raw = iframeRef.current?.contentDocument?.title;
        if (!raw) return;

        const display =
          raw === "New Tab" || raw.startsWith("Totem Demo") ? "Totem" : raw;
        setTabTitle(display);
      } catch {
        // Ignore cross-origin access while the iframe is booting.
      }
    }, 400);

    return () => window.clearInterval(interval);
  }, [opened]);

  return (
    <div className="site-browser-shell">
      <div className="site-browser-strip">
        <div className="site-browser-window-controls" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>

        {opened ? (
          <div className="site-browser-tab">
            <TotemLogo className="size-4 shrink-0" />
            <span className="truncate">{tabTitle}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpened(false);
              }}
              className="site-browser-close-button"
              aria-label="Close tab"
            >
              <svg
                viewBox="0 0 12 12"
                className="size-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="site-browser-launcher">
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="site-browser-launcher-button"
              aria-label="Open new tab"
            >
              <svg
                viewBox="0 0 12 12"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
              <span>New tab</span>
            </button>
            <div className="site-browser-pointer">
              <svg width="18" height="22" viewBox="0 0 24 30" fill="none">
                <path
                  d="M7 1L7 19L11.5 15.5L15 23L17.5 22L14 14.5L19.5 13.5L7 1Z"
                  fill="white"
                  stroke="#202124"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            window.open("/demo-page", "_blank", "noopener,noreferrer");
          }}
          className="site-browser-action-button"
          aria-label="Open full-page demo"
          title="Open full-page demo"
        >
          <svg
            viewBox="0 0 20 20"
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 12L3 17" />
            <path d="M6 17H3v-3" />
            <path d="M12 8l5-5" />
            <path d="M14 3h3v3" />
          </svg>
        </button>
      </div>

      <div className="site-browser-toolbar">
        <div className="site-browser-nav" aria-hidden="true">
          <span className="site-browser-nav-button">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="site-browser-nav-button">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <div className="site-browser-urlbar" />
      </div>

      {!opened ? (
        <div
          className="site-browser-stage site-browser-closed-stage"
          onClick={() => setOpened(true)}
        >
          <div className="site-browser-glow" />
          <p className="site-browser-hint">Click &quot;New tab&quot; above</p>
        </div>
      ) : (
        <div className="site-browser-stage site-browser-screen">
          {!frameReady && (
            <div className="site-browser-loading">
              <div className="px-6 text-center">
                <SiteEyebrow tone="inverse" className="text-white/45">
                  Totem Demo
                </SiteEyebrow>
                <p className="mt-2 text-sm text-white/80">Loading preview...</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="Totem New Tab demo"
            src="demo.html"
            onLoad={() => setFrameReady(true)}
            className={cn(
              "site-browser-frame",
              frameReady ? "opacity-100" : "opacity-0",
            )}
            loading="eager"
          />
        </div>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function FAQDisclosure({ item }: { item: FAQItem }) {
  return (
    <details className="rounded-xl border border-neutral-200 bg-white transition-colors duration-200 open:border-neutral-300">
      <summary className="site-summary-reset flex min-h-11 cursor-pointer items-start gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-base leading-snug tracking-tight text-neutral-900">
            {item.question}
          </h4>
        </div>
        <span
          aria-hidden="true"
          className="pt-0.5 text-lg leading-none text-neutral-300"
        >
          +
        </span>
      </summary>
      <div className="border-t border-neutral-200 px-4 py-3.5">
        <p className="m-0 text-sm leading-relaxed text-neutral-600">
          {item.answer}
        </p>
      </div>
    </details>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <SiteLayout page="landing">
      <main>
        <SiteSection containerClassName="max-w-6xl py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <SiteEyebrow className="mb-4">Chrome Extension</SiteEyebrow>
              <SiteHeading as="h1" size="hero" className="mb-5 max-w-xl">
                Read your X bookmarks, not the feed.
              </SiteHeading>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed text-neutral-500">
                Open a new tab to read your saved posts. No feed, no algorithmic
                noise.
              </p>
              <div className="mb-8 flex flex-wrap gap-3">
                <SiteButtonLink
                  href={INSTALL_URL}
                  target="_blank"
                  variant="primary"
                >
                  {INSTALL_BUTTON_LABEL}
                </SiteButtonLink>
                <SiteButtonLink
                  href={DEMO_VIDEO_URL}
                  target="_blank"
                  variant="secondary"
                >
                  Watch demo video
                </SiteButtonLink>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-neutral-400">
                <span>No account</span>
                <span aria-hidden="true" className="text-neutral-300">
                  •
                </span>
                <span>No backend</span>
                <span aria-hidden="true" className="text-neutral-300">
                  •
                </span>
                <span>Local-first</span>
              </div>
            </div>

            <aside className="lg:pt-2">
              <SiteCard className="overflow-hidden bg-neutral-950 shadow-site-frame">
                <iframe
                  title="Totem quick walkthrough video"
                  src={DEMO_VIDEO_EMBED_URL}
                  className="block aspect-video w-full border-0"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </SiteCard>
            </aside>
          </div>
        </SiteSection>

        <section id="demo" className="bg-neutral-950 py-16 sm:py-20">
          <div className="mx-auto mb-8 w-full max-w-5xl px-6">
            <SiteEyebrow tone="inverse" className="mb-3">
              Live demo
            </SiteEyebrow>
            <SiteHeading
              as="h2"
              size="section"
              tone="inverse"
              className="mb-3 max-w-lg"
            >
              See the experience before you install.
            </SiteHeading>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
              Click the New tab button in the mock browser to open Totem. If
              this looks useful, install now.{" "}
              <SiteBodyLink
                href="/demo-page"
                className="text-white/70 hover:text-white"
              >
                Open full-page demo &rarr;
              </SiteBodyLink>
            </p>
          </div>

          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
            <DemoBrowser />
          </div>

          <div className="mx-auto mt-4 w-full max-w-5xl px-6">
            <p className="text-sm text-neutral-600">
              Works offline after first sync and keeps your reading state local.
            </p>
          </div>
        </section>

        <SiteSection className="py-16 sm:py-20">
          <SiteEyebrow className="mb-3 text-center">Features</SiteEyebrow>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <SiteHeading as="h2" size="section" className="mb-3">
              Features you will love.
            </SiteHeading>
            <p className="text-lg leading-relaxed text-neutral-400">
              Discover more once you install.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <SiteCard
                as="article"
                key={feature.title}
                className={cn(feature.wide && "md:col-span-2", "p-4")}
              >
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className="mb-4 aspect-video w-full rounded-xl border border-neutral-200 object-cover"
                  loading="lazy"
                />
                <SiteHeading
                  as="h3"
                  size="card"
                  className={cn("mb-2", feature.wide && "text-center")}
                >
                  {feature.title}
                </SiteHeading>
                <p
                  className={cn(
                    "text-sm leading-relaxed text-neutral-600",
                    feature.wide && "mx-auto max-w-3xl text-center",
                  )}
                >
                  {feature.body}
                </p>
              </SiteCard>
            ))}
          </div>
        </SiteSection>

        <SiteSection id="faq" className="py-16 sm:py-20">
          <div className="max-w-4xl">
            <div className="mb-8 max-w-3xl">
              <SiteHeading as="h2" size="section">
                FAQ
              </SiteHeading>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Totem does not ask for your X password and does not run its own
                backend. Your notes and reading state stay local on this device.
                For the full breakdown of permissions and storage, read the{" "}
                <SiteBodyLink href="/privacy">privacy page</SiteBodyLink>.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <FAQDisclosure key={item.question} item={item} />
              ))}
            </div>

            <SiteCard className="mt-5 p-5">
              <p className="m-0 text-sm font-medium text-neutral-900">
                Still stuck?
              </p>
              <p className="m-0 mt-2 text-sm leading-relaxed text-neutral-600">
                Email{" "}
                <SiteBodyLink href="mailto:support@usetotem.app">
                  support@usetotem.app
                </SiteBodyLink>{" "}
                with a screenshot and what your browser or Totem is showing.
              </p>
            </SiteCard>
          </div>
        </SiteSection>

        <section className="bg-neutral-900 py-14">
          <div className="mx-auto w-full max-w-xl px-6 text-center">
            <SiteHeading as="h2" size="section" tone="inverse" className="mb-3">
              Ready to start reading your bookmarks?
            </SiteHeading>
            <p className="mb-8 text-sm text-white/70">
              No account required. No subscription. Just install and open a new
              tab.
            </p>
            <SiteButtonLink
              href={INSTALL_URL}
              target="_blank"
              variant="secondary"
            >
              {FINAL_INSTALL_BUTTON_LABEL}
            </SiteButtonLink>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

// ─── Privacy Page ─────────────────────────────────────────────────────────────

function PrivacyPage() {
  return (
    <SiteLayout page="privacy">
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="mb-10">
          <SiteEyebrow className="mb-2">Totem Legal</SiteEyebrow>
          <SiteHeading as="h1" size="page" className="mb-2">
            Privacy Policy
          </SiteHeading>
          <p className="text-sm text-neutral-400">
            Last updated: March 2, 2026
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <PolicySection title="1. Data Totem accesses and stores">
            <ul>
              <li>
                X authentication headers captured from your own authenticated
                x.com GraphQL requests (including authorization, cookie,
                x-csrf-token, and related X client headers when present).
              </li>
              <li>X user ID derived from your existing session cookie.</li>
              <li>
                Bookmark data and tweet detail content fetched from X so you can
                read saved posts in Totem.
              </li>
              <li>
                Bookmark mutation signals from x.com (CreateBookmark /
                DeleteBookmark events, and tweet IDs when available) to keep
                local data in sync.
              </li>
              <li>
                Reading progress, highlights, notes, and local preferences (for
                example theme, search engine choice, quick-link settings, and
                other new-tab UI state).
              </li>
              <li>
                If you enable quick links: top-site URLs from Chrome's topSites
                API and favicon URLs generated by Chrome.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="2. Where data is stored">
            <ul>
              <li>
                IndexedDB stores bookmarks, tweet detail cache, reading
                progress, and highlights/notes.
              </li>
              <li>
                chrome.storage.local stores runtime/auth state (including
                captured auth headers), mutation event queue, and GraphQL
                endpoint catalog metadata.
              </li>
              <li>
                chrome.storage.sync stores theme and settings (when sync storage
                is available).
              </li>
              <li>
                localStorage stores small local UI keys (for example selected
                reading tab and wallpaper index).
              </li>
              <li>
                Totem does not operate a backend database for your extension
                data.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="3. Network use and sharing">
            <ul>
              <li>
                Totem sends authenticated API requests to x.com to fetch
                bookmarks and tweet details, and to delete bookmarks when you
                choose to unbookmark in Totem.
              </li>
              <li>
                Totem may fetch x.com / abs.twimg.com bundles to discover
                GraphQL query IDs when needed for compatibility.
              </li>
              <li>
                Search queries are sent directly to your chosen search provider
                (or browser default search) when you submit a search.
              </li>
              <li>
                Totem does not send analytics or behavioral telemetry to a
                Totem-operated server, does not sell personal data, and does not
                share data with ad/tracking platforms.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="4. Why permissions are used">
            <ul>
              <li>
                <strong>storage</strong>: stores local bookmarks/cache/progress,
                auth/runtime state, and settings.
              </li>
              <li>
                <strong>webRequest / declarativeNetRequest</strong>: enables
                capture of required auth/request metadata and authenticated
                requests to X.
              </li>
              <li>
                <strong>host permission (x.com)</strong>: required to read your
                own bookmark data, run content scripts on x.com, and detect
                account context.
              </li>
              <li>
                <strong>optional permissions</strong> (topSites, favicon,
                search) are requested on demand when you enable related
                features.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="5. Data retention">
            <ul>
              <li>
                Tweet detail cache: up to 30 days, then removed by cleanup
                logic.
              </li>
              <li>Bookmark mutation event cache: up to 14 days.</li>
              <li>GraphQL endpoint catalog entries: up to 30 days.</li>
              <li>
                Auth headers are refreshed from live x.com traffic and may
                remain in local storage until session/auth state changes or you
                remove the extension.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="6. Your control">
            <ul>
              <li>You can remove the extension at any time.</li>
              <li>You can reset Totem local data from settings.</li>
              <li>
                Optional permission grants are managed by Chrome. Turning a
                feature off in Totem stops using it, but does not automatically
                revoke the permission from Chrome.
              </li>
              <li>
                To revoke optional permissions, use Chrome extension permission
                controls for Totem.
              </li>
              <li>
                Reset local data clears bookmark/content caches and most local
                state, but currently preserves auth/query metadata used for
                account continuity.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="7. Contact">
            <p>
              For privacy questions, email{" "}
              <SiteBodyLink href="mailto:support@usetotem.app">
                support@usetotem.app
              </SiteBodyLink>
              .
            </p>
          </PolicySection>
        </div>
      </main>
    </SiteLayout>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SiteCard as="section" className="p-5 shadow-none">
      <SiteHeading as="h2" size="card" className="mb-3 mt-0">
        {title}
      </SiteHeading>
      <div className="site-legal-copy">{children}</div>
    </SiteCard>
  );
}

// ─── Demo Page ────────────────────────────────────────────────────────────────

function DemoPage() {
  const [frameReady, setFrameReady] = useState(false);

  return (
    <div className="site-demo-page">
      {!frameReady && (
        <div className="site-browser-loading">
          <div className="px-6 text-center">
            <SiteEyebrow tone="inverse" className="text-white/45">
              Totem Demo
            </SiteEyebrow>
            <p className="mt-2 text-sm text-white/80">Loading preview...</p>
          </div>
        </div>
      )}
      <iframe
        title="Totem New Tab demo"
        src="demo.html"
        onLoad={() => setFrameReady(true)}
        className={cn(
          "absolute inset-0 h-full w-full border-0 transition-opacity duration-200",
          frameReady ? "opacity-100" : "opacity-0",
        )}
        loading="eager"
      />
    </div>
  );
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function SiteApp({ page }: SiteAppProps) {
  if (page === "privacy") return <PrivacyPage />;
  if (page === "demo") return <DemoPage />;
  return <LandingPage />;
}
