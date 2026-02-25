import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import {
  migrateLegacyLocalStorageKeys,
  migrateLegacyChromeStorageKeys,
} from "./lib/storage-migration";
import "./index.css";

migrateLegacyLocalStorageKeys();
migrateLegacyChromeStorageKeys().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
