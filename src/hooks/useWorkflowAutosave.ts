/**
 * Nexus Agents Studio — Workflow Autosave (T17)
 * Generic debounced autosave hook. Decoupled from any store —
 * watches a value (e.g. nodes+edges combined hash) and fires
 * onSave callback after `delay` ms of inactivity.
 *
 * Usage:
 *   const { lastSavedAt, isSaving } = useWorkflowAutosave({
 *     watchValue: [nodes, edges],
 *     enabled: !!workflowId && isDirty,
 *     onSave: handleSave,
 *   });
 */
import { useEffect, useRef, useState } from 'react';

interface UseWorkflowAutosaveOptions {
  /** Values to watch — autosave fires when this changes */
  watchValue: unknown;
  /** The save function. Returns Promise<void>. */
  onSave: () => Promise<void> | void;
  /** Debounce delay in milliseconds. Default 3000. */
  delay?: number;
  /** Whether autosave is enabled. */
  enabled?: boolean;
}

export function useWorkflowAutosave({
  watchValue,
  onSave,
  delay = 3000,
  enabled = true,
}: UseWorkflowAutosaveOptions) {
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    // Skip the very first run — don't autosave on mount
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSave();
        setLastSavedAt(new Date().toISOString());
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [watchValue, enabled, delay, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { lastSavedAt, isSaving };
}
