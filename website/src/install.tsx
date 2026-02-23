import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import InstallPage from "./install/InstallPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InstallPage />
  </StrictMode>,
);
