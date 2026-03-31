import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from "framer-motion";

interface SwipeNavigationProps {
  children: ReactNode;
}

const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 300;

/**
 * Wraps content with swipe-left/right navigation for mobile.
 * Swipe right = go back, swipe left = no-op (or future: go forward).
 */
export function SwipeNavigation({ children }: SwipeNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const x = useMotionValue(0);
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Visual hint opacity for back gesture
  const hintOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 0.6]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;

    // Swipe right to go back
    if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate("/");
      }
    }

    // Reset position
    controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } });
  };

  // Reset on route change
  useEffect(() => {
    controls.start({ x: 0 });
  }, [location.pathname, controls]);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Back hint indicator */}
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-10 z-10 flex items-center justify-center pointer-events-none"
        style={{ opacity: hintOpacity }}
      >
        <div className="h-8 w-1 rounded-full bg-primary/60" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="touch-pan-y"
        dragDirectionLock
      >
        {children}
      </motion.div>
    </div>
  );
}
