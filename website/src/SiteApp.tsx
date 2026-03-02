import { useEffect, useRef, useState } from "react";
import { TotemLogo } from "../../src/components/TotemLogo";

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

// ─── Layout ───────────────────────────────────────────────────────────────────

function SiteLayout({
  page,
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
        className={`sticky top-0 z-50 border-b border-neutral-200 transition-colors duration-200 ${
          scrolled
            ? "bg-white/90 backdrop-blur-lg"
            : "bg-white"
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 h-14">
          <a
            href="index.html"
            className="flex items-center gap-2.5 no-underline"
            aria-label="Totem homepage"
          >
            <TotemLogo className="size-7" />
            <span className="font-bold text-neutral-900 text-[0.95rem] tracking-tight">
              Totem
            </span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Primary">
            <a
              href="privacy.html"
              className={`px-3 py-1.5 rounded-full text-sm font-medium no-underline transition-colors ${
                page === "privacy"
                  ? "text-neutral-900 bg-neutral-100"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              Privacy
            </a>
            <a
              href="#install"
              className="ml-1 inline-flex items-center px-4 py-1.5 rounded-full bg-neutral-900 text-white text-sm font-semibold no-underline transition-all hover:bg-neutral-800 active:scale-[0.97]"
            >
              Add to Chrome
            </a>
          </nav>
        </div>
      </header>

      {children}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-600">
          <div className="flex flex-col gap-1.5">
            <a
              href="index.html"
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
              href="privacy.html"
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
  const [opened, setOpened] = useState(false);
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
            window.open("demo-page.html", "_blank", "noopener,noreferrer");
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
            className={`block w-full border-0 bg-[#0a0f16] animate-fade-in transition-opacity duration-200 ${
              frameReady ? "opacity-100" : "opacity-0"
            }`}
            style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
            loading="eager"
          />
        </div>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "Clean reader",
    body: "Read threads, articles, and links without feed clutter.",
  },
  {
    title: "Simple reading states",
    body: "Track what is unread, in progress, and done.",
  },
  {
    title: "Highlights & notes",
    body: "Highlight lines and add notes while you read.",
  },
  {
    title: "Manual mark as read",
    body: "Nothing auto-completes. You choose when an item is done.",
  },
  {
    title: "Works offline",
    body: "Cached content and progress stay available without internet.",
  },
  {
    title: "Keyboard shortcuts",
    body: "Move faster with shortcuts for navigation and reading actions.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Save on X",
    body: "Bookmark any post on X. Totem syncs it.",
  },
  {
    n: "2",
    title: "Open a new tab",
    body: "Your reading queue appears instantly.",
  },
  {
    n: "3",
    title: "Read and finish",
    body: "Read, highlight, add notes, then mark as read.",
  },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  return (
    <SiteLayout page="landing">
      <main>
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-4">
            Chrome Extension
          </p>
          <h1 className="font-[Newsreader,serif] text-[clamp(2.25rem,5vw,3.125rem)] leading-[1.05] tracking-tight text-neutral-900 mb-5 max-w-[18ch] text-balance">
            Read your X bookmarks, not the feed.
          </h1>
          <p className="text-neutral-500 text-lg leading-relaxed max-w-[48ch] mb-8">
            Totem replaces your Chrome new tab with a focused reading queue, so
            you can read saved posts without getting pulled back into X.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <a
              href="#install"
              className="inline-flex items-center h-11 px-6 rounded-xl bg-accent-400 text-white font-semibold text-[0.95rem] no-underline transition-all hover:bg-accent-500 active:scale-[0.97]"
            >
              Add to Chrome
            </a>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-400 font-medium">
            <span>No account</span>
            <span className="text-neutral-200">|</span>
            <span>No backend</span>
            <span className="text-neutral-200">|</span>
            <span>Local-first</span>
          </div>
        </section>

        {/* ── Demo ──────────────────────────────────────────────── */}
        <section id="demo" className="w-full bg-neutral-950 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-6 mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-3">
              Live demo
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-3 max-w-[22ch]">
              See Totem in action.
            </h2>
            <p className="text-neutral-500 text-sm max-w-[52ch]">
              Click the New tab button in the mock browser to open Totem.{" "}
              <a
                href="demo-page.html"
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
            <p className="text-neutral-600 text-xs mt-4">
              Demo uses fixture data and the same core UI as the extension.
            </p>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3">
            What you get
          </p>
          <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[20ch]">
            Clear workflow. Less noise.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="border border-neutral-100 rounded-xl p-5"
              >
                <h3 className="text-[0.95rem] font-semibold text-neutral-900 mb-1.5">
                  {f.title}
                </h3>
                <p className="text-sm text-neutral-500 leading-relaxed m-0">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────── */}
        <section className="border-t border-neutral-100">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3">
              How it works
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[26ch]">
              From bookmark to done in three steps.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {step.n}
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-neutral-900 m-0">
                    {step.title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed m-0">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Band ──────────────────────────────────────────── */}
        <section id="install" className="w-full bg-neutral-950 py-16 sm:py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-4">
              Start reading your saved posts.
            </h2>
            <p className="text-neutral-500 text-sm mb-8">
              Free. Local-first. No account.
            </p>
            <a
              href="#install"
              className="inline-flex items-center h-11 px-7 rounded-xl bg-white text-neutral-900 font-semibold text-[0.95rem] no-underline transition-all hover:bg-neutral-100 active:scale-[0.97]"
            >
              Add to Chrome
            </a>
            <p className="text-neutral-700 text-xs mt-5 tracking-wide">
              Local-first &middot; 0 servers &middot; No feed
            </p>
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
                Totem-operated server, does not sell personal data, and does
                not share data with ad/tracking platforms.
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
              <li>
                GraphQL endpoint catalog entries: up to 30 days.
              </li>
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
        className={`absolute inset-0 block w-full h-full border-0 transition-opacity duration-200 ${
          frameReady ? "opacity-100" : "opacity-0"
        }`}
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
