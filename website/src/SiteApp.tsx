import { EnvelopeSimpleIcon, XLogoIcon } from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "../../src/lib/cn";
import { TotemLogo } from "../../src/components/TotemLogo";
import {
  SITE_COPY,
  SITE_LINKS,
  type FAQItem,
  type PolicySection as PolicySectionData,
  type PolicySectionItem,
} from "./site-content";

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

type SiteButtonVariant = "primary" | "secondary";
type SiteButtonSize = "default" | "pill";
type SiteHeadingSize = "hero" | "section" | "page" | "card";

const siteButtonBaseClass =
  "inline-flex items-center justify-center gap-2 no-underline font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

const siteButtonVariantClasses: Record<SiteButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-700",
  secondary:
    "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100",
};

const siteButtonSizeClasses: Record<SiteButtonSize, string> = {
  default: "h-11 rounded-xl px-6 text-sm",
  pill: "h-10 rounded-full px-4 text-sm",
};

const siteHeadingClasses: Record<SiteHeadingSize, string> = {
  hero: "text-balance text-5xl leading-tight",
  section: "text-balance text-4xl leading-tight",
  page: "text-balance text-4xl leading-tight",
  card: "text-2xl leading-tight",
};

const siteBodyLinkClass =
  "font-medium text-neutral-900 underline underline-offset-4 transition-colors duration-200 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

const siteFooterLinkClass =
  "rounded-sm text-xs text-neutral-600 no-underline transition-colors duration-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";

function SiteButtonLink({
  variant = "primary",
  size = "default",
  className,
  target,
  rel,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: SiteButtonVariant;
  size?: SiteButtonSize;
  children: ReactNode;
}) {
  const safeRel = target === "_blank" ? (rel ?? "noopener noreferrer") : rel;

  return (
    <a
      {...props}
      target={target}
      rel={safeRel}
      className={cn(
        siteButtonBaseClass,
        siteButtonVariantClasses[variant],
        siteButtonSizeClasses[size],
        className,
      )}
    >
      {children}
    </a>
  );
}

function SiteBodyLink({
  className,
  target,
  rel,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) {
  const safeRel = target === "_blank" ? (rel ?? "noopener noreferrer") : rel;

  return (
    <a
      {...props}
      target={target}
      rel={safeRel}
      className={cn(siteBodyLinkClass, className)}
    >
      {children}
    </a>
  );
}

function SiteEyebrow({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "muted" | "inverse";
  className?: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "inverse"
      ? "text-white/60"
      : tone === "muted"
        ? "text-neutral-500"
        : "text-neutral-400";

  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-widest",
        toneClass,
        className,
      )}
    >
      {children}
    </p>
  );
}

function SiteHeading({
  as,
  size = "section",
  tone = "default",
  className,
  children,
}: {
  as?: ElementType;
  size?: SiteHeadingSize;
  tone?: "default" | "inverse";
  className?: string;
  children: ReactNode;
}) {
  const Component = (as ?? "h2") as ElementType;

  return (
    <Component
      className={cn(
        "font-serif tracking-tight",
        siteHeadingClasses[size],
        tone === "inverse" ? "text-white" : "text-neutral-900",
        className,
      )}
    >
      {children}
    </Component>
  );
}

