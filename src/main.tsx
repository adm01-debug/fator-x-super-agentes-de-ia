import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";
import { initGlobalErrorHandlers } from "./lib/logger";

// Initialize global error handlers before rendering
initGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Initialize Web Vitals monitoring
initWebVitals();

// Register Service Worker for PWA support (T15)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Check for updates every hour while the app is open
        setInterval(() => {
          registration.update().catch(() => {
            /* noop */
          });
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        // SW registration is best-effort; app must work without it
      });
  });
}
