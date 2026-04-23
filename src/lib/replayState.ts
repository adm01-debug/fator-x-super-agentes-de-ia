/**
 * replayState — persistência por execução do estado do ReplayDialog.
 *
 * Guarda passo atual, play/pause e velocidade indexados por `session_id`,
 * permitindo que o usuário reabra a mesma execução e retome do mesmo lugar.
 *
 * Storage: `localStorage` em uma única chave (`nexus.replay.state.v1`) com
 * um mapa { [sessionId]: ReplayState }. Mantemos no máximo `MAX_ENTRIES`
 * execuções, descartando as mais antigas (LRU por `updatedAt`) para evitar
 * crescimento ilimitado.
 */

const STORAGE_KEY = 'nexus.replay.state.v1';
const MAX_ENTRIES = 50;

export interface ReplayState {
  step: number;
  playing: boolean;
  speed: number;
  updatedAt: number;
}

type Store = Record<string, ReplayState>;

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota / privacy mode — ignora silenciosamente */
  }
}

export function loadReplayState(sessionId: string): ReplayState | null {
  if (!sessionId) return null;
  const store = readStore();
  return store[sessionId] ?? null;
}

export function saveReplayState(sessionId: string, state: Omit<ReplayState, 'updatedAt'>): void {
  if (!sessionId) return;
  const store = readStore();
  store[sessionId] = { ...state, updatedAt: Date.now() };

  // LRU: se passou do limite, remove os mais antigos.
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys
      .map((k) => [k, store[k].updatedAt] as const)
      .sort((a, b) => a[1] - b[1]);
    const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
    for (const [k] of toRemove) delete store[k];
  }

  writeStore(store);
}

export function clearReplayState(sessionId: string): void {
  if (!sessionId) return;
  const store = readStore();
  if (store[sessionId]) {
    delete store[sessionId];
    writeStore(store);
  }
}
