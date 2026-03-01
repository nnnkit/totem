import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

function copyWebsiteDataJson() {
  return {
    name: "copy-website-data-json",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      const source = resolve(__dirname, "website/data.json");
      if (!existsSync(source)) return;

      const outDir = options.dir ?? resolve(__dirname, "dist");
      const websiteOutDir = resolve(outDir, "website");
      mkdirSync(websiteOutDir, { recursive: true });
      copyFileSync(source, resolve(websiteOutDir, "data.json"));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyWebsiteDataJson()],
  base: "./",
  build: {
    modulePreload: { polyfill: false },
    outDir: "dist",
    rollupOptions: {
      input: {
        website: resolve(__dirname, "website/index.html"),
        privacy: resolve(__dirname, "website/privacy.html"),
        "demo-page": resolve(__dirname, "website/demo-page.html"),
        demo: resolve(__dirname, "website/demo.html"),
        newtab: resolve(__dirname, "newtab.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
