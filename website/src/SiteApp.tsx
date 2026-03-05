import { useEffect, useRef, useState } from "react";
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
    wide: true,
  },
  {
    title: "Speed through with shortcuts",
    body: "Navigate and triage quickly without breaking focus.",
    image: keyboardShortcutsImage,
    alt: "Totem keyboard shortcuts helping users move through saved bookmarks faster.",
  },
  {
    title: "Keep reading offline",
    body: "Continue reading when X is unavailable or your connection drops.",
    image: worksOfflineImage,
    alt: "Totem interface running with offline-ready cached reading queue.",
  },
];

const INSTALL_FAQ: FAQItem[] = [
  {
    question: "Will this need my X password?",
    answer:
      "No. Totem uses your existing logged-in session in Chrome to access your bookmarks.",
  },
  {
    question: "Does this use my data?",
    answer:
      "It only uses your bookmarks and local reading state to work as your reading queue.",
  },
  {
    question: "How quickly does it show my bookmarks?",
    answer:
      "Most users can view saved items quickly after install, with fuller sync during normal usage.",
  },
  {
    question: "Can I uninstall cleanly?",
    answer: "Yes. Removing Totem removes extension state from your browser.",
  },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

function SiteLayout({
  page: _page,
  children,
}: {
  page: SitePage;
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

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
    <div className="min-h-dvh bg-white text-neutral-900 font-[Space_Grotesk,sans-serif]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-neutral-200 transition-colors duration-200",
          scrolled ? "bg-white/90 backdrop-blur-lg" : "bg-white",
        )}
      >
        <div className="max-w-5xl mx-auto px-6 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <a
              href="/"
              className="flex items-center gap-2.5 no-underline"
              aria-label="Totem homepage"
            >
              <TotemLogo className="size-7" />
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-neutral-900 text-[0.95rem] tracking-tight">
                  Totem
                </span>
                <span className="text-[0.68rem] text-neutral-500 tracking-[0.08em]">
                  Read your X bookmarks, not the feed.
                </span>
              </span>
            </a>
            <nav className="flex items-center gap-1" aria-label="Primary">
              <a
                href={INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center px-4 py-1.5 rounded-full bg-neutral-900 text-white text-sm font-semibold no-underline transition-all hover:bg-neutral-800 active:scale-[0.97]"
              >
                Install Totem
              </a>
              <a
                href="#demo"
                className="ml-1 inline-flex items-center px-4 py-1.5 rounded-full border border-neutral-200 text-sm font-semibold text-neutral-700 no-underline transition-colors hover:text-neutral-900 hover:bg-neutral-50"
              >
                See Demo
              </a>
            </nav>
          </div>
        </div>
      </header>

      {children}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-600">
          <div className="flex flex-col gap-1.5">
            <a
              href="/"
              className="flex items-center gap-2 no-underline"
              aria-label="Totem homepage"
            >
              <TotemLogo className="size-5" />
              <span className="font-semibold text-neutral-700 text-xs tracking-tight">
                Totem
              </span>
            </a>
            <p className="text-neutral-500 text-xs">
              Read your X bookmarks, not the feed.
            </p>
          </div>
          <nav
            className="flex items-center gap-5 text-xs"
            aria-label="Footer links"
          >
            <a
              href="/privacy"
              className="no-underline text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="mailto:support@usetotem.app"
              className="no-underline text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Contact
            </a>
            <a
              href="https://github.com/nnnkit/totem"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1.5"
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

  // Poll iframe document.title to reflect it in the fake tab
  useEffect(() => {
    if (!opened) {
      setTabTitle("Totem");
      setFrameReady(false);
      return;
    }

    const interval = setInterval(() => {
      try {
        const raw = iframeRef.current?.contentDocument?.title;
        if (!raw) return;
        // BookmarkReader resets to "New Tab" on unmount — show "Totem" instead
        const display =
          raw === "New Tab" || raw.startsWith("Totem Demo") ? "Totem" : raw;
        setTabTitle(display);
      } catch {
        // cross-origin — ignore
      }
    }, 400);

    return () => clearInterval(interval);
  }, [opened]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#20232b] shadow-[0_32px_90px_rgba(0,0,0,0.48)]">
      {/* ── Tab strip ─────────────────────────────────────────── */}
      <div className="flex items-end gap-4 px-5 pt-3 bg-[#242730] border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5 pb-2.5" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>

        {opened ? (
          <div className="flex items-center gap-2 px-3.5 h-[42px] rounded-t-xl bg-[#343843] text-white/85 text-[12px] font-medium min-w-[170px] max-w-[260px] -mb-px border border-white/[0.08] border-b-transparent">
            <TotemLogo className="size-4 shrink-0" />
            <span className="truncate">{tabTitle}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpened(false);
              }}
              className="ml-auto size-5 flex items-center justify-center rounded-md text-white/35 hover:text-white/75 hover:bg-white/10 transition-colors cursor-pointer"
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
          <div className="relative -mb-px flex items-center">
            <button
              onClick={() => setOpened(true)}
              className="relative inline-flex items-center gap-2.5 h-[42px] px-5 rounded-t-xl bg-[#3a3f4a] text-white/80 hover:text-white hover:bg-[#454b58] transition-colors cursor-pointer text-[12px] font-medium border border-white/[0.08] border-b-transparent"
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
            <div
              className="absolute -right-3 top-[20px] pointer-events-none animate-bounce"
              style={{ animationDuration: "1.6s" }}
            >
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
          className="ml-auto mb-2.5 flex items-center justify-center size-6 rounded-md text-white/45 hover:text-white/80 hover:bg-white/8 transition-colors cursor-pointer"
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

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 h-9 bg-[#2b2f38] border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="flex items-center justify-center size-6 rounded-md text-white/25">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="flex items-center justify-center size-6 rounded-md text-white/25">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <div className="flex-1 h-7 rounded-full bg-[#1f222b] border border-white/[0.05]" />
      </div>

      {/* ── Content area ─────────────────────────────────────── */}
      {!opened ? (
        <div
          className="relative cursor-pointer bg-[#1f222b]"
          style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
          onClick={() => setOpened(true)}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.03),transparent_58%)]" />
          <p className="absolute left-5 bottom-4 text-[11px] tracking-[0.08em] uppercase text-white/28">
            Click &quot;New tab&quot; above
          </p>
        </div>
      ) : (
        <div
          className="relative block w-full overflow-hidden bg-[#0a0f16]"
          style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
        >
          {!frameReady && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#0a0f16]">
              <div className="text-center px-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                  Totem Demo
                </p>
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
              "block w-full border-0 bg-[#0a0f16] animate-fade-in transition-opacity duration-200",
              frameReady ? "opacity-100" : "opacity-0",
            )}
            style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
            loading="eager"
          />
        </div>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <SiteLayout page="landing">
      <main>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-4">
                Chrome Extension
              </p>
              <h1 className="font-[Newsreader,serif] text-[clamp(2.25rem,5vw,3.125rem)] leading-[1.05] tracking-tight text-neutral-900 mb-5 max-w-[18ch] text-balance">
                Read your X bookmarks, not the feed.
              </h1>
              <p className="text-neutral-500 text-lg leading-relaxed max-w-[48ch] mb-8">
                Open a new tab to read your saved posts. No feed, no algorithmic
                noise.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <a
                  href={INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center h-11 px-6 rounded-xl bg-accent-400 text-white font-semibold text-[0.95rem] no-underline transition-all hover:bg-accent-500 active:scale-[0.97]"
                >
                  {INSTALL_BUTTON_LABEL}
                </a>
                <a
                  href={DEMO_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center h-11 px-6 rounded-xl border border-neutral-200 bg-white text-neutral-900 text-[0.95rem] no-underline font-semibold transition-all hover:bg-neutral-100"
                >
                  Watch demo video
                </a>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-400 font-medium">
                <span>No account</span>
                <span className="text-neutral-200">|</span>
                <span>No backend</span>
                <span className="text-neutral-200">|</span>
                <span>Local-first</span>
              </div>
            </div>
            <aside className="lg:pt-2">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
                <iframe
                  title="Totem quick walkthrough video"
                  src={DEMO_VIDEO_EMBED_URL}
                  className="block w-full aspect-[16/10] border-0"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </aside>
          </div>
        </section>

        {/* ── Demo ──────────────────────────────────────────────── */}
        <section id="demo" className="w-full bg-neutral-950 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-6 mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-3">
              Live demo
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-3 max-w-[22ch]">
              See the experience before you install.
            </h2>
            <p className="text-neutral-500 text-sm max-w-[52ch]">
              Click the New tab button in the mock browser to open Totem. If
              this looks useful, install now.{" "}
              <a
                href="/demo-page"
                className="text-white/70 underline underline-offset-2 hover:text-white transition-colors"
              >
                Open full-page demo &rarr;
              </a>
            </p>
          </div>

          {/* Browser — wider than content, bleeds out */}
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6">
            <DemoBrowser />
          </div>

          <div className="max-w-5xl mx-auto px-6">
            <p className="text-neutral-600 text-sm mt-4">
              Works offline after first sync and keeps your reading state local.
            </p>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3 text-center">
            Features
          </p>
          <h2 className="font-[Newsreader,serif] text-[clamp(1.95rem,3.7vw,3rem)] leading-tight tracking-tight text-neutral-900 mb-3 text-center text-balance">
            <span className="block">
              Five practical features you will love.
            </span>
            <span className="block text-neutral-400">
              (Discover more once you install.)
            </span>
          </h2>
          <p className="text-neutral-500 text-[0.98rem] leading-relaxed max-w-[60ch] mx-auto text-center mb-10 text-balance">
            Everything below is already in the extension today.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className={cn(
                  "rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_36px_rgba(0,0,0,0.06)]",
                  feature.wide ? "md:col-span-2 p-4 sm:p-4" : "p-3 sm:p-3",
                )}
              >
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className={cn(
                    "w-full object-cover rounded-xl border border-neutral-200 mb-4",
                    feature.wide ? "aspect-21/9" : "aspect-16/10",
                  )}
                  loading="lazy"
                />
                <h3
                  className={cn(
                    "text-[1.2rem] leading-tight tracking-tight text-neutral-900 mb-2 font-[Newsreader,serif]",
                    feature.wide && "text-center",
                  )}
                >
                  {feature.title}
                </h3>
                <p
                  className={cn(
                    "text-[0.96rem] text-neutral-600 leading-relaxed",
                    feature.wide && "text-center max-w-[62ch] mx-auto",
                  )}
                >
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Trust & FAQ ────────────────────────────────────────── */}
        <section id="faq" className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid gap-8 md:grid-cols-[1.05fr,1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3">
                What this extension will and won&apos;t do
              </p>
              <h2 className="font-[Newsreader,serif] text-[1.8rem] leading-tight tracking-tight text-neutral-900 mb-4 text-balance">
                Permission trust, in plain language.
              </h2>
              <div className="rounded-xl border border-neutral-200 bg-neutral-100 p-4">
                <p className="text-sm text-neutral-600 m-0">
                  The extension only needs access required to read your own X
                  bookmarks and cache your reading data.
                </p>
                <p className="text-sm text-neutral-600 m-0 mt-2">
                  It does not create an account, store your feed, or upload your
                  notes anywhere.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3">
                Quick questions
              </p>
              <div className="flex flex-col gap-4">
                {INSTALL_FAQ.map((item) => (
                  <article
                    key={item.question}
                    className="rounded-xl border border-neutral-200 p-4"
                  >
                    <h3 className="text-[1rem] leading-snug tracking-tight text-neutral-900 mb-2">
                      {item.question}
                    </h3>
                    <p className="text-sm text-neutral-600 m-0 leading-relaxed">
                      {item.answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────── */}
        <section className="w-full bg-neutral-900 py-14">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-3">
              Ready to start reading your bookmarks?
            </h2>
            <p className="text-white/70 text-sm mb-8">
              No account required. No subscription. Just install and open a new
              tab.
            </p>
            <a
              href={INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-11 px-7 rounded-xl bg-white text-neutral-900 font-semibold text-[0.95rem] no-underline transition-all hover:bg-neutral-100 active:scale-[0.97]"
            >
              {FINAL_INSTALL_BUTTON_LABEL}
            </a>
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
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-2">
            Totem Legal
          </p>
          <h1 className="font-[Newsreader,serif] text-[clamp(2rem,4vw,3rem)] leading-none tracking-tight text-neutral-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-neutral-400">
            Last updated: March 2, 2026
          </p>
        </div>

        {/* Sections */}
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
              <a
                href="mailto:support@usetotem.app"
                className="text-neutral-900 underline underline-offset-2"
              >
                support@usetotem.app
              </a>
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
  children: React.ReactNode;
}) {
  return (
    <section className="border border-neutral-100 rounded-xl p-5">
      <h2 className="font-[Newsreader,serif] text-xl tracking-tight text-neutral-900 mb-3 mt-0">
        {title}
      </h2>
      <div className="text-sm text-neutral-500 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:m-0 [&_p]:m-0 [&_strong]:text-neutral-700">
        {children}
      </div>
    </section>
  );
}

// ─── Demo Page ────────────────────────────────────────────────────────────────

function DemoPage() {
  const [frameReady, setFrameReady] = useState(false);

  return (
    <div className="fixed inset-0 bg-[#0a0f16]">
      {!frameReady && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#0a0f16]">
          <div className="text-center px-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Totem Demo
            </p>
            <p className="mt-2 text-sm text-white/80">Loading preview...</p>
          </div>
        </div>
      )}
      <iframe
        title="Totem New Tab demo"
        src="demo.html"
        onLoad={() => setFrameReady(true)}
        className={cn(
          "absolute inset-0 block w-full h-full border-0 transition-opacity duration-200",
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
