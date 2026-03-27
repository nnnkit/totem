import { dirname, resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "../.."),
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    modulePreload: { polyfill: false },
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "../../newtab.html"),
        reader: resolve(__dirname, "../../reader.html"),
        "open-in-totem": resolve(__dirname, "../../src/content/open-in-totem.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
