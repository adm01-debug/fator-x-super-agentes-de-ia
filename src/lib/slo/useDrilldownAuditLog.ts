/**
 * useDrilldownAuditLog — Tracks every meaningful change to the SLO drill-down
 * filters and toggles within the current browser session. Used to reproduce
 * the view a teammate is looking at when something is shared.
 *
 * Scope: sessionStorage only (per-tab) — no backend writes. The log is wiped
 * when the tab/session ends, matching the user's choice for "Local (sessão atual)".
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'nexus.slo.drilldown.audit';
const MAX_ENTRIES = 200;

export interface DrilldownAuditChange {
  /** Stable key identifying which control changed (e.g. 'windowHours'). */
  field: string;
  /** Human-readable field name shown in the timeline. */
  label: string;
  /** Stringified previous value (for display). */
  from: string;
  /** Stringified next value (for display). */
  to: string;
}

export interface DrilldownAuditEntry {
  id: string;
  /** ISO timestamp when the change was recorded. */
  ts: string;
  /** All field changes batched in the same render frame. */
  changes: DrilldownAuditChange[];
  /** URL snapshot at the time of the change so the view can be reopened. */
  url: string;
}

export interface DrilldownAuditState {
  windowHours: number;
  compareHours: number;
  windowName: string;
  selectedAgentId: string;
  includeToolFailures: boolean;
  compareToolModes: boolean;
  /** Comma-separated, sorted list of failure-mode keys for stable diffing. */
  failureModesKey: string;
}

type FieldFormatter = (value: DrilldownAuditState[keyof DrilldownAuditState]) => string;

// Field metadata: label + formatter for human-friendly diff display.
const FIELDS: Record<keyof DrilldownAuditState, { label: string; format: FieldFormatter }> = {
  windowHours: {
    label: 'Janela',
    format: (v) => {
      const n = Number(v);
      if (n >= 24 * 7) return `${Math.round(n / 24 / 7)}sem`;
      if (n >= 24) return `${Math.round(n / 24)}d`;
      return `${n}h`;
    },
  },
  compareHours: {
    label: 'Baseline',
    format: (v) => {
      const n = Number(v);
      if (n <= 0) return '— (desativado)';
      if (n >= 24 * 7) return `${Math.round(n / 24 / 7)}sem`;
      if (n >= 24) return `${Math.round(n / 24)}d`;
      return `${n}h`;
    },
  },
  windowName: {
    label: 'Nome',
    format: (v) => (v ? `"${v}"` : '— (vazio)'),
  },
  selectedAgentId: {
    label: 'Agente',
    format: (v) => (v ? String(v).slice(0, 8) + '…' : 'todos'),
  },
  includeToolFailures: {
    label: 'Tool failures',
    format: (v) => (v ? 'incluídos' : 'excluídos'),
  },
  compareToolModes: {
    label: 'Comparar tools',
    format: (v) => (v ? 'lado a lado' : 'desativado'),
  },
  failureModesKey: {
    label: 'Modos de falha',
    format: (v) => {
      const s = String(v ?? '');
      if (!s) return 'nenhum';
      const parts = s.split(',');
      return parts.length >= 4 ? 'todos' : parts.join(', ');
    },
  },
};

function readLog(): DrilldownAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLog(entries: DrilldownAuditEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota or privacy mode — fail silently; the in-memory state still works.
  }
}

/**
 * Diffs the previous state against the next, returning only the fields that
 * actually changed. Used to skip no-op re-renders.
 */
function diffState(prev: DrilldownAuditState, next: DrilldownAuditState): DrilldownAuditChange[] {
  const changes: DrilldownAuditChange[] = [];
  (Object.keys(FIELDS) as Array<keyof DrilldownAuditState>).forEach((key) => {
    if (prev[key] === next[key]) return;
    const meta = FIELDS[key];
    changes.push({
      field: key,
      label: meta.label,
      from: meta.format(prev[key]),
      to: meta.format(next[key]),
    });
  });
  return changes;
}

export function useDrilldownAuditLog(state: DrilldownAuditState) {
  const [entries, setEntries] = useState<DrilldownAuditEntry[]>(() => readLog());
  const prevStateRef = useRef<DrilldownAuditState | null>(null);

  useEffect(() => {
    // Skip the very first render — there's no "previous" yet, and we don't
    // want to log the initial hydration as a fake change event.
    if (prevStateRef.current === null) {
      prevStateRef.current = state;
      return;
    }
    const changes = diffState(prevStateRef.current, state);
    prevStateRef.current = state;
    if (changes.length === 0) return;

    const entry: DrilldownAuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      changes,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      writeLog(next);
      return next;
    });
  }, [state]);

  const clear = useCallback(() => {
    setEntries([]);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { entries, clear };
}
