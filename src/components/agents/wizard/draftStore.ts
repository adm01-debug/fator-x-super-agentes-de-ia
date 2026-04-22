import {
  QUICK_AGENT_DEFAULTS,
  quickIdentitySchema,
  quickTypeSchema,
  type QuickAgentForm,
} from '@/lib/validations/quickAgentSchema';
import type { PromptVariantId } from '@/data/quickAgentTemplates';
import type { DraftSummary } from './DraftRecoveryBanner';

const VALID_VARIANTS: ReadonlyArray<PromptVariantId> = ['balanced', 'concise', 'detailed'];
function normalizeVariant(v: unknown): PromptVariantId | null {
  return typeof v === 'string' && (VALID_VARIANTS as readonly string[]).includes(v)
    ? (v as PromptVariantId)
    : null;
}

export interface DraftRestoreCheck {
  canRestore: boolean;
  reason?: string;
  nextStep?: string;
}

/**
 * Validates whether a draft has the minimum viable content to be restored.
 * Requires at least the identity step (name + emoji + mission) to pass.
 */
export interface DraftResumeTarget {
  stepIdx: number;
  field?: keyof QuickAgentForm;
}

interface ResumeStepDef {
  key: string;
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } };
  fields: readonly string[];
}

/**
 * Computes which step to resume on AND which specific field within that step
 * is the first one failing validation. Falls back to first empty field by heuristic
 * when the schema error has no path (e.g. superRefine on prompt).
 */
export function computeResumeTarget(
  form: QuickAgentForm,
  steps: ReadonlyArray<ResumeStepDef>,
): DraftResumeTarget {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const r = s.schema.safeParse(form);
    if (r.success) continue;
    const path = r.error?.errors?.[0]?.path?.[0];
    let field = typeof path === 'string' ? (path as keyof QuickAgentForm) : undefined;
    if (!field) {
      // Fallback: first declared field that looks empty/short
      const empty = s.fields.find((fname) => {
        const v = form[fname as keyof QuickAgentForm];
        if (typeof v === 'string') return v.trim().length === 0;
        return v == null;
      });
      field = (empty ?? s.fields[0]) as keyof QuickAgentForm;
    }
    return { stepIdx: i, field };
  }
  return { stepIdx: steps.length - 1 };
}

export function checkDraftRestorable(form: QuickAgentForm): DraftRestoreCheck {
  const result = quickIdentitySchema.safeParse(form);
  if (result.success) return { canRestore: true };

  const first = result.error.errors[0];
  const field = String(first?.path?.[0] ?? '');
  const fieldLabel: Record<string, string> = {
    name: 'defina um nome para o agente',
    emoji: 'escolha um emoji',
    mission: 'escreva uma missão de pelo menos 10 caracteres',
    description: 'ajuste a descrição',
  };
  const reason = 'Rascunho incompleto demais para retomar';
  const hint = fieldLabel[field] ?? (first?.message ?? 'preencha a identidade básica');
  return {
    canRestore: false,
    reason,
    nextStep: `Identidade — ${hint}`,
  };
}

export const DRAFTS_KEY = 'quick-agent-wizard-drafts';
export const LEGACY_DRAFT_KEY = 'quick-agent-wizard-draft';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
export const MAX_DRAFTS = 5;

export interface DraftEntry {
  id: string;
  form: QuickAgentForm;
  savedAt: string;   // ISO
  createdAt: string; // ISO
  /** When true, the prompt was manually edited — variant chips should not auto-detect. */
  promptCustomLocked?: boolean;
  /**
   * The variant the user explicitly picked (Equilibrado / Conciso / Detalhado),
   * persisted so we can restore the active chip across sessions instead of
   * always falling back to the auto-detected first match.
   */
  selectedVariant?: PromptVariantId | null;
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
            promptCustomLocked: d.promptCustomLocked === true,
            selectedVariant: normalizeVariant(d.selectedVariant),
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

/** Renames the agent inside a specific draft. Pure function. */
export function renameDraft(
  store: DraftsStoreV2,
  id: string,
  newName: string,
): DraftsStoreV2 {
  const trimmed = newName.trim();
  const now = new Date().toISOString();
  return {
    ...store,
    drafts: store.drafts.map((d) =>
      d.id === id ? { ...d, form: { ...d.form, name: trimmed }, savedAt: now } : d,
    ),
  };
}
export function upsertDraft(
  store: DraftsStoreV2,
  draft: { id?: string; form: QuickAgentForm; promptCustomLocked?: boolean; selectedVariant?: PromptVariantId | null },
): { store: DraftsStoreV2; id: string } {
  const now = new Date().toISOString();
  const id = draft.id ?? genId();
  const existing = store.drafts.find((d) => d.id === id);
  let drafts: DraftEntry[];
  if (existing) {
    drafts = store.drafts.map((d) =>
      d.id === id
        ? {
            ...d,
            form: draft.form,
            savedAt: now,
            promptCustomLocked: draft.promptCustomLocked ?? d.promptCustomLocked ?? false,
            selectedVariant: draft.selectedVariant !== undefined ? draft.selectedVariant : d.selectedVariant ?? null,
          }
        : d,
    );
  } else {
    const entry: DraftEntry = {
      id,
      form: draft.form,
      savedAt: now,
      createdAt: now,
      promptCustomLocked: draft.promptCustomLocked ?? false,
      selectedVariant: draft.selectedVariant ?? null,
    };
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
