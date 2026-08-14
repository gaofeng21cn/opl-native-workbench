import { createRoot } from "react-dom/client";
import "./integrations/deepseek-harness/theme";
import type { OplStudioSurface } from "./bridge/oplBridge";
import { installWebTransport } from "./bridge/webTransport";
import { renderOplStudioRoot } from "./composition/dshSlotHost";

declare global {
  interface Window {
    oplStudio?: OplStudioSurface;
  }
}

const desktopTransportInstalled = Boolean(window.oplStudio);
document.documentElement.dataset.oplHost = desktopTransportInstalled ? "desktop" : "web";

if (!desktopTransportInstalled && window.location.protocol !== "file:") {
  installWebTransport();
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("missing #root renderer mount");
}

createRoot(rootElement).render(renderOplStudioRoot());
