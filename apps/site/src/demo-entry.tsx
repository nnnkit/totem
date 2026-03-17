import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoNewTabApp } from "@totem/runtime-demo";
import { ErrorBoundary } from "@totem/app-shell";
import "../../../src/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <DemoNewTabApp />
    </ErrorBoundary>
  </StrictMode>,
);
