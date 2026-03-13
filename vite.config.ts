import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    modulePreload: { polyfill: false },
    outDir: "dist",
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "newtab.html"),
        reader: resolve(__dirname, "reader.html"),
        "open-in-totem": resolve(__dirname, "src/content/open-in-totem.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
