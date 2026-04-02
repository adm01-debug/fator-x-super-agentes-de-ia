import { type ReactNode } from "react";

interface SwipeNavigationProps {
  children: ReactNode;
}

/**
 * Simplified wrapper — swipe navigation removed for performance.
 * The drag listeners on all page content caused jank on mobile.
 */
export function SwipeNavigation({ children }: SwipeNavigationProps) {
  return <>{children}</>;
}
