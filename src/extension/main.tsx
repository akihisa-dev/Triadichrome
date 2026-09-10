import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionPage } from "./ExtensionPage";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("The extension page root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ExtensionPage />
  </StrictMode>,
);
