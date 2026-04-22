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
  type QuickAgentForm,
} from '@/lib/validations/quickAgentSchema';
import {
  QUICK_AGENT_TEMPLATES,
  PERSONA_FROM_TYPE,
  type QuickAgentType,
} from '@/data/quickAgentTemplates';
import { StepQuickIdentity } from './quickSteps/StepQuickIdentity';
import { StepQuickType } from './quickSteps/StepQuickType';
import { StepQuickModel } from './quickSteps/StepQuickModel';
import { StepQuickPrompt } from './quickSteps/StepQuickPrompt';
import { DraftRecoveryBanner, type DraftBannerEntry } from './DraftRecoveryBanner';
import {
  loadDrafts,
  saveDrafts,
  upsertDraft,
  removeDraft,
  setActive,
  summarizeForm,
  checkDraftRestorable,
  computeResumeTarget,
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
  const lastTypeRef = useRef<QuickAgentType | null>(null);

  // Auto-clear field highlight after 4s
  useEffect(() => {
    if (!highlightField) return;
    const t = window.setTimeout(() => setHighlightField(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlightField]);

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
      const { store } = upsertDraft(prev, { id: prev.activeId ?? undefined, form });
      saveDrafts(store);
      return store;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, draftDecided]);

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

  const restoreDraft = (id: string) => {
    const target = pendingDrafts.find((d) => d.id === id);
    if (!target) return;
    const check = checkDraftRestorable(target.form);
    if (!check.canRestore) {
      toast.warning(check.reason ?? 'Rascunho incompleto demais para retomar', {
        description: `Próximo passo necessário: ${check.nextStep ?? 'Identidade'}. Continue daqui ou descarte.`,
      });
      return;
    }
    setForm(target.form);
    lastTypeRef.current = target.form.type as QuickAgentType;
    const resume = computeResumeTarget(target.form, STEPS);
    setStep(resume.stepIdx);
    setHighlightField(resume.field ?? null);
    setDraftsStore((prev) => {
      const next = setActive(prev, id);
      saveDrafts(next);
      return next;
    });
    setPendingDrafts([]);
    setDraftDecided(true);
    toast.success('Rascunho restaurado', {
      description: resume.field
        ? `Continue em "${STEPS[resume.stepIdx].label}" — campo: ${FIELD_LABEL[resume.field] ?? String(resume.field)}`
        : `Continuando do passo: ${STEPS[resume.stepIdx].label}`,
    });
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
    toast.success(`Template "${t.suggestedName}" aplicado`, {
      description: 'Nome, missão, modelo e prompt foram preenchidos.',
    });
    setErrors({});
  };

  const restorePromptFromType = () => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    update('prompt', t.systemPrompt);
    toast.success('Prompt restaurado do template');
  };

  const applyPromptVariant = (variantId: import('@/data/quickAgentTemplates').PromptVariantId) => {
    const t = QUICK_AGENT_TEMPLATES[form.type as QuickAgentType];
    const variant = t.promptVariants[variantId];
    update('prompt', variant.prompt);
    toast.success(`Variação "${variant.label}" aplicada`, {
      description: 'Você pode editar livremente depois.',
    });
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

  const saveAgent = async () => {
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
    setSaving(true);
    const { error } = await supabaseExternal.from('agents').insert({
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
      },
    });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar agente', { description: error.message });
      return;
    }
    // Remove only the active draft (preserve other parallel drafts)
    if (draftsStore.activeId) {
      setDraftsStore((prev) => {
        const next = removeDraft(prev, prev.activeId!);
        saveDrafts(next);
        return next;
      });
    }
    toast.success('Agente criado com sucesso!', { description: `${form.name} foi salvo como rascunho.` });
    navigate('/agents');
  };

  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (e.key === 'Escape' && !isTyping) { e.preventDefault(); goPrev(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && isLast) { e.preventDefault(); void saveAgent(); }
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
      case 3: return <StepQuickPrompt form={form} errors={errors} update={update} onRestore={restorePromptFromType} onApplyVariant={applyPromptVariant} highlightField={hfFor(['prompt'])} />;
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, errors, highlightField]);

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
          <Button onClick={saveAgent} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {saving ? 'Criando…' : 'Criar agente'}
          </Button>
        )}
      </div>
    </div>
  );
}
