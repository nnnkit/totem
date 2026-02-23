import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "@ext": path.resolve(import.meta.dirname, "../src") },
      dedupe: ["idb", "react", "react-dom"],
    },
  },
});
