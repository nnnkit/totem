// Reads markdown blog posts, renders them to HTML, and emits per-post HTML
// pages, a /blog listing page, and a generated TS module the React app
// imports. Drafts are excluded unless `includeDrafts` is true (dev mode).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, "..");
const CONTENT_DIR = resolve(SITE_ROOT, "content/blog");
const OUTPUT_BLOG_DIR = resolve(SITE_ROOT, "blog");
const GENERATED_DIR = resolve(SITE_ROOT, "src/generated");

const SITE_URL = "https://usetotem.xyz";
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/icon-128.png`;

const md = new MarkdownIt({ html: true, linkify: true, typographer: true }).use(footnote);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function readPosts() {
  if (!existsSync(CONTENT_DIR)) return [];

  return readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const filePath = join(CONTENT_DIR, file);
      const raw = readFileSync(filePath, "utf8");
      const { data, content } = matter(raw);

      const slug = data.slug ?? file.replace(/\.md$/, "");
      const title = data.title ?? slug;
      const description = data.description ?? "";
      const publishedAt = data.publishedAt ?? null;
      const draft = data.draft === true;
      const canonicalKeyword = data.canonicalKeyword ?? null;

      const html = md.render(content);

      return {
        slug,
        title,
        description,
        publishedAt: publishedAt
          ? new Date(publishedAt).toISOString().slice(0, 10)
          : null,
        draft,
        canonicalKeyword,
        html,
        sourceFile: file,
      };
    });
}

function postPageHtml(post) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = `${post.title} — Totem`;
  const description = post.description;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VBKV6TVM6W"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-VBKV6TVM6W');
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,700;1,400;1,700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />

    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48" />
    <link rel="apple-touch-icon" href="/icons/icon-128.png" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(post.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta property="og:site_name" content="Totem" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(post.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />

    <!-- JSON-LD -->
    <script type="application/ld+json">
    ${escapeJsonForScript({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      datePublished: post.publishedAt,
      url,
      author: { "@type": "Organization", name: "Totem" },
      publisher: {
        "@type": "Organization",
        name: "Totem",
        logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
      },
    })}
    </script>
  </head>
  <body>
    <div id="root" data-page="blog-post" data-slug="${escapeHtml(post.slug)}"></div>
    <script type="module" src="../../src/main.tsx"></script>
  </body>
</html>
`;
}

function indexPageHtml() {
  const url = `${SITE_URL}/blog/`;
  const title = "Totem — Blog";
  const description = "Notes on Twitter/X bookmarks, read-later workflows, and the small details that make reading what you saved actually possible.";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VBKV6TVM6W"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-VBKV6TVM6W');
    </script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,700;1,400;1,700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />

    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${url}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48" />
    <link rel="apple-touch-icon" href="/icons/icon-128.png" />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
    <meta property="og:site_name" content="Totem" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  </head>
  <body>
    <div id="root" data-page="blog-index"></div>
    <script type="module" src="../src/main.tsx"></script>
  </body>
</html>
`;
}

function generatedModuleSource(visiblePosts) {
  const sorted = [...visiblePosts].sort((a, b) => {
    const aDate = a.publishedAt ?? "";
    const bDate = b.publishedAt ?? "";
    return bDate.localeCompare(aDate);
  });

  return `// AUTO-GENERATED — do not edit. Regenerated on every dev/build by build-blog.mjs.

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string | null;
  draft: boolean;
  canonicalKeyword: string | null;
  html: string;
  sourceFile: string;
}

export const blogPosts: BlogPost[] = ${JSON.stringify(sorted, null, 2)};

export const blogPostsBySlug: Record<string, BlogPost> = Object.fromEntries(
  blogPosts.map((post) => [post.slug, post]),
);
`;
}

export function buildBlog({ includeDrafts = false } = {}) {
  const allPosts = readPosts();
  const visiblePosts = includeDrafts ? allPosts : allPosts.filter((post) => !post.draft);

  if (existsSync(OUTPUT_BLOG_DIR)) rmSync(OUTPUT_BLOG_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_BLOG_DIR, { recursive: true });
  mkdirSync(GENERATED_DIR, { recursive: true });

  const inputs = {};

  writeFileSync(join(OUTPUT_BLOG_DIR, "index.html"), indexPageHtml(), "utf8");
  inputs["blog-index"] = join(OUTPUT_BLOG_DIR, "index.html");

  for (const post of visiblePosts) {
    const slugDir = join(OUTPUT_BLOG_DIR, post.slug);
    mkdirSync(slugDir, { recursive: true });
    writeFileSync(join(slugDir, "index.html"), postPageHtml(post), "utf8");
    inputs[`blog-${post.slug}`] = join(slugDir, "index.html");
  }

  writeFileSync(join(GENERATED_DIR, "blog-posts.ts"), generatedModuleSource(visiblePosts), "utf8");

  return {
    inputs,
    counts: {
      total: allPosts.length,
      visible: visiblePosts.length,
      drafts: allPosts.length - visiblePosts.length,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const includeDrafts = process.argv.includes("--drafts");
  const { counts } = buildBlog({ includeDrafts });
  console.log(`[build-blog] ${counts.visible} visible, ${counts.drafts} drafts (includeDrafts=${includeDrafts})`);
}
