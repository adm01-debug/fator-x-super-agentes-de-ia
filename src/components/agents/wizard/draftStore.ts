import {
  QUICK_AGENT_DEFAULTS,
  quickTypeSchema,
  type QuickAgentForm,
} from '@/lib/validations/quickAgentSchema';
import type { DraftSummary } from './DraftRecoveryBanner';

export const DRAFTS_KEY = 'quick-agent-wizard-drafts';
export const LEGACY_DRAFT_KEY = 'quick-agent-wizard-draft';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
export const MAX_DRAFTS = 5;

export interface DraftEntry {
  id: string;
  form: QuickAgentForm;
  savedAt: string;   // ISO
  createdAt: string; // ISO
}

export interface DraftsStoreV2 {
  version: 2;
  activeId: string | null;
  drafts: DraftEntry[];
}

function emptyStore(): DraftsStoreV2 {
  return { version: 2, activeId: null, drafts: [] };
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {/* ignore */}
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeForm(form: Partial<QuickAgentForm> | undefined): QuickAgentForm {
  return { ...QUICK_AGENT_DEFAULTS, ...(form ?? {}) };
}

/** Load drafts collection. Migrates legacy single-draft envelope (v1) on the fly. */
export function loadDrafts(): DraftsStoreV2 {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && Array.isArray(parsed.drafts)) {
        return {
          version: 2,
          activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
          drafts: parsed.drafts.map((d: any) => ({
            id: typeof d.id === 'string' ? d.id : genId(),
            form: normalizeForm(d.form),
            savedAt: typeof d.savedAt === 'string' ? d.savedAt : new Date().toISOString(),
            createdAt: typeof d.createdAt === 'string' ? d.createdAt : (d.savedAt ?? new Date().toISOString()),
          })),
        };
      }
    }
  } catch {/* ignore */}

  // Migrate legacy v1
  try {
    const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const form = normalizeForm(parsed?.form ?? parsed);
      const savedAt = typeof parsed?.savedAt === 'string' ? parsed.savedAt : new Date().toISOString();
      const id = genId();
      const store: DraftsStoreV2 = {
        version: 2,
        activeId: id,
        drafts: [{ id, form, savedAt, createdAt: savedAt }],
      };
      saveDrafts(store);
      try { localStorage.removeItem(LEGACY_DRAFT_KEY); } catch {/* ignore */}
      return store;
    }
  } catch {/* ignore */}

  return emptyStore();
}

export function saveDrafts(store: DraftsStoreV2): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  } catch {/* ignore */}
}

/** Insert or update a draft. Enforces MAX_DRAFTS via LRU on savedAt. */
export function upsertDraft(
  store: DraftsStoreV2,
  draft: { id?: string; form: QuickAgentForm },
): { store: DraftsStoreV2; id: string } {
  const now = new Date().toISOString();
  const id = draft.id ?? genId();
  const existing = store.drafts.find((d) => d.id === id);
  let drafts: DraftEntry[];
  if (existing) {
    drafts = store.drafts.map((d) =>
      d.id === id ? { ...d, form: draft.form, savedAt: now } : d,
    );
  } else {
    const entry: DraftEntry = { id, form: draft.form, savedAt: now, createdAt: now };
    drafts = [entry, ...store.drafts];
  }
  // LRU prune
  if (drafts.length > MAX_DRAFTS) {
    drafts = [...drafts]
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      .slice(0, MAX_DRAFTS);
  }
  return { store: { ...store, drafts, activeId: id }, id };
}

export function removeDraft(store: DraftsStoreV2, id: string): DraftsStoreV2 {
  const drafts = store.drafts.filter((d) => d.id !== id);
  const activeId = store.activeId === id ? null : store.activeId;
  return { ...store, drafts, activeId };
}

export function clearDrafts(): DraftsStoreV2 {
  const store = emptyStore();
  saveDrafts(store);
  try { localStorage.removeItem(LEGACY_DRAFT_KEY); } catch {/* ignore */}
  return store;
}

export function setActive(store: DraftsStoreV2, id: string | null): DraftsStoreV2 {
  return { ...store, activeId: id };
}

export function summarizeForm(form: QuickAgentForm): DraftSummary {
  return {
    name: form.name,
    hasIdentity:
      form.name.trim().length > 0 ||
      form.mission.trim().length > 0 ||
      (form.description ?? '').trim().length > 0,
    hasType: quickTypeSchema.safeParse(form).success,
    hasModel: form.model.trim().length > 0,
    hasPrompt: form.prompt.trim().length >= 10,
  };
}
