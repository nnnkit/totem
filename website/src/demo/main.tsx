import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../../../src/components/ErrorBoundary";
import { DemoNewTabApp } from "./DemoNewTabApp";
import "../../../src/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <DemoNewTabApp />
    </ErrorBoundary>
  </StrictMode>,
);
