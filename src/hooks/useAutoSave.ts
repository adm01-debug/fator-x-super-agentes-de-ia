import { useEffect, useRef } from 'react';

/**
 * Auto-save hook with debounce
 * Triggers save after `delay` ms of inactivity when data is dirty.
 */
export function useAutoSave(
  isDirty: boolean,
  save: () => Promise<void>,
  delay = 5000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    if (!isDirty) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        await save();
      } finally {
        isSavingRef.current = false;
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isDirty, save, delay]);
}
