/**
 * savedTestRunsStore — persiste Test Runs simulados por agente em localStorage.
 * Sem rede. Inclui subscribe simples para refletir mudanças na UI.
 */
import type { SimulationSummary } from './agentTestSimulationService';

export interface SavedTestRun {
  id: string;
  agentId: string;
  name: string;
  savedAt: string; // ISO
  prompt: string; // prompt customizado usado (vazio = amostra padrão)
  summary: SimulationSummary;
}

const KEY_PREFIX = 'nexus.savedTestRuns.v1.';
const MAX_PER_AGENT = 25;

function storageKey(agentId: string): string {
  return `${KEY_PREFIX}${agentId}`;
}

function safeParse(raw: string | null): SavedTestRun[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listSavedRuns(agentId: string): SavedTestRun[] {
  if (typeof window === 'undefined') return [];
  const runs = safeParse(window.localStorage.getItem(storageKey(agentId)));
  // Mais recente primeiro
  return [...runs].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function saveRun(input: {
  agentId: string;
  name: string;
  prompt: string;
  summary: SimulationSummary;
}): SavedTestRun {
  const run: SavedTestRun = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agentId: input.agentId,
    name: input.name.trim() || `Run ${new Date().toLocaleString('pt-BR')}`,
    savedAt: new Date().toISOString(),
    prompt: input.prompt,
    summary: input.summary,
  };
  const existing = listSavedRuns(input.agentId);
  const next = [run, ...existing].slice(0, MAX_PER_AGENT);
  window.localStorage.setItem(storageKey(input.agentId), JSON.stringify(next));
  emitChange(input.agentId);
  return run;
}

export function deleteRun(agentId: string, runId: string): void {
  const next = listSavedRuns(agentId).filter((r) => r.id !== runId);
  window.localStorage.setItem(storageKey(agentId), JSON.stringify(next));
  emitChange(agentId);
}

export function renameRun(agentId: string, runId: string, name: string): void {
  const next = listSavedRuns(agentId).map((r) =>
    r.id === runId ? { ...r, name: name.trim() || r.name } : r,
  );
  window.localStorage.setItem(storageKey(agentId), JSON.stringify(next));
  emitChange(agentId);
}

// ─── Pub/sub minimalista para reatividade entre componentes ──────────────
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function emitChange(agentId: string) {
  listeners.get(agentId)?.forEach((l) => l());
  listeners.get('*')?.forEach((l) => l());
}

export function subscribeSavedRuns(agentId: string, fn: Listener): () => void {
  if (!listeners.has(agentId)) listeners.set(agentId, new Set());
  listeners.get(agentId)!.add(fn);
  return () => {
    listeners.get(agentId)?.delete(fn);
  };
}
