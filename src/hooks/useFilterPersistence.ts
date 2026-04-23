/**
 * useFilterPersistence — hydrates filter state from Cloud (with localStorage fallback)
 * and persists changes (debounced 800ms) to both.
 *
 * Returns { filters, setFilters, isLoading, syncStatus, clearAll, hydrate }.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getUserFilters, saveUserFilters, deleteUserFilters, type FilterScope,
} from '@/services/userFilterPreferencesService';

export type SyncStatus = 'idle' | 'loading' | 'synced' | 'local' | 'saving';

interface Options<T> {
  scope: FilterScope;
  defaults: T;
  storageKey: string;
}

export function useFilterPersistence<T extends Record<string, unknown>>({
  scope, defaults, storageKey,
}: Options<T>) {
  const [filters, setFiltersState] = useState<T>(defaults);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  const readLocal = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }, [storageKey]);

  const writeLocal = useCallback((v: T) => {
    try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* ignore */ }
  }, [storageKey]);

  // Hydrate on mount: Cloud first, fallback to localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const cloud = await getUserFilters<T>(scope);
      if (cancelled) return;
      if (cloud) {
        setFiltersState({ ...defaults, ...cloud });
        setSyncStatus('synced');
      } else {
        const local = readLocal();
        if (local) {
          setFiltersState({ ...defaults, ...local });
          setSyncStatus('local');
        } else {
          setSyncStatus('synced');
        }
      }
      hydrated.current = true;
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const setFilters = useCallback((updater: T | ((prev: T) => T)) => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      // Persist (debounced) — but only after initial hydration to avoid overwriting Cloud with defaults.
      if (hydrated.current) {
        writeLocal(next);
        setSyncStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          const ok = await saveUserFilters(scope, next);
          setSyncStatus(ok ? 'synced' : 'local');
        }, 800);
      }
      return next;
    });
  }, [scope, writeLocal]);

  const clearAll = useCallback(async () => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setFiltersState(defaults);
    setSyncStatus('saving');
    const ok = await deleteUserFilters(scope);
    setSyncStatus(ok ? 'synced' : 'local');
  }, [scope, storageKey, defaults]);

  /** Force-restore (e.g. undo) — writes immediately, bypassing debounce. */
  const restore = useCallback(async (snapshot: T) => {
    setFiltersState(snapshot);
    writeLocal(snapshot);
    setSyncStatus('saving');
    const ok = await saveUserFilters(scope, snapshot);
    setSyncStatus(ok ? 'synced' : 'local');
  }, [scope, writeLocal]);

  return { filters, setFilters, isLoading, syncStatus, clearAll, restore };
}
