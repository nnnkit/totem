import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

function copyWebsiteStaticFiles() {
  return {
    name: "copy-website-static-files",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, "dist-website");

      const copyIfExists = (sourcePath: string, destinationPath: string) => {
        const source = resolve(__dirname, sourcePath);
        if (!existsSync(source)) return;

        const destination = resolve(outDir, destinationPath);
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(source, destination);
      };

      copyIfExists("website/data.json", "data.json");
      copyIfExists("public/favicon.svg", "favicon.svg");
      copyIfExists("public/favicon-48.png", "favicon-48.png");
      copyIfExists("public/favicon-16.png", "favicon-16.png");
      copyIfExists("public/icons/icon-128.png", "icons/icon-128.png");
      copyIfExists("public/icons/icon-48.png", "icons/icon-48.png");
      copyIfExists("public/icons/icon-16.png", "icons/icon-16.png");
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, "website"),
  publicDir: false,
  plugins: [react(), tailwindcss(), copyWebsiteStaticFiles()],
  base: "/",
  build: {
    modulePreload: { polyfill: false },
    outDir: resolve(__dirname, "dist-website"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "website/index.html"),
        privacy: resolve(__dirname, "website/privacy.html"),
        "demo-page": resolve(__dirname, "website/demo-page.html"),
        demo: resolve(__dirname, "website/demo.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
