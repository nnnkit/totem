const SERIF = "'Spectral', Georgia, serif";

interface ReleaseProps {
  version: string;
  date: string;
  items: string[];
  latest?: boolean;
}

function Release({ version, date, items, latest }: ReleaseProps) {
  return (
    <div
      className={`border-l-2 pl-4 ${latest ? "border-accent" : "border-x-border"}`}
    >
      <h2 className="text-lg font-semibold text-x-text">
        {version}{" "}
        <span className="text-sm font-normal text-x-text-secondary">
          — {date}
        </span>
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-pretty text-x-text-secondary leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const RELEASES: ReleaseProps[] = [
  {
    version: "v1.0.2",
    date: "February 23, 2026",
    items: [
      "Rebrand to Totem with origami logo",
      "Add glass shine loading animation",
      "Update header layout and logo sizing",
    ],
    latest: true,
  },
  {
    version: "v1.0.1",
    date: "February 22, 2026",
    items: [
      "Reader view for threads and articles",
      "Reading progress tracking with auto-save",
      "Keyboard navigation (j/k, Enter, Escape)",
      "Daily wallpaper gallery",
      "Dark and light themes",
      "Search across all bookmarks",
    ],
  },
  {
    version: "v1.0.0",
    date: "February 20, 2026",
    items: [
      "Initial release",
      "New tab replacement with bookmark display",
      "Bookmark sync from X.com",
    ],
  },
];

export default function ChangelogPage() {
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
          Changelog
        </h1>
        <p className="mt-2 text-pretty text-x-text-secondary">
          What&apos;s new in Totem.
        </p>

        <div className="mt-10 space-y-8">
          {RELEASES.map((release) => (
            <Release key={release.version} {...release} />
          ))}
        </div>
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
              href="/demo"
              className="transition-colors hover:text-x-text"
            >
              Demo
            </a>
            <a
              href="/privacy"
              className="transition-colors hover:text-x-text"
            >
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
