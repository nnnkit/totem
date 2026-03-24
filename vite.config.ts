import { defineConfig, build as viteBuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const contentScripts: Record<string, string> = {
  "open-in-totem": resolve(__dirname, "src/content/open-in-totem.ts"),
};

function contentScriptPlugin(): Plugin {
  return {
    name: "content-script-iife",
    async closeBundle() {
      for (const [name, entry] of Object.entries(contentScripts)) {
        await viteBuild({
          configFile: false,
          logLevel: "warn",
          build: {
            write: true,
            emptyOutDir: false,
            outDir: "dist",
            rollupOptions: {
              input: { [name]: entry },
              output: {
                format: "iife",
                entryFileNames: "assets/[name].js",
              },
            },
          },
        });
      }
    },
  };
}

function serviceWorkerPlugin(): Plugin {
  return {
    name: "service-worker-ts",
    async closeBundle() {
      await viteBuild({
        configFile: false,
        logLevel: "warn",
        build: {
          write: true,
          emptyOutDir: false,
          outDir: "dist",
          lib: {
            entry: resolve(__dirname, "src/service-worker/index.ts"),
            formats: ["iife"],
            name: "ServiceWorker",
            fileName: () => "service-worker-next.js",
          },
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentScriptPlugin(), serviceWorkerPlugin()],
  base: "./",
  build: {
    modulePreload: { polyfill: false },
    outDir: "dist",
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "newtab.html"),
        reader: resolve(__dirname, "reader.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
