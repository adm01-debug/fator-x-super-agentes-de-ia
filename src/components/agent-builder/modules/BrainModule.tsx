import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, SliderField, ToggleField, SelectField } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import type { LLMModel, ReasoningPattern } from '@/types/agentTypes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface ModelInfo {
  id: LLMModel;
  name: string;
  provider: string;
  context: string;
  cost: string;
  tier: string;
  tierColor: 'orange' | 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  accentColor: string;
  best_for: string;
  strengths: string[];
  weaknesses: string[];
}

const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', context: '200K',
    cost: '$15/$75 por 1M', tier: 'Premium', tierColor: 'orange', accentColor: '#D4A574',
    best_for: 'Raciocínio complexo, análise profunda, tarefas multi-step',
    strengths: ['Raciocínio superior', 'Instruções complexas', 'Código avançado'],
    weaknesses: ['Custo elevado', 'Latência maior'],
  },
  {
    id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', context: '200K',
    cost: '$3/$15 por 1M', tier: 'Recomendado', tierColor: 'blue', accentColor: '#4D96FF',
    best_for: 'Melhor custo-benefício, velocidade + qualidade',
    strengths: ['Equilíbrio ideal', 'Velocidade', 'Custo-benefício'],
    weaknesses: ['Menos profundo que Opus em raciocínio'],
  },
  {
    id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', context: '200K',
    cost: '$0.25/$1.25 por 1M', tier: 'Econômico', tierColor: 'green', accentColor: '#6BCB77',
    best_for: 'Ultra-rápido, classificação, triagem, tarefas simples',
    strengths: ['Velocidade extrema', 'Custo mínimo', 'Alto throughput'],
    weaknesses: ['Raciocínio limitado', 'Menos criativo'],
  },
  {
    id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K',
    cost: '$2.50/$10 por 1M', tier: 'Premium', tierColor: 'red', accentColor: '#FF6B6B',
    best_for: 'Multi-modal nativo, ampla compatibilidade',
    strengths: ['Multi-modal', 'Ecossistema amplo', 'Function calling robusto'],
    weaknesses: ['Contexto menor', 'Menos transparente'],
  },
  {
    id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', context: '1M',
    cost: '$1.25/$5 por 1M', tier: 'Premium', tierColor: 'yellow', accentColor: '#FFD93D',
    best_for: 'Contexto massivo, multi-modal avançado',
    strengths: ['Contexto de 1M tokens', 'Multi-modal', 'Custo competitivo'],
    weaknesses: ['Menor precisão em instruções complexas'],
  },
  {
    id: 'llama-4', name: 'Llama 4', provider: 'Meta (Open)', context: '128K',
    cost: 'Custo de infra', tier: 'Open Source', tierColor: 'purple', accentColor: '#9B59B6',
    best_for: 'Self-hosted, zero custo de API, total controle',
    strengths: ['Sem custo de API', 'Privacidade total', 'Customizável'],
    weaknesses: ['Requer infra própria', 'Fine-tuning complexo'],
  },
];

const REASONING_OPTIONS: { id: ReasoningPattern; name: string; description: string; recommended?: boolean }[] = [
  { id: 'react', name: 'ReAct', description: 'Raciocina, age, observa e itera. Padrão mais versátil.', recommended: true },
  { id: 'cot', name: 'Chain-of-Thought', description: 'Passo-a-passo explícito antes de responder.' },
  { id: 'tot', name: 'Tree-of-Thought', description: 'Múltiplos caminhos de raciocínio em paralelo.' },
  { id: 'reflection', name: 'Reflection', description: 'Revisa e critica a própria resposta antes de entregar.' },
  { id: 'plan_execute', name: 'Plan & Execute', description: 'Cria plano completo, depois executa etapa por etapa.' },
];

const FALLBACK_OPTIONS = MODELS.map((m) => ({ value: m.id, label: m.name }));

