import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, SelectionGrid, SliderField, ToggleField, SelectField } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import type { LLMModel, ReasoningPattern } from '@/types/agentTypes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

const MODELS = [
  { id: 'claude-opus-4.6', icon: '🟤', title: 'Claude Opus 4.6', description: 'Anthropic · 200K ctx · $15/$75 por 1M', badge: <NexusBadge color="orange">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-gold))' },
  { id: 'claude-sonnet-4.6', icon: '🔵', title: 'Claude Sonnet 4.6', description: 'Anthropic · 200K ctx · $3/$15 por 1M', badge: <NexusBadge color="blue">Recomendado</NexusBadge>, accentColor: 'hsl(var(--nexus-blue))' },
  { id: 'claude-haiku-4.5', icon: '🟢', title: 'Claude Haiku 4.5', description: 'Anthropic · 200K ctx · $0.25/$1.25 por 1M', badge: <NexusBadge color="green">Econômico</NexusBadge>, accentColor: 'hsl(var(--nexus-green))' },
  { id: 'gpt-4o', icon: '🔴', title: 'GPT-4o', description: 'OpenAI · 128K ctx · $2.50/$10 por 1M', badge: <NexusBadge color="red">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-red))' },
  { id: 'gemini-2.5-pro', icon: '🟡', title: 'Gemini 2.5 Pro', description: 'Google · 1M ctx · $1.25/$5 por 1M', badge: <NexusBadge color="yellow">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-yellow))' },
  { id: 'llama-4', icon: '🟣', title: 'Llama 4', description: 'Meta (Open) · 128K ctx · Custo infra', badge: <NexusBadge color="purple">Open Source</NexusBadge>, accentColor: 'hsl(var(--nexus-purple))' },
];

const REASONING_OPTIONS: { id: ReasoningPattern; name: string; description: string; recommended?: boolean }[] = [
  { id: 'react', name: 'ReAct', description: 'Raciocina, age, observa e itera. Padrão mais versátil.', recommended: true },
  { id: 'cot', name: 'Chain-of-Thought', description: 'Passo-a-passo explícito antes de responder.' },
  { id: 'tot', name: 'Tree-of-Thought', description: 'Múltiplos caminhos de raciocínio em paralelo.' },
  { id: 'reflection', name: 'Reflection', description: 'Revisa e critica a própria resposta antes de entregar.' },
  { id: 'plan_execute', name: 'Plan & Execute', description: 'Cria plano completo, depois executa etapa por etapa.' },
];

const FALLBACK_OPTIONS = MODELS.map((m) => ({ value: m.id, label: m.title }));

export function BrainModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  return (
    <div className="space-y-10">
      {/* Seção A — Modelo Principal */}
      <section>
        <SectionTitle icon="🧠" title="Modelo Principal (LLM)" subtitle="Selecione o modelo de linguagem que alimentará o cérebro do agente." />
        <SelectionGrid
          items={MODELS}
          value={agent.model}
          onChange={(id) => updateAgent({ model: id as LLMModel })}
          columns={3}
        />
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
                  {opt.recommended && <NexusBadge label="Recomendado" color="hsl(var(--nexus-green))" />}
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
          <SliderField
            label="Temperature"
            value={agent.temperature}
            onChange={(v) => updateAgent({ temperature: v })}
            min={0} max={100} step={1}
            description="Baixo = determinístico. Alto = criativo."
          />
          <SliderField
            label="Top-P"
            value={agent.top_p}
            onChange={(v) => updateAgent({ top_p: v })}
            min={0} max={100} step={1}
            description="Controla a diversidade do vocabulário."
          />
          <SliderField
            label="Max Tokens (K)"
            value={agent.max_tokens}
            onChange={(v) => updateAgent({ max_tokens: v })}
            min={1} max={100} step={1} unit="K"
            description="Limite máximo de tokens na resposta."
          />
          <SliderField
            label="Retry Count"
            value={agent.retry_count}
            onChange={(v) => updateAgent({ retry_count: v })}
            min={0} max={10} step={1}
            description="Tentativas em caso de falha."
          />
        </div>
      </section>
    </div>
  );
}
