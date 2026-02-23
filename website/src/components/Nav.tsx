import { useEffect, useState } from "react";

interface Props {
  currentPage?: string;
}

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Demo", href: "/demo" },
  { label: "Privacy", href: "/privacy" },
];

export function Nav({ currentPage }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-20 bg-x-bg/80 backdrop-blur-md border-b transition-colors ${
        scrolled ? "border-x-border" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <a href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="size-7" fill="none">
            <defs>
              <linearGradient
                id="totem-shine"
                x1="0"
                y1="0"
                x2="0.3"
                y2="1"
              >
                <stop offset="0%" stopColor="white" stopOpacity={0.45} />
                <stop offset="50%" stopColor="white" stopOpacity={0.1} />
                <stop offset="100%" stopColor="white" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d="M10 90L90 90L90 10Z" fill="#e07a5f" />
            <path d="M90 10L55 45L90 90Z" fill="#c96b50" />
            <path
              d="M55 45L90 10"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
            />
            <path d="M10 90L90 90L90 10Z" fill="url(#totem-shine)" />
          </svg>
          <span
            className="text-lg font-medium text-x-text"
            style={{ fontFamily: '"Spectral", Georgia, serif' }}
          >
            Totem
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                currentPage === link.href
                  ? "text-accent"
                  : "text-x-text-secondary hover:text-x-text"
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="https://chromewebstore.google.com"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Add to Chrome
        </a>
      </div>
    </nav>
  );
}
