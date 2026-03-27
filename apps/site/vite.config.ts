import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyExtensionSiteAssets() {
  return {
    name: "copy-extension-site-assets",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, "dist");

      const copyIfExists = (sourcePath: string, destinationPath: string) => {
        const source = resolve(__dirname, sourcePath);
        if (!existsSync(source)) return;

        const destination = resolve(outDir, destinationPath);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(source, destination);
      };

      copyIfExists("../../public/favicon.svg", "favicon.svg");
      copyIfExists("../../public/favicon-48.png", "favicon-48.png");
      copyIfExists("../../public/favicon-16.png", "favicon-16.png");
      copyIfExists("../../public/icons/icon-128.png", "icons/icon-128.png");
      copyIfExists("../../public/icons/icon-48.png", "icons/icon-48.png");
      copyIfExists("../../public/icons/icon-16.png", "icons/icon-16.png");
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), tailwindcss(), copyExtensionSiteAssets()],
  publicDir: resolve(__dirname, "public"),
  base: "/",
  build: {
    modulePreload: { polyfill: false },
    outDir: resolve(__dirname, "../../dist-website"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        privacy: resolve(__dirname, "privacy/index.html"),
        demo: resolve(__dirname, "demo/index.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
