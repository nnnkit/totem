import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";
import rehypeBlogLinks from "./src/lib/rehype-blog-links.mjs";

export default defineConfig({
  site: "https://usetotem.xyz",
  output: "static",
  outDir: "../../dist-website",
  trailingSlash: "ignore",
  build: {
    format: "directory",
    assets: "assets",
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith("/uninstall-feedback/"),
      serialize(item) {
        const pathname = new URL(item.url).pathname;
        const isHome = pathname === "/";
        const isBlogPost = pathname.startsWith("/blog/") && pathname !== "/blog/";
        return {
          ...item,
          changefreq: isBlogPost ? "weekly" : "monthly",
          priority: isHome ? 1 : isBlogPost ? 0.7 : 0.8,
        };
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeBlogLinks],
    smartypants: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
