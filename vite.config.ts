// His Theatre build config: plain Vite + React + Tailwind, installable on phones (PWA).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.png", "icons/apple-touch-icon-180.png"],
      manifest: {
        id: "/",
        name: "His Theatre",
        short_name: "His Theatre",
        description: "The official app of HIS (Hearts In Service) Theatre Ministry.",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        theme_color: "#343434",
        background_color: "#FBF8F1",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell (HTML, JS, CSS, fonts, icons) so the app opens offline.
        globPatterns: ["**/*.{js,css,html,woff2,png,webp,svg}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Never cache calls to the database; the app keeps its own offline copy of what you last saw.
        navigateFallbackDenylist: [/^\/api\//],
        // Fonts chosen in Profile → Appearance: keep a copy so they still show offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 8080 },
});
