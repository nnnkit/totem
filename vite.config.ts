import { defineConfig, build as viteBuild, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import { resolve } from "path";

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8"),
) as { version?: string };
const appVersion = packageJson.version ?? "0.0.0";

const contentScripts: Record<string, string> = {
  "open-in-totem": resolve(__dirname, "src/content/open-in-totem.ts"),
};

function contentScriptPlugin(): Plugin {
  return {
    name: "content-script-iife",
    async closeBundle() {
      await Promise.all(
        Object.entries(contentScripts).map(([name, entry]) =>
          viteBuild({
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
          }),
        ),
      );
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
          rollupOptions: {
            input: {
              "service-worker": resolve(
                __dirname,
                "src/service-worker/index.ts",
              ),
            },
            output: {
              format: "iife",
              entryFileNames: "[name].js",
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentScriptPlugin(), serviceWorkerPlugin()],
  define: {
    __TOTEM_APP_VERSION__: JSON.stringify(appVersion),
  },
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
