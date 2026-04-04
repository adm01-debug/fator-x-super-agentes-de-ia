import { useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lightweight page transition using CSS transitions instead of framer-motion.
 * Eliminates the AnimatePresence "wait" mode that blocks rendering.
 */
export function DirectionalTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const goingDeeper = location.pathname.split("/").length > prevPath.current.split("/").length;
    prevPath.current = location.pathname;

    // Directional slide: deeper = slide from right, shallower = slide from left
    const startX = goingDeeper ? "8px" : "-8px";

    el.style.opacity = "0";
    el.style.transform = `translateX(${startX}) translateY(2px)`;
    el.style.transition = "none";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "opacity 0.2s cubic-bezier(0.22,1,0.36,1), transform 0.2s cubic-bezier(0.22,1,0.36,1)";
        el.style.opacity = "1";
        el.style.transform = "translateX(0) translateY(0)";
      });
    });

    // Restore focus for screen readers
    const main = document.getElementById("main-content");
    if (main) main.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div ref={containerRef} className="flex-1 will-change-transform">
      {children}
    </div>
  );
}
