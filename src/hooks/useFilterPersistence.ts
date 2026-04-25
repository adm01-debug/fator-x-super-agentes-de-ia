/**
 * useFilterPersistence — hydrates filter state from Cloud (with localStorage fallback)
 * and persists changes (debounced 800ms) to both.
 *
 * Cross-tab sync: uses BroadcastChannel (with `storage` event fallback) so that any
 * setFilters / clearAll / restore in one tab updates every other tab/instance with
 * the same scope. The instance that emitted the change ignores its own echo via a
 * unique instanceId stamp on each message.
 *
 * Returns { filters, setFilters, isLoading, syncStatus, clearAll, restore }.
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

type BroadcastMsg<T> =
  | { type: 'set'; scope: FilterScope; instanceId: string; filters: T }
  | { type: 'clear'; scope: FilterScope; instanceId: string };

const CHANNEL_PREFIX = 'nexus.filters.';

export function useFilterPersistence<T extends Record<string, unknown>>({
  scope, defaults, storageKey,
}: Options<T>) {
  const [filters, setFiltersState] = useState<T>(defaults);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);
  const instanceId = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const channelRef = useRef<BroadcastChannel | null>(null);

  const readLocal = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
  }, [storageKey]);

  const writeLocal = useCallback((v: T) => {
    try { localStorage.setItem(storageKey, JSON.stringify(v)); } catch { /* ignore */ }
  }, [storageKey]);

  const removeLocal = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  /** Broadcast a message to other tabs/instances. Safe no-op if BC unavailable. */
  const broadcast = useCallback((msg: BroadcastMsg<T>) => {
    try { channelRef.current?.postMessage(msg); } catch { /* ignore */ }
  }, []);

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

  // Cross-tab sync: BroadcastChannel + storage event fallback.
  useEffect(() => {
    const channelName = `${CHANNEL_PREFIX}${scope}`;
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(channelName);
        channelRef.current = bc;
        bc.onmessage = (ev: MessageEvent<BroadcastMsg<T>>) => {
          const msg = ev.data;
          if (!msg || msg.scope !== scope) return;
          if (msg.instanceId === instanceId.current) return; // ignore self-echo
          if (msg.type === 'set') {
            setFiltersState({ ...defaults, ...msg.filters });
            setSyncStatus('synced');
          } else if (msg.type === 'clear') {
            setFiltersState(defaults);
            setSyncStatus('synced');
          }
        };
      } catch { /* fallback below */ }
    }

    // Storage event fallback (covers older browsers + cross-origin frames).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      if (e.newValue === null) {
        setFiltersState(defaults);
        setSyncStatus('synced');
        return;
      }
      try {
        const next = JSON.parse(e.newValue) as T;
        setFiltersState({ ...defaults, ...next });
        setSyncStatus('synced');
      } catch { /* ignore corrupted payload */ }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (bc) {
        try { bc.close(); } catch { /* ignore */ }
      }
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, storageKey]);

  const setFilters = useCallback((updater: T | ((prev: T) => T)) => {
    setFiltersState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      // Persist (debounced) — but only after initial hydration to avoid overwriting Cloud with defaults.
      if (hydrated.current) {
        writeLocal(next);
        // Notify other tabs immediately (don't wait for debounced Cloud save).
        broadcast({ type: 'set', scope, instanceId: instanceId.current, filters: next });
        setSyncStatus('saving');
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          const ok = await saveUserFilters(scope, next);
          setSyncStatus(ok ? 'synced' : 'local');
        }, 800);
      }
      return next;
    });
  }, [scope, writeLocal, broadcast]);

  const clearAll = useCallback(async () => {
    removeLocal();
    setFiltersState(defaults);
    broadcast({ type: 'clear', scope, instanceId: instanceId.current });
    setSyncStatus('saving');
    const ok = await deleteUserFilters(scope);
    setSyncStatus(ok ? 'synced' : 'local');
  }, [scope, removeLocal, defaults, broadcast]);

  /** Force-restore (e.g. undo) — writes immediately, bypassing debounce. */
  const restore = useCallback(async (snapshot: T) => {
    setFiltersState(snapshot);
    writeLocal(snapshot);
    broadcast({ type: 'set', scope, instanceId: instanceId.current, filters: snapshot });
    setSyncStatus('saving');
    const ok = await saveUserFilters(scope, snapshot);
    setSyncStatus(ok ? 'synced' : 'local');
  }, [scope, writeLocal, broadcast]);

  return { filters, setFilters, isLoading, syncStatus, clearAll, restore };
}
