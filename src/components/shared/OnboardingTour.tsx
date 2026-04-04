import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, Bot, Sparkles, Keyboard, Rocket, Brain, Shield, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "nexus-onboarding-v2";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  action?: { label: string; path: string };
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Fator X! 🚀",
    description: "Sua plataforma completa para criar, configurar, avaliar e operar agentes de IA com governança total.",
    icon: Rocket,
    tip: "Você pode reabrir este tour a qualquer momento em Settings.",
  },
  {
    title: "Crie seus Agentes",
    description: "Configure agentes com modelo de IA, persona, ferramentas, memória e knowledge base — tudo no Agent Builder guiado.",
    icon: Bot,
    action: { label: "Criar agente", path: "/agents/new" },
    tip: "Use ⌘K para buscar qualquer agente rapidamente.",
  },
  {
    title: "Super Cérebro",
    description: "Memória centralizada da empresa: consulte, extraia entidades, monitore saúde do conhecimento e descubra especialistas.",
    icon: Brain,
    action: { label: "Explorar", path: "/brain" },
  },
  {
    title: "Oráculo Multi-IA",
    description: "Consulte múltiplos modelos simultaneamente e obtenha consenso inteligente para respostas mais confiáveis.",
    icon: Sparkles,
    action: { label: "Abrir Oráculo", path: "/oracle" },
  },
  {
    title: "Workflows Visuais",
    description: "Monte pipelines multi-agente com drag & drop. Conecte agentes em cadeia para tarefas complexas.",
    icon: GitBranch,
    action: { label: "Ver Workflows", path: "/workflows" },
  },
  {
    title: "Segurança & Guardrails",
    description: "Configure políticas de conteúdo, limites de custo e aprovação humana (HITL) antes de publicar em produção.",
    icon: Shield,
    action: { label: "Configurar", path: "/security" },
  },
  {
    title: "Atalhos de Teclado",
    description: "Use ⌘K para busca, G para Dashboard, A para Agentes, Shift+N para novo agente, e ? para todos os atalhos.",
    icon: Keyboard,
    tip: "Essas dicas aparecem em cada página relevante!",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_KEY);
      if (!done) {
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(TOUR_KEY, "true"); } catch {}
  }, []);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleAction = (path: string) => {
    dismiss();
    navigate(path);
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Tour de boas-vindas"
        aria-describedby="tour-description"
      >
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full nexus-gradient-bg rounded-r-full"
            style={{ width: `${progress}%`, transition: 'width 0.3s ease' }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {step + 1}/{TOUR_STEPS.length}
              </span>
              <button
                onClick={dismiss}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Fechar tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <h3 className="text-lg font-heading font-bold text-foreground mb-2">{current.title}</h3>
          <p id="tour-description" className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

          {current.tip && (
            <p className="text-[11px] text-primary/70 mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
              {current.tip}
            </p>
          )}

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === step ? "h-2 w-6 bg-primary" : i < step ? "h-2 w-2 bg-primary/40" : "h-2 w-2 bg-secondary"
                  }`}
                  aria-label={`Ir para passo ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={prev}
                >
                  Anterior
                </Button>
              )}
              {current.action && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleAction(current.action!.path)}
                >
                  {current.action.label}
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5 text-xs nexus-gradient-bg text-primary-foreground hover:opacity-90"
                onClick={next}
              >
                {isLast ? "Começar!" : "Próximo"}
                {!isLast && <ArrowRight className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
