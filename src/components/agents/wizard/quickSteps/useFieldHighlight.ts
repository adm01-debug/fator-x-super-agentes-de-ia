import { useEffect, useRef, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Coordinated scroll + focus + visual pulse for a "first invalid field" target.
 *
 * Behavior when `active` flips to true:
 *  1. Scrolls the target ref into view. Smooth by default; instant ('auto')
 *     when `prefers-reduced-motion: reduce` is on.
 *  2. After the scroll settles (~250ms, or 0ms in reduced motion), focuses
 *     the target (or its first focusable descendant when it isn't focusable
 *     itself).
 *  3. Returns a `pulsing` boolean that callers gate on to apply a temporary
 *     ring/animate-pulse class. Auto-clears after `pulseMs` (default 3000ms).
 *
 * Reduced-motion mode: the ring is still applied (so users can locate the
 * field) but without the `animate-pulse` keyframe — just a static colored
 * ring that auto-clears. Caller decides via `FIELD_HIGHLIGHT_CLS` vs
 * `FIELD_HIGHLIGHT_CLS_STATIC`.
 */
export function useFieldHighlight(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  pulseMs = 3000,
) {
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    el.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    setPulsing(true);

    // Focus delay matches the scroll animation; skip the wait when motion
    // is reduced so keyboard users land on the field immediately.
    const focusDelay = prefersReducedMotion ? 0 : 250;
    focusTimerRef.current = window.setTimeout(() => {
      const focusable =
        el.matches('input, textarea, select, button, [tabindex]')
          ? (el as HTMLElement)
          : el.querySelector<HTMLElement>(
              'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
            );
      focusable?.focus({ preventScroll: true });
    }, focusDelay);

    pulseTimerRef.current = window.setTimeout(() => setPulsing(false), pulseMs);

    return () => {
      if (focusTimerRef.current != null) window.clearTimeout(focusTimerRef.current);
      if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
    };
  }, [active, pulseMs, ref, prefersReducedMotion]);

  return pulsing;
}

/** Tailwind utility for the standard highlight ring used across wizard steps. */
export const FIELD_HIGHLIGHT_CLS =
  'ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse rounded-md transition-shadow';

/**
 * Reduced-motion variant: same ring/contrast for discoverability, but no
 * pulsing keyframe. Components that import `FIELD_HIGHLIGHT_CLS` directly
 * should switch to this when `usePrefersReducedMotion()` is true.
 */
export const FIELD_HIGHLIGHT_CLS_STATIC =
  'ring-2 ring-warning ring-offset-2 ring-offset-background rounded-md transition-shadow';

