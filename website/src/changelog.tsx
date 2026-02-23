import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChangelogPage from "./changelog/ChangelogPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChangelogPage />
  </StrictMode>,
);
