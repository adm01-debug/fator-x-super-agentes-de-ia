import { useMemo } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Clock, Gauge, Wrench, Brain, Maximize2, Code2, Lock } from 'lucide-react';
import type { SimulatedRun, SimulatedErrorType } from '@/services/agentTestSimulationService';

interface Props {
  runs: SimulatedRun[];
}

const ERROR_META: Record<SimulatedErrorType, {
  label: string;
  icon: typeof Clock;
  description: string;
  guardrail: string;
}> = {
  timeout: {
    label: 'Timeout',
    icon: Clock,
    description: 'Resposta excedeu o tempo limite — modelo lento ou prompt longo demais.',
    guardrail: 'Defina max_response_time (ex.: 15s) e ative fallback automático para modelo mais rápido.',
  },
  rate_limit: {
    label: 'Rate limit',
    icon: Gauge,
    description: 'Provedor recusou por excesso de requisições no minuto.',
    guardrail: 'Habilite retry exponencial (3 tentativas) + circuit breaker por workspace.',
  },
  tool_failure: {
    label: 'Falha em ferramenta',
    icon: Wrench,
    description: 'Tool/function-call retornou erro ou payload inválido.',
    guardrail: 'Adicione validação Zod no output de cada tool e rota de fallback "graceful degradation".',
  },
  hallucination: {
    label: 'Alucinação',
    icon: Brain,
    description: 'Modelo gerou fato/citação não suportada pelo contexto.',
    guardrail: 'Force grounding via RAG obrigatório + judge LLM verificando citações antes de responder.',
  },
  context_overflow: {
    label: 'Estouro de contexto',
    icon: Maximize2,
    description: 'Prompt + histórico ultrapassou janela do modelo.',
    guardrail: 'Implemente truncamento inteligente (sliding window) e summarization automática a cada 10 turnos.',
  },
  parsing_error: {
    label: 'Erro de parsing',
    icon: Code2,
    description: 'Output não casou com schema JSON esperado.',
    guardrail: 'Use structured outputs (response_format json_schema) e valide com Zod no client.',
  },
  unsafe_output: {
    label: 'Saída insegura',
    icon: Lock,
    description: 'Conteúdo bloqueado por política de moderação ou PII detectada.',
    guardrail: 'Plugue guardrail de moderação (ex.: Llama Guard) pré-resposta e mascare PII antes do log.',
  },
};

export function ErrorAnalysisPanel({ runs }: Props) {
  const { errors, total, breakdown, topErrorType } = useMemo(() => {
    const errs = runs.filter((r) => r.status === 'error' && r.error_type);
    const counts = new Map<SimulatedErrorType, number>();
    errs.forEach((r) => {
      const t = r.error_type!;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    });
    const sorted = Array.from(counts.entries())
      .map(([type, count]) => ({ type, count, pct: (count / runs.length) * 100 }))
      .sort((a, b) => b.count - a.count);
    return {
      errors: errs,
      total: runs.length,
      breakdown: sorted,
      topErrorType: sorted[0]?.type,
    };
  }, [runs]);

  if (total === 0) return null;

  if (errors.length === 0) {
    return (
      <div className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-3 flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold text-nexus-emerald">Nenhum erro nesta simulação</p>
          <p className="text-[11px] text-muted-foreground">Mantenha os guardrails atuais e considere expandir os casos de teste.</p>
        </div>
      </div>
    );
  }

  const errorRatePct = (errors.length / total) * 100;
  const top3 = breakdown.slice(0, 3);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-foreground">
            Análise de erros
            <span className="ml-1.5 font-normal text-muted-foreground">
              · {errors.length}/{total} falharam ({errorRatePct.toFixed(0)}%)
            </span>
          </h4>
        </div>
        {topErrorType && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
            top: {ERROR_META[topErrorType].label.toLowerCase()}
          </span>
        )}
      </div>

      {/* Breakdown bar chart */}
      <div className="space-y-1.5">
        {breakdown.map(({ type, count, pct }) => {
          const meta = ERROR_META[type];
          const Icon = meta.icon;
          const widthPct = (count / errors.length) * 100;
          return (
            <div key={type} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <Icon className="h-3 w-3 text-destructive" aria-hidden="true" />
                  {meta.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {count}× <span className="text-muted-foreground/60">({pct.toFixed(0)}% do total)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full bg-destructive/70 rounded-full transition-all"
                  style={{ width: `${widthPct}%` }}
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={errors.length}
                  aria-label={`${meta.label}: ${count} ocorrências`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Guardrail recommendations — top 3 */}
      <div className="border-t border-destructive/20 pt-2.5 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
          <AlertTriangle className="h-3 w-3 text-nexus-amber" aria-hidden="true" />
          Guardrails sugeridos
          <span className="font-normal text-muted-foreground">(priorizados pelos erros mais frequentes)</span>
        </div>
        <ul className="space-y-1.5">
          {top3.map(({ type }, idx) => {
            const meta = ERROR_META[type];
            const Icon = meta.icon;
            return (
              <li
                key={type}
                className="rounded-md bg-card/50 border border-border/40 p-2 text-[11px] flex gap-2"
              >
                <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded bg-primary/10 text-primary font-mono font-bold text-[10px]">
                  {idx + 1}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="font-medium text-foreground">{meta.label}</span>
                    <span className="text-muted-foreground">— {meta.description}</span>
                  </div>
                  <p className="text-foreground/90 leading-snug">
                    <span className="text-nexus-emerald font-medium">→ </span>
                    {meta.guardrail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
