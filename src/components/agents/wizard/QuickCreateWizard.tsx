import { useEffect, useMemo, useState } from 'react';
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
import { DraftRecoveryBanner, type DraftSummary } from './DraftRecoveryBanner';

const STEPS = [
  { key: 'identity', label: 'Identidade', schema: quickIdentitySchema, fields: ['name', 'emoji', 'mission', 'description'] },
  { key: 'type', label: 'Tipo', schema: quickTypeSchema, fields: ['type'] },
  { key: 'model', label: 'Modelo', schema: quickModelSchema, fields: ['model'] },
  { key: 'prompt', label: 'Prompt', schema: quickPromptSchema, fields: ['prompt'] },
] as const;

const DRAFT_KEY = 'quick-agent-wizard-draft';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

interface DraftEnvelope {
  form: QuickAgentForm;
  savedAt: string;
}

function readDraftEnvelope(): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'form' in parsed && 'savedAt' in parsed) {
      const env = parsed as DraftEnvelope;
      return { form: { ...QUICK_AGENT_DEFAULTS, ...env.form }, savedAt: env.savedAt };
    }
    return { form: { ...QUICK_AGENT_DEFAULTS, ...parsed }, savedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

function summarize(form: QuickAgentForm): DraftSummary {
  return {
    name: form.name,
    hasIdentity:
      form.name.trim().length > 0 ||
      form.mission.trim().length > 0 ||
      (form.description ?? '').trim().length > 0,
    hasType: quickTypeSchema.safeParse(form).success,
    hasModel: quickModelSchema.safeParse(form).success,
    hasPrompt: form.prompt.trim().length >= 10,
  };
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
  const [pendingDraft, setPendingDraft] = useState<DraftEnvelope | null>(null);
  const [draftDecided, setDraftDecided] = useState(false);

  // On mount: check for a meaningful, non-expired draft and offer recovery.
  useEffect(() => {
    const env = readDraftEnvelope();
    if (!env) { setDraftDecided(true); return; }
    const ageMs = Date.now() - new Date(env.savedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > DRAFT_TTL_MS || !isDraftMeaningful(env.form)) {
      try { localStorage.removeItem(DRAFT_KEY); } catch {/* ignore */}
      setDraftDecided(true);
      return;
    }
    setPendingDraft(env);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft only after the user decided what to do with any prior draft.
  useEffect(() => {
    if (!draftDecided) return;
    try {
      const envelope: DraftEnvelope = { form, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope));
    } catch {/* ignore */}
  }, [form, draftDecided]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setForm(pendingDraft.form);
    const resumeIdx = STEPS.findIndex((s) => !s.schema.safeParse(pendingDraft.form).success);
    const target = resumeIdx === -1 ? STEPS.length - 1 : resumeIdx;
    setStep(target);
    setPendingDraft(null);
    setDraftDecided(true);
    toast.success('Rascunho restaurado', {
      description: `Continuando do passo: ${STEPS[target].label}`,
    });
  };

  const discardDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {/* ignore */}
    setPendingDraft(null);
    setDraftDecided(true);
    toast('Rascunho descartado');
  };

  const update = <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
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
    // Validate all
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
    try { localStorage.removeItem(DRAFT_KEY); } catch {/* ignore */}
    toast.success('Agente criado com sucesso!', { description: `${form.name} foi salvo como rascunho.` });
    navigate('/agents');
  };

  const isLast = step === STEPS.length - 1;

  // Keyboard shortcuts
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
    switch (step) {
      case 0: return <StepQuickIdentity form={form} errors={errors} update={update} />;
      case 1: return <StepQuickType form={form} errors={errors} update={update} applyTemplate={applyTemplate} />;
      case 2: return <StepQuickModel form={form} errors={errors} update={update} />;
      case 3: return <StepQuickPrompt form={form} errors={errors} update={update} onRestore={restorePromptFromType} onApplyVariant={applyPromptVariant} />;
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form, errors]);

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">
      {pendingDraft && (
        <DraftRecoveryBanner
          savedAt={pendingDraft.savedAt}
          summary={summarize(pendingDraft.form)}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
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
