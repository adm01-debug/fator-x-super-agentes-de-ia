/**
 * useChecklistAutoUnlock
 * Persisted user preference: when ON, edits made *through the prompt
 * checklist* (Inserir Persona/Escopo/Formato/Regras, "ir para seção" with
 * snippet, batch fill) should automatically release the Custom lock and
 * re-enable auto-detection of variations — instead of forcing the prompt
 * back into "customizado" like a manual edit does.
 *
 * Default OFF to preserve the current safer behavior; user must opt in.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wizard.checklistAutoUnlock';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useChecklistAutoUnlock() {
  const [enabled, setEnabledState] = useState<boolean>(() => read());

  // Cross-tab sync — if the user toggles the setting in another tab/wizard
  // instance, mirror it here so behavior stays consistent.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabledState(read());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    setEnabledState(next);
  }, []);

  return { enabled, setEnabled };
}
