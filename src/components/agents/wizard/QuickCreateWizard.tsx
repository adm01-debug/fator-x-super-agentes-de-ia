import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  quickIdentitySchema,
  quickTypeSchema,
  quickModelSchema,
  quickPromptSchema,
  QUICK_AGENT_DEFAULTS,
  isDraftMeaningful,
  getMissingSections,
  getThinSections,
  REQUIRED_PROMPT_SECTIONS,
  type QuickAgentForm,
} from '@/lib/validations/quickAgentSchema';
import { detectPromptContradictions } from '@/lib/validations/promptContradictions';
import { sanitizePromptInput, PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';
import {
  QUICK_AGENT_TEMPLATES,
  PERSONA_FROM_TYPE,
  detectPromptVariant,
  type QuickAgentType,
} from '@/data/quickAgentTemplates';
import { StepQuickIdentity } from './quickSteps/StepQuickIdentity';
import { StepQuickType } from './quickSteps/StepQuickType';
import { StepQuickModel } from './quickSteps/StepQuickModel';
import { StepQuickPrompt } from './quickSteps/StepQuickPrompt';
import { PreflightReviewSummary } from './quickSteps/PreflightReviewSummary';
import { DraftRecoveryBanner, type DraftBannerEntry } from './DraftRecoveryBanner';
import { DangerousActionDialog } from '@/components/rbac/DangerousActionDialog';
import { AlertTriangle } from 'lucide-react';
import { logAudit } from '@/services/auditLogService';
import { useChecklistAutoUnlock } from '@/hooks/useChecklistAutoUnlock';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
// AlertDialog moved into PromptVariantDiffDialog
import { QUICK_AGENT_TEMPLATES as TEMPLATES_FOR_DIALOG, PROMPT_VARIANT_META as VARIANT_META_FOR_DIALOG } from '@/data/quickAgentTemplates';
import { PromptVariantDiffDialog } from './quickSteps/PromptVariantDiffDialog';
import {
  loadDrafts,
  saveDrafts,
  upsertDraft,
  removeDraft,
  setActive,
  summarizeForm,
  checkDraftRestorable,
  computeResumeTarget,
  renameDraft,
  DRAFT_TTL_MS,
  type DraftsStoreV2,
  type DraftEntry,
} from './draftStore';

const FIELD_LABEL: Partial<Record<keyof QuickAgentForm, string>> = {
  name: 'Nome',
  emoji: 'Emoji',
  mission: 'Missão',
  description: 'Descrição',
  type: 'Tipo',
  model: 'Modelo',
  prompt: 'Prompt',
};
const STEPS = [
  { key: 'identity', label: 'Identidade', schema: quickIdentitySchema, fields: ['name', 'emoji', 'mission', 'description'] },
  { key: 'type', label: 'Tipo', schema: quickTypeSchema, fields: ['type'] },
  { key: 'model', label: 'Modelo', schema: quickModelSchema, fields: ['model'] },
  { key: 'prompt', label: 'Prompt', schema: quickPromptSchema, fields: ['prompt'] },
] as const;

const TYPE_LABEL: Record<QuickAgentType, string> = {
  chatbot: 'Chatbot',
  copilot: 'Copiloto',
  analyst: 'Analista',
  sdr: 'SDR',
  support: 'Suporte',
  researcher: 'Pesquisa',
  orchestrator: 'Orquestrador',
};

// User-tunable minimum prompt depth before "Criar agente" unlocks.
// Persisted across sessions so the choice sticks per browser.
const PROMPT_DEPTH_OPTIONS = [5, 8, 12] as const;
type PromptDepth = typeof PROMPT_DEPTH_OPTIONS[number];
const PROMPT_DEPTH_KEY = 'nexus.quickWizard.minPromptDepth';
const DEFAULT_PROMPT_DEPTH: PromptDepth = 8;

function loadPromptDepth(): PromptDepth {
  try {
    const raw = localStorage.getItem(PROMPT_DEPTH_KEY);
    const n = raw ? Number(raw) : NaN;
    return (PROMPT_DEPTH_OPTIONS as readonly number[]).includes(n) ? (n as PromptDepth) : DEFAULT_PROMPT_DEPTH;
  } catch {
    return DEFAULT_PROMPT_DEPTH;
  }
}

function countPromptWords(text: string): number {
  // Strip code fences/markdown noise so the count reflects real prose, not
  // boilerplate the user pasted in.
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_~#>\-]/g, ' ');
  const matches = stripped.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

interface QuickCreateWizardProps {
  onBack: () => void;
}

export function QuickCreateWizard({ onBack }: QuickCreateWizardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof QuickAgentForm, string>>>({});

  const [form, setForm] = useState<QuickAgentForm>(QUICK_AGENT_DEFAULTS);
  const [draftsStore, setDraftsStore] = useState<DraftsStoreV2>({ version: 2, activeId: null, drafts: [] });
  const [pendingDrafts, setPendingDrafts] = useState<DraftEntry[]>([]);
  const [draftDecided, setDraftDecided] = useState(false);
  const [highlightField, setHighlightField] = useState<keyof QuickAgentForm | null>(null);
  // Resumo visual do erro pós-restauração — exibido junto do highlightField.
  // Nulo = nenhum feedback ativo. Auto-limpa quando o usuário corrige o campo.
  const [restoreFeedback, setRestoreFeedback] = useState<import('./RestoreFeedbackBanner').RestoreFeedbackInfo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promptCustomLocked, setPromptCustomLocked] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<import('@/data/quickAgentTemplates').PromptVariantId | null>(null);
  const [pendingVariant, setPendingVariant] = useState<import('@/data/quickAgentTemplates').PromptVariantId | null>(null);
  const [lockEvents, setLockEvents] = useState<import('./quickSteps/PromptLockEventLog').PromptLockEvent[]>([]);
  // Persisted user rule: when ON, edits coming from the section checklist
  // (Inserir Persona/Escopo/Formato/Regras) auto-unlock the Custom mode.
  const { enabled: checklistAutoUnlock, setEnabled: setChecklistAutoUnlock } = useChecklistAutoUnlock();
  const pushLockEvent = (
    kind: import('./quickSteps/PromptLockEventLog').PromptLockEventKind,
    detail?: string,
  ) => {
    setLockEvents((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: Date.now(),
        kind,
        detail,
      },
    ].slice(-30));
  };
  const lastTypeRef = useRef<QuickAgentType | null>(null);
  const lastTypeForLockRef = useRef<string>(QUICK_AGENT_DEFAULTS.type);

  const [minPromptDepth, setMinPromptDepth] = useState<PromptDepth>(() => loadPromptDepth());
  useEffect(() => {
    try { localStorage.setItem(PROMPT_DEPTH_KEY, String(minPromptDepth)); } catch { /* ignore quota */ }
  }, [minPromptDepth]);
  const promptWordCount = useMemo(() => countPromptWords(form.prompt), [form.prompt]);
  const meetsDepth = promptWordCount >= minPromptDepth;

  // Real-time per-section completeness — recomputed every keystroke so the
  // create button reflects the current state of Persona/Escopo/Formato/Regras
  // without waiting for a step submit.
  const sectionStatus = useMemo(() => {
    const missing = getMissingSections(form.prompt);
    const thin = getThinSections(form.prompt);
    const labelOf = (k: string) =>
      REQUIRED_PROMPT_SECTIONS.find((s) => s.key === k)?.label ?? k;
    return {
      missingKeys: missing,
      thinKeys: thin.map((t) => t.key),
      missingLabels: missing.map(labelOf),
      thinLabels: thin.map((t) => t.label),
      blocked: missing.length > 0 || thin.length > 0,
    };
  }, [form.prompt]);

  // Auto-clear field highlight after 4s
  useEffect(() => {
    if (!highlightField) return;
    const t = window.setTimeout(() => setHighlightField(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightField]);

  // Quando o campo destacado é resolvido (ou expira), o banner de feedback
  // de restauração também desaparece — mantém os dois sincronizados.
  useEffect(() => {
    if (!highlightField && restoreFeedback) setRestoreFeedback(null);
  }, [highlightField, restoreFeedback]);

  // On mount: load store, filter recoverable drafts.
  useEffect(() => {
    const store = loadDrafts();
    const now = Date.now();
    const recoverable = store.drafts
      .filter((d) => {
        const age = now - new Date(d.savedAt).getTime();
        return Number.isFinite(age) && age <= DRAFT_TTL_MS && isDraftMeaningful(d.form);
      })
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    // Drop expired/empty entries from the persisted store too
    const cleaned: DraftsStoreV2 = {
      ...store,
      drafts: recoverable,
      activeId: recoverable.find((d) => d.id === store.activeId)?.id ?? null,
    };
    saveDrafts(cleaned);
    setDraftsStore(cleaned);

    if (recoverable.length === 0) {
      setDraftDecided(true);
    } else {
      setPendingDrafts(recoverable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save current form into the active draft (after user resolved any pending recovery).
  useEffect(() => {
    if (!draftDecided) return;
    if (!isDraftMeaningful(form) && !draftsStore.activeId) return;
    setDraftsStore((prev) => {
      const { store } = upsertDraft(prev, { id: prev.activeId ?? undefined, form, promptCustomLocked, selectedVariant });
      saveDrafts(store);
      return store;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, draftDecided, promptCustomLocked, selectedVariant]);

  // Heuristic: when user changes the type after editing a meaningful draft,
  // offer to fork into a new draft (one per type).
  useEffect(() => {
    if (!draftDecided) return;
    const prevType = lastTypeRef.current;
    lastTypeRef.current = form.type as QuickAgentType;
    if (!prevType || prevType === form.type) return;
    if (!isDraftMeaningful(form)) return;
    const activeId = draftsStore.activeId;
    if (!activeId) return;

    toast('Tipo alterado para ' + TYPE_LABEL[form.type as QuickAgentType], {
      description: 'Quer manter o anterior e começar um novo rascunho?',
      action: {
        label: 'Salvar como novo',
        onClick: () => {
          setDraftsStore((prev) => {
            // Re-anchor active draft to the previous type by reverting its stored type
            const previous = prev.drafts.find((d) => d.id === activeId);
            const restoredPrev = previous
              ? { ...prev, drafts: prev.drafts.map((d) => d.id === activeId ? { ...d, form: { ...d.form, type: prevType } } : d) }
              : prev;
            // Create a fresh draft with the current form (new type)
            const { store } = upsertDraft({ ...restoredPrev, activeId: null }, { form });
            saveDrafts(store);
            toast.success('Novo rascunho criado', { description: `Anterior preservado como ${TYPE_LABEL[prevType]}.` });
            return store;
          });
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const restoreDraft = (id: string, mode: 'full' | 'partial' = 'full') => {
    const target = pendingDrafts.find((d) => d.id === id);
    if (!target) return;
    const check = checkDraftRestorable(target.form);
    // No modo "parcial" só aplicamos os campos efetivamente preenchidos —
    // o restante mantém o default do form (vazio), forçando o usuário a
    // completar conscientemente cada um. No modo "completo" restauramos
    // exatamente o estado salvo, incluindo campos vazios do rascunho.
    const summary = summarizeForm(target.form);
    const formToApply: typeof target.form = mode === 'partial'
      ? {
          ...form, // base = estado atual (defaults)
          ...(summary.hasIdentity ? {
            name: target.form.name,
            mission: target.form.mission,
            description: target.form.description,
          } : {}),
          ...(summary.hasType ? { type: target.form.type } : {}),
          ...(summary.hasModel ? { model: target.form.model } : {}),
          ...(summary.hasPrompt ? { prompt: target.form.prompt } : {}),
        }
      : target.form;

    setForm(formToApply);
    setPromptCustomLocked(target.promptCustomLocked === true && mode === 'full');
    setSelectedVariant(mode === 'full' ? (target.selectedVariant ?? null) : null);
    lastTypeForLockRef.current = formToApply.type;
    lastTypeRef.current = formToApply.type as QuickAgentType;
    const resume = computeResumeTarget(formToApply, STEPS);
    setStep(resume.stepIdx);
    setHighlightField(resume.field ?? null);
    // Resumo visual do erro junto do highlightField — mostrado no banner
    // logo abaixo do header até o usuário corrigir o campo ou dispensar.
    if (resume.field) {
      setRestoreFeedback({
        ...resume,
        stepLabel: resume.stepLabel ?? STEPS[resume.stepIdx]?.label,
        fieldLabel: FIELD_LABEL[resume.field] ?? String(resume.field),
        mode,
      });
    } else {
      setRestoreFeedback(null);
    }
    setDraftsStore((prev) => {
      const next = setActive(prev, id);
      saveDrafts(next);
      return next;
    });
    setPendingDrafts([]);
    setDraftDecided(true);
    if (target.promptCustomLocked === true && mode === 'full') {
      pushLockEvent('locked-manual-edit', `rascunho "${target.form.name?.trim() || 'sem nome'}" restaurado já travado`);
    } else {
      pushLockEvent('unlocked-draft-restore', `rascunho "${target.form.name?.trim() || 'sem nome'}" (${mode === 'partial' ? 'parcial' : 'completo'})`);
    }
    if (mode === 'partial') {
      toast.success('Rascunho restaurado parcialmente', {
        description: resume.field
          ? `Só os campos preenchidos foram aplicados. Continue em "${STEPS[resume.stepIdx].label}" — campo destacado: ${FIELD_LABEL[resume.field] ?? String(resume.field)}.`
          : `Só os campos preenchidos foram aplicados. Continue em "${STEPS[resume.stepIdx].label}".`,
      });
    } else if (!check.canRestore) {
      toast.warning('Rascunho restaurado (incompleto)', {
        description: resume.field
          ? `Complete o campo "${FIELD_LABEL[resume.field] ?? String(resume.field)}" em "${STEPS[resume.stepIdx].label}" para continuar.`
          : `Continue do passo: ${STEPS[resume.stepIdx].label}.`,
      });
    } else {
      toast.success('Rascunho restaurado', {
        description: resume.field
          ? `Continue em "${STEPS[resume.stepIdx].label}" — campo: ${FIELD_LABEL[resume.field] ?? String(resume.field)}`
          : `Continuando do passo: ${STEPS[resume.stepIdx].label}`,
      });
    }
  };

  const handleRenameDraft = (id: string, newName: string) => {
    const trimmed = newName.trim();
    setDraftsStore((prev) => {
      const next = renameDraft(prev, id, trimmed);
      saveDrafts(next);
      return next;
    });
    setPendingDrafts((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, form: { ...d.form, name: trimmed }, savedAt: new Date().toISOString() }
          : d,
      ),
    );
    toast.success('Nome do rascunho atualizado');
  };

  const discardOneDraft = (id: string) => {
    setDraftsStore((prev) => {
      const next = removeDraft(prev, id);
      saveDrafts(next);
      return next;
    });
    setPendingDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (next.length === 0) setDraftDecided(true);
      return next;
    });
    toast('Rascunho descartado');
  };

  const discardAllDrafts = () => {
    const empty: DraftsStoreV2 = { version: 2, activeId: null, drafts: [] };
    saveDrafts(empty);
    setDraftsStore(empty);
    setPendingDrafts([]);
    setDraftDecided(true);
    toast('Todos os rascunhos foram descartados');
  };

  const update = <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (highlightField === key) setHighlightField(null);
  };

  /**
   * Manual prompt edit — flips the custom lock so chips stop auto-detecting.
   * `source` distinguishes typing ('manual', default) from clipboard paste
   * ('paste') and from edits driven by the section checklist ('checklist').
   *
   * Behavior matrix:
   * - `manual` / `paste`: ALWAYS lock (paste is opaque user intent).
   * - `checklist`: if the user enabled "Destravar ao usar o checklist" via
   *   `useChecklistAutoUnlock`, the edit DOES NOT trigger a lock — and if the
   *   prompt was already locked, releases it and emits `unlocked-checklist`.
   *   Otherwise, behaves like a regular manual edit.
   */
  const updatePromptManual = (next: string, source: 'manual' | 'paste' | 'checklist' = 'manual') => {
    setForm((prev) => ({ ...prev, prompt: next }));
    setErrors((prev) => ({ ...prev, prompt: undefined }));
    if (highlightField === 'prompt') setHighlightField(null);

    if (source === 'checklist' && checklistAutoUnlock) {
      // Auto-unlock rule active — release the lock if held, do NOT re-lock.
      if (promptCustomLocked) {
        pushLockEvent('unlocked-checklist', 'edição via checklist (regra automática ligada)');
        setPromptCustomLocked(false);
        setSelectedVariant(null);
      }
      return;
    }

    if (!promptCustomLocked) {
      pushLockEvent(
        source === 'paste' ? 'locked-paste' : 'locked-manual-edit',
        source === 'paste' ? 'colagem no editor' : 'edição direta no editor',
      );
    }
    setPromptCustomLocked(true);
    setSelectedVariant(null);
  };

  // Reset lock + persisted variant when the user changes the agent type.
  useEffect(() => {
    if (lastTypeForLockRef.current !== form.type) {
      const prevType = lastTypeForLockRef.current;
      lastTypeForLockRef.current = form.type;
      if (promptCustomLocked) {
        pushLockEvent(
          'unlocked-type-change',
          `${TYPE_LABEL[prevType as QuickAgentType] ?? prevType} → ${TYPE_LABEL[form.type as QuickAgentType] ?? form.type}`,
        );
      }
      setPromptCustomLocked(false);
      setSelectedVariant(null);
    }
  }, [form.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyTemplate = (type: QuickAgentType) => {
    const t = QUICK_AGENT_TEMPLATES[type];
    setForm((prev) => ({
      ...prev,
      type,
      name: prev.name || t.suggestedName,
      emoji: t.emoji,
      mission: prev.mission || t.mission,
      description: prev.description || t.description,
      model: t.recommendedModel,
      prompt: t.systemPrompt,
    }));
    if (promptCustomLocked) {
      pushLockEvent('unlocked-template', `template "${t.suggestedName}"`);
    }
    setPromptCustomLocked(false);
    setSelectedVariant(null);
    toast.success(`Template "${t.suggestedName}" aplicado`, {
      description: 'Nome, missão, modelo e prompt foram preenchidos.',
    });
    setErrors({});
  };

  const restorePromptFromType = () => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    update('prompt', t.systemPrompt);
    if (promptCustomLocked) {
      pushLockEvent('unlocked-restore-template', `template do tipo ${TYPE_LABEL[form.type as QuickAgentType] ?? form.type}`);
    }
    setPromptCustomLocked(false);
    setSelectedVariant(null);
    toast.success('Prompt restaurado do template');
  };

  /**
   * Hard reset to a known-safe state: re-sanitizes the base template,
   * clears variant lock + selection, resets emoji to the type default,
   * and clears any field errors. Used as the wizard's "panic button"
   * when the prompt or live preview ends up in a confusing state.
   */
  const safeResetPromptAndPreview = () => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    const sanitized = sanitizePromptInput(t.systemPrompt, PROMPT_LIMITS.MAX_TOTAL).clean;
    setForm((prev) => ({
      ...prev,
      prompt: sanitized,
      emoji: t.emoji,
    }));
    if (promptCustomLocked) {
      pushLockEvent('unlocked-safe-reset', `tipo ${TYPE_LABEL[form.type as QuickAgentType] ?? form.type}`);
    }
    setPromptCustomLocked(false);
    setSelectedVariant(null);
    setErrors((prev) => ({ ...prev, prompt: undefined }));
    if (highlightField === 'prompt') setHighlightField(null);
    toast.success('Estado seguro restaurado', {
      description: 'Prompt e preview voltaram ao template base do tipo selecionado.',
    });
  };

  const doApplyPromptVariant = (variantId: import('@/data/quickAgentTemplates').PromptVariantId) => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    const variant = t.promptVariants[variantId];
    update('prompt', variant.prompt);
    if (promptCustomLocked) {
      pushLockEvent('unlocked-variant', `variação "${variant.label}"`);
    }
    setPromptCustomLocked(false);
    setSelectedVariant(variantId);
    toast.success(`Variação "${variant.label}" aplicada`, {
      description: 'Você pode editar livremente depois.',
    });
  };

  const applyPromptVariant = (variantId: import('@/data/quickAgentTemplates').PromptVariantId) => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    const nextPrompt = t.promptVariants[variantId].prompt;
    if (form.prompt.trim() === nextPrompt.trim()) {
      toast.info(`Já está usando "${t.promptVariants[variantId].label}"`);
      if (promptCustomLocked) {
        pushLockEvent('unlocked-variant', `variação "${t.promptVariants[variantId].label}" (sem alterações no texto)`);
      }
      setSelectedVariant(variantId);
      setPromptCustomLocked(false);
      return;
    }
    setPendingVariant(variantId);
  };

  const validateStep = (idx: number): boolean => {
    const def = STEPS[idx];
    const result = def.schema.safeParse(form);
    if (result.success) {
      setErrors((prev) => {
        const next = { ...prev };
        def.fields.forEach((f) => { delete next[f as keyof QuickAgentForm]; });
        return next;
      });
      return true;
    }
    const newErrors: Partial<Record<keyof QuickAgentForm, string>> = {};
    result.error.errors.forEach((e) => {
      const path = e.path[0] as keyof QuickAgentForm | undefined;
      if (path) newErrors[path] = e.message;
    });
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return false;
  };

  const goNext = () => {
    if (!validateStep(step)) {
      toast.error('Corrija os campos destacados antes de avançar');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const goPrev = () => {
    if (step === 0) onBack();
    else setStep(step - 1);
  };

  const goToStep = (idx: number) => {
    if (idx <= step) setStep(idx);
    else if (validateStep(step)) setStep(idx);
  };

  /** Validate everything; if OK, open the confirmation dialog. */
  const requestCreate = () => {
    if (!user) {
      toast.error('Faça login para criar agentes');
      navigate('/auth');
      return;
    }
    for (let i = 0; i < STEPS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        toast.error('Corrija os campos destacados');
        return;
      }
    }
    if (sectionStatus.blocked) {
      setStep(STEPS.length - 1);
      setHighlightField('prompt');
      const parts: string[] = [];
      if (sectionStatus.missingLabels.length)
        parts.push(`faltam ${sectionStatus.missingLabels.join(', ')}`);
      if (sectionStatus.thinLabels.length)
        parts.push(`muito curtas: ${sectionStatus.thinLabels.join(', ')}`);
      toast.error('Seções obrigatórias incompletas', {
        description: parts.join(' · '),
      });
      return;
    }
    if (!meetsDepth) {
      setStep(STEPS.length - 1);
      setHighlightField('prompt');
      toast.error('Prompt muito curto', {
        description: `Mínimo configurado: ${minPromptDepth} palavras (atual: ${promptWordCount}). Ajuste o nível em "Profundidade mínima" se quiser ser menos rigoroso.`,
      });
      return;
    }
    setConfirmOpen(true);
  };

  const saveAgent = async (override?: { reason: string; conflictCount: number }) => {
    setConfirmOpen(false);
    if (!user) {
      toast.error('Faça login para criar agentes');
      navigate('/auth');
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await supabaseExternal
      .from('agents')
      .insert({
        user_id: user.id,
        name: form.name.trim(),
        mission: form.mission.trim(),
        persona: PERSONA_FROM_TYPE[form.type as QuickAgentType],
        model: form.model,
        avatar_emoji: form.emoji,
        status: 'draft' as const,
        config: {
          type: form.type,
          system_prompt: form.prompt,
          description: form.description,
          created_via: 'quick_wizard',
          ...(override
            ? {
                created_with_conflicts: true,
                conflicts_override_reason: override.reason,
                conflicts_count_at_creation: override.conflictCount,
              }
            : {}),
        },
      })
      .select('id')
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar agente', { description: error.message });
      return;
    }
    // If the user opted to bypass contradiction warnings, log a high-signal
    // audit entry so admins can review the rationale later.
    if (override) {
      const insertedId = (inserted as { id?: string } | null)?.id;
      void logAudit({
        action: 'create',
        resource_type: 'agent',
        resource_id: insertedId,
        resource_name: form.name.trim(),
        reason: override.reason,
        status: 'success',
        metadata: {
          override: 'create_with_conflicts',
          conflicts_count: override.conflictCount,
          agent_type: form.type,
          model: form.model,
          created_via: 'quick_wizard',
        },
      });
    }
    // Remove only the active draft (preserve other parallel drafts)
    if (draftsStore.activeId) {
      setDraftsStore((prev) => {
        const next = removeDraft(prev, prev.activeId!);
        saveDrafts(next);
        return next;
      });
    }
    toast.success('Agente criado com sucesso!', {
      description: override
        ? `${form.name} foi salvo como rascunho com ${override.conflictCount} conflito(s) registrados.`
        : `${form.name} foi salvo como rascunho.`,
    });
    navigate('/agents');
  };

  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (e.key === 'Escape' && !isTyping) { e.preventDefault(); goPrev(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && isLast) { e.preventDefault(); requestCreate(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form]);

  const stepNode = useMemo(() => {
    const hf = highlightField;
    const hfFor = (fields: ReadonlyArray<keyof QuickAgentForm>) =>
      hf && fields.includes(hf) ? hf : undefined;
    switch (step) {
      case 0: return <StepQuickIdentity form={form} errors={errors} update={update} highlightField={hfFor(['name', 'emoji', 'mission', 'description'])} />;
      case 1: return <StepQuickType form={form} errors={errors} update={update} applyTemplate={applyTemplate} highlightField={hfFor(['type'])} />;
      case 2: return <StepQuickModel form={form} errors={errors} update={update} highlightField={hfFor(['model'])} />;
      case 3: {
        const detected = detectPromptVariant(form.type as QuickAgentType, form.prompt);
        const activeVariant = promptCustomLocked ? null : (selectedVariant ?? detected);
        return <StepQuickPrompt form={form} errors={errors} onPromptManualEdit={updatePromptManual} onRestore={restorePromptFromType} onSafeReset={safeResetPromptAndPreview} onApplyVariant={applyPromptVariant} customLocked={promptCustomLocked} onUnlockCustom={() => { if (promptCustomLocked) pushLockEvent('unlocked-manual', 'botão "Destravar" no editor'); setPromptCustomLocked(false); setSelectedVariant(null); }} activeVariant={activeVariant} lockEvents={lockEvents} highlightField={hfFor(['prompt'])} checklistAutoUnlock={checklistAutoUnlock} onToggleChecklistAutoUnlock={setChecklistAutoUnlock} />;
      }
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, errors, highlightField, promptCustomLocked, selectedVariant]);

  const bannerEntries: DraftBannerEntry[] = useMemo(
    () => pendingDrafts.map((d) => {
      const check = checkDraftRestorable(d.form);
      return {
        id: d.id,
        savedAt: d.savedAt,
        summary: summarizeForm(d.form),
        typeLabel: TYPE_LABEL[d.form.type as QuickAgentType] ?? String(d.form.type),
        restorable: check.canRestore,
        restoreBlockedReason: check.canRestore
          ? undefined
          : `${check.reason ?? 'Incompleto'} — ${check.nextStep ?? ''}`.trim(),
      };
    }),
    [pendingDrafts],
  );

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {bannerEntries.length > 0 && (
        <DraftRecoveryBanner
          drafts={bannerEntries}
          onRestore={restoreDraft}
          onDiscardOne={discardOneDraft}
          onDiscardAll={discardAllDrafts}
          onRename={handleRenameDraft}
        />
      )}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goPrev} className="text-muted-foreground" aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground">Criação rápida ⚡</h1>
          <p className="text-sm text-muted-foreground">Passo {step + 1} de {STEPS.length}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Etapas">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.key}
              onClick={() => goToStep(i)}
              role="tab"
              aria-selected={isActive}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : isDone
                  ? 'bg-secondary/60 text-foreground hover:bg-secondary'
                  : 'text-muted-foreground'
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  isDone
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-1" />}
            </button>
          );
        })}
      </div>

      <div key={step} className="animate-page-enter">{stepNode}</div>

      {/* Profundidade mínima do prompt — toggle persistente. Bloqueia "Criar
          agente" se o prompt atual não atingir o nível selecionado. */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">Profundidade mínima do prompt</span>
          <span className="text-[11px] text-muted-foreground">
            Atual: <span className={`font-mono tabular-nums ${meetsDepth ? 'text-nexus-emerald' : 'text-nexus-amber'}`}>{promptWordCount}</span> palavra{promptWordCount === 1 ? '' : 's'}
            {' · '}mínimo exigido: <span className="font-mono tabular-nums">{minPromptDepth}</span>
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Nível mínimo de profundidade do prompt"
          className="ml-auto inline-flex rounded-md border border-border/60 bg-background p-0.5"
        >
          {PROMPT_DEPTH_OPTIONS.map((opt) => {
            const active = minPromptDepth === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMinPromptDepth(opt)}
                title={
                  opt === 5 ? 'Permissivo — aceita prompts curtos'
                    : opt === 8 ? 'Equilibrado — recomendado'
                    : 'Rigoroso — exige descrição mais detalhada'
                }
                className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                {opt} palavras
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <Button variant="ghost" onClick={goPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="text-xs text-muted-foreground hidden sm:block">
          {step + 1} de {STEPS.length}
          {isLast && <span className="ml-2 opacity-60">(Ctrl+Enter para criar)</span>}
        </div>
        {!isLast ? (
          <Button onClick={goNext} className="gap-2">
            Próximo <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          (() => {
            const conflictCount = detectPromptContradictions(form.prompt).length;
            const conflictBlocked = conflictCount > 0;
            const depthBlocked = !meetsDepth;
            const sectionsBlocked = sectionStatus.blocked;
            const blocked = conflictBlocked || depthBlocked || sectionsBlocked;
            const sectionTitle = (() => {
              const parts: string[] = [];
              if (sectionStatus.missingLabels.length)
                parts.push(`faltam: ${sectionStatus.missingLabels.join(', ')}`);
              if (sectionStatus.thinLabels.length)
                parts.push(`muito curtas: ${sectionStatus.thinLabels.join(', ')}`);
              return `Complete as seções obrigatórias (${parts.join(' · ')}).`;
            })();
            const title = conflictBlocked
              ? `Resolva os ${conflictCount} conflito(s) entre regras antes de criar.`
              : sectionsBlocked
              ? sectionTitle
              : depthBlocked
              ? `Prompt com ${promptWordCount}/${minPromptDepth} palavras — adicione mais detalhes ou reduza o nível mínimo.`
              : undefined;
            const sectionShort =
              sectionStatus.missingKeys.length + sectionStatus.thinKeys.length;
            const label = saving
              ? 'Criando…'
              : conflictBlocked
              ? `Resolver ${conflictCount} conflito(s)`
              : sectionsBlocked
              ? `Completar ${sectionShort} seção(ões)`
              : depthBlocked
              ? `Faltam ${Math.max(minPromptDepth - promptWordCount, 0)} palavra(s)`
              : 'Criar agente';
            return (
              <div className="flex items-center gap-2">
                {conflictBlocked && !depthBlocked && !sectionsBlocked && (
                  <DangerousActionDialog
                    title="Criar mesmo com conflitos"
                    description={
                      <>
                        <p>
                          Detectamos <strong>{conflictCount} conflito(s)</strong> entre as regras do prompt.
                          Esta ação cria o agente sem resolvê-los — use apenas se a contradição é{' '}
                          <strong>intencional</strong> (ex.: política exige duas regras que se sobrepõem
                          contextualmente).
                        </p>
                        <p>
                          O motivo abaixo será registrado no <strong>log de auditoria</strong> junto com a
                          contagem de conflitos para revisão posterior.
                        </p>
                      </>
                    }
                    action="create"
                    resourceType="agent"
                    resourceName={form.name.trim() || 'agente sem nome'}
                    confirmLabel="Criar mesmo assim"
                    minReasonLength={20}
                    metadata={{ override: 'create_with_conflicts', conflicts_count: conflictCount }}
                    onConfirm={async ({ reason }) => {
                      await saveAgent({ reason, conflictCount });
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        className="gap-2 border-nexus-amber/50 text-nexus-amber hover:bg-nexus-amber/10 hover:text-nexus-amber"
                        title="Criar mesmo com os conflitos detectados — exige justificativa e fica no audit log"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Criar mesmo assim
                      </Button>
                    }
                  />
                )}
                <Button onClick={requestCreate} disabled={saving || blocked} className="gap-2" title={title}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {label}
                </Button>
              </div>
            );
          })()
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!saving) setConfirmOpen(o); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Criar {form.name.trim() ? `"${form.name.trim()}"` : 'agente'}?
            </DialogTitle>
            <DialogDescription>
              Revise o resumo abaixo. Após confirmar, o agente será salvo como rascunho na sua biblioteca.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
            <PreflightReviewSummary form={form} compact />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            {(() => {
              const conflictCount = detectPromptContradictions(form.prompt).length;
              const conflictBlocked = conflictCount > 0;
              const depthBlocked = !meetsDepth;
              const sectionsBlocked = sectionStatus.blocked;
              const blocked = conflictBlocked || depthBlocked || sectionsBlocked;
              const sectionTitle = (() => {
                const parts: string[] = [];
                if (sectionStatus.missingLabels.length)
                  parts.push(`faltam: ${sectionStatus.missingLabels.join(', ')}`);
                if (sectionStatus.thinLabels.length)
                  parts.push(`muito curtas: ${sectionStatus.thinLabels.join(', ')}`);
                return `Complete as seções obrigatórias (${parts.join(' · ')}).`;
              })();
              const title = conflictBlocked
                ? `Resolva os ${conflictCount} conflito(s) entre regras antes de criar.`
                : sectionsBlocked
                ? sectionTitle
                : depthBlocked
                ? `Prompt com ${promptWordCount}/${minPromptDepth} palavras — adicione mais detalhes ou reduza o nível mínimo.`
                : undefined;
              const sectionShort =
                sectionStatus.missingKeys.length + sectionStatus.thinKeys.length;
              const label = saving
                ? 'Criando…'
                : conflictBlocked
                ? `Resolver ${conflictCount} conflito(s)`
                : sectionsBlocked
                ? `Completar ${sectionShort} seção(ões)`
                : depthBlocked
                ? `Faltam ${Math.max(minPromptDepth - promptWordCount, 0)} palavra(s)`
                : 'Confirmar e criar';
              return (
                <Button onClick={() => saveAgent()} disabled={saving || blocked} className="gap-2" title={title}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {label}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pendingVariant && (() => {
        const t = TEMPLATES_FOR_DIALOG[form.type as QuickAgentType];
        const variant = t.promptVariants[pendingVariant];
        const nextLabel = VARIANT_META_FOR_DIALOG[pendingVariant].label;
        const currentLabel = promptCustomLocked
          ? 'Customizado'
          : selectedVariant
          ? VARIANT_META_FOR_DIALOG[selectedVariant].label
          : 'Atual';
        return (
          <PromptVariantDiffDialog
            open={!!pendingVariant}
            onOpenChange={(o) => !o && setPendingVariant(null)}
            currentPrompt={form.prompt}
            currentLabel={currentLabel}
            nextPrompt={variant.prompt}
            nextLabel={nextLabel}
            customLocked={promptCustomLocked}
            onConfirm={() => {
              if (pendingVariant) doApplyPromptVariant(pendingVariant);
              setPendingVariant(null);
            }}
          />
        );
      })()}
    </div>
  );
}
