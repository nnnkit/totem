# Marketing Site & Distribution / Checkout Surface — Deep Dive

**Scope:** `apps/site/` (Astro marketing site at https://usetotem.xyz, deployed on Vercel) and the extension↔site handoff, evaluated for hosting a Pro/lifetime-unlock purchase funnel and license endpoint.

**Bottom line up front:** The site is a **100% static Astro build** (`output: "static"`) deployed to Vercel **with no adapter and no server runtime**. As shipped it **cannot** host a license-issuing/verification endpoint — that needs either a Vercel adapter switch (to add Astro endpoints / Vercel Functions) or, more cleanly given the local-first ethos, a third-party merchant-of-record (Gumroad/Lemon Squeezy/Polar) that does issuance + tax, with the static site providing only the marketing/checkout-entry/paste-a-key pages.

---

## 1. Site architecture, build, and deploy

### Astro setup
- **Config:** `apps/site/astro.config.mjs`
  - `site: "https://usetotem.xyz"`, **`output: "static"`** (line 10), `outDir: "../../dist-website"` (line 11), `trailingSlash: "ignore"`, `build.format: "directory"`, `build.assets: "assets"`.
  - Integrations: `@astrojs/react` (React 19 islands), `@astrojs/sitemap` (with a `filter`/`serialize` that excludes `/uninstall-feedback/` and sets per-page `changefreq`/`priority`), `@tailwindcss/vite`.
  - Markdown pipeline: `remark-gfm` + a custom rehype plugin `rehypeBlogLinks` (see §4); footnotes labeled "Sources"; `smartypants: true`.
- **No Astro adapter is configured and none is installed.** `find src/pages -name "*.ts" -o -name "*.js"` returns nothing (no Astro endpoints / API routes); `node_modules/@astrojs/vercel` is **absent**; there is no `middleware.*` file. This is a pure static-site generator setup.
- **Package:** `apps/site/package.json` — name `@totem/site`, deps: `astro ^5.18.2`, `@astrojs/react ^4.4.2`, `@astrojs/sitemap`, `tailwindcss v4`, `remark-gfm`, `unist-util-visit`. Scripts: `dev` / `build` / `preview` / `check` (`astro check`). It is a workspace package; root `package.json` drives it via `pnpm build:website` (`pnpm --filter @totem/site build`) and `pnpm package:website`.

### How pages are authored
Two patterns, both under `apps/site/src/pages/`:
1. **Astro pages** wrapping a shared layout. Each page imports `BaseLayout.astro` and passes SEO props. Examples:
   - `index.astro` — landing; reads root `package.json` version, pulls 3 recent blog posts via `getCollection("blog")`, injects `SoftwareApplication` JSON-LD (note: currently `offers.price: "0"`, `isAccessibleForFree: true` — **this JSON-LD will need updating when a paid tier ships**), renders the `<LandingPage>` React island.
   - `privacy.astro` → `<PrivacyPage>` island; `how-it-works.astro`; `demo.astro` → `<DemoNewTabApp client:only="react">` with `showChrome={false}`.
   - `export-format/v1.astro` — a fully hand-authored long-form HTML doc page (no React island). **This is the best template to copy for a new `/pricing` or `/manage-license` static content page** — it shows the prose/article pattern, the in-page TOC, and `BaseLayout` SEO wiring.
   - `uninstall-feedback.astro` — **the closest existing precedent for a "form" page.** It is a static page with a `<form>`, a client `<script>` that assembles a `mailto:`/Gmail compose URL, and `robots="noindex, follow"`. It demonstrates how to build an interactive page with **no backend** (everything happens client-side / hands off to an external service). A "paste your license key" page would follow exactly this shape.
2. **Content collections** for the blog: `src/content.config.ts` defines a `blog` collection via `glob({ pattern: "**/*.md", base: "./src/content/blog" })` with a Zod schema (`title`, `slug?`, `description`, `publishedAt?`, `draft?`, `canonicalKeyword?`). Markdown files live in `src/content/blog/*.md` and render through `src/pages/blog/[slug].astro` (`getStaticPaths` + `render(post)`), plus `src/pages/blog/index.astro` for the list.

### Layout & shared chrome
- `src/layouts/BaseLayout.astro` is the single SEO/HTML shell. Props: `title`, `description`, `canonical`, `og`, `twitter`, `spaceGrotesk`, `embedGuardGa`, `showChrome`, `page`, `bodyClass`, `robots`. It renders `<head>` (fonts via Google Fonts, canonical, OG/Twitter, Organization+WebSite JSON-LD), then conditionally wraps content with `SiteHeader` + `SiteFooter` (when `showChrome` is true). It also **inlines the Google Analytics (gtag G-VBKV6TVM6W) loader** — there's an `embedGuardGa` variant that suppresses GA inside iframes/`?embed`.
- `src/components/`: `SiteHeader.astro`, `SiteFooter.astro`, `Favicon.astro`, `BlogPostCta.astro`. The header/footer pull all copy + links from `src/react/site-content.ts`.
- React islands live in `src/react/SiteApp.tsx` (exports `LandingPage`, `PrivacyPage`, `HowItWorksPage`) and `src/react/demo/`. Site copy/config is centralized in **`src/react/site-content.ts`** — this is the single source of truth for `SITE_LINKS`, `SITE_COPY`, install URLs, and feature blurbs.

### Build & deploy (Vercel)
- **`vercel.json` (repo root):** `framework: "astro"`, `installCommand: "pnpm install --frozen-lockfile"`, **`buildCommand: "pnpm build:website"`**, **`outputDirectory: "dist-website"`**, `cleanUrls: true`, `trailingSlash: false`. One redirect: `/website/:path*` → `/:path*` (temporary).
- Because `output: "static"` + no adapter, Vercel serves `dist-website/` as **static files on the CDN only**. There is no Vercel Functions deployment from this project today. `cleanUrls`/redirects/headers in `vercel.json` are the only "server-ish" config, and they are edge/CDN config, not compute.

**→ Answer to Q1:** The site is **fully static**. It can serve static HTML/CSS/JS and CDN-level redirects, but **it cannot run server endpoints or Vercel Functions as currently configured.** To host a license endpoint *here*, you would need to (a) `npm i @astrojs/vercel`, set `output: "server"` or `"hybrid"`, add `adapter: vercel()`, and write Astro endpoints under `src/pages/api/*.ts` — which introduces a server runtime, secrets management (signing key), and a database/KV for license records, i.e. it breaks the "no Totem server" purity. The recommended alternative is a **merchant-of-record SaaS** (Gumroad / Lemon Squeezy / Polar) that issues + verifies license keys via *their* API/webhooks, leaving this site static. License *verification* in the extension can then be a stateless signed-token check or a call to the MoR's verify API from the extension itself.

---

## 2. Where the purchase-funnel pages would live in the Astro structure

All new pages slot into `apps/site/src/pages/` and reuse `BaseLayout.astro` + `SiteHeader`/`SiteFooter`. Concrete placement:

| Page | File | Reuse / template |
|---|---|---|
| **Pricing** | `src/pages/pricing.astro` → `/pricing` | New React island in `SiteApp.tsx` *or* hand-authored like `export-format/v1.astro`. Add `"pricing"` to the `SitePageKey` union in `BaseLayout.astro` and the `page` prop type in `SiteHeader.astro`/`SiteFooter.astro`. Add a nav link in `SiteFooter.astro` (and header CTA copy in `site-content.ts`). |
| **Checkout entry** | Usually **not a page** — the "Buy" button links out to the MoR hosted checkout (Gumroad/Lemon Squeezy/Polar overlay or hosted page). The button lives on `pricing.astro` (and optionally a CTA in `BlogPostCta.astro`). If an overlay widget is used, it's a `<script>` island on `pricing.astro`. |
| **Post-purchase / license delivery** | `src/pages/upgrade/success.astro` → `/upgrade/success` (set `robots="noindex, follow"` like `uninstall-feedback.astro`). The MoR's `success_url` redirects here with the license key/token in the query string; a client `<script>` reads `location.search`, displays the key, offers "copy" and a **deep-link button back into the extension** (see §3). Pure client-side — no backend needed. |
| **Manage license** | `src/pages/manage-license.astro` → `/manage-license` (or `/license`). Static page with a "paste your key" form + "verify"/"check status" that calls the **MoR verify API** client-side (or links to the MoR's customer portal / "manage subscription" URL). Pattern mirrors `uninstall-feedback.astro` (static page + client `<script>`, no server). |

**Components/layouts to reuse directly:**
- `BaseLayout.astro` for every page (SEO, OG, GA, header/footer).
- `BlogPostCta.astro` is the model for a reusable "Upgrade to Pro" CTA card (it already does UTM-decorated CTA URLs derived from `SITE_LINKS.installUrl`).
- `uninstall-feedback.astro` for any **form + client-script, no-backend** page (success page, paste-a-key page).
- `export-format/v1.astro` for **long-form static content** (a detailed pricing/FAQ/feature-comparison page).
- Centralize all new URLs (checkout URL, success URL, manage URL, MoR product IDs) in **`src/react/site-content.ts`** under `SITE_LINKS`, matching the existing `chromeWebStoreInstallUrl`/`installUrl` pattern.

---

## 3. Extension ↔ site handoff

### What exists today (one-directional, marketing-only)
- **Site → extension (install):** Everything funnels to the **Chrome Web Store**. `site-content.ts` defines `chromeWebStoreListingUrl = https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo` and `chromeWebStoreInstallUrl` = that listing + `?utm_source=usetotem.xyz&utm_medium=referral&utm_campaign=site_install`. `installUrl` resolves to the CWS install URL (falls back to `github.com/nnnkit/totem/releases/latest` only if the CWS URL were empty). The header, footer, landing CTAs, and `BlogPostCta.astro` all link to `installUrl` with `target="_blank"`.
- **Extension → site (only two hard-coded links):**
  - `src/lib/constants/growth.ts`: `PRIVACY_POLICY_URL = https://usetotem.xyz/privacy` (rendered in `OnboardingModal.tsx`), and `UNINSTALL_FEEDBACK_URL = https://usetotem.xyz/uninstall-feedback?utm_source=extension&utm_medium=uninstall&utm_campaign=feedback`. The uninstall URL is wired via `chrome.runtime.setUninstallURL(...)` in `src/service-worker/index.ts` (`configureUninstallFeedback`, called from `registerReleaseFoundationHooks`).
  - `src/lib/export/quick-export.ts` embeds `https://usetotem.xyz/export-format/v1` as a doc link inside exported ZIPs.
- **Install-time behavior:** On `chrome.runtime.onInstalled` with `reason === "install"`, the service worker opens an **in-extension** tab (`newtab.html?utm_source=extension&utm_medium=oninstall&utm_campaign=first_launch`), **not** the marketing site (`openFirstLaunchTab` in `src/service-worker/index.ts`). So there is **no existing "open the site from the extension" deep-link** beyond privacy/uninstall.
- There is currently **no `pricing`, `license`, `upgrade`, `checkout`, or payment-provider reference anywhere** in `src/` or `apps/site/src/` (confirmed by grep). The only `premium_*` hit is `premium_content_api_read_enabled: false` in `api-proxy.ts`, which is an **X GraphQL feature flag**, unrelated to Totem monetization. This is greenfield.

### How "Upgrade in extension → checkout on site → license back to extension" would be wired
There is no extension custom URL scheme today, so the handoff must use standard web URLs + a paste-key fallback. Recommended flow:

1. **Upgrade entry (extension):** An "Upgrade to Pro" button in the new-tab UI / settings calls `chrome.tabs.create({ url: PRICING_URL })` where `PRICING_URL = https://usetotem.xyz/pricing?utm_source=extension&utm_medium=upgrade&utm_campaign=pro` (add to `growth.ts`, mirroring `UNINSTALL_FEEDBACK_URL`). Optionally append the extension's stable install id / a nonce as a query param so the success page can build a return deep link.
2. **Checkout (site → MoR):** `/pricing` "Buy" button opens the MoR hosted checkout (Gumroad/Lemon Squeezy/Polar). MoR handles payment, tax (merchant-of-record), and license-key generation — **no Totem server required**.
3. **License delivery (MoR → site success page):** Configure the MoR `success_url` = `https://usetotem.xyz/upgrade/success`. The MoR appends the license key (or order token) to the redirect. The static success page (`src/pages/upgrade/success.astro`, `noindex`) reads `location.search` client-side and shows the key + copy button.
4. **Return to extension — three layered mechanisms, in preference order:**
   - **(a) `chrome.runtime.sendMessage(EXTENSION_ID, {type:"TOTEM_LICENSE", key})` from the web page** — requires adding `externally_connectable` (with `matches: ["https://usetotem.xyz/*"]`) to the extension manifest and an `onMessageExternal` handler. Cleanest one-click activation; the success page JS posts the key straight into the extension.
   - **(b) Deep-link button** `chrome-extension://<id>/newtab.html?license=<key>` (or a custom action) that the success page renders; the new-tab boot reads `?license=` and stores/validates it. Works without `externally_connectable` but exposes the key in a URL.
   - **(c) Paste-a-key fallback (always ship this):** a field in extension Settings + the `/manage-license` page where the user pastes the key manually. This is the robust, no-coupling path and mirrors the existing `uninstall-feedback.astro` "static page + client script, no backend" pattern.
5. **Verification (extension):** The extension validates the key either offline (verify an Ed25519/HMAC signature against a public key bundled in the extension — keeps "no Totem server" intact) or by calling the **MoR's license-verify API** directly from the service worker. Store the unlocked state in `chrome.storage.local` alongside existing runtime/auth keys. This fits the local-first architecture: no Totem backend in the loop.

**Manifest note:** Whichever of (a)/(b) is chosen, the work is on the **extension side** (manifest `externally_connectable` and/or an `onMessageExternal`/URL-param handler). The site side stays static. The success/manage pages are ordinary Astro static pages with client `<script>` glue.

---

## 4. SEO / UTM / `ref` decoration the funnel must preserve

The site already has a consistent attribution scheme; a purchase funnel must not strip it.

- **Blog link rehype plugin — `apps/site/src/lib/rehype-blog-links.mjs`** (registered in `astro.config.mjs`): at build time it rewrites every `<a>` in blog Markdown.
  - **Internal links** to `usetotem.xyz` / `www.usetotem.xyz` get `utm_source=blog`, `utm_medium=referral`, `utm_campaign=blog_post`, and `utm_content=<post-slug>`. **Important for the funnel:** a "Buy/Upgrade" link placed in a blog post pointing at `/pricing` will be auto-decorated with these blog UTMs — desirable, keep it.
  - **External links** (non-Totem hosts) get `utm_source=usetotem.xyz`, `utm_medium=referral`, `utm_campaign=blog`, **and `ref=usetotem.xyz`**, plus `target="_blank"` + `rel="noopener noreferrer"`. The MoR checkout domain (e.g. `gumroad.com`) is external, so links to it from blog posts will be decorated this way automatically.
- **Hand-built CTA UTM derivation:** `BlogPostCta.astro` takes the base `installUrl` and rewrites `utm_campaign=site_install` → `utm_campaign=blog_post_cta&utm_content=<slug>`. A Pro CTA card should follow the same derive-from-base pattern so campaigns stay attributable.
- **Install URL canonical params:** `chromeWebStoreInstallUrl` carries `utm_source=usetotem.xyz&utm_medium=referral&utm_campaign=site_install`. Any new "Upgrade" link from the site should use a parallel campaign (e.g. `utm_campaign=pricing` / `pro_upgrade`) so funnel analytics separate install vs upgrade.
- **Extension-originated UTMs:** extension→site links already tag `utm_source=extension` (`utm_medium=uninstall|oninstall|upgrade`). Keep the `utm_source=extension&utm_medium=upgrade&utm_campaign=pro` convention for the new pricing deep-link so in-extension conversions are distinguishable from organic.
- **Analytics:** GA4 (`G-VBKV6TVM6W`) is loaded in `BaseLayout.astro` for every page, so `/pricing` and `/upgrade/success` get pageview tracking for free; the funnel should set up GA events/conversions on the success page. (Note the project's local-first stance: GA is on the **marketing site**, not the extension.)
- **Sitemap:** `astro.config.mjs` sitemap `filter` excludes `/uninstall-feedback/`. The **`/upgrade/success` page should likewise be excluded** (and `noindex`); `/pricing` should be **included** (it's a real indexable page) and will inherit the default `priority: 0.8, changefreq: monthly`.
- **Structured data caveat:** `index.astro`'s `SoftwareApplication` JSON-LD currently declares `offers.price: "0"` / `isAccessibleForFree: true`. When Pro ships, update this (or add an `offers` array reflecting the free + $19 lifetime tiers) to keep rich-result data truthful.

---

## Key file references
- `apps/site/astro.config.mjs` — static output, no adapter, markdown pipeline, sitemap filter.
- `vercel.json` (repo root) — Vercel build/output config, `cleanUrls`, redirects (CDN-only, no functions).
- `apps/site/src/layouts/BaseLayout.astro` — shared SEO/HTML shell + GA; add `pricing` to `SitePageKey`.
- `apps/site/src/react/site-content.ts` — `SITE_LINKS` / `SITE_COPY`, install URLs (add checkout/license URLs here).
- `apps/site/src/pages/uninstall-feedback.astro` — template for a no-backend form/paste-key page.
- `apps/site/src/pages/export-format/v1.astro` — template for a long-form static content page.
- `apps/site/src/components/BlogPostCta.astro` — UTM-derived CTA card model.
- `apps/site/src/lib/rehype-blog-links.mjs` — build-time UTM/`ref` link decoration (internal + external).
- `apps/site/src/content.config.ts` + `src/pages/blog/[slug].astro` — content-collection authoring.
- `src/lib/constants/growth.ts` — extension's hard-coded site URLs (`PRIVACY_POLICY_URL`, `UNINSTALL_FEEDBACK_URL`); add `PRICING_URL` here.
- `src/service-worker/index.ts` — `setUninstallURL`, `onInstalled` first-launch tab (opens in-extension newtab, not site), `chrome.tabs.create` usage; site of any future `onMessageExternal`/license handoff handler.
