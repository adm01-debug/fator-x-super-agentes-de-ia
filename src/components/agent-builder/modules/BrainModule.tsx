import { useState } from 'react';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, SelectionGrid, SliderField, ToggleField, SelectField } from '../ui';
import { NexusBadge } from '../ui/NexusBadge';
import type { LLMModel, ReasoningPattern } from '@/types/agentTypes';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { routeQuery, type RouteResult } from '@/services/modelRouterService';
import { getAllSkills } from '@/services/progressiveSkillLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Cpu } from 'lucide-react';
import { toast } from 'sonner';

const MODELS = [
  { id: 'claude-opus-4.6', icon: '🟤', title: 'Claude Opus 4.6', description: 'Anthropic · 200K ctx · $15/$75 por 1M', badge: <NexusBadge color="orange">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-gold))' },
  { id: 'claude-sonnet-4.6', icon: '🔵', title: 'Claude Sonnet 4.6', description: 'Anthropic · 200K ctx · $3/$15 por 1M', badge: <NexusBadge color="blue">Recomendado</NexusBadge>, accentColor: 'hsl(var(--nexus-blue))' },
  { id: 'claude-haiku-4.5', icon: '🟢', title: 'Claude Haiku 4.5', description: 'Anthropic · 200K ctx · $0.25/$1.25 por 1M', badge: <NexusBadge color="green">Econômico</NexusBadge>, accentColor: 'hsl(var(--nexus-green))' },
  { id: 'gpt-4o', icon: '🔴', title: 'GPT-4o', description: 'OpenAI · 128K ctx · $2.50/$10 por 1M', badge: <NexusBadge color="red">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-red))' },
  { id: 'gemini-2.5-pro', icon: '🟡', title: 'Gemini 2.5 Pro', description: 'Google · 1M ctx · $1.25/$5 por 1M', badge: <NexusBadge color="yellow">Premium</NexusBadge>, accentColor: 'hsl(var(--nexus-yellow))' },
  { id: 'llama-4', icon: '🟣', title: 'Llama 4', description: 'Meta (Open) · 128K ctx · Custo infra', badge: <NexusBadge color="purple">Open Source</NexusBadge>, accentColor: 'hsl(var(--nexus-purple))' },
  { id: 'huggingface/Qwen/Qwen3-30B-A3B', icon: '🤗', title: 'Qwen3 30B', description: 'HuggingFace · MoE · $0.15/$0.30 por 1M', badge: <NexusBadge color="yellow">HF Free</NexusBadge>, accentColor: 'hsl(45, 90%, 55%)' },
  { id: 'huggingface/mistralai/Mistral-Small-24B-Instruct-2501', icon: '🤗', title: 'Mistral Small 24B', description: 'HuggingFace · 24B · $0.10/$0.30 por 1M', badge: <NexusBadge color="yellow">HF Free</NexusBadge>, accentColor: 'hsl(45, 90%, 55%)' },
  { id: 'huggingface/meta-llama/Llama-4-Scout-17B-16E-Instruct', icon: '🤗', title: 'Llama 4 Scout', description: 'HuggingFace · 17B MoE · $0.17/$0.40 por 1M', badge: <NexusBadge color="yellow">HF Free</NexusBadge>, accentColor: 'hsl(45, 90%, 55%)' },
];

const REASONING_OPTIONS: { id: ReasoningPattern; name: string; description: string; recommended?: boolean }[] = [
  { id: 'react', name: 'ReAct', description: 'Raciocina, age, observa e itera. Padrão mais versátil.', recommended: true },
  { id: 'cot', name: 'Chain-of-Thought', description: 'Passo-a-passo explícito antes de responder.' },
  { id: 'tot', name: 'Tree-of-Thought', description: 'Múltiplos caminhos de raciocínio em paralelo.' },
  { id: 'reflection', name: 'Reflection', description: 'Revisa e critica a própria resposta antes de entregar.' },
  { id: 'plan_execute', name: 'Plan & Execute', description: 'Cria plano completo, depois executa etapa por etapa.' },
  { id: 'smolagent', name: '🤗 SmolagentRT', description: 'Agente autônomo com 13 ferramentas HF (busca, imagem, áudio, banco, etc). Executa ações reais.' },
];

const FALLBACK_OPTIONS = MODELS.map((m) => ({ value: m.id, label: m.title }));

export function BrainModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);
  const [routing, setRouting] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  const skills = getAllSkills();

  const handleAutoRoute = async () => {
    const testQuery = agent.mission || agent.persona || 'Analyze complex data and provide insights';
    setRouting(true);
    try {
      const result = await routeQuery(testQuery);
      setRouteResult(result);
      const matchingModel = MODELS.find(m => result.recommended_model.includes(m.id) || m.id.includes(result.recommended_model));
      if (matchingModel) {
        updateAgent({ model: matchingModel.id as LLMModel });
        toast.success(`Auto-Route: ${matchingModel.title} (${result.tier})`);
      } else {
        toast.info(`Sugestão: ${result.recommended_model} (${result.tier})`);
      }
    } catch {
      toast.error('Auto-Route indisponível, selecione manualmente');
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Seção A — Modelo Principal */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <SectionTitle icon="🧠" title="Modelo Principal (LLM)" subtitle="Selecione o modelo de linguagem que alimentará o cérebro do agente." />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={handleAutoRoute} disabled={routing}>
            {routing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Auto-Route
          </Button>
        </div>
        {routeResult && (
          <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5 animate-fade-in">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">Complexidade: {routeResult.complexity.level} ({(routeResult.complexity.score * 100).toFixed(0)}%)</Badge>
              <Badge variant="outline" className="text-[10px]">Tier: {routeResult.tier}</Badge>
              <Badge variant="outline" className="text-[10px]">~${routeResult.estimated_cost_per_query.toFixed(4)}/query</Badge>
            </div>
            {routeResult.alternatives.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Alternativas: {routeResult.alternatives.map(a => `${a.model} (${a.tier})`).join(', ')}
              </p>
            )}
          </div>
        )}
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

      {/* Seção E — Progressive Skill Loading */}
      <section>
        <SectionTitle icon="🧩" title="Progressive Skill Loading" subtitle="Skills carregadas dinamicamente no contexto do LLM para economizar tokens." />
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Skills Registradas</span>
            <Badge variant="secondary" className="text-[11px]">{skills.length}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O sistema carrega apenas as skills relevantes para cada tarefa, otimizando uso de tokens e qualidade da resposta.
            Skills são selecionadas por matching semântico com a task description.
          </p>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skills.slice(0, 10).map((s: { id: string; name: string }) => (
                <Badge key={s.id} variant="outline" className="text-[10px]">{s.name}</Badge>
              ))}
              {skills.length > 10 && <Badge variant="secondary" className="text-[10px]">+{skills.length - 10} mais</Badge>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
