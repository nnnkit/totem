import {
  AirplaneTiltIcon,
  ArticleIcon,
  CheckIcon,
  HighlighterCircleIcon,
  ShieldCheckIcon,
  type Icon,
} from "@phosphor-icons/react";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "../../../../src/lib/cn";
import { TotemLogo } from "../../../../src/components/TotemLogo";
import {
  SITE_COPY,
  SITE_LINKS,
  type TransitFlow,
  type TransitRoute,
  type TransitSegment,
  type TransitStation,
  type FAQItem,
  type FAQGroup,
  type FeatureItem,
  type IconFeatureItem,
  type PolicySection as PolicySectionData,
  type PolicySectionItem,
  type PrivacyFeatureCard,
  type PrivacyPermission,
  type PrivacySummaryItem,
} from "./site-content";

function ChromeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-0.82 0 437.46 437.46"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="chrome-logo-inner"
          gradientUnits="userSpaceOnUse"
          x1="216.802"
          y1="140.297"
          x2="216.802"
          y2="296.195"
        >
          <stop offset="0" stopColor="#a2c0e6" />
          <stop offset="1" stopColor="#406cb1" />
        </linearGradient>
      </defs>
      <path
        fill="#c6352e"
        d="M217.341.039s128.478-5.783 196.57 123.337H206.416s-39.188-1.289-72.593 46.255c-9.634 19.916-19.91 40.473-8.349 80.937C108.773 222.309 36.823 97.04 36.823 97.04S87.578 5.176 217.341.039z"
      />
      <path
        fill="#f4d911"
        d="M407.223 327.871s-59.247 114.143-205.118 108.533c17.995-31.148 103.772-179.682 103.772-179.682s20.709-33.289-3.744-85.991c-12.431-18.305-25.09-37.486-65.919-47.713 32.836-.326 177.285.021 177.285.021s54.168 89.891-6.276 204.832z"
      />
      <path
        fill="#81b354"
        d="M28.373 328.738s-69.224-108.395 8.58-231.908c17.979 31.16 103.71 179.72 103.71 179.72s18.469 34.578 76.341 39.756c22.061-1.609 45.007-2.982 74.279-33.223-16.139 28.594-88.673 153.521-88.673 153.521S97.681 438.56 28.373 328.738z"
      />
      <path
        fill="#7baa50"
        d="M202.105 437.46l29.187-121.793s32.092-2.504 58.982-32.017c-16.693 29.365-88.169 153.81-88.169 153.81z"
      />
      <path
        fill="#ffffff"
        d="M119.59 220.093c0-53.69 43.52-97.215 97.215-97.215 53.69 0 97.214 43.524 97.214 97.215 0 53.693-43.522 97.219-97.214 97.219-53.695 0-97.215-43.525-97.215-97.219z"
      />
      <path
        fill="url(#chrome-logo-inner)"
        d="M135.86 220.093c0-44.702 36.238-80.941 80.945-80.941 44.698 0 80.94 36.239 80.94 80.941 0 44.703-36.242 80.945-80.94 80.945-44.707.001-80.945-36.244-80.945-80.945z"
      />
      <path
        fill="#e7ce12"
        d="M413.5 123.039l-120.183 35.237s-18.123-26.596-57.104-35.258c33.776-.115 177.287.021 177.287.021z"
      />
      <path
        fill="#bc332c"
        d="M123.137 246.197c-16.89-29.25-86.31-149.16-86.31-149.16l89.029 88.07s-9.149 18.82-5.68 45.7l2.961 15.39z"
      />
    </svg>
  );
}

