import { visit } from "unist-util-visit";

const SITE_HOSTNAME = "usetotem.xyz";
const TOTEM_HOSTS = new Set(["usetotem.xyz", "www.usetotem.xyz"]);

function decorateExternalUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (TOTEM_HOSTS.has(url.hostname)) return null;
  if (url.hostname === SITE_HOSTNAME || url.hostname.endsWith(`.${SITE_HOSTNAME}`)) return null;

  if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", SITE_HOSTNAME);
  if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", "referral");
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", "blog");
  if (!url.searchParams.has("ref")) url.searchParams.set("ref", SITE_HOSTNAME);
  return url.toString();
}

function decorateInternalUrl(href, slug) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!TOTEM_HOSTS.has(url.hostname)) return null;
  url.searchParams.set("utm_source", "blog");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "blog_post");
  if (slug) url.searchParams.set("utm_content", slug);
  return url.toString();
}

function deriveSlug(file) {
  const fm = file?.data?.astro?.frontmatter;
  if (fm && typeof fm.slug === "string") return fm.slug;
  const path = file?.history?.[0] || file?.path;
  if (typeof path === "string") {
    const base = path.split(/[\\/]/).pop() || "";
    return base.replace(/\.md$/, "");
  }
  return "";
}

export default function rehypeBlogLinks() {
  return (tree, file) => {
    const slug = deriveSlug(file);
    visit(tree, "element", (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties && node.properties.href;
      if (typeof href !== "string") return;

      const internal = decorateInternalUrl(href, slug);
      if (internal !== null) {
        node.properties.href = internal;
        return;
      }

      const external = decorateExternalUrl(href);
      if (external !== null) {
        node.properties.href = external;
        if (!node.properties.target) node.properties.target = "_blank";
        if (!node.properties.rel) node.properties.rel = "noopener noreferrer";
      }
    });
  };
}
