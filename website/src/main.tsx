import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SiteApp, type SitePage } from "./SiteApp";
import "./site.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

const pageAttr = root.dataset.page;
const page: SitePage =
  pageAttr === "privacy" || pageAttr === "support" ? pageAttr : "landing";

createRoot(root).render(
  <StrictMode>
    <SiteApp page={page} />
  </StrictMode>,
);
