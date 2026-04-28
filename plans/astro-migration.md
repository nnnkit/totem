# Astro migration plan for `apps/site`

> **Status:** plan (baselines captured, no code changes yet)
> **Owner:** Claude + Ankit
> **Last updated:** 2026-04-27

This plan replaces the Vite SPA at `apps/site` with an Astro site that statically renders blog post bodies (so external `<a>` with UTM/`ref` are crawler-visible) and keeps React for interactive surfaces. It is self-contained — a fresh agent can pick this up cold without prior conversation context.

---

## 1. Goal & non-goals

**Goal**
- Replace the SPA shell + `build-blog.mjs` + runtime `parseHtml` setup at `apps/site` with Astro pages.
- Statically render blog HTML at build time (external `<a>` UTM/`ref` decoration becomes crawler-visible).
- Preserve every existing URL, page content, and visual design at desktop + mobile.
- Keep or improve SEO meta parity (title, description, canonical, OG, Twitter, JSON-LD) on every page.
- Keep React for interactive components (the demo, the how-it-works diagram, etc.) via Astro islands.

**Non-goals**
- Not refactoring `apps/site/src/SiteApp.tsx` content. Components carry over as-is, just hosted by Astro.
- Not touching the extension app at `apps/extension` or root `src/` (extension new-tab/reader code).
- Not changing the existing markdown content under `apps/site/content/blog/*.md`.
- Not adding new pages or new design.

---

## 2. Pre-migration baselines (already captured)

Used to verify visual + SEO parity after migration. Do **not** modify these files.

- `plans/astro-migration/before/head/*.html` — `<head>` extracted from each built page in `dist-website/` (10 files: `root`, `demo`, `how-it-works`, `privacy`, `blog`, and 5 blog post slugs).
- `plans/astro-migration/before/screenshots/desktop-*.png` — full-page screenshots at 1280×800 for all 10 routes.
- `plans/astro-migration/before/screenshots/mobile-*.png` — full-page screenshots at 390×844 for all 10 routes.

All routes captured:
1. `/` (landing)
2. `/demo/`
3. `/how-it-works/`
4. `/privacy/`
5. `/blog/` (index)
6. `/blog/are-x-twitter-bookmarks-private/`
7. `/blog/best-chrome-bookmark-managers-2026/`
8. `/blog/how-to-export-twitter-bookmarks/`
9. `/blog/pocket-alternatives-2026/`
10. `/blog/twitter-x-bookmark-limit-explained/`

After migration, regenerate the same screenshots into `plans/astro-migration/after/screenshots/` and diff visually. SEO heads diff against `before/head/*.html` byte-for-byte (allowing only intentional improvements documented below).

---

## 3. Current architecture (read this before changing anything)

### Build pipeline today
- `apps/site/package.json`: `dev` and `build` invoke `vite -c vite.config.ts`.
- `apps/site/vite.config.ts` runs `buildBlog({ includeDrafts })` from `apps/site/scripts/build-blog.mjs` *during* config evaluation. That step:
  - Reads `apps/site/content/blog/*.md` (gray-matter frontmatter + markdown-it + footnote plugin).
  - Writes one static `apps/site/blog/<slug>/index.html` per published post + `apps/site/blog/index.html` for the index.
  - Emits `apps/site/src/generated/blog-posts.ts` containing `blogPosts: BlogPost[]` and `blogPostsBySlug` (each post has a rendered `html` string).
  - The custom `link_open` markdown-it renderer (added 2026-04-27) decorates external `<a>` with UTM + `ref=usetotem.xyz` query params at render time. Internal `usetotem.xyz` links are skipped.
- `vite.config.ts` adds a dev middleware that rewrites `/blog`, `/blog/<slug>` to the slug's static `index.html` so dev URLs match prod.
- `vite.config.ts` builds 4 hand-written shells (`index.html`, `demo/index.html`, `how-it-works/index.html`, `privacy/index.html`) plus the generated blog shells. All output to `dist-website/`.
- `vite.config.ts` `copyExtensionSiteAssets` plugin copies favicons + icons from the repo root `public/` into the build.

