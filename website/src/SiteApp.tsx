import { useEffect, useState } from "react";

export type SitePage = "landing" | "privacy";

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
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#f4a259] text-white text-sm font-extrabold shrink-0">
              T
            </span>
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
              className="ml-2 inline-flex items-center px-4 py-1.5 rounded-full bg-[#f4a259] text-white text-sm font-semibold no-underline transition-all hover:bg-[#c97b30] active:scale-[0.97]"
            >
              Add to Chrome
            </a>
          </nav>
        </div>
      </header>

      {children}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-neutral-400">
          <div className="flex flex-col gap-1">
            <a
              href="index.html"
              className="flex items-center gap-2 no-underline"
              aria-label="Totem homepage"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#f4a259] text-white text-[0.6rem] font-extrabold">
                T
              </span>
              <span className="font-bold text-neutral-500 text-xs tracking-tight">
                Totem
              </span>
            </a>
            <p className="text-neutral-400 text-xs mt-0.5">
              Actually read what you saved on X.
            </p>
          </div>
          <nav
            className="flex items-center gap-5 text-xs"
            aria-label="Footer links"
          >
            <a
              href="privacy.html"
              className="no-underline text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="mailto:support@usetotem.app"
              className="no-underline text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Contact
            </a>
          </nav>
          <p className="text-xs text-neutral-300">&copy; 2026 Totem</p>
        </div>
      </footer>
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4a259] mb-4">
            Free Chrome Extension
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
              className="inline-flex items-center h-11 px-6 rounded-xl bg-[#f4a259] text-white font-semibold text-[0.95rem] no-underline shadow-[0_4px_14px_rgba(244,162,89,0.3)] transition-all hover:bg-[#c97b30] hover:shadow-[0_6px_20px_rgba(244,162,89,0.4)] active:scale-[0.97]"
            >
              Add to Chrome &mdash; free
            </a>
            <a
              href="#demo"
              className="inline-flex items-center h-11 px-6 rounded-xl border border-neutral-200 bg-white text-neutral-700 font-semibold text-[0.95rem] no-underline transition-all hover:bg-neutral-50 active:scale-[0.97]"
            >
              See the demo &darr;
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
        <section
          id="demo"
          className="w-full bg-[#0b1118] py-16 sm:py-20"
        >
          <div className="max-w-5xl mx-auto px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4a259] mb-3">
              Live preview
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-3 max-w-[22ch]">
              Try it. Open a new tab.
            </h2>
            <p className="text-white/50 text-sm mb-8 max-w-[52ch]">
              Interactive demo below &mdash; same UI components as the extension,
              running on fixture data.
            </p>

            {/* Browser chrome */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0f1c2d] shadow-[0_24px_60px_rgba(2,10,18,0.45)]">
              <div className="flex items-center gap-3 px-4 h-11 border-b border-white/[0.07] bg-black/20">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                </div>
                <div className="flex-1 text-center text-[0.7rem] text-white/30 bg-white/[0.06] rounded-md py-1 px-3">
                  New Tab &mdash; Totem
                </div>
              </div>
              <iframe
                title="Totem New Tab demo"
                src="demo.html"
                className="block w-full border-0 bg-[#0a0f16]"
                style={{ minHeight: "clamp(480px, 60vh, 680px)" }}
                loading="lazy"
              />
            </div>

            <p className="text-white/30 text-xs mt-4">
              Demo uses fixture data. Same core components as the real extension.
            </p>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4a259] mb-3">
            What you get
          </p>
          <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[20ch]">
            Save. Open. Read.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="border border-neutral-100 rounded-xl p-5 bg-neutral-50/50"
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
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4a259] mb-3">
              Three steps
            </p>
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-neutral-900 mb-10 max-w-[26ch]">
              From saved to read in 60 seconds.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.n} className="flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f4a259] text-white text-sm font-bold flex items-center justify-center shrink-0">
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
        <section id="install" className="w-full bg-[#0b1118] py-16 sm:py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="font-[Newsreader,serif] text-[clamp(1.8rem,3.5vw,2.8rem)] leading-tight tracking-tight text-white mb-4">
              Start reading what you saved.
            </h2>
            <p className="text-white/50 text-sm mb-8">
              Free. No account. No backend.
            </p>
            <a
              href="#install"
              className="inline-flex items-center h-11 px-7 rounded-xl bg-white text-[#0b1118] font-semibold text-[0.95rem] no-underline shadow-[0_4px_14px_rgba(0,0,0,0.2)] transition-all hover:bg-neutral-100 active:scale-[0.97]"
            >
              Add to Chrome
            </a>
            <p className="text-white/25 text-xs mt-5 tracking-wide">
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f4a259] mb-2">
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
                className="text-[#c97b30] underline underline-offset-2"
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
    <section className="border border-neutral-100 rounded-xl bg-neutral-50/50 p-5">
      <h2 className="font-[Newsreader,serif] text-xl tracking-tight text-neutral-900 mb-3 mt-0">
        {title}
      </h2>
      <div className="text-sm text-neutral-500 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:m-0 [&_p]:m-0 [&_strong]:text-neutral-700">
        {children}
      </div>
    </section>
  );
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function SiteApp({ page }: SiteAppProps) {
  if (page === "privacy") return <PrivacyPage />;
  return <LandingPage />;
}
