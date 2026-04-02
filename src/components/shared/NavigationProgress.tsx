import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Lightweight CSS-only progress bar — no framer-motion overhead.
 */
export function NavigationProgress() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px]">
      <div
        className="h-full bg-primary rounded-r-full"
        style={{
          animation: "nav-progress 0.3s ease-out forwards",
        }}
      />
      <style>{`
        @keyframes nav-progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