function SiteSection({
  id,
  className,
  containerClassName,
  children,
}: {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={className}>
      <div className={cn("mx-auto w-full max-w-5xl px-6", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

function SiteCard({
  as,
  className,
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component
      className={cn(
        "rounded-2xl border border-neutral-200 bg-white shadow-site-card",
        className,
      )}
    >
      {children}
    </Component>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function SiteLayout({
  page,
  children,
}: {
  page: SitePage;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const demoHref = page === "landing" ? "#demo" : "/#demo";
  const { footer, header } = SITE_COPY;

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
    <div className="min-h-dvh bg-white font-site-sans text-neutral-900">
      <header
        className={cn(
          "sticky top-0 z-50 border-b border-neutral-200 transition-colors duration-200",
          scrolled ? "bg-white/90 backdrop-blur-md" : "bg-white",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-2.5">
          <a
            href="/"
            className="flex items-center gap-2.5 no-underline"
            aria-label={header.brandAriaLabel}
          >
            <TotemLogo className="size-7" />
            <span className="text-sm font-bold tracking-tight text-neutral-900">
              {header.brandName}
            </span>
          </a>

          <nav
            className="flex items-center gap-2"
            aria-label={header.navAriaLabel}
          >
            <SiteButtonLink
              href={SITE_LINKS.installUrl}
              target="_blank"
              variant="primary"
              size="pill"
            >
              {header.installLabel}
            </SiteButtonLink>
            <SiteButtonLink href={demoHref} variant="secondary" size="pill">
              {header.demoLabel}
            </SiteButtonLink>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <a
              href="/"
              className="flex items-center gap-2 no-underline"
              aria-label={footer.brandAriaLabel}
            >
              <TotemLogo className="size-5" />
              <span className="text-xs font-semibold tracking-tight text-neutral-700">
                {header.brandName}
              </span>
            </a>
          </div>

          <nav
            className="flex items-center gap-5"
            aria-label={footer.navAriaLabel}
          >
            <a href={SITE_LINKS.privacyUrl} className={siteFooterLinkClass}>
              {footer.privacyLabel}
            </a>
            <a
              href={SITE_LINKS.supportEmailUrl}
              className={cn(
                siteFooterLinkClass,
                "inline-flex items-center justify-center",
              )}
              aria-label="Email support"
              title="Email support"
            >
              <EnvelopeSimpleIcon className="size-3.5" />
            </a>
            <a
              href={SITE_LINKS.supportXUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                siteFooterLinkClass,
                "inline-flex items-center justify-center",
              )}
              aria-label={`Open ${SITE_LINKS.supportXHandle} on X`}
              title={SITE_LINKS.supportXHandle}
            >
              <XLogoIcon className="size-3.5" />
            </a>
            <a
              href={SITE_LINKS.githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                siteFooterLinkClass,
                "inline-flex items-center gap-1.5",
              )}
            >
              <GitHubIcon className="size-3.5" />
            </a>
          </nav>

          <p className="text-xs text-neutral-500">{footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Demo Browser Mockup ──────────────────────────────────────────────────────

function DemoBrowser() {
  const { browser } = SITE_COPY;
  const [opened, setOpened] = useState(true);
  const [frameReady, setFrameReady] = useState(false);
  const [tabTitle, setTabTitle] = useState<string>(browser.defaultTabTitle);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!opened) {
      setTabTitle(browser.defaultTabTitle);
      setFrameReady(false);
      return;
    }

    const interval = window.setInterval(() => {
      try {
        const raw = iframeRef.current?.contentDocument?.title;
        if (!raw) return;

        const display =
          raw === browser.newTabTitle ||
          raw.startsWith(browser.demoTabTitlePrefix)
            ? browser.defaultTabTitle
            : raw;
        setTabTitle(display);
      } catch {
        // Ignore cross-origin access while the iframe is booting.
      }
    }, 400);

    return () => window.clearInterval(interval);
  }, [
    browser.defaultTabTitle,
    browser.demoTabTitlePrefix,
    browser.newTabTitle,
    opened,
  ]);

  return (
    <div className="site-browser-shell">
      <div className="site-browser-strip">
        <div className="site-browser-window-controls" aria-hidden="true">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>

        {opened ? (
          <div className="site-browser-tab">
            <TotemLogo className="size-4 shrink-0" />
            <span className="truncate">{tabTitle}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpened(false);
              }}
              className="site-browser-close-button"
              aria-label={browser.closeTabLabel}
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
          <div className="site-browser-launcher">
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="site-browser-launcher-button"
              aria-label={browser.launcherLabel}
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
              <span>{browser.launcherText}</span>
            </button>
            <div className="site-browser-pointer">
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
            window.open(
              SITE_LINKS.demoPageUrl,
              "_blank",
              "noopener,noreferrer",
            );
          }}
          className="site-browser-action-button"
          aria-label={browser.fullPageDemoAriaLabel}
          title={browser.fullPageDemoTitle}
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

      <div className="site-browser-toolbar">
        <div className="site-browser-nav" aria-hidden="true">
          <span className="site-browser-nav-button">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <span className="site-browser-nav-button">
            <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <div className="site-browser-urlbar" />
      </div>

      {!opened ? (
        <div
          className="site-browser-stage site-browser-closed-stage"
          onClick={() => setOpened(true)}
        >
          <div className="site-browser-glow" />
          <p className="site-browser-hint">{browser.closedHint}</p>
        </div>
      ) : (
        <div className="site-browser-stage site-browser-screen">
          {!frameReady && (
            <div className="site-browser-loading">
              <div className="px-6 text-center">
                <SiteEyebrow tone="inverse" className="text-white/45">
                  {browser.loadingEyebrow}
                </SiteEyebrow>
                <p className="mt-2 text-sm text-white/80">
                  {browser.loadingText}
                </p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title={browser.frameTitle}
            src="demo.html"
            onLoad={() => setFrameReady(true)}
            className={cn(
              "site-browser-frame",
              frameReady ? "opacity-100" : "opacity-0",
            )}
            loading="eager"
          />
        </div>
      )}
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function FAQDisclosure({ item }: { item: FAQItem }) {
  return (
    <details className="rounded-xl border border-neutral-200 bg-white transition-colors duration-200 open:border-neutral-300">
      <summary className="site-summary-reset flex min-h-11 cursor-pointer items-start gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-base leading-snug tracking-tight text-neutral-900">
            {item.question}
          </h4>
        </div>
        <span
          aria-hidden="true"
          className="pt-0.5 text-lg leading-none text-neutral-300"
        >
          +
        </span>
      </summary>
      <div className="border-t border-neutral-200 px-4 py-3.5">
        <p className="m-0 text-sm leading-relaxed text-neutral-600">
          {item.answer}
        </p>
      </div>
    </details>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage() {
  const { faq, features, hero, demo } = SITE_COPY.landing;

  return (
    <SiteLayout page="landing">
      <main>
        <SiteSection containerClassName="max-w-6xl py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <SiteEyebrow className="mb-4">{hero.eyebrow}</SiteEyebrow>
              <SiteHeading as="h1" size="hero" className="mb-5 max-w-xl">
                {hero.title}
              </SiteHeading>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed text-neutral-500">
                {hero.description}
              </p>
              <div className="mb-8 flex flex-wrap gap-3">
                <SiteButtonLink
                  href={SITE_LINKS.installUrl}
                  target="_blank"
                  variant="primary"
                >
                  {hero.installButtonLabel}
                </SiteButtonLink>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-neutral-400">
                {hero.chips.map((chip, index) => (
                  <span key={chip} className="contents">
                    {index > 0 ? (
                      <span aria-hidden="true" className="text-neutral-300">
                        •
                      </span>
                    ) : null}
                    <span>{chip}</span>
                  </span>
                ))}
              </div>
            </div>

            <aside className="lg:pt-2">
              <SiteCard className="overflow-hidden bg-neutral-950 shadow-site-frame">
                <iframe
                  title={hero.videoTitle}
                  src={SITE_LINKS.demoVideoEmbedUrl}
                  className="block aspect-video w-full border-0"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </SiteCard>
            </aside>
          </div>
        </SiteSection>

        <section id="demo" className="bg-neutral-950 py-16 sm:py-20">
          <div className="mx-auto mb-8 w-full max-w-5xl px-6">
            <SiteEyebrow tone="inverse" className="mb-3">
              {demo.eyebrow}
            </SiteEyebrow>
            <SiteHeading
              as="h2"
              size="section"
              tone="inverse"
              className="mb-3 max-w-lg"
            >
              {demo.title}
            </SiteHeading>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
              {demo.description}{" "}
              <SiteBodyLink
                href={SITE_LINKS.demoPageUrl}
                className="text-white/70 hover:text-white"
              >
                {demo.linkLabel}
              </SiteBodyLink>
            </p>
          </div>

          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
            <DemoBrowser />
          </div>

          <div className="mx-auto mt-4 w-full max-w-5xl px-6">
            <p className="text-sm text-neutral-600">{demo.note}</p>
          </div>
        </section>

        <SiteSection className="py-16 sm:py-20">
          <SiteEyebrow className="mb-3 text-center">
            {features.eyebrow}
          </SiteEyebrow>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <SiteHeading as="h2" size="section" className="mb-3">
              {features.title}
            </SiteHeading>
            <p className="text-lg leading-relaxed text-neutral-400">
              {features.description}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {features.items.map((feature) => (
              <SiteCard
                as="article"
                key={feature.title}
                className={cn(feature.wide && "md:col-span-2", "p-4")}
              >
                <img
                  src={feature.image}
                  alt={feature.alt}
                  className="mb-4 aspect-video w-full rounded-xl border border-neutral-200 object-cover"
                  loading="lazy"
                />
                <SiteHeading
                  as="h3"
                  size="card"
                  className={cn("mb-2", feature.wide && "text-center")}
                >
                  {feature.title}
                </SiteHeading>
                <p
                  className={cn(
                    "text-sm leading-relaxed text-neutral-600",
                    feature.wide && "mx-auto max-w-3xl text-center",
                  )}
                >
                  {feature.body}
                </p>
              </SiteCard>
            ))}
          </div>
        </SiteSection>

        <SiteSection id="faq" className="py-16 sm:py-20">
          <div className="max-w-4xl">
            <div className="mb-8 max-w-3xl">
              <SiteHeading as="h2" size="section">
                {faq.title}
              </SiteHeading>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                {faq.introBefore}
                <SiteBodyLink href={SITE_LINKS.privacyUrl}>
                  {faq.introLinkLabel}
                </SiteBodyLink>
                {faq.introAfter}
              </p>
            </div>

            <div className="space-y-3">
              {faq.items.map((item) => (
                <FAQDisclosure key={item.question} item={item} />
              ))}
            </div>
          </div>
        </SiteSection>

        <section className="bg-neutral-900 py-14">
          <div className="mx-auto w-full max-w-xl px-6 text-center">
            <SiteHeading as="h2" size="section" tone="inverse" className="mb-3">
              {faq.finalCtaTitle}
            </SiteHeading>
            <p className="mb-8 text-sm text-white/70">
              {faq.finalCtaDescription}
            </p>
            <SiteButtonLink
              href={SITE_LINKS.installUrl}
              target="_blank"
              variant="secondary"
            >
              {faq.finalCtaButtonLabel}
            </SiteButtonLink>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

// ─── Privacy Page ─────────────────────────────────────────────────────────────

function PrivacyPage() {
  const { privacy } = SITE_COPY;

  return (
    <SiteLayout page="privacy">
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="mb-10">
          <SiteEyebrow className="mb-2">{privacy.eyebrow}</SiteEyebrow>
          <SiteHeading as="h1" size="page" className="mb-2">
            {privacy.title}
          </SiteHeading>
          <p className="text-sm text-neutral-400">
            {privacy.lastUpdatedLabel} {privacy.lastUpdated}
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {privacy.sections.map((section) => (
            <PolicySectionCard key={section.title} section={section} />
          ))}
        </div>
      </main>
    </SiteLayout>
  );
}

function renderPolicySectionItem(item: PolicySectionItem, index: number) {
  if (typeof item === "string") {
    return <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>;
  }

  return (
    <li key={`${index}-${item.label}`}>
      <strong>{item.label}</strong>: {item.text}
    </li>
  );
}

function PolicySectionCard({ section }: { section: PolicySectionData }) {
  return (
    <SiteCard as="section" className="p-5 shadow-none">
      <SiteHeading as="h2" size="card" className="mb-3 mt-0">
        {section.title}
      </SiteHeading>
      <div className="site-legal-copy">
        {"items" in section ? (
          <ul>{section.items.map(renderPolicySectionItem)}</ul>
        ) : (
          <p>
            {section.contactLead}
            <SiteBodyLink href={`mailto:${section.email}`}>
              {section.email}
            </SiteBodyLink>
            {section.contactTail}
          </p>
        )}
      </div>
    </SiteCard>
  );
}

// ─── Demo Page ────────────────────────────────────────────────────────────────

function DemoPage() {
  const { browser, demoPage } = SITE_COPY;
  const [frameReady, setFrameReady] = useState(false);

  return (
    <div className="site-demo-page">
      {!frameReady && (
        <div className="site-browser-loading">
          <div className="px-6 text-center">
            <SiteEyebrow tone="inverse" className="text-white/45">
              {demoPage.loadingEyebrow}
            </SiteEyebrow>
            <p className="mt-2 text-sm text-white/80">{demoPage.loadingText}</p>
          </div>
        </div>
      )}
      <iframe
        title={browser.frameTitle}
        src="demo.html"
        onLoad={() => setFrameReady(true)}
        className={cn(
          "absolute inset-0 h-full w-full border-0 transition-opacity duration-200",
          frameReady ? "opacity-100" : "opacity-0",
        )}
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
