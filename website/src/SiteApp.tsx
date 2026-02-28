import { useMemo, useState } from "react";

export type SitePage = "landing" | "privacy" | "support";

interface SiteAppProps {
  page: SitePage;
}

interface SiteLayoutProps {
  page: SitePage;
  children: React.ReactNode;
}

interface LinkProps {
  href: string;
  label: string;
  active?: boolean;
}

function NavLink({ href, label, active }: LinkProps) {
  return (
    <a
      href={href}
      className={`site-nav-link${active ? " is-active" : ""}`}
    >
      {label}
    </a>
  );
}

function SiteLayout({ page, children }: SiteLayoutProps) {
  return (
    <div className="site-page">
      <div className="site-radial site-radial-a" aria-hidden />
      <div className="site-radial site-radial-b" aria-hidden />
      <header className="site-header">
        <a className="site-brand" href="index.html" aria-label="Totem homepage">
          <span className="site-brand-mark" aria-hidden>
            T
          </span>
          <span className="site-brand-name">Totem</span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          <NavLink href="index.html" label="Home" active={page === "landing"} />
          <NavLink href="privacy.html" label="Privacy" active={page === "privacy"} />
          <NavLink href="support.html" label="Support" active={page === "support"} />
        </nav>
      </header>

      {children}

      <footer className="site-footer">
        <p>Totem - Actually read what you saved on X.</p>
        <div className="site-footer-links">
          <a href="privacy.html">Privacy Policy</a>
          <a href="support.html">Support</a>
          <a href="index.html#install">Install Guide</a>
        </div>
      </footer>
    </div>
  );
}

