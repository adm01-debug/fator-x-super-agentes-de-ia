import { useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

// Map routes to indices for directional detection
const routeOrder = [
  "/", "/agents", "/knowledge", "/memory", "/tools", "/prompts",
  "/workflows", "/evaluations", "/deployments", "/monitoring",
  "/data-storage", "/security", "/team", "/billing", "/settings",
];

function getRouteIndex(pathname: string) {
  const exact = routeOrder.indexOf(pathname);
  if (exact !== -1) return exact;
  // Sub-routes inherit parent index
  for (let i = routeOrder.length - 1; i >= 0; i--) {
    if (pathname.startsWith(routeOrder[i] + "/") || pathname.startsWith(routeOrder[i])) {
      return i;
    }
  }
  return 0;
}

export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const prevIndex = useRef(getRouteIndex(location.pathname));
  const currentIndex = getRouteIndex(location.pathname);
  const direction = currentIndex >= prevIndex.current ? 1 : -1;

  useEffect(() => {
    prevIndex.current = currentIndex;
  }, [currentIndex]);

  return (
      <div
        key={location.pathname}
        className="flex-1"
      >
        {children}
      </div>
  );
}
