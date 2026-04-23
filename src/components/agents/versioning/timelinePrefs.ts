/**
 * timelinePrefs — persistência local (por agente) dos filtros da timeline.
 *
 * Guardamos apenas o que é "preferência de visão" e seguro de restaurar entre
 * sessões: preset, intervalo (range) e modo (detail/compare). NÃO persistimos
 * `sel`/`a`/`b` porque são IDs específicos de uma sessão e podem ficar inválidos
 * se a versão for deletada — quem precisa compartilhar isso usa o link da URL.
 *
 * Schema versionado em SCHEMA_VERSION para que mudanças futuras invalidem
 * graciosamente entradas antigas em vez de quebrar a tela.
 */

const SCHEMA_VERSION = 1;
const KEY_PREFIX = 'fx:timeline-prefs:v1:';

export interface TimelinePrefs {
  /** id do preset ativo (ex.: 'all', 'last-7d'). Default 'all'. */
  preset?: string;
  /** range serializado conforme TimelineRangeFilter.serializeRange(). */
  range?: string;
  /** modo de visualização padrão ao reabrir. */
  mode?: 'detail' | 'compare';
}

interface StoredEntry {
  v: number;
  prefs: TimelinePrefs;
  /** epoch ms — útil para debug/limpeza futura. */
  ts: number;
}

function keyFor(agentId: string): string {
  return `${KEY_PREFIX}${agentId}`;
}

/**
 * Lê as preferências salvas para um agente. Retorna null em qualquer falha
 * (storage indisponível em modo privado, JSON corrompido, schema antigo).
 */
export function loadTimelinePrefs(agentId: string): TimelinePrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEntry;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== SCHEMA_VERSION) return null;
    if (!parsed.prefs || typeof parsed.prefs !== 'object') return null;
    return parsed.prefs;
  } catch {
    return null;
  }
}

/**
 * Salva (merge) as preferências do agente. Se todas as chaves resultarem
 * vazias/default, remove a entrada para não acumular lixo.
 */
export function saveTimelinePrefs(agentId: string, prefs: TimelinePrefs): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadTimelinePrefs(agentId) ?? {};
    const next: TimelinePrefs = { ...current, ...prefs };
    // Normaliza: remove valores que equivalem ao default para manter o blob enxuto.
    if (!next.preset || next.preset === 'all') delete next.preset;
    if (!next.range) delete next.range;
    if (!next.mode || next.mode === 'detail') delete next.mode;
    if (Object.keys(next).length === 0) {
      window.localStorage.removeItem(keyFor(agentId));
      return;
    }
    const entry: StoredEntry = { v: SCHEMA_VERSION, prefs: next, ts: Date.now() };
    window.localStorage.setItem(keyFor(agentId), JSON.stringify(entry));
  } catch {
    // storage cheio / private mode — silencioso, persistência é opcional.
  }
}

/** Limpa as preferências salvas (ex.: botão "resetar visão"). */
export function clearTimelinePrefs(agentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(keyFor(agentId));
  } catch {
    // ignore
  }
}
