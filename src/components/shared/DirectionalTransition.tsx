import { useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

const routeOrder = [
  "/", "/agents", "/knowledge", "/memory", "/tools", "/prompts",
  "/workflows", "/evaluations", "/deployments", "/monitoring",
  "/data-storage", "/security", "/team", "/billing", "/settings",
];

function getRouteIndex(pathname: string) {
  const exact = routeOrder.indexOf(pathname);
  if (exact !== -1) return exact;
  for (let i = routeOrder.length - 1; i >= 0; i--) {
    if (pathname.startsWith(routeOrder[i] + "/") || pathname.startsWith(routeOrder[i])) {
      return i;
    }
  }
  return 0;
}

// Detect if navigating deeper (sub-route) vs lateral (sibling)
function getDepthChange(prev: string, next: string) {
  const prevDepth = prev.split("/").filter(Boolean).length;
  const nextDepth = next.split("/").filter(Boolean).length;
  return nextDepth - prevDepth;
}

export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const prevIndex = useRef(getRouteIndex(location.pathname));
  const currentIndex = getRouteIndex(location.pathname);
  const depthChange = getDepthChange(prevPath.current, location.pathname);

  // Determine animation direction based on depth or lateral movement
  let xOffset = 0;
  let yOffset = 0;

  if (depthChange > 0) {
    // Going deeper — slide from right
    xOffset = 30;
  } else if (depthChange < 0) {
    // Going back — slide from left
    xOffset = -30;
  } else {
    // Lateral navigation — directional based on route order
    const direction = currentIndex >= prevIndex.current ? 1 : -1;
    xOffset = direction * 30;
  }

  useEffect(() => {
    prevIndex.current = currentIndex;
    prevPath.current = location.pathname;
  }, [currentIndex, location.pathname]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: xOffset, y: yOffset }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: -xOffset, y: -yOffset }}
        transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex-1"
        // Restore focus to main content for screen readers
        onAnimationComplete={() => {
          const main = document.getElementById("main-content");
          if (main) main.focus({ preventScroll: true });
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
