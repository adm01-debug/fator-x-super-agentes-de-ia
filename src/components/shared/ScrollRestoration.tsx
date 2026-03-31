import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top on route change and manages focus for accessibility.
 */
export function ScrollRestoration() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll main content area to top
    const main = document.getElementById("main-content");
    if (main) {
      main.scrollTo({ top: 0, behavior: "instant" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname]);

  return null;
}
