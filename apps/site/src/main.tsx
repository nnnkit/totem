import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteApp, type SitePage } from "./SiteApp";
import "../../../src/index.css";
import "./site.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

const pageAttr = root.dataset.page;
const slugAttr = root.dataset.slug ?? null;

const page: SitePage =
  pageAttr === "privacy"
    ? "privacy"
    : pageAttr === "how-it-works"
      ? "how-it-works"
      : pageAttr === "blog-index"
        ? "blog-index"
        : pageAttr === "blog-post"
          ? "blog-post"
          : "landing";

createRoot(root).render(
  <StrictMode>
    <SiteApp page={page} slug={slugAttr} />
  </StrictMode>,
);
