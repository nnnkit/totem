export function DemoBanner() {
  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-accent/95 px-4 py-2 text-white">
      <span className="text-sm font-medium">
        You&apos;re exploring a live demo of Totem
      </span>
      <span className="hidden text-white/40 sm:inline">&middot;</span>
      <span className="hidden text-sm text-white/80 sm:inline">
        Install to use with your own bookmarks
      </span>
      <a
        href="https://chromewebstore.google.com/detail/totem/kdgbhpgmfejfndkhgobbanoihjkpogbb"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
      >
        Install Extension &rarr;
      </a>
    </div>
  );
}
