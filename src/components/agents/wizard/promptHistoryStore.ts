/**
 * Prompt-only autosave history.
 * Independent from the full draft store — keeps timestamped snapshots of just
 * the `prompt` field so the user can recover from accidental edits/wipes,
 * even across different drafts/types.
 */

export const PROMPT_HISTORY_KEY = 'quick-agent-wizard-prompt-history.v1';
export const PROMPT_HISTORY_MAX = 20;
export const PROMPT_HISTORY_MIN_LEN = 20; // ignore micro-edits
export const PROMPT_HISTORY_MIN_DELTA = 15; // chars changed vs latest snapshot
export const PROMPT_HISTORY_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias

export interface PromptSnapshot {
  id: string;
  prompt: string;
  savedAt: string; // ISO
  length: number;
  type?: string;
}

interface PromptHistoryStore {
  version: 1;
  snapshots: PromptSnapshot[];
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {/* ignore */}
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPromptHistory(): PromptSnapshot[] {
  try {
    const raw = localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PromptHistoryStore;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.snapshots)) return [];
    const now = Date.now();
    const fresh = parsed.snapshots.filter((s) => {
      if (!s || typeof s.prompt !== 'string' || typeof s.savedAt !== 'string') return false;
      const age = now - new Date(s.savedAt).getTime();
      return Number.isFinite(age) && age <= PROMPT_HISTORY_TTL_MS;
    });
    return fresh.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

function persist(snapshots: PromptSnapshot[]): void {
  try {
    const store: PromptHistoryStore = { version: 1, snapshots };
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(store));
  } catch {/* ignore */}
}

/**
 * Adds a snapshot if it's meaningfully different from the latest one.
 * Returns the (possibly unchanged) snapshot list.
 */
export function pushPromptSnapshot(
  current: PromptSnapshot[],
  prompt: string,
  type?: string,
): { snapshots: PromptSnapshot[]; added: boolean } {
  const trimmed = prompt.trim();
  if (trimmed.length < PROMPT_HISTORY_MIN_LEN) {
    return { snapshots: current, added: false };
  }
  const latest = current[0];
  if (latest) {
    if (latest.prompt === prompt) return { snapshots: current, added: false };
    const delta = Math.abs(latest.prompt.length - prompt.length);
    // If lengths differ slightly AND content is mostly the same, skip
    if (delta < PROMPT_HISTORY_MIN_DELTA && latest.prompt.slice(0, 200) === prompt.slice(0, 200)) {
      return { snapshots: current, added: false };
    }
  }
  const snap: PromptSnapshot = {
    id: genId(),
    prompt,
    savedAt: new Date().toISOString(),
    length: prompt.length,
    type,
  };
  const next = [snap, ...current].slice(0, PROMPT_HISTORY_MAX);
  persist(next);
  return { snapshots: next, added: true };
}

export function deletePromptSnapshot(current: PromptSnapshot[], id: string): PromptSnapshot[] {
  const next = current.filter((s) => s.id !== id);
  persist(next);
  return next;
}

export function clearPromptHistory(): PromptSnapshot[] {
  persist([]);
  return [];
}
