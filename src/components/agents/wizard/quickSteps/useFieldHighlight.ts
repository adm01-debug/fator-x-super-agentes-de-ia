import { useEffect, useRef, useState, type RefObject } from 'react';
import { expandAncestorContainers } from './expandAncestorContainers';

/**
 * Coordinated scroll + focus + visual pulse for a "first invalid field" target.
 *
 * Behavior when `active` flips to true:
 *  1. Smoothly scrolls the target ref into the viewport center.
 *  2. After the scroll settles (~250ms), focuses the target (or its first
 *     focusable descendant when it isn't focusable itself).
 *  3. Returns a `pulsing` boolean that callers gate on to apply a temporary
 *     ring/animate-pulse class. Auto-clears after `pulseMs` (default 3000ms).
 *
 * Caller is responsible for rendering the ring class — this hook stays
 * styling-agnostic so each step can match its own visual idiom.
 */
export function useFieldHighlight(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  pulseMs = 3000,
) {
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setPulsing(true);

    focusTimerRef.current = window.setTimeout(() => {
      // Prefer focusing the element itself if it's focusable (input, textarea,
      // button); otherwise locate the first focusable descendant.
      const focusable =
        el.matches('input, textarea, select, button, [tabindex]')
          ? (el as HTMLElement)
          : el.querySelector<HTMLElement>(
              'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
            );
      focusable?.focus({ preventScroll: true });
    }, 250);

    pulseTimerRef.current = window.setTimeout(() => setPulsing(false), pulseMs);

    return () => {
      if (focusTimerRef.current != null) window.clearTimeout(focusTimerRef.current);
      if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
    };
  }, [active, pulseMs, ref]);

  return pulsing;
}

/** Tailwind utility for the standard highlight ring used across wizard steps. */
export const FIELD_HIGHLIGHT_CLS =
  'ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse rounded-md transition-shadow';