### Runtime today
- All shells include `<div id="root" data-page="..."><script type="module" src="./src/main.tsx">`.
- `apps/site/src/main.tsx` reads `data-page` + `data-slug` and renders `<SiteApp page={page} slug={slug} />`.
- `apps/site/src/SiteApp.tsx` (~2255 lines) is the entire site: `LandingPage`, `BlogIndexPage`, `BlogPostPage`, `PrivacyPage`, `HowItWorksPage`, plus shared `SiteLayout`, header, footer, FAQ, CTAs.
- `BlogPostPage` (around line 2155) reads `blogPostsBySlug[slug]`, parses `post.html` via `html-react-parser`, and runs each `<a>` through `makeBlogLinkTransformer` (line 2124) which:
  - Adds blog-flavored UTM (`utm_source=blog`, `utm_campaign=blog_post`, `utm_content=<slug>`) for `TOTEM_HOSTS` only.
  - Sets `target="_blank"` + `rel="noopener noreferrer"` on other external hosts (and does not touch their search params — the build-time decoration in `build-blog.mjs` already added UTM/ref).
- The demo page has its own bootstrap: `apps/site/demo/index.html` → `apps/site/src/demo-entry.tsx` → `<DemoNewTabApp />`. This works *today* because Vite multi-page builds let each HTML have its own `<script type="module">` entry.

