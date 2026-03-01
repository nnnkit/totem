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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-white text-neutral-900 font-[Space_Grotesk,sans-serif]">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled
            ? "bg-white/90 backdrop-blur-lg border-b border-neutral-200"
            : "border-b border-transparent"
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
              Actually read what you saved on X.
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
  const [tabTitle, setTabTitle] = useState("Totem");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Poll iframe document.title to reflect it in the fake tab
  useEffect(() => {
    if (!opened) {
      setTabTitle("Totem");
      return;
    }

    const interval = setInterval(() => {
      try {
        const raw = iframeRef.current?.contentDocument?.title;
        if (!raw) return;
        // BookmarkReader resets to "New Tab" on unmount — show "Totem" instead
        const display = raw === "New Tab" || raw.startsWith("Totem Demo") ? "Totem" : raw;
        setTabTitle(display);
      } catch {
        // cross-origin — ignore
      }
    }, 400);

    return () => clearInterval(interval);
  }, [opened]);

  return (
    <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-white/[0.06] bg-[#202124] shadow-2xl">
      {/* ── Tab bar (traffic lights + tabs in one row) ─────── */}
      <div className="flex items-end px-3 pt-3 bg-[#202124]">
        {/* macOS traffic lights — vertically centered */}
        <div className="flex items-center gap-2 pb-2 pr-4" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Totem tab — only when opened */}
        {opened && (
          <div className="flex items-center gap-2 px-4 h-[34px] rounded-t-lg bg-[#292a2d] text-white/90 text-[11px] font-medium min-w-[160px] max-w-[220px] -mb-px">
            <TotemLogo className="size-3.5 shrink-0" />
            <span className="truncate">{tabTitle}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpened(false);
              }}
              className="ml-auto size-4 flex items-center justify-center rounded-sm text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close tab"
            >
              <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
        )}

        {/* "+" new tab button */}
        {!opened && (
          <div className="relative flex items-center h-[34px] -mb-px">
            {/* Pulse ring */}
            <span className="absolute inset-0 m-auto size-8 rounded-lg bg-white/20 animate-demo-pulse pointer-events-none" />
            <button
              onClick={() => setOpened(true)}
              className="relative flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-lg bg-white/[0.12] text-white/70 hover:text-white hover:bg-white/[0.2] transition-colors cursor-pointer text-[11px] font-medium"
              aria-label="Open new tab"
            >
              <svg
                viewBox="0 0 12 12"
                className="size-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="6" y1="1" x2="6" y2="11" />
                <line x1="1" y1="6" x2="11" y2="6" />
              </svg>
              <span className="hidden sm:inline">New tab</span>
            </button>

            {/* Animated cursor pointing at this button */}
            <div className="absolute -bottom-5 left-1/2 pointer-events-none animate-demo-cursor">
              <svg
                width="24"
                height="30"
                viewBox="0 0 24 30"
                fill="none"
              >
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

        {/* Spacer */}
        <div className="flex-1" />
      </div>

      {/* ── Toolbar (address bar + nav) ────────────────────── */}
      <div className="flex items-center gap-2 px-3 h-10 bg-[#292a2d] border-b border-white/[0.05]">
        {/* Nav buttons */}
        <div className="flex items-center gap-0.5" aria-hidden="true">
          <span className="flex items-center justify-center size-7 rounded text-white/20">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="flex items-center justify-center size-7 rounded text-white/20">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          <span className="flex items-center justify-center size-7 rounded text-white/20">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </span>
        </div>

        {/* Address bar */}
        <div className="flex-1 flex items-center justify-center text-[11px] text-white/30 bg-[#202124] rounded-full py-1.5 px-4 border border-white/[0.04]">
          <svg viewBox="0 0 16 16" className="size-3 mr-1.5 text-white/15" fill="currentColor">
            <path fillRule="evenodd" d="M8 1a4.5 4.5 0 00-4.5 4.5V7H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-.5V5.5A4.5 4.5 0 008 1zm2.5 6V5.5a2.5 2.5 0 10-5 0V7h5z" clipRule="evenodd" />
          </svg>
          chrome://newtab
        </div>

        {/* Right side icons */}
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="flex items-center justify-center size-7 rounded text-white/20">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </span>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────── */}
      {!opened ? (
        <div
          className="flex flex-col items-center justify-center text-center px-6 cursor-pointer select-none group bg-[#202124]"
          style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
          onClick={() => setOpened(true)}
        >
          <div className="mb-5 size-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors">
            <svg
              viewBox="0 0 24 24"
              className="size-6 text-white/25 group-hover:text-white/45 transition-colors"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <p className="text-white/40 text-sm font-medium mb-1 text-pretty">
            Open a new tab
          </p>
          <p className="text-white/20 text-xs text-pretty">
            Click the <span className="text-white/40 font-medium">+</span> button above or anywhere here
          </p>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          title="Totem New Tab demo"
          src="demo.html"
          className="block w-full border-0 bg-[#0a0f16] animate-fade-in"
          style={{ minHeight: "clamp(540px, 65vh, 760px)" }}
          loading="eager"
        />
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "Distraction-free reader",
    body: "A clean reading surface for threads, articles, and linked posts.",
  },
  {
    title: "Unread / Continue / Read",
    body: "Three queue states. Never lose track of where you left off.",
  },
  {
    title: "Highlights & notes",
    body: "Select any passage to highlight it. Add notes. Everything stays local.",
  },
  {
    title: "Explicit mark-as-read",
    body: "You decide when something is done. No scroll-based guessing.",
  },
  {
    title: "Offline-friendly",
    body: "Cached content and progress keep working without a connection.",
  },
  {
    title: "Keyboard-first",
    body: "Navigate, read, and finish with shortcuts built for daily use.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Bookmark on X",
    body: "Save posts normally. Totem syncs them automatically.",
  },
  {
    n: "2",
    title: "Open a new tab",
    body: "Your reading queue replaces the new tab. No feed.",
  },
  {
    n: "3",
    title: "Read, highlight, done",
    body: "Work through posts. Highlight, annotate, mark complete.",
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
          <h1 className="font-[Newsreader,serif] text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-neutral-900 mb-5 max-w-[18ch] text-balance">
            Actually read what you saved on X.
          </h1>
          <p className="text-neutral-500 text-lg leading-relaxed max-w-[48ch] mb-8">
            Totem turns every new tab into a calm reading queue for your X
            bookmarks. No feed. No noise.
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
            <span>No backend</span>
            <span className="text-neutral-200">|</span>
            <span>No account</span>
            <span className="text-neutral-200">|</span>
            <span>100% local</span>
          </div>
        </section>

        {/* ── Demo ──────────────────────────────────────────────── */}
        <section id="demo" className="w-full bg-neutral-950 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-6 mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-3">
              Live preview
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-3 max-w-[22ch]">
              Try it. Open a new tab.
            </h2>
            <p className="text-neutral-500 text-sm max-w-[52ch]">
              Click the + tab to see exactly what Totem looks like when you open
              a new tab.{" "}
              <a
                href="demo-page.html"
                className="text-white/70 underline underline-offset-2 hover:text-white transition-colors"
              >
                Try the full-page experience &rarr;
              </a>
            </p>
          </div>

          {/* Browser — wider than content, bleeds out */}
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6">
            <DemoBrowser />
          </div>

          <div className="max-w-5xl mx-auto px-6">
            <p className="text-neutral-600 text-xs mt-4">
              Demo uses fixture data. Same core components as the real extension.
            </p>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-3">
            What you get
          </p>
          <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[20ch]">
            Save. Open. Read.
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
              Three steps
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[26ch]">
              From saved to read in 60 seconds.
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
              Start reading what you saved.
            </h2>
            <p className="text-neutral-500 text-sm mb-8">
              No account. No backend.
            </p>
            <a
              href="#install"
              className="inline-flex items-center h-11 px-7 rounded-xl bg-white text-neutral-900 font-semibold text-[0.95rem] no-underline transition-all hover:bg-neutral-100 active:scale-[0.97]"
            >
              Add to Chrome
            </a>
            <p className="text-neutral-700 text-xs mt-5 tracking-wide">
              Local-first &middot; 0 servers &middot; No feed recreation
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
            Last updated: February 28, 2026
          </p>
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-5">
          <PolicySection title="1. What Totem collects">
            <ul>
              <li>
                X authentication headers from your active browser session
                (authorization, cookie, CSRF token).
              </li>
              <li>X user ID derived from your existing session cookie.</li>
              <li>
                Your bookmarked posts and related content needed for reading.
              </li>
              <li>
                Reading progress, highlights, and notes created inside Totem.
              </li>
              <li>
                Local user preferences such as theme and new tab settings.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="2. Where data is stored">
            <ul>
              <li>
                Primary storage: local browser storage (IndexedDB +
                chrome.storage.local).
              </li>
              <li>
                Settings sync: chrome.storage.sync when available in Chrome.
              </li>
              <li>
                Totem does not operate a backend database for user content.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="3. What Totem does not collect">
            <ul>
              <li>
                No analytics or behavioral telemetry sent to a Totem server.
              </li>
              <li>No sale of personal data.</li>
              <li>No sharing with third-party ad or tracking platforms.</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. Why permissions are used">
            <ul>
              <li>
                <strong>storage</strong>: saves bookmarks, progress, notes, and
                settings locally.
              </li>
              <li>
                <strong>webRequest / declarativeNetRequest</strong>: enables
                authenticated calls to X on your behalf.
              </li>
              <li>
                <strong>host permission (x.com)</strong>: required to read your
                own bookmark data and detect account context.
              </li>
              <li>
                <strong>optional permissions</strong> (topSites, favicon, search)
                only apply when you enable those features.
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
                Local data persists until you clear browser storage or remove
                Totem.
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="6. Your control">
            <ul>
              <li>You can remove the extension at any time.</li>
              <li>You can reset Totem local data from settings.</li>
              <li>
                You can disable optional permissions by toggling related features
                off.
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
  return (
    <iframe
      title="Totem New Tab demo"
      src="demo.html"
      className="fixed inset-0 block w-full h-full border-0"
      loading="eager"
    />
  );
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function SiteApp({ page }: SiteAppProps) {
  if (page === "privacy") return <PrivacyPage />;
  if (page === "demo") return <DemoPage />;
  return <LandingPage />;
}
