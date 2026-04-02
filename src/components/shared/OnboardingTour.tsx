import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, Bot, Sparkles, Keyboard, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOUR_KEY = "nexus-onboarding-done";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  action?: { label: string; path: string };
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Fator X! 🚀",
    description: "Sua plataforma completa para criar, configurar, avaliar e operar agentes de IA com governança. Vamos fazer um tour rápido!",
    icon: Rocket,
  },
  {
    title: "Crie seus Agentes",
    description: "Configure agentes com modelo de IA, prompt, ferramentas, memória e knowledge base — tudo em um wizard guiado.",
    icon: Bot,
    action: { label: "Criar agente", path: "/agents/new" },
  },
  {
    title: "Oráculo Multi-IA",
    description: "Consulte múltiplos modelos de IA simultaneamente e obtenha consenso para respostas mais confiáveis.",
    icon: Sparkles,
    action: { label: "Abrir Oráculo", path: "/oracle" },
  },
  {
    title: "Atalhos de Teclado",
    description: "Use ⌘K para busca rápida, G para Dashboard, A para Agentes, e ? para ver todos os atalhos.",
    icon: Keyboard,
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
        // Small delay so the page loads first
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

  const handleAction = (path: string) => {
    dismiss();
    navigate(path);
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={dismiss}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Tour de boas-vindas"
        >
          {/* Progress bar */}
          <div className="h-1 bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-r-full"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%`, transition: 'width 0.3s ease' }}
            />
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <button
                onClick={dismiss}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Fechar tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-lg font-heading font-bold text-foreground mb-2">{current.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-secondary"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
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
