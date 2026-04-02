import { useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lightweight page transition using CSS transitions instead of framer-motion.
 * Eliminates the AnimatePresence "wait" mode that blocks rendering.
 */
export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Quick fade-in on route change
    el.style.opacity = "0";
    el.style.transform = "translateY(4px)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.1s ease-out, transform 0.1s ease-out";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    // Restore focus for screen readers
    const main = document.getElementById("main-content");
    if (main) main.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div ref={containerRef} className="flex-1">
      {children}
    </div>
  );
}