### Shared assets / styling
- Tailwind v4 via `@tailwindcss/vite` plugin (configured in `vite.config.ts` plugins array).
- Global CSS imports come from two places: `apps/site/src/main.tsx` imports `../../../src/index.css` (extension's Tailwind base) **and** `./site.css` (site-only overrides).
- Fonts: Google Fonts `Spectral` + `Space Grotesk` via `<link rel="stylesheet">` in each shell `<head>`.
- GA4: `G-VBKV6TVM6W` snippet inlined in every page's `<head>` (the demo guards it for iframe/embed mode).
- Favicons / icons: `/favicon.svg`, `/favicon-48.png`, `/favicon-16.png`, `/icons/icon-128.png`, `/icons/icon-48.png`, `/icons/icon-16.png` — all copied from repo-root `public/` into the build by the Vite plugin.

### Per-page SEO meta currently in place (must preserve)
Verified from `plans/astro-migration/before/head/*.html`:
- Every page: `<title>`, `<meta name="description">`, `<link rel="canonical">`, OG (`og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:site_name`), Twitter (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`).
- Landing: extra JSON-LD `SoftwareApplication`.
- Blog post pages: extra JSON-LD `BlogPosting` (with `headline`, `description`, `datePublished`, `url`, `author`, `publisher`).
- Demo: GA snippet is wrapped in an embed-detection guard (skip when `?embed` or framed).
- All pages: GA4 snippet, font preconnect + stylesheet link.

---

## 4. Target architecture

```
apps/site/
├── astro.config.mjs              # @astrojs/react + @tailwindcss/vite
├── package.json                  # adds astro, @astrojs/react, @astrojs/sitemap
├── tsconfig.json
├── public/                       # favicons, icons, demo-data.json (moved from existing public/)
├── src/
│   ├── content.config.ts         # Astro content collection schema for blog
│   ├── content/blog/             # markdown files (moved from apps/site/content/blog)
│   ├── layouts/
│   │   └── BaseLayout.astro      # html, head, GA, fonts, OG/Twitter slots, header, footer
│   ├── components/               # Astro wrappers around React islands
│   │   ├── SiteHeader.astro      # static header (no JS needed)
│   │   ├── SiteFooter.astro      # static footer
│   │   └── BlogPostCta.astro     # static CTA, no React
│   ├── pages/
│   │   ├── index.astro           # imports LandingApp from existing React
│   │   ├── demo.astro            # imports DemoNewTabApp (client:load)
│   │   ├── how-it-works.astro    # imports HowItWorksApp (client:load)
│   │   ├── privacy.astro         # static markup or React island
│   │   └── blog/
│   │       ├── index.astro       # iterates content collection
│   │       └── [slug].astro      # renders post body via Astro <Content />
│   ├── lib/
│   │   └── rehype-external-links.ts  # build-time UTM + ref + target/rel decoration
│   └── react/                    # React components extracted from SiteApp.tsx
│       ├── LandingApp.tsx
│       ├── HowItWorksApp.tsx
│       ├── BlogIndexExtras.tsx   # if any interactivity is needed
│       └── ...                   # PrivacyPage, FAQ, etc. as needed
```

**Notes**
- `apps/site/src/SiteApp.tsx` gets split into per-page React entry components. Initial pass: keep all components co-located in one file but export multiple roots (`LandingApp`, `HowItWorksApp`, `PrivacyApp`). The blog branches (`BlogIndexPage`, `BlogPostPage`) are deleted — Astro owns those.
- `apps/site/src/demo/DemoNewTabApp.tsx` is reused as-is — Astro mounts it with `client:load` from `demo.astro`.
- `apps/site/src/main.tsx` is deleted. Page-specific React bootstrapping happens through Astro's `client:*` directives.
- Existing `apps/site/scripts/build-blog.mjs` is deleted. `apps/site/src/generated/blog-posts.ts` is deleted.
- Hand-written `apps/site/index.html`, `apps/site/demo/index.html`, `apps/site/how-it-works/index.html`, `apps/site/privacy/index.html` are deleted (replaced by `.astro` pages).
- Hand-written CSS (`apps/site/src/site.css`) is imported from `BaseLayout.astro`.
- Tailwind base (`src/index.css` at repo root) is also imported from `BaseLayout.astro`. The Tailwind v4 `@source` directives need to include `apps/site/src/**/*.{astro,tsx,ts}` so JIT picks up classes used in `.astro` files.

---

## 5. File mapping (current → new)

| Current | New | Notes |
|---|---|---|
| `apps/site/index.html` | `apps/site/src/pages/index.astro` | Use `BaseLayout`; import `LandingApp` React component |
| `apps/site/demo/index.html` | `apps/site/src/pages/demo.astro` | Mount `DemoNewTabApp` with `client:load`; preserve embed-aware GA guard |
| `apps/site/how-it-works/index.html` | `apps/site/src/pages/how-it-works.astro` | Mount `HowItWorksApp` with `client:load` |
| `apps/site/privacy/index.html` | `apps/site/src/pages/privacy.astro` | Try static `.astro` first; React island only if interactivity is needed |
| `apps/site/blog/index.html` (generated) | `apps/site/src/pages/blog/index.astro` | Iterate `getCollection('blog')` |
| `apps/site/blog/<slug>/index.html` (generated) | `apps/site/src/pages/blog/[slug].astro` | `getStaticPaths` from collection; render `<Content />` |
| `apps/site/content/blog/*.md` | `apps/site/src/content/blog/*.md` | Moved into Astro content directory |
| `apps/site/scripts/build-blog.mjs` | deleted; replaced by `src/lib/rehype-external-links.ts` + Astro markdown config | Build-time link decoration via rehype |
| `apps/site/src/generated/blog-posts.ts` | deleted | Astro content collection replaces it |
| `apps/site/src/main.tsx` | deleted | Per-page React entries via `client:*` |
| `apps/site/src/SiteApp.tsx` | split into `apps/site/src/react/{LandingApp,HowItWorksApp,...}.tsx` | Components stay; page switch goes |
| `apps/site/src/demo-entry.tsx` | deleted | Demo bootstrapped from `demo.astro` |
| `apps/site/vite.config.ts` | replaced by `apps/site/astro.config.mjs` | Astro uses Vite under the hood |
| `apps/site/src/site.css` | unchanged; imported from `BaseLayout.astro` | |
| Repo root `public/` (favicons) | copied to `apps/site/public/` (or symlinked) | Astro serves from its own `public/` |
| Repo root `src/index.css` (Tailwind base) | unchanged; imported from `BaseLayout.astro` | Update `@source` globs to include `.astro` files |
| `apps/site/src/feature-previews/reading-states.jpg` | unchanged or moved to `public/` | Currently referenced as `/src/feature-previews/...` which works in dev only — consider moving to `public/` |
| `dist-website/` | unchanged output dir | Set in `astro.config.mjs` `outDir` |

---

## 6. Phased implementation

Each phase is committable on its own. Run `pnpm build:website` and visual diff against baselines at the end of every phase.

### Phase 0 — Preflight (already done)
- ✅ Capture `before/head/*.html` (10 files)
- ✅ Capture `before/screenshots/desktop-*.png` (10 files)
- ✅ Capture `before/screenshots/mobile-*.png` (10 files)
- ✅ Confirm UTM/ref decoration is live in current build

### Phase 1 — Astro skeleton + Tailwind + React
1. `pnpm --filter @totem/site add -D astro @astrojs/react @astrojs/sitemap @astrojs/check`
2. Create `apps/site/astro.config.mjs`:
   - `output: 'static'`
   - `outDir: '../../dist-website'` (matches today)
   - `site: 'https://usetotem.xyz'`
   - integrations: `react()`, `sitemap()`
   - `vite: { plugins: [tailwindcss()] }`
   - `markdown: { rehypePlugins: [...] }` (link decoration added in Phase 4)
3. Update `apps/site/package.json` scripts: `dev: astro dev`, `build: astro build`, `preview: astro preview`.
4. Update root `package.json` `build:website` script if needed (currently `pnpm --filter @totem/site build`, no change).
5. Smoke test: `pnpm --filter @totem/site dev` should start Astro on port 4321 and serve a placeholder `index.astro`.

### Phase 2 — `BaseLayout` + shared chrome
1. Create `apps/site/src/layouts/BaseLayout.astro` accepting frontmatter props: `title`, `description`, `canonical`, `ogImage`, `ogType`, `jsonLd`, `gaGuard` (boolean for demo embed mode).
2. Inline GA4 snippet (with optional embed guard for demo).
3. Add Google Fonts preconnect + stylesheet (Spectral + Space Grotesk).
4. Add favicon links.
5. Render `<slot name="head" />` for page-specific JSON-LD or extra meta.
6. Render `<SiteHeader />` and `<SiteFooter />` (Astro components — port the JSX directly to `.astro` syntax; both are static).
7. Import `apps/site/src/site.css` and the repo-root Tailwind base CSS.

### Phase 3 — Static pages first (`privacy`, `how-it-works`, `landing`)
Order: privacy (smallest, mostly static text) → how-it-works (mid; has interactive stations) → landing (largest; embeds demo iframe + FAQ disclosure widgets).

For each:
1. Create `src/pages/<route>.astro` using `BaseLayout` with the exact `<head>` props pulled from `before/head/<route>.html`.
2. Extract the corresponding component from `SiteApp.tsx` into `src/react/<Page>App.tsx`. Mount with `client:load`.
3. Diff `<head>` byte-for-byte against `before/head/<route>.html`. The only allowed differences:
   - Astro injects `<meta name="generator">` (allowed).
   - Module preload hashes change (expected).
   - Removed: hand-coded `<script type="module" src="./src/main.tsx">` (replaced by Astro's bundle injection).
4. Visual diff at desktop + mobile — must match baseline.

### Phase 4 — Blog content collection + rehype link decoration
1. Move `apps/site/content/blog/*.md` → `apps/site/src/content/blog/*.md`.
2. Create `apps/site/src/content.config.ts`:
   ```ts
   import { defineCollection, z } from "astro:content";
   const blog = defineCollection({
     type: "content",
     schema: z.object({
       title: z.string(),
       description: z.string(),
       slug: z.string().optional(),
       publishedAt: z.string().optional(),
       draft: z.boolean().optional(),
       canonicalKeyword: z.string().optional(),
     }),
   });
   export const collections = { blog };
   ```
3. Create `apps/site/src/lib/rehype-external-links.ts` — port the logic from `build-blog.mjs:21-49` (the markdown-it `link_open` renderer) to a rehype plugin. Behavior:
   - For external `<a href>` (http/https, host !== `usetotem.xyz`):
     - Add `utm_source=usetotem.xyz`, `utm_medium=referral`, `utm_campaign=blog`, `ref=usetotem.xyz` (only if not already present).
     - Add `target="_blank"`, `rel="noopener noreferrer"`.
   - Skip internal `usetotem.xyz` and anchor/footnote links.
   - Skip non-http(s) protocols.
4. Wire into `astro.config.mjs`:
   ```js
   markdown: {
     remarkPlugins: ['remark-gfm'], // tables in posts
     rehypePlugins: ['rehype-slug', './src/lib/rehype-external-links.ts'],
   }
   ```
5. Markdown-it footnote plugin → replaced by `remark-gfm` + footnote support is built into remark. Verify footnote rendering on `pocket-alternatives-2026` and `how-to-export-twitter-bookmarks` (heaviest footnote use).

### Phase 5 — Blog pages (`/blog`, `/blog/[slug]`)
1. Create `apps/site/src/pages/blog/index.astro`:
   - `const posts = await getCollection('blog', ({ data }) => !data.draft);`
   - Sort by `publishedAt` descending.
   - Use `BaseLayout` with title `Totem — Blog`, description matches `build-blog.mjs:144`.
   - Render the same listing markup currently produced by `BlogIndexPage` in `SiteApp.tsx:2070-2090`.
2. Create `apps/site/src/pages/blog/[slug].astro`:
   - `getStaticPaths()` returns one entry per published post.
   - `BaseLayout` props: title `${post.title} — Totem`, canonical `https://usetotem.xyz/blog/${slug}`, JSON-LD `BlogPosting`, OG type `article`.
   - Render `<article class="prose prose-neutral ..."><Content /></article>` using the same Tailwind typography classes from `SiteApp.tsx:2203`.
   - Render the static `BlogPostCta` (port of `BlogPostCta` from `SiteApp.tsx:2215`).
   - The runtime `parseHtml` + `makeBlogLinkTransformer` is gone — link decoration is now in the rehype plugin at build time.
3. The Totem-host UTM rewrite (`makeBlogLinkTransformer` on `TOTEM_HOSTS`) must move into the rehype plugin too. Verify by grepping rendered HTML for the existing `utm_source=blog&utm_campaign=blog_post&utm_content=<slug>` patterns visible in the desktop screenshots — for example `desktop-blog-best-chrome-bookmark-managers-2026.png` shows `https://usetotem.xyz/?utm_source=blog&utm_medium=referral&utm_campaign=blog_post&utm_content=best-chrome-bookmark-managers-2026`. Pass the slug into the rehype plugin via `data.astro.slug` so `utm_content` can be set per post.

### Phase 6 — Sitemap + robots
1. `@astrojs/sitemap` integration auto-generates `sitemap-index.xml`.
2. Verify the sitemap includes every page + every blog post.
3. Add `apps/site/public/robots.txt` if not already present (the current site does not appear to ship one — flag this as a small SEO improvement; reference the new sitemap from it).

### Phase 7 — Tailwind purge + asset paths
1. Update `src/index.css` (Tailwind v4 base) — add `@source "../../apps/site/src/**/*.{astro,tsx,ts}"` so JIT scans `.astro` files.
2. Move `apps/site/src/feature-previews/reading-states.jpg` to `apps/site/public/feature-previews/reading-states.jpg`. Update references from `/src/feature-previews/...` to `/feature-previews/...`. (Current path works in dev only and ships through Vite's asset graph — Astro will need an explicit `import` or a public path.)
3. Move repo-root `public/` favicons to `apps/site/public/` (or symlink). Confirm `dist-website/favicon.svg` etc. still exist after `astro build`.

### Phase 8 — Verify + cutover
1. `pnpm --filter @totem/site build` — confirm `dist-website/` matches the structure of today's build (same routes).
2. Capture after-screenshots into `plans/astro-migration/after/screenshots/` at desktop + mobile for all 10 routes.
3. Diff `dist-website/<route>/index.html` `<head>` against `plans/astro-migration/before/head/<route>.html`. Allowed differences: bundle hash names, `<meta name="generator">`, removed inline script tags. Disallowed: missing canonical, missing OG, missing JSON-LD, changed title/description text.
4. Run a Lighthouse audit (manual; not scripted) on `/` and one blog post post-build via `pnpm --filter @totem/site preview`. Verify SEO score ≥ current.
5. Spot-check rendered HTML of `dist-website/blog/best-chrome-bookmark-managers-2026/index.html` for:
   - External `<a>` containing `?utm_source=usetotem.xyz&utm_medium=referral&utm_campaign=blog&ref=usetotem.xyz` (the build-time decoration).
   - Internal `<a href="https://usetotem.xyz/...">` containing `utm_source=blog&utm_medium=referral&utm_campaign=blog_post&utm_content=best-chrome-bookmark-managers-2026` (Totem-host decoration).
6. Confirm `dist-website/sitemap-index.xml` exists and lists all routes.
7. Confirm `package:website` (from root `package.json`) still works — it bundles `dist-website/`. No script change should be required.

---

## 7. SEO parity checklist (must pass per page)

Run for every route. Source of truth is `plans/astro-migration/before/head/<route>.html`.

For each `dist-website/<route>/index.html`:
- [ ] `<title>` matches baseline
- [ ] `<meta name="description">` matches baseline
- [ ] `<link rel="canonical">` matches baseline
- [ ] All `<meta property="og:*">` match baseline
- [ ] All `<meta name="twitter:*">` match baseline
- [ ] Favicon links present (`favicon.svg`, `favicon-48.png`, `apple-touch-icon`)
- [ ] Font preconnect + stylesheet present
- [ ] GA4 snippet present (and on `/demo/`, embed-guarded)
- [ ] JSON-LD present where the baseline has it (`SoftwareApplication` on `/`, `BlogPosting` on each post)
- [ ] Article body present in raw HTML (no JS required) for blog posts
- [ ] External `<a>` in blog post body has UTM/`ref` query string baked in

Also new (improvements over current):
- [ ] `sitemap-index.xml` generated
- [ ] `robots.txt` references sitemap

---

## 8. Visual parity checklist (must pass per page × per viewport)

After Phase 8, for each route × {desktop, mobile}:
- [ ] After-screenshot exists in `plans/astro-migration/after/screenshots/`
- [ ] Layout matches baseline (header, footer, hero, sections)
- [ ] Typography matches (Spectral for serif headings, Space Grotesk for body)
- [ ] Tailwind utility classes resolve (no purge surprises in `.astro` scope)
- [ ] Demo iframe on landing still loads (`/demo/?embed=1`)
- [ ] FAQ disclosure widgets on landing still expand
- [ ] How-it-works diagram still interactive (stations clickable, lines toggle)
- [ ] Reading-states preview image loads on landing

---

## 9. Risks & open decisions

### Risks
1. **Tailwind class purging in `.astro` files** — If `@source` globs miss `.astro`, classes will be stripped and pages render unstyled. Mitigation: explicit `@source` in `src/index.css`; verify with one full build before continuing past Phase 2.
2. **Footnote rendering parity** — Switching from `markdown-it-footnote` to `remark-gfm`/remark footnotes may change footnote markup (different IDs, different backref text). Expected: minor cosmetic differences. Acceptable if all anchors still resolve. Verify on `pocket-alternatives-2026` (most footnotes).
3. **GA4 double-counting on demo** — Astro must reproduce the embed/iframe guard from `apps/site/demo/index.html:6-22` exactly, or analytics double-counts when the landing page embeds the demo.
4. **`feature-previews/reading-states.jpg` path** — Currently referenced as `/src/feature-previews/...` which only resolves through Vite's dev asset graph. Move to `public/` or `import` it explicitly. If skipped, the landing page will 404 the image in production.
5. **React 19 + Astro compatibility** — Project is on `react@^19.0.0`. Verify `@astrojs/react` supports React 19 (it does as of Astro 4.16+; pin Astro version accordingly).
6. **Repo-root `vite.config.ts`** — The root `vite.config.ts` builds the **extension**, not the site. Untouched by this migration but worth noting the root `pnpm dev` and `pnpm build:extension` continue to work.
7. **`utm_content=<slug>` in rehype** — Astro's content rendering passes file metadata into rehype plugins via VFile data. Need to confirm the slug is reachable in the rehype pass; if not, do a post-render string substitution at the page level instead.

### Open decisions (need user input or judgment)
- **Migrate in place vs. parallel app?** Plan above migrates **in place** — `apps/site` becomes Astro and the old Vite shell is replaced. Faster but harder to bail out. Alternative: build at `apps/site-astro/` and switch the deploy target last. Recommended: in-place with feature-branch cutover.
- **`SiteApp.tsx` split granularity?** Initial pass: keep components co-located, just export multiple roots. Later pass: actually break into per-page files. Don't conflate the two.
- **CTA / BlogPostCta** — port to a static `.astro` component (no React needed) since it's just markup + a static link. Recommended.
- **Dropping `html-react-parser`** — once Phase 5 is in, this dependency is unused. Remove from `apps/site/package.json` (or root, wherever it lives). Confirm nothing else imports it.

---

## 10. Cutover & rollback

- All work happens on a feature branch (`astro-migration` or similar).
- `dist-website/` output stays at `<repo>/dist-website/` — the deploy step doesn't change.
- Rollback = revert the merge commit. Baselines in `plans/astro-migration/before/` make a re-validation cheap.
- Post-cutover: keep `plans/astro-migration/` for a few weeks in case a regression surfaces. Delete after the next blog post ships clean.

---

## 11. Quick reference: commands

```bash
# Dev
pnpm --filter @totem/site dev               # Astro dev on :4321

# Build + preview
pnpm --filter @totem/site build             # → dist-website/
pnpm --filter @totem/site preview           # serves dist-website/

# Verify head parity (run per route post-build)
diff <(awk '/<head>/,/<\/head>/' dist-website/index.html) plans/astro-migration/before/head/root.html

# Verify external link decoration in built output
grep -oE 'href="[^"]+utm_source=usetotem.xyz[^"]+"' dist-website/blog/best-chrome-bookmark-managers-2026/index.html | head

# After-screenshot capture (manual, via chrome-devtools MCP):
#   navigate http://localhost:4321/<route> → resize 1280x800 → take_screenshot fullPage → save to plans/astro-migration/after/screenshots/
#   then resize 390x844 and repeat
```

---

## 12. Success criteria (definition of done)

1. `pnpm --filter @totem/site build` completes without errors.
2. `dist-website/` contains every route from the baseline list.
3. SEO checklist passes for all 10 routes.
4. Visual checklist passes for all 10 routes × 2 viewports.
5. External `<a>` in built blog HTML carry UTM + `ref` query — visible to crawlers without JS.
6. `sitemap-index.xml` generated and lists every page.
7. Demo, how-it-works diagram, and FAQ remain interactive.
8. Root `pnpm build:website` script unchanged.
9. `package:website` still produces a valid bundle.
10. `apps/site/scripts/build-blog.mjs`, `apps/site/src/generated/blog-posts.ts`, and `apps/site/src/main.tsx` are deleted.
