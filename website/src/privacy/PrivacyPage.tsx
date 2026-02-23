const SERIF = "'Spectral', Georgia, serif";

const LAST_UPDATED = "February 23, 2026";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-x-text">{title}</h2>
      <div className="mt-3 space-y-3 text-pretty text-x-text-secondary leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-x-bg text-x-text">
      <header className="mx-auto max-w-2xl px-6 pt-16 pb-4">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-x-text-secondary transition-colors hover:text-x-text"
        >
          <svg viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to Totem
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-20">
        <h1
          className="text-balance text-4xl font-bold tracking-tight"
          style={{ fontFamily: SERIF }}
        >
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-x-text-secondary">
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="Overview">
          <p>
            Totem is a Chrome extension that replaces your new tab page with a
            calm reader for your X (formerly Twitter) bookmarks. Your privacy is
            fundamental to how Totem is built: all data stays on your device, and
            no information is sent to any external server operated by Totem.
          </p>
        </Section>

        <Section title="Data collected">
          <p>
            Totem accesses the following data to function. All data is stored
            locally on your device using Chrome&apos;s built-in storage APIs and is
            never transmitted to any server controlled by Totem.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-x-text">X.com authentication tokens.</strong>{" "}
              When you browse x.com, Totem captures your authentication headers
              (OAuth bearer token, CSRF token, and session cookie) from requests
              to X&apos;s API. These tokens are stored locally and used exclusively
              to fetch your bookmarks from X&apos;s API on your behalf. They are
              never sent anywhere else.
            </li>
            <li>
              <strong className="text-x-text">X.com user ID.</strong>{" "}
              Totem reads the <code className="rounded bg-x-card px-1 py-0.5 text-xs">twid</code> cookie
              from x.com to identify which account is logged in. This is stored
              locally to manage per-user bookmark data.
            </li>
            <li>
              <strong className="text-x-text">Bookmark data.</strong>{" "}
              Your bookmarked posts are fetched from X&apos;s API and cached
              locally in your browser&apos;s IndexedDB storage for offline access
              and performance.
            </li>
            <li>
              <strong className="text-x-text">Reading progress.</strong>{" "}
              Scroll positions and read states are saved locally so you can pick
              up where you left off.
            </li>
            <li>
              <strong className="text-x-text">Preferences.</strong>{" "}
              Theme, layout, and display settings are stored in Chrome&apos;s
              local storage.
            </li>
          </ul>
        </Section>

        <Section title="Permissions explained">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-x-text">cookies</strong> &mdash; Read the{" "}
              <code className="rounded bg-x-card px-1 py-0.5 text-xs">twid</code> cookie
              from x.com to detect which account is signed in.
            </li>
            <li>
              <strong className="text-x-text">storage</strong> &mdash; Save
              authentication tokens, preferences, and cached data locally.
            </li>
            <li>
              <strong className="text-x-text">webRequest</strong> &mdash; Observe
              outgoing requests to X&apos;s GraphQL API to capture authentication
              headers and detect bookmark changes.
            </li>
            <li>
              <strong className="text-x-text">declarativeNetRequest</strong> &mdash; Set
              the correct Origin header on API requests made by the extension so
              X&apos;s servers accept them.
            </li>
            <li>
              <strong className="text-x-text">tabs</strong> &mdash; Open a
              background tab to x.com when re-authentication is needed (e.g.
              after token expiry). The tab is closed automatically.
            </li>
            <li>
              <strong className="text-x-text">host_permissions (x.com)</strong> &mdash;
              Required to read cookies, observe network requests, and make API
              calls to X.
            </li>
          </ul>
        </Section>

        <Section title="Data sharing">
          <p>
            Totem does not transmit any data to servers owned or operated by
            Totem. The only network requests made are directly to X.com&apos;s API
            to fetch and manage your bookmarks, using your own authentication
            credentials. No analytics, telemetry, or tracking of any kind is
            included.
          </p>
        </Section>

        <Section title="Data storage and security">
          <p>
            All data is stored locally on your device using Chrome&apos;s
            extension storage APIs and IndexedDB. Authentication tokens are
            stored in <code className="rounded bg-x-card px-1 py-0.5 text-xs">chrome.storage.local</code>,
            which is sandboxed to the extension and inaccessible to websites or
            other extensions. Uninstalling the extension removes all stored data.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            Totem loads fonts from Google Fonts. No other third-party services
            are used. Wallpaper images are bundled with the extension and served
            locally.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy is updated, the changes will be posted on this page
            with a revised date. Continued use of the extension after changes
            constitutes acceptance.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            If you have questions about this privacy policy, open an issue on
            the project&apos;s GitHub repository.
          </p>
        </Section>
      </main>

      <footer className="border-t border-x-border px-6 py-8">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 text-sm text-x-text-secondary">
          <a href="/" className="transition-colors hover:text-x-text">
            Totem
          </a>
          <div className="flex gap-6">
            <a
              href="https://github.com/nnnkit/totem/"
              className="transition-colors hover:text-x-text"
            >
              GitHub
            </a>
            <a
              href="/changelog"
              className="transition-colors hover:text-x-text"
            >
              Changelog
            </a>
            <a
              href="/demo"
              className="transition-colors hover:text-x-text"
            >
              Demo
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