/** Scroll-triggered visibility hook. Fires once, then disconnects. */
function useOnScreen(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export type SitePage = "landing" | "privacy" | "how-it-works";

type SiteButtonVariant = "primary" | "secondary";
type SiteButtonSize = "default" | "pill";
type SiteHeadingSize = "hero" | "section" | "page" | "card";

const siteButtonBaseClass =
  "inline-flex items-center justify-center gap-2 no-underline font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

const siteButtonVariantClasses: Record<SiteButtonVariant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800",
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

// SiteLayout: chrome (header + footer) lives in Astro now (BaseLayout.astro).
// This component is a no-op wrapper to keep page sources unchanged.
function SiteLayout({ children }: { page: SitePage; children: ReactNode }) {
  return <>{children}</>;
}

interface DemoBrowserState {
  opened: boolean;
  frameReady: boolean;
  tabTitle: string;
}

type DemoBrowserPatch =
  | Partial<DemoBrowserState>
  | ((state: DemoBrowserState) => Partial<DemoBrowserState>);

function demoBrowserReducer(
  state: DemoBrowserState,
  patch: DemoBrowserPatch,
): DemoBrowserState {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
}

function DemoBrowser() {
  const { browser } = SITE_COPY;
  const [{ opened, frameReady, tabTitle }, updateBrowser] = useReducer(
    demoBrowserReducer,
    {
      opened: true,
      frameReady: false,
      tabTitle: browser.defaultTabTitle,
    },
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Astro hydrates this component after the iframe may have already loaded
  // from cache, so a React `onLoad` prop can miss the event. Attach a native
  // listener and also poll readyState to cover the already-loaded case.
  useEffect(() => {
    if (!opened) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (iframe.contentDocument?.readyState === "complete") {
      updateBrowser({ frameReady: true });
      return;
    }

    const handleLoad = () => updateBrowser({ frameReady: true });
    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [opened]);

  useEffect(() => {
    if (!opened) {
      updateBrowser({
        tabTitle: browser.defaultTabTitle,
        frameReady: false,
      });
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
        updateBrowser({ tabTitle: display });
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
                updateBrowser({ opened: false });
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
              onClick={() => updateBrowser({ opened: true })}
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
          role="button"
          tabIndex={0}
          className="site-browser-stage site-browser-closed-stage"
          onClick={() => updateBrowser({ opened: true })}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              updateBrowser({ opened: true });
            }
          }}
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
            src="/demo/?embed=1"
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

/** Stylized tweet action bar showing the "Open in Totem" button. */
/** Fade-up on scroll into view. */
function SiteReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, visible } = useOnScreen();
  return (
    <div
      ref={ref}
      className={cn("site-reveal", visible && "is-visible", className)}
    >
      {children}
    </div>
  );
}

/** Stagger children on scroll into view. */
function SiteRevealStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { ref, visible } = useOnScreen();
  return (
    <div
      ref={ref}
      className={cn(
        "site-reveal-stagger",
        visible && "is-visible",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Full section with scroll reveal. */
function SiteRevealSection({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: ElementType;
}) {
  const { ref, visible } = useOnScreen(0.1);
  return (
    <Tag
      ref={ref}
      id={id}
      className={cn("site-reveal", visible && "is-visible", className)}
    >
      {children}
    </Tag>
  );
}

function FAQDisclosure({ item }: { item: FAQItem }) {
  return (
    <details className="site-faq-item group border-b border-neutral-200 last:border-b-0">
      <summary className="site-summary-reset flex min-h-11 cursor-pointer items-start gap-4 py-4">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-base leading-snug tracking-tight text-neutral-900 transition-colors duration-150 ease group-hover:text-neutral-700">
            {item.question}
          </h4>
        </div>
        <span
          aria-hidden="true"
          className="site-faq-icon mt-0.5 text-neutral-400"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </span>
      </summary>
      <div className="site-faq-content">
        <div className="site-faq-content-inner">
          <p className="m-0 max-w-2xl pb-4 pr-8 text-sm leading-relaxed text-neutral-600">
            {item.answer}
          </p>
        </div>
      </div>
    </details>
  );
}

function FAQGroupBlock({ group }: { group: FAQGroup }) {
  return (
    <section>
      <SiteEyebrow tone="muted" className="mb-2">
        {group.name}
      </SiteEyebrow>
      <div className="border-t border-neutral-200">
        {group.items.map((item) => (
          <FAQDisclosure key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}

function FeatureHeroTile({
  feature,
  className,
}: {
  feature: FeatureItem;
  className?: string;
}) {
  return (
    <SiteCard
      as="article"
      className={cn(
        "site-feature-card flex flex-col overflow-hidden p-4 md:p-6",
        className,
      )}
    >
      <img
        src={feature.image}
        alt={feature.alt}
        className="mb-5 aspect-video w-full rounded-xl border border-neutral-200 object-cover md:aspect-auto md:min-h-0 md:flex-1"
        loading="lazy"
      />
      <SiteHeading as="h3" size="card" className="mb-2">
        {feature.title}
      </SiteHeading>
      <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
        {feature.body}
      </p>
    </SiteCard>
  );
}

type AccentColor = "amber" | "slate" | "sky" | "emerald";

const ACCENT_CLASSES: Record<AccentColor, { panel: string; icon: string }> = {
  amber: {
    panel: "border-amber-200/70 bg-amber-50",
    icon: "text-amber-600",
  },
  slate: {
    panel: "border-neutral-200 bg-neutral-50",
    icon: "text-neutral-700",
  },
  sky: {
    panel: "border-sky-200/70 bg-sky-50",
    icon: "text-sky-600",
  },
  emerald: {
    panel: "border-emerald-200/70 bg-emerald-50",
    icon: "text-emerald-600",
  },
};

function IconFeatureTile({
  feature,
  icon: IconCmp,
  accent,
  className,
}: {
  feature: IconFeatureItem;
  icon: Icon;
  accent: AccentColor;
  className?: string;
}) {
  const a = ACCENT_CLASSES[accent];
  return (
    <SiteCard
      as="article"
      className={cn("site-feature-card flex flex-col p-5 md:p-6", className)}
    >
      <div
        className={cn(
          "mb-5 inline-flex size-12 items-center justify-center rounded-xl border",
          a.panel,
        )}
      >
        <IconCmp
          aria-hidden="true"
          weight="duotone"
          className={cn("size-6", a.icon)}
        />
      </div>
      <SiteHeading as="h3" size="card" className="mb-2">
        {feature.title}
      </SiteHeading>
      <p className="text-sm leading-relaxed text-neutral-600">{feature.body}</p>
    </SiteCard>
  );
}

function PrivacyFeatureTile({
  feature,
  href,
  className,
}: {
  feature: PrivacyFeatureCard;
  href: string;
  className?: string;
}) {
  const a = ACCENT_CLASSES.emerald;
  return (
    <SiteCard
      as="article"
      className={cn("site-feature-card flex flex-col p-5 md:p-6", className)}
    >
      <div className="flex h-full flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <div className="flex flex-col md:max-w-sm">
          <div
            className={cn(
              "mb-5 inline-flex size-12 items-center justify-center rounded-xl border",
              a.panel,
            )}
          >
            <ShieldCheckIcon
              aria-hidden="true"
              weight="duotone"
              className={cn("size-6", a.icon)}
            />
          </div>
          <SiteHeading as="h3" size="card" className="mb-2">
            {feature.title}
          </SiteHeading>
          <p className="text-sm leading-relaxed text-neutral-600">
            {feature.body}
          </p>
          <SiteBodyLink
            href={href}
            className="mt-4 self-start text-sm font-medium text-neutral-900 hover:text-neutral-700 md:mt-auto md:pt-6"
          >
            {feature.linkLabel}
          </SiteBodyLink>
        </div>
        <ul className="space-y-1.5 md:flex-1 md:self-center">
          {feature.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-2 text-sm text-neutral-700"
            >
              <CheckIcon
                aria-hidden="true"
                weight="bold"
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </SiteCard>
  );
}

export type BlogSummary = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatIsoDateLabel(value: string): string {
  const [year, month, day] = value.split("-");
  const monthName = MONTH_NAMES[Number(month) - 1];
  const dayNumber = Number(day);
  if (!year || !monthName || !Number.isFinite(dayNumber)) return value;
  return `${monthName} ${dayNumber}, ${year}`;
}

function LandingPage({ recentPosts }: { recentPosts: BlogSummary[] }) {
  const { faq, features, hero, demo } = SITE_COPY.landing;

  return (
    <SiteLayout page="landing">
      <main>
        <SiteSection containerClassName="max-w-6xl py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="site-hero-stagger relative">
              {/* Chaos icons — social feed debris that dissolves */}
              <div className="site-hero-chaos" aria-hidden="true">
                {/* Heart */}
                <svg className="site-hero-chaos-icon" style={{ top: "8%", left: "72%", "--chaos-rotate": "rotate(-12deg)", animationDelay: "0ms" } as React.CSSProperties} width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40Z" /></svg>
                {/* Retweet */}
                <svg className="site-hero-chaos-icon" style={{ top: "32%", left: "85%", "--chaos-rotate": "rotate(8deg)", animationDelay: "120ms" } as React.CSSProperties} width="18" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48V152a8,8,0,0,1-13.66,5.66L188,135.31l-42.34,42.35a8,8,0,0,1-11.32,0L96,139.31,69.66,165.66a8,8,0,0,1-11.32-11.32l32-32a8,8,0,0,1,11.32,0L140,160.69,176.69,124l-22.35-22.34A8,8,0,0,1,160,88h56A8,8,0,0,1,224,48Z" /></svg>
                {/* Bookmark */}
                <svg className="site-hero-chaos-icon" style={{ top: "55%", left: "78%", "--chaos-rotate": "rotate(-6deg)", animationDelay: "240ms" } as React.CSSProperties} width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32H56A8,8,0,0,0,48,40V224a8,8,0,0,0,12.65,6.51L128,193.83l67.35,36.68A8,8,0,0,0,208,224V40A8,8,0,0,0,200,32Z" /></svg>
              </div>

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
                  <ChromeIcon className="size-5 shrink-0" />
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

            <aside className="site-hero-aside lg:pt-2">
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

        <SiteRevealSection id="demo" className="bg-neutral-950 py-16 sm:py-20" as="section">
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
        </SiteRevealSection>

        <SiteSection className="py-16 sm:py-20">
          <SiteReveal className="mb-10">
            <SiteEyebrow className="mb-3 text-center">
              {features.eyebrow}
            </SiteEyebrow>
            <div className="mx-auto max-w-3xl text-center">
              <SiteHeading as="h2" size="section" className="mb-3">
                {features.title}
              </SiteHeading>
              <p className="text-lg leading-relaxed text-neutral-400">
                {features.description}
              </p>
            </div>
          </SiteReveal>

          <SiteRevealStagger className="grid gap-5 md:grid-cols-3 md:grid-rows-[auto_auto_auto]">
            <FeatureHeroTile
              feature={features.hero}
              className="md:col-span-2 md:row-span-2"
            />
            <IconFeatureTile
              feature={features.highlights}
              icon={HighlighterCircleIcon}
              accent="amber"
              className="md:col-start-3 md:row-start-1"
            />
            <IconFeatureTile
              feature={features.clean}
              icon={ArticleIcon}
              accent="slate"
              className="md:col-start-3 md:row-start-2"
            />
            <IconFeatureTile
              feature={features.offline}
              icon={AirplaneTiltIcon}
              accent="sky"
              className="md:col-start-1 md:row-start-3"
            />
            <PrivacyFeatureTile
              feature={features.privacy}
              href={SITE_LINKS.privacyUrl}
              className="md:col-span-2 md:col-start-2 md:row-start-3"
            />
          </SiteRevealStagger>
        </SiteSection>

        <SiteSection id="faq" className="py-16 sm:py-20">
          <div className="max-w-4xl">
            <SiteReveal className="mb-8 max-w-3xl">
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
            </SiteReveal>

            <SiteRevealStagger className="space-y-10">
              {faq.groups.map((group) => (
                <FAQGroupBlock key={group.name} group={group} />
              ))}
            </SiteRevealStagger>
          </div>
        </SiteSection>

        <RecentBlogPostsSection posts={recentPosts} />

        <SiteRevealSection className="bg-neutral-900 py-14" as="section">
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
              <ChromeIcon className="size-5 shrink-0" />
              {faq.finalCtaButtonLabel}
            </SiteButtonLink>
          </div>
        </SiteRevealSection>
      </main>
    </SiteLayout>
  );
}

function RecentBlogPostsSection({ posts }: { posts: BlogSummary[] }) {
  const recent = posts.slice(0, 3);
  if (recent.length === 0) return null;

  return (
    <SiteRevealSection className="bg-neutral-50 py-20" as="section">
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <SiteEyebrow tone="muted" className="mb-3">
              From the blog
            </SiteEyebrow>
            <SiteHeading as="h2" size="section" className="max-w-2xl">
              Notes on bookmarks, reading, and the things you save.
            </SiteHeading>
          </div>
          <a
            href="/blog/"
            className="hidden whitespace-nowrap text-sm font-medium text-neutral-700 no-underline transition-colors hover:text-neutral-900 sm:inline-block"
          >
            All posts →
          </a>
        </div>

        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {recent.map((post) => (
            <li key={post.slug}>
              <a
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-6 no-underline shadow-site-card transition-shadow duration-200 hover:shadow-md"
              >
                {post.publishedAt && (
                  <time
                    dateTime={post.publishedAt}
                    className="text-xs uppercase tracking-widest text-neutral-400"
                  >
                    {formatIsoDateLabel(post.publishedAt)}
                  </time>
                )}
                <h3 className="mt-3 font-serif text-xl leading-tight text-neutral-900 transition-colors group-hover:text-neutral-700">
                  {post.title}
                </h3>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-600 text-pretty">
                  {post.description}
                </p>
                <span className="mt-5 text-xs font-medium uppercase tracking-widest text-neutral-500 transition-colors group-hover:text-neutral-900">
                  Read →
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-10 sm:hidden">
          <a
            href="/blog/"
            className="text-sm font-medium text-neutral-700 no-underline transition-colors hover:text-neutral-900"
          >
            All posts →
          </a>
        </div>
      </div>
    </SiteRevealSection>
  );
}

function PrivacyPage() {
  const { privacy } = SITE_COPY;

  return (
    <SiteLayout page="privacy">
      {/* ── Hero ── */}
      <section className="site-privacy-hero">
        <div className="mx-auto max-w-5xl px-6 pb-14 pt-20 sm:pb-20 sm:pt-28">
          <div className="mb-6 flex items-baseline gap-3">
            <SiteEyebrow tone="inverse">{privacy.eyebrow}</SiteEyebrow>
            <span className="text-xs text-white/30">
              {privacy.lastUpdatedLabel} {privacy.lastUpdated}
            </span>
          </div>

          <SiteHeading as="h1" size="hero" tone="inverse" className="mb-6 max-w-3xl">
            {privacy.title}
          </SiteHeading>

          <p className="mb-3 max-w-2xl text-lg leading-relaxed text-white/65 text-pretty">
            {privacy.introTitle}
          </p>

          <p className="max-w-2xl text-sm leading-relaxed text-white/35 text-pretty">
            {privacy.introBody}
          </p>

          <div className="site-privacy-promises">
            {privacy.reassuranceItems.map((item) => (
              <div key={item} className="site-privacy-promise">
                <span className="site-privacy-promise-icon" aria-hidden="true">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M1.5 5.5L4 8L8.5 2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        {/* ── Short version ── */}
        <section className="site-privacy-section">
          <div className="site-privacy-section-header">
            <span className="site-privacy-section-rule" />
            <SiteHeading as="h2" size="card">
              {privacy.summaryTitle}
            </SiteHeading>
          </div>
          <div className="site-privacy-summary-grid">
            {privacy.summaryItems.map((item, i) => (
              <PrivacySummaryCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </section>

        {/* ── Permissions ── */}
        <section className="site-privacy-section">
          <div className="site-privacy-section-header">
            <span className="site-privacy-section-rule" />
            <SiteHeading as="h2" size="card">
              {privacy.permissionsTitle}
            </SiteHeading>
          </div>
          <p className="site-privacy-body mb-8 max-w-3xl">
            {privacy.permissionsIntro}
          </p>
          <div className="site-privacy-permissions-grid">
            {privacy.permissions.map((permission) => (
              <PrivacyPermissionCard
                key={permission.name}
                permission={permission}
              />
            ))}
          </div>
        </section>

        {/* ── Policy details ── */}
        <section className="site-privacy-section">
          <div className="site-privacy-section-header">
            <span className="site-privacy-section-rule" />
            <SiteHeading as="h2" size="card">
              {privacy.fullPolicyTitle}
            </SiteHeading>
          </div>
          <div className="site-privacy-detail-stack">
            {privacy.sections.map((section) => (
              <PolicySectionCard key={section.title} section={section} />
            ))}
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}

function PrivacySummaryCard({
  item,
  index,
}: {
  item: PrivacySummaryItem;
  index: number;
}) {
  return (
    <div className="site-privacy-summary-card">
      <span className="site-privacy-summary-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="site-privacy-summary-title">{item.title}</p>
      <p className="site-privacy-body mt-2">{item.body}</p>
    </div>
  );
}

function PrivacyPermissionCard({
  permission,
}: {
  permission: PrivacyPermission;
}) {
  const isOptional = permission.access === "Optional";

  return (
    <div className="site-privacy-permission-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="site-privacy-permission-name">{permission.name}</h3>
        <span
          className={cn(
            "site-privacy-access-badge",
            isOptional
              ? "site-privacy-access-badge--optional"
              : "site-privacy-access-badge--required",
          )}
        >
          {permission.access}
        </span>
      </div>

      <dl className="site-privacy-permission-meta">
        <div>
          <dt>Why</dt>
          <dd>{permission.reason}</dd>
        </div>
        <div>
          <dt>What it does</dt>
          <dd>{permission.use}</dd>
        </div>
      </dl>
    </div>
  );
}

function renderPolicySectionItem(item: PolicySectionItem, index: number) {
  if (typeof item === "string") {
    return <li key={item}>{item}</li>;
  }

  return (
    <li key={`${item.label}-${item.text}`}>
      <strong>{item.label}</strong>: {item.text}
    </li>
  );
}

function PolicySectionCard({ section }: { section: PolicySectionData }) {
  return (
    <article className="site-privacy-detail-card">
      <h3 className="site-privacy-detail-title">{section.title}</h3>
      <div className="site-legal-copy">
        <ul>{section.items.map(renderPolicySectionItem)}</ul>
      </div>
    </article>
  );
}

type RouteLookup = Record<string, TransitRoute>;
type StationLookup = Record<string, TransitStation>;

function buildSegmentPath(
  segment: TransitSegment,
  stations: StationLookup,
  offset: number,
): string {
  if (segment.path.length < 2) return "";
  const corner = 18;
  const points = segment.path.flatMap((id) => {
    const station = stations[id];
    return station ? [{ x: station.x, y: station.y + offset }] : [];
  });

  if (points.length < 2) return "";

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (next && prev.y === curr.y && curr.y !== next.y) {
      // Horizontal segment turning vertical at curr.
      const dirX = curr.x > prev.x ? -1 : 1;
      const dirY = next.y > curr.y ? 1 : -1;
      d += ` L ${curr.x + dirX * corner} ${curr.y}`;
      d += ` Q ${curr.x} ${curr.y} ${curr.x} ${curr.y + dirY * corner}`;
    } else if (next && prev.x === curr.x && curr.x !== next.x) {
      // Vertical segment turning horizontal at curr.
      const dirY = curr.y > prev.y ? -1 : 1;
      const dirX = next.x > curr.x ? 1 : -1;
      d += ` L ${curr.x} ${curr.y + dirY * corner}`;
      d += ` Q ${curr.x} ${curr.y} ${curr.x + dirX * corner} ${curr.y}`;
    } else if (prev.x !== curr.x && prev.y !== curr.y) {
      // Diagonal: just stop at the next station.
      d += ` L ${curr.x} ${curr.y}`;
    } else {
      d += ` L ${curr.x} ${curr.y}`;
    }
  }

  return d;
}

function StationDetailPanel({
  station,
  routes,
  stations,
  onSelect,
}: {
  station: TransitStation;
  routes: RouteLookup;
  stations: StationLookup;
  onSelect: (id: string) => void;
}) {
  const stationRoutes = station.routes.flatMap((id) => {
    const route = routes[id];
    return route ? [route] : [];
  });
  const neighbors = station.neighbors.flatMap((id) => {
    const neighbor = stations[id];
    return neighbor ? [neighbor] : [];
  });

  return (
    <aside className="transit-panel" aria-live="polite">
      <header className="transit-panel-header">
        <span className="transit-panel-eyebrow">Station</span>
        <h3 className="transit-panel-title">{station.name}</h3>
        <p className="transit-panel-subtitle">{station.short}</p>
      </header>

      <div className="transit-panel-section">
        <p className="transit-panel-detail">{station.detail}</p>
      </div>

      {station.files.length > 0 ? (
        <div className="transit-panel-section">
          <p className="transit-panel-label">Files</p>
          <ul className="transit-panel-files">
            {station.files.map((file) => (
              <li key={file}>
                <code>{file}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {station.writes.length > 0 ? (
        <div className="transit-panel-section">
          <p className="transit-panel-label">
            Writes · {station.writes.length}
          </p>
          <ul className="transit-panel-keys">
            {station.writes.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {station.reads.length > 0 ? (
        <div className="transit-panel-section">
          <p className="transit-panel-label">Reads</p>
          <ul className="transit-panel-reads">
            {station.reads.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="transit-panel-section">
        <p className="transit-panel-label">Lines · {stationRoutes.length}</p>
        <ul className="transit-panel-routes">
          {stationRoutes.map((route) => (
            <li key={route.id}>
              <span
                className="transit-panel-route-dot"
                style={{ backgroundColor: route.color }}
                aria-hidden="true"
              />
              <span>{route.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {neighbors.length > 0 ? (
        <div className="transit-panel-section">
          <p className="transit-panel-label">
            Neighbors · {neighbors.length}
          </p>
          <ul className="transit-panel-neighbors">
            {neighbors.map((neighbor) => (
              <li key={neighbor.id}>
                <button
                  type="button"
                  onClick={() => onSelect(neighbor.id)}
                  className="transit-panel-neighbor"
                >
                  <span aria-hidden="true">→</span> {neighbor.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

function FlowsPanel({
  flows,
  stations,
  activeFlowId,
  activeStepIndex,
  onSelectFlow,
  onSelectStep,
}: {
  flows: readonly TransitFlow[];
  stations: StationLookup;
  activeFlowId: string | null;
  activeStepIndex: number;
  onSelectFlow: (id: string) => void;
  onSelectStep: (index: number) => void;
}) {
  const activeFlow = flows.find((flow) => flow.id === activeFlowId) ?? null;

  return (
    <section className="transit-flows" aria-label="Flows">
      <header className="transit-flows-header">
        <p className="transit-flows-eyebrow">Flows</p>
        <h2 className="transit-flows-title">Walk a real path through the system.</h2>
        <p className="transit-flows-summary">
          {activeFlow
            ? activeFlow.summary
            : "Pick a flow. Each step jumps the map to the station that runs that part."}
        </p>
      </header>

      <div className="transit-flows-tabs" role="tablist">
        {flows.map((flow) => {
          const isActive = flow.id === activeFlowId;
          return (
            <button
              key={flow.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectFlow(flow.id)}
              className={cn("transit-flow-tab", isActive && "is-active")}
            >
              {flow.label}
            </button>
          );
        })}
      </div>

      {activeFlow ? (
        <ol className="transit-flow-steps">
          {activeFlow.steps.map((step, index) => {
            const station = stations[step.stationId];
            const isCurrent = index === activeStepIndex;
            return (
              <li key={`${activeFlow.id}-${step.stationId}-${step.note}`}>
                <button
                  type="button"
                  onClick={() => onSelectStep(index)}
                  className={cn(
                    "transit-flow-step",
                    isCurrent && "is-current",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span className="transit-flow-step-num">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="transit-flow-step-body">
                    <span className="transit-flow-step-station">
                      {station?.name ?? step.stationId}
                    </span>
                    <span className="transit-flow-step-note">{step.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function InteractiveMap({
  stations,
  routes,
  segments,
  selectedId,
  filteredRouteId,
  flowStationIds,
  onSelectStation,
}: {
  stations: readonly TransitStation[];
  routes: readonly TransitRoute[];
  segments: readonly TransitSegment[];
  selectedId: string;
  filteredRouteId: string | null;
  flowStationIds: Set<string>;
  onSelectStation: (id: string) => void;
}) {
  const routeMap: RouteLookup = {};
  for (const route of routes) routeMap[route.id] = route;

  const stationMap: StationLookup = {};
  for (const station of stations) stationMap[station.id] = station;

  const selected = stationMap[selectedId] ?? stations[0];

  const edgeOffsets = new Map<string, number>();
  const offsetForSegment = (segment: TransitSegment) => {
    const key = segment.path.toSorted().join("|") + "::" + segment.route;
    const used = edgeOffsets.get(key) ?? 0;
    edgeOffsets.set(key, used + 1);
    return used;
  };

  const isSegmentInFlow = (segment: TransitSegment) => {
    if (flowStationIds.size < 2) return false;
    return segment.path.every((id) => flowStationIds.has(id));
  };

  const segmentRenders = segments.map((segment, index) => {
    const offset = offsetForSegment(segment) * 7;
    const route = routeMap[segment.route];
    if (!route) return null;
    const onSelectedRoute = selected.routes.includes(segment.route);
    const matchesFilter =
      filteredRouteId === null || filteredRouteId === segment.route;
    const inFlow = isSegmentInFlow(segment);

    let opacity = 0.18;
    if (filteredRouteId !== null) {
      opacity = matchesFilter ? 0.95 : 0.05;
    } else if (inFlow) {
      opacity = 0.95;
    } else if (flowStationIds.size > 0) {
      opacity = 0.1;
    } else if (onSelectedRoute) {
      opacity = 0.95;
    }

    return {
      key: `${segment.route}-${index}`,
      d: buildSegmentPath(segment, stationMap, offset),
      color: route.color,
      routeId: segment.route,
      opacity,
    };
  });

  return (
    <div
      className="transit-map"
      role="figure"
      aria-label="Totem architecture transit map"
    >
      <svg
        viewBox="0 0 1080 480"
        className="transit-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="transit-grid"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.8" fill="rgb(148 163 184 / 0.18)" />
          </pattern>
        </defs>
        <rect width="1080" height="480" fill="url(#transit-grid)" />

        {segmentRenders.map((seg) => {
          if (!seg) return null;
          return (
            <path
              key={seg.key}
              d={seg.d}
              stroke={seg.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={seg.opacity}
              className="transit-path"
            />
          );
        })}

        {stations.map((station) => {
          const isActive = station.id === selected.id;
          const isInFlow = flowStationIds.has(station.id);
          const isDimmed =
            (filteredRouteId !== null &&
              !station.routes.includes(filteredRouteId)) ||
            (flowStationIds.size > 0 && !isInFlow && !isActive);
          const routeColor = routeMap[station.routes[0]]?.color ?? "#475569";
          const radius = station.kind === "hub" ? 14 : 10;

          return (
            <g
              key={station.id}
              transform={`translate(${station.x} ${station.y})`}
              className={cn(
                "transit-station",
                isActive && "is-active",
                isInFlow && "is-in-flow",
                isDimmed && "is-dimmed",
              )}
              onClick={() => onSelectStation(station.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectStation(station.id);
                }
              }}
              aria-label={`${station.name} — ${station.short}`}
            >
              {isActive ? (
                <circle
                  r={radius + 10}
                  fill={routeColor}
                  opacity={0.12}
                  className="transit-station-glow"
                />
              ) : null}
              <circle
                r={radius}
                fill="white"
                stroke={routeColor}
                strokeWidth={isActive ? 4 : 2.5}
              />
              {station.kind === "hub" ? (
                <circle r={radius - 5} fill={routeColor} opacity={0.85} />
              ) : isActive ? (
                <circle r={4} fill={routeColor} />
              ) : null}

              <text
                y={radius + 22}
                textAnchor="middle"
                className="transit-station-label"
              >
                {station.name}
              </text>
              <text
                y={radius + 38}
                textAnchor="middle"
                className="transit-station-sub"
              >
                {station.short}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const HOW_IT_WORKS_DEFAULT_FLOW_ID = "first-sync";

interface HowItWorksUrlState {
  flowId: string | null;
  stepIndex: number;
  stationId: string | null;
  routeId: string | null;
}

function readHowItWorksUrl(): HowItWorksUrlState {
  if (typeof window === "undefined") {
    return { flowId: null, stepIndex: 0, stationId: null, routeId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const rawFlow = params.get("flow");
  const rawStep = parseInt(params.get("step") ?? "", 10);
  return {
    flowId:
      rawFlow === "none"
        ? null
        : rawFlow ?? HOW_IT_WORKS_DEFAULT_FLOW_ID,
    stepIndex: Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 0,
    stationId: params.get("station"),
    routeId: params.get("route"),
  };
}

function buildHowItWorksUrl(state: HowItWorksUrlState): string {
  const params = new URLSearchParams();
  if (state.flowId === null) {
    params.set("flow", "none");
  } else if (state.flowId !== HOW_IT_WORKS_DEFAULT_FLOW_ID) {
    params.set("flow", state.flowId);
  }
  if (state.flowId !== null && state.stepIndex > 0) {
    params.set("step", String(state.stepIndex));
  }
  if (state.flowId === null && state.stationId) {
    params.set("station", state.stationId);
  }
  if (state.routeId) {
    params.set("route", state.routeId);
  }
  const path =
    typeof window !== "undefined" ? window.location.pathname : "/how-it-works/";
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

interface HowItWorksState {
  selectedId: string;
  filteredRouteId: string | null;
  activeFlowId: string | null;
  flowStepIndex: number;
}

type HowItWorksPatch =
  | Partial<HowItWorksState>
  | ((state: HowItWorksState) => Partial<HowItWorksState>);

function howItWorksReducer(
  state: HowItWorksState,
  patch: HowItWorksPatch,
): HowItWorksState {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
}

function HowItWorksPage() {
  const { howItWorks: interactive } = SITE_COPY;

  const stationMap: StationLookup = {};
  for (const station of interactive.stations) stationMap[station.id] = station;
  const routeMap: RouteLookup = {};
  for (const route of interactive.routes) routeMap[route.id] = route;

  const flowExists = (id: string | null): id is string =>
    id != null && interactive.flows.some((f) => f.id === id);
  const stationExists = (id: string | null): id is string =>
    id != null && id in stationMap;
  const routeExists = (id: string | null): id is string =>
    id != null && interactive.routes.some((r) => r.id === id);

  const deriveStateFromUrl = (
    url: HowItWorksUrlState,
  ): {
    flowId: string | null;
    stepIndex: number;
    stationId: string;
    routeId: string | null;
  } => {
    let flowId: string | null;
    if (url.flowId === null) {
      flowId = null;
    } else if (flowExists(url.flowId)) {
      flowId = url.flowId;
    } else {
      flowId = HOW_IT_WORKS_DEFAULT_FLOW_ID;
    }

    const flow = flowId
      ? interactive.flows.find((f) => f.id === flowId) ?? null
      : null;
    const stepIndex = flow
      ? Math.min(Math.max(0, url.stepIndex), flow.steps.length - 1)
      : 0;
    const stationFromFlow = flow?.steps[stepIndex]?.stationId ?? null;
    const stationId = flow
      ? stationFromFlow ?? interactive.bookmarkBaseId
      : stationExists(url.stationId)
        ? url.stationId
        : interactive.bookmarkBaseId;
    const routeId = routeExists(url.routeId) ? url.routeId : null;

    return { flowId, stepIndex, stationId, routeId };
  };

  const initial = deriveStateFromUrl(readHowItWorksUrl());

  const [
    { selectedId, filteredRouteId, activeFlowId, flowStepIndex },
    updateHowItWorks,
  ] = useReducer(howItWorksReducer, initial, (state) => ({
    selectedId: state.stationId,
    filteredRouteId: state.routeId,
    activeFlowId: state.flowId,
    flowStepIndex: state.stepIndex,
  }));

  const skipNextUrlSync = useRef(true);

  // State → URL (push history). Skip the first run since state was just
  // hydrated from the URL on mount; instead, normalize the URL to canonical.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = buildHowItWorksUrl({
      flowId: activeFlowId,
      stepIndex: flowStepIndex,
      stationId: selectedId,
      routeId: filteredRouteId,
    });
    const current = window.location.pathname + window.location.search;
    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false;
      if (next !== current) window.history.replaceState(null, "", next);
      return;
    }
    if (next !== current) window.history.pushState(null, "", next);
  }, [activeFlowId, flowStepIndex, selectedId, filteredRouteId]);

  // Browser back/forward → restore state from URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      const next = deriveStateFromUrl(readHowItWorksUrl());
      skipNextUrlSync.current = true;
      updateHowItWorks({
        activeFlowId: next.flowId,
        flowStepIndex: next.stepIndex,
        selectedId: next.stationId,
        filteredRouteId: next.routeId,
      });
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFlow =
    interactive.flows.find((flow) => flow.id === activeFlowId) ?? null;

  const flowStationIds = new Set<string>(
    activeFlow ? activeFlow.steps.map((step) => step.stationId) : [],
  );

  const handleSelectStation = (id: string) => {
    if (activeFlow) {
      const idx = activeFlow.steps.findIndex(
        (step) => step.stationId === id,
      );
      updateHowItWorks({
        selectedId: id,
        ...(idx !== -1 ? { flowStepIndex: idx } : {}),
      });
      return;
    }
    updateHowItWorks({ selectedId: id });
  };

  const handleSelectFlow = (flowId: string) => {
    const flow = interactive.flows.find((f) => f.id === flowId);
    if (!flow) return;
    updateHowItWorks({
      activeFlowId: flowId,
      flowStepIndex: 0,
      filteredRouteId: null,
      selectedId: flow.steps[0]?.stationId ?? selectedId,
    });
  };

  const handleSelectStep = (index: number) => {
    if (!activeFlow) return;
    const target = activeFlow.steps[index]?.stationId;
    updateHowItWorks({
      flowStepIndex: index,
      ...(target ? { selectedId: target } : {}),
    });
  };

  const handleClearFlow = () => {
    updateHowItWorks({ activeFlowId: null, flowStepIndex: 0 });
  };

  const toggleRouteFilter = (routeId: string) => {
    updateHowItWorks((current) => ({
      activeFlowId: activeFlow ? null : current.activeFlowId,
      flowStepIndex: activeFlow ? 0 : current.flowStepIndex,
      filteredRouteId: current.filteredRouteId === routeId ? null : routeId,
    }));
  };

  const selectedStation = stationMap[selectedId] ?? interactive.stations[0];

  return (
    <SiteLayout page="how-it-works">
      <main className="transit-main">
        <div className="transit-bg" aria-hidden="true" />
        <div className="transit-container">
          <header className="transit-intro">
            <SiteEyebrow tone="muted" className="mb-3">
              {interactive.eyebrow}
            </SiteEyebrow>
            <SiteHeading as="h1" size="page" className="mb-3 max-w-2xl">
              {interactive.title}
            </SiteHeading>
            <p className="max-w-2xl text-base leading-relaxed text-neutral-500">
              {interactive.intro}
            </p>
          </header>

          <div className="transit-legend" role="group" aria-label="Lines">
            <span className="transit-legend-label">
              {interactive.legendTitle}
            </span>
            {interactive.routes.map((route) => {
              const isActive = filteredRouteId === route.id;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => toggleRouteFilter(route.id)}
                  className={cn(
                    "transit-legend-item",
                    isActive && "is-active",
                  )}
                  aria-pressed={isActive}
                  title={route.description}
                >
                  <span
                    className="transit-legend-dot"
                    style={{ backgroundColor: route.color }}
                    aria-hidden="true"
                  />
                  <span>{route.name}</span>
                </button>
              );
            })}
            {filteredRouteId !== null ? (
              <button
                type="button"
                onClick={() => updateHowItWorks({ filteredRouteId: null })}
                className="transit-legend-clear"
              >
                Clear filter
              </button>
            ) : null}
          </div>

          <div className="transit-shell">
            <InteractiveMap
              stations={interactive.stations}
              routes={interactive.routes}
              segments={interactive.segments}
              selectedId={selectedStation.id}
              filteredRouteId={filteredRouteId}
              flowStationIds={flowStationIds}
              onSelectStation={handleSelectStation}
            />

            <StationDetailPanel
              station={selectedStation}
              routes={routeMap}
              stations={stationMap}
              onSelect={handleSelectStation}
            />
          </div>

          <FlowsPanel
            flows={interactive.flows}
            stations={stationMap}
            activeFlowId={activeFlowId}
            activeStepIndex={flowStepIndex}
            onSelectFlow={handleSelectFlow}
            onSelectStep={handleSelectStep}
          />

          {activeFlow ? (
            <div className="transit-flow-footer">
              <button
                type="button"
                onClick={handleClearFlow}
                className="transit-flow-exit"
              >
                Exit flow
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </SiteLayout>
  );
}

export { LandingPage, PrivacyPage, HowItWorksPage };
