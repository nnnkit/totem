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
  integrations: [react(), sitemap()],
  markdown: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeBlogLinks],
    smartypants: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