function LandingPage() {
  const [demoTab, setDemoTab] = useState<"article" | "newtab">("article");

  const principles = useMemo(
    () => [
      {
        title: "Visibility Over Friction",
        body: "Bookmarks stay in front of you in every new tab so reading starts before distraction does.",
      },
      {
        title: "Reading Over Scrolling",
        body: "One focused queue and a calm reader interface. No algorithmic feed, no infinite noise.",
      },
      {
        title: "Local-First Reliability",
        body: "Data lives in your browser with no Totem backend dependency. Your workflow does not depend on our servers.",
      },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        title: "Distraction-free reader",
        body: "Substack-style reading surface for threads, links, and long-form posts.",
      },
      {
        title: "Unread / Continue / Read",
        body: "Intentional queue states keep your backlog manageable and completion visible.",
      },
      {
        title: "Highlights and notes",
        body: "Capture what matters while reading, without leaving the page.",
      },
      {
        title: "Explicit mark as read",
        body: "No auto-completion guesses. If you did not click it, it is not marked done.",
      },
      {
        title: "Offline-friendly",
        body: "Cached bookmark details and reading progress keep working when network is unstable.",
      },
      {
        title: "Fast keyboard workflow",
        body: "Open, navigate, and finish reading with shortcuts designed for everyday use.",
      },
    ],
    [],
  );

  const permissions = useMemo(
    () => [
      {
        title: "storage",
        body: "Stores bookmarks, highlights, notes, and progress locally in your browser.",
      },
      {
        title: "webRequest + declarativeNetRequest",
        body: "Uses your existing X session to fetch your own bookmarks.",
      },
      {
        title: "topSites / favicon / search (optional)",
        body: "Only used when you enable quick links or browser-default search integration.",
      },
    ],
    [],
  );

  return (
    <SiteLayout page="landing">
      <main>
        <section className="site-hero" id="top">
          <p className="site-eyebrow">Chrome Extension for Focused Reading</p>
          <h1>Actually read what you saved on X.</h1>
          <p className="site-hero-copy">
            Totem turns your new tab into a calm reading surface so bookmarked posts stop disappearing in the feed loop.
          </p>
          <div className="site-hero-actions">
            <a className="site-btn site-btn-primary" href="#demo">
              Try Interactive Demo
            </a>
            <a className="site-btn site-btn-secondary" href="#install">
              Installation Guide
            </a>
          </div>
          <div className="site-hero-stats" role="list" aria-label="Product highlights">
            <div role="listitem">
              <strong>Local-first</strong>
              <span>No Totem backend required</span>
            </div>
            <div role="listitem">
              <strong>Calm UX</strong>
              <span>One queue, one reader, no feed recreation</span>
            </div>
            <div role="listitem">
              <strong>Reader tools</strong>
              <span>Highlights, notes, and completion tracking</span>
            </div>
          </div>
        </section>

        <section className="site-section" aria-labelledby="principles-title">
          <div className="site-section-head">
            <p>Product soul</p>
            <h2 id="principles-title">Built for focused completion, not passive scrolling.</h2>
          </div>
          <div className="site-grid site-grid-3">
            {principles.map((item) => (
              <article className="site-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-section" aria-labelledby="features-title">
          <div className="site-section-head">
            <p>Core features</p>
            <h2 id="features-title">Everything users need to move from saved to read.</h2>
          </div>
          <div className="site-grid site-grid-3">
            {features.map((item) => (
              <article className="site-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-section" id="demo" aria-labelledby="demo-title">
          <div className="site-section-head">
            <p>Live preview</p>
            <h2 id="demo-title">Switch tabs and open a real Totem New Tab demo.</h2>
          </div>

          <div className="site-browser" role="region" aria-label="Interactive browser preview">
            <div className="site-browser-top">
              <div className="site-browser-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="site-browser-tabs" role="tablist" aria-label="Preview tabs">
                <button
                  type="button"
                  role="tab"
                  aria-selected={demoTab === "article"}
                  className={`site-browser-tab${demoTab === "article" ? " is-active" : ""}`}
                  onClick={() => setDemoTab("article")}
                >
                  Regular Website
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={demoTab === "newtab"}
                  className={`site-browser-tab${demoTab === "newtab" ? " is-active" : ""}`}
                  onClick={() => setDemoTab("newtab")}
                >
                  New Tab
                </button>
              </div>
            </div>

            <div className="site-browser-view">
              {demoTab === "article" ? (
                <div className="site-feed-mock">
                  <aside>
                    <h3>Trending distractions</h3>
                    <ul>
                      <li>14 threads you never planned to read</li>
                      <li>Breaking takes every 3 minutes</li>
                      <li>Recommended accounts you did not ask for</li>
                    </ul>
                  </aside>
                  <article>
                    <h3>Your intent before opening X</h3>
                    <p>
                      "Read my saved posts on systems design and product thinking." Totem protects this intent by opening a queue-first reading space in your new tab.
                    </p>
                    <p>
                      Click <strong>New Tab</strong> above to see the interactive experience with dummy data, including list view, reader view, and settings.
                    </p>
                  </article>
                </div>
              ) : (
                <iframe
                  title="Totem New Tab demo"
                  src="demo.html"
                  className="site-demo-frame"
                  loading="lazy"
                />
              )}
            </div>
          </div>

          <p className="site-note">
            Demo note: preview uses fixture data, but renders the same core UI components as the extension.
          </p>
        </section>

        <section className="site-section" id="install" aria-labelledby="install-title">
          <div className="site-section-head">
            <p>Install and trust</p>
            <h2 id="install-title">What users and Chrome reviewers need to see.</h2>
          </div>

          <div className="site-grid site-grid-2">
            <article className="site-card site-card-tall">
              <h3>Installation flow</h3>
              <ol>
                <li>Install Totem from the Chrome Web Store.</li>
                <li>Keep your existing X login session active in Chrome.</li>
                <li>Open a new tab to launch Totem.</li>
                <li>Start reading from Unread, Continue, or Read tabs.</li>
              </ol>
            </article>

            <article className="site-card site-card-tall">
              <h3>Chrome Web Store pages</h3>
              <ul>
                <li>
                  <a href="privacy.html">Privacy Policy</a>
                  <span>Complete disclosure of data collection, storage, and retention.</span>
                </li>
                <li>
                  <a href="support.html">Support</a>
                  <span>Contact, troubleshooting, and usage guidance.</span>
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="site-section" aria-labelledby="permissions-title">
          <div className="site-section-head">
            <p>Permission transparency</p>
            <h2 id="permissions-title">Why each permission exists.</h2>
          </div>

          <div className="site-grid site-grid-3">
            {permissions.map((item) => (
              <article className="site-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

function PrivacyPage() {
  return (
    <SiteLayout page="privacy">
      <main className="site-doc">
        <header>
          <p>Totem Legal</p>
          <h1>Privacy Policy</h1>
          <p>Last updated: February 28, 2026</p>
        </header>

        <section>
          <h2>1. What Totem collects</h2>
          <ul>
            <li>X authentication headers from your active browser session (authorization, cookie, CSRF token).</li>
            <li>X user ID derived from your existing session cookie.</li>
            <li>Your bookmarked posts and related content needed for reading.</li>
            <li>Reading progress, highlights, and notes created inside Totem.</li>
            <li>Local user preferences such as theme and new tab settings.</li>
          </ul>
        </section>

        <section>
          <h2>2. Where data is stored</h2>
          <ul>
            <li>Primary storage: local browser storage (IndexedDB + chrome.storage.local).</li>
            <li>Settings sync: chrome.storage.sync when available in Chrome.</li>
            <li>Totem does not operate a backend database for user content.</li>
          </ul>
        </section>

        <section>
          <h2>3. What Totem does not collect</h2>
          <ul>
            <li>No analytics or behavioral telemetry sent to a Totem server.</li>
            <li>No sale of personal data.</li>
            <li>No sharing with third-party ad or tracking platforms.</li>
          </ul>
        </section>

        <section>
          <h2>4. Why permissions are used</h2>
          <ul>
            <li><strong>storage</strong>: saves bookmarks, progress, notes, and settings locally.</li>
            <li><strong>webRequest / declarativeNetRequest</strong>: enables authenticated calls to X on your behalf.</li>
            <li><strong>host permission (x.com)</strong>: required to read your own bookmark data and detect account context.</li>
            <li><strong>optional permissions</strong> (`topSites`, `favicon`, `search`) only apply when you enable those features.</li>
          </ul>
        </section>

        <section>
          <h2>5. Data retention</h2>
          <ul>
            <li>Tweet detail cache: up to 30 days, then removed by cleanup logic.</li>
            <li>Bookmark mutation event cache: up to 14 days.</li>
            <li>Local data persists until you clear browser storage or remove Totem.</li>
          </ul>
        </section>

        <section>
          <h2>6. Your control</h2>
          <ul>
            <li>You can remove the extension at any time.</li>
            <li>You can reset Totem local data from settings.</li>
            <li>You can disable optional permissions by toggling related features off.</li>
          </ul>
        </section>

        <section>
          <h2>7. Contact</h2>
          <p>
            For privacy questions, visit <a href="support.html">Support</a> and use the contact channel listed there.
          </p>
        </section>
      </main>
    </SiteLayout>
  );
}

function SupportPage() {
  return (
    <SiteLayout page="support">
      <main className="site-doc">
        <header>
          <p>Totem Help</p>
          <h1>Support</h1>
          <p>Guides for installation, troubleshooting, and reporting issues.</p>
        </header>

        <section>
          <h2>1. Getting started</h2>
          <ol>
            <li>Install Totem from the Chrome Web Store.</li>
            <li>Log in to X in the same Chrome profile.</li>
            <li>Open a new tab to launch Totem.</li>
            <li>Use Sync if your bookmark list is not yet populated.</li>
          </ol>
        </section>

        <section>
          <h2>2. Common issues</h2>
          <ul>
            <li><strong>No bookmarks appear:</strong> confirm your X session is active, then click Sync.</li>
            <li><strong>Re-auth prompts:</strong> open X in a normal tab, refresh session, and return to Totem.</li>
            <li><strong>Missing highlights:</strong> check if local browser storage was cleared.</li>
            <li><strong>Top sites not visible:</strong> enable quick links in settings and allow optional permission.</li>
          </ul>
        </section>

        <section>
          <h2>3. Reporting a bug</h2>
          <p>
            Please include your Chrome version, Totem version, and exact reproduction steps.
          </p>
          <p>
            Preferred channel: <a href="mailto:support@usetotem.app">support@usetotem.app</a>.
          </p>
        </section>

        <section>
          <h2>4. Security and privacy questions</h2>
          <p>
            Read the <a href="privacy.html">Privacy Policy</a> for full data handling details.
          </p>
        </section>
      </main>
    </SiteLayout>
  );
}

export function SiteApp({ page }: SiteAppProps) {
  if (page === "privacy") return <PrivacyPage />;
  if (page === "support") return <SupportPage />;
  return <LandingPage />;
}
