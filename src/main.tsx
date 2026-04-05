import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/web-vitals";

// ---------------------------------------------------------------------------
// Sentry Error Tracking
// ---------------------------------------------------------------------------
// To enable Sentry error tracking in production:
//
// 1. Install the SDK:
//      npm install @sentry/react
//
// 2. Create a Sentry project at https://sentry.io and obtain your DSN.
//
// 3. Add the DSN to your environment variables:
//      VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
//
// 4. Uncomment the block below:
//
// import * as Sentry from '@sentry/react';
// Sentry.init({
//   dsn: import.meta.env.VITE_SENTRY_DSN,
//   environment: import.meta.env.MODE,
//   tracesSampleRate: 0.1,
//   integrations: [Sentry.browserTracingIntegration()],
// });
//
// 5. (Optional) Wrap <App /> with Sentry.ErrorBoundary for React error capture:
//      <Sentry.ErrorBoundary fallback={<p>An error occurred</p>}>
//        <App />
//      </Sentry.ErrorBoundary>
// ---------------------------------------------------------------------------

createRoot(document.getElementById("root")!).render(<App />);

initWebVitals();
