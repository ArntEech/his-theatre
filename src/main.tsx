import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Applies the saved light/dark choice and follows the phone when set to "System".
import "./lib/theme";
import "./lib/textSize";
import "./lib/font";
import { registerSW } from "virtual:pwa-register";

// Keep installed copies up to date. A new version is downloaded in the background and the
// app switches to it at once (the page reloads itself). It looks for one when the app opens,
// when it comes back to the front, and every 30 minutes while open.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {});
    };
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  },
});
void updateSW;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