export function BrainModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  return (
    <div className="space-y-10">
      {/* Seção A — Modelo Principal */}
      <section>
        <SectionTitle icon="🧠" title="Modelo Principal (LLM)" subtitle="Selecione o modelo de linguagem que alimentará o cérebro do agente." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODELS.map((m) => {
            const selected = agent.model === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateAgent({ model: m.id })}
                className={cn(
                  'text-left rounded-xl border p-4 transition-all duration-200',
                  selected
                    ? 'border-primary bg-primary/5 shadow-[0_0_20px_rgba(77,150,255,0.1)]'
                    : 'border-border bg-card hover:bg-muted/30'
                )}
                style={selected ? { borderColor: m.accentColor } : undefined}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                  <NexusBadge color={m.tierColor}>{m.tier}</NexusBadge>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">{m.provider} · {m.context} ctx · {m.cost}</p>
                <p className="text-xs text-muted-foreground/80 mb-3">{m.best_for}</p>

                {/* Strengths */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {m.strengths.map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {s}
                    </span>
                  ))}
                </div>
                {/* Weaknesses */}
                <div className="flex flex-wrap gap-1">
                  {m.weaknesses.map((w) => (
                    <span key={w} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {w}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Seção B — Fallback */}
      <section>
        <SectionTitle icon="🔄" title="Modelo de Fallback" subtitle="Modelo alternativo caso o principal falhe ou atinja rate-limit." />
        <ToggleField
          label="Ativar fallback automático"
          description="Redireciona para outro modelo em caso de erro ou indisponibilidade."
          checked={!!agent.model_fallback}
          onCheckedChange={(checked) => updateAgent({ model_fallback: checked ? (agent.model === 'claude-sonnet-4.6' ? 'claude-haiku-4.5' : 'claude-sonnet-4.6') : undefined })}
        />
        {agent.model_fallback && (
          <div className="mt-3">
            <SelectField
              label="Modelo de Fallback"
              value={agent.model_fallback}
              onChange={(v) => updateAgent({ model_fallback: v as LLMModel })}
              options={FALLBACK_OPTIONS.filter((o) => o.value !== agent.model)}
              hint="Escolha um modelo diferente do principal."
            />
          </div>
        )}
      </section>

      {/* Seção C — Padrão de Raciocínio */}
      <section>
        <SectionTitle icon="💡" title="Padrão de Raciocínio" subtitle="Como o agente estrutura seu pensamento antes de responder." />
        <RadioGroup
          value={agent.reasoning}
          onValueChange={(v) => updateAgent({ reasoning: v as ReasoningPattern })}
          className="space-y-2"
        >
          {REASONING_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all duration-200',
                agent.reasoning === opt.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/20 hover:bg-muted/40'
              )}
            >
              <RadioGroupItem value={opt.id} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{opt.name}</span>
                  {opt.recommended && <NexusBadge color="green">Recomendado</NexusBadge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </section>

      {/* Seção D — Parâmetros */}
      <section>
        <SectionTitle icon="⚙️" title="Parâmetros do Modelo" subtitle="Ajuste fino do comportamento de geração." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SliderField label="Temperature" value={agent.temperature} onChange={(v) => updateAgent({ temperature: v })} min={0} max={100} step={1} description="Baixo = determinístico. Alto = criativo." />
          <SliderField label="Top-P" value={agent.top_p} onChange={(v) => updateAgent({ top_p: v })} min={0} max={100} step={1} description="Controla a diversidade do vocabulário." />
          <SliderField label="Max Tokens (K)" value={agent.max_tokens} onChange={(v) => updateAgent({ max_tokens: v })} min={1} max={100} step={1} unit="K" description="Limite máximo de tokens na resposta." />
          <SliderField label="Retry Count" value={agent.retry_count} onChange={(v) => updateAgent({ retry_count: v })} min={0} max={10} step={1} description="Tentativas em caso de falha." />
        </div>
      </section>
    </div>
  );
}
