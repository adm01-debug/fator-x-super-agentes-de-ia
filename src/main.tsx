import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";
import { initGlobalErrorHandlers } from "./lib/logger";

// Initialize global error handlers before rendering
initGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);

// Initialize Web Vitals monitoring
initWebVitals();
