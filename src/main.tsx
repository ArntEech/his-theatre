import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
// Applies the saved light/dark choice and follows the phone when set to "System".
import "./lib/theme";
import "./lib/textSize";
import "./lib/font";
import { registerSW } from "virtual:pwa-register";
import { attachRegistration, checkForUpdate } from "./lib/appUpdate";

// Keep installed copies up to date. A new version downloads in the background and the app
// switches to it at once (the page reloads itself). It checks when the app opens, whenever it
// comes back to the front or back online, and every 5 minutes while open. Settings also has a
// "Check for Updates" button (src/lib/appUpdate.ts).
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    attachRegistration(registration, () => void updateSW(true));
    const check = () => void checkForUpdate(true);
    check();
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("pageshow", check);
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
