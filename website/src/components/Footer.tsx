const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Demo", href: "/demo" },
  { label: "Privacy", href: "/privacy" },
  { label: "Changelog", href: "/changelog" },
];

const communityLinks = [
  { label: "GitHub", href: "https://github.com/nnnkit/totem/" },
  {
    label: "Chrome Web Store",
    href: "https://chromewebstore.google.com",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-x-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="size-7" fill="none">
              <defs>
                <linearGradient
                  id="totem-shine-footer"
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
              <path d="M10 90L90 90L90 10Z" fill="url(#totem-shine-footer)" />
            </svg>
            <span
              className="text-lg font-medium text-x-text"
              style={{ fontFamily: '"Spectral", Georgia, serif' }}
            >
              Totem
            </span>
          </div>
          <p className="text-sm text-x-text-secondary text-pretty">
            Actually read what you saved on X.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-x-text">Product</h3>
          <ul className="flex flex-col gap-2">
            {productLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-x-text-secondary transition-colors hover:text-x-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-x-text">Community</h3>
          <ul className="flex flex-col gap-2">
            {communityLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-x-text-secondary transition-colors hover:text-x-text"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-x-border">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p className="text-xs text-x-text-secondary tabular-nums">
            &copy; 2026 Totem
          </p>
        </div>
      </div>
    </footer>
  );
}
