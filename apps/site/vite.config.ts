import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "url";
import { buildBlog } from "./scripts/build-blog.mjs";

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

function blogPagesPlugin({ includeDrafts }: { includeDrafts: boolean }): Plugin {
  return {
    name: "totem-blog-pages",
    configureServer(server) {
      // Rewrite clean URLs to the actual generated index.html, before Vite's
      // SPA fallback catches them and serves the landing page.
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? "";
        const pathOnly = url.split("?")[0];
        const query = url.slice(pathOnly.length);

        // /blog → /blog/index.html ; /blog/<slug> → /blog/<slug>/index.html
        const indexMatch = pathOnly === "/blog" || pathOnly === "/blog/";
        const slugMatch = pathOnly.match(/^\/blog\/([^/]+)\/?$/);

        if (indexMatch) {
          req.url = "/blog/index.html" + query;
        } else if (slugMatch) {
          const [, slug] = slugMatch;
          const slugIndex = resolve(__dirname, `blog/${slug}/index.html`);
          if (existsSync(slugIndex)) {
            req.url = `/blog/${slug}/index.html` + query;
          }
        }
        next();
      });

      server.watcher.add(resolve(__dirname, "content/blog"));
      server.watcher.on("all", (_event, path) => {
        if (path.endsWith(".md") && path.includes("content/blog")) {
          buildBlog({ includeDrafts });
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const includeDrafts = command === "serve";
  const { inputs: blogInputs, counts } = buildBlog({ includeDrafts });

  // eslint-disable-next-line no-console
  console.log(
    `[totem-blog-pages] command=${command} includeDrafts=${includeDrafts} visible=${counts.visible} drafts=${counts.drafts}`,
  );

  return {
    root: resolve(__dirname),
    plugins: [react(), tailwindcss(), copyExtensionSiteAssets(), blogPagesPlugin({ includeDrafts })],
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
          "how-it-works": resolve(__dirname, "how-it-works/index.html"),
          ...blogInputs,
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
  };
});
