import { useEffect } from "react";

const STORE_URL = "https://chromewebstore.google.com";

export default function InstallPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = STORE_URL;
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-x-bg text-x-text">
      <svg viewBox="0 0 100 100" className="size-16" fill="none">
        <defs>
          <linearGradient id="totem-shine-install" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity={0.45} />
            <stop offset="50%" stopColor="white" stopOpacity={0.1} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d="M10 90L90 90L90 10Z" fill="#e07a5f" />
        <path d="M90 10L55 45L90 90Z" fill="#c96b50" />
        <path d="M55 45L90 10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <path d="M10 90L90 90L90 10Z" fill="url(#totem-shine-install)" />
      </svg>

      <div className="mt-6 size-5 animate-spin rounded-full border-2 border-x-border border-t-accent" />

      <p className="mt-4 text-pretty text-x-text-secondary">
        Taking you to the Chrome Web Store...
      </p>

      <a
        href={STORE_URL}
        className="mt-3 text-sm text-accent transition-colors hover:text-accent/80"
      >
        Click here if you&apos;re not redirected
      </a>
    </div>
  );
}
