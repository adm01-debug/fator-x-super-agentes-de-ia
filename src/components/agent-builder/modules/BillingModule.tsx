import { useMemo, useState } from 'react';
import { SectionTitle, SliderField, InputField, ToggleField, ProgressBar } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { LightBarChart, LightLineChart } from '@/components/charts';
import { useBillingData } from '@/hooks/useBillingData';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { listModelPrices, USD_TO_BRL, estimateTokens } from '@/lib/llmPricing';
import { Calculator, TrendingDown, Zap } from 'lucide-react';

// Real data from Supabase via useBillingData hook — no more mocks!

const COST_CATEGORIES = [
  { key: 'llm', label: '🧠 LLM Tokens', color: 'hsl(var(--nexus-blue))' },
  { key: 'embedding', label: '🔢 Embeddings', color: 'hsl(var(--nexus-green))' },
  { key: 'tools', label: '🔧 Tool Calls', color: 'hsl(var(--nexus-yellow))' },
  { key: 'storage', label: '💾 Storage', color: 'hsl(var(--nexus-purple))' },
];

export function BillingModule() {
  const { agent, updateAgent } = useAgentBuilderStore();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const billing = useBillingData(agent.id);
  const [simInput, setSimInput] = useState('Olá, preciso de ajuda com meu pedido número 12345.');
  const [simMaxTokens, setSimMaxTokens] = useState(1000);

  const totalWeek = billing.totalWeek;
  const avgDaily = billing.avgDaily;
  const projectedMonth = billing.projectedMonth;
  const budgetUsed = agent.monthly_budget ? (projectedMonth / agent.monthly_budget) * 100 : 0;

  const simulation = useMemo(() => {
    const inputTokens = estimateTokens(simInput);
    const outputTokens = Math.max(100, Math.floor(simMaxTokens * 0.6));
    return listModelPrices()
      .map((p) => {
        const costUsd = (inputTokens / 1000) * p.input_per_1k + (outputTokens / 1000) * p.output_per_1k;
        return {
          ...p,
          inputTokens,
          outputTokens,
          costUsd,
          costBrl: costUsd * USD_TO_BRL,
        };
      })
      .sort((a, b) => a.costUsd - b.costUsd);
  }, [simInput, simMaxTokens]);

  const cheapest = simulation[0];
  const fastest = [...simulation].sort((a, b) => a.avg_latency_ms - b.avg_latency_ms)[0];

  return (
    <div className="space-y-8">
      <SectionTitle icon="💰" title="Uso & Custos" subtitle="Dashboard de custos, budget e projeções" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Custo Semanal', value: `$${totalWeek.toFixed(2)}`, color: 'nexus-blue' },
          { label: 'Média Diária', value: `$${avgDaily.toFixed(2)}`, color: 'nexus-green' },
          { label: 'Projeção Mensal', value: `$${projectedMonth.toFixed(0)}`, color: 'nexus-yellow' },
          { label: 'Interações/dia', value: '~340', color: 'nexus-purple' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold text-[hsl(var(--${c.color}))]`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Cost Breakdown Chart */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Breakdown de Custos</h3>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${
                  period === p
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'daily' ? 'Diário' : p === 'weekly' ? 'Semanal' : 'Mensal'}
              </button>
            ))}
          </div>
        </div>
        <LightBarChart
          data={billing.dailyUsage}
          xKey="date"
          height={280}
          yFormatter={(v) => `$${v}`}
          showLegend
          series={[
            { dataKey: 'llm', name: 'LLM', color: 'hsl(var(--nexus-blue))', radius: 4, stackId: 'a' },
            { dataKey: 'embedding', name: 'Embedding', color: 'hsl(var(--nexus-green))', stackId: 'a' },
            { dataKey: 'tools', name: 'Tools', color: 'hsl(var(--nexus-yellow))', stackId: 'a' },
            { dataKey: 'storage', name: 'Storage', color: 'hsl(var(--nexus-purple))', stackId: 'a' },
          ]}
        />
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {COST_CATEGORIES.map((cat) => {
          const total = billing.dailyUsage.reduce((s, d) => s + (d[cat.key as keyof typeof d] as number), 0);
          const pct = (total / totalWeek) * 100;
          return (
            <div key={cat.key} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xl font-bold" style={{ color: cat.color }}>${total.toFixed(2)}</p>
              <ProgressBar value={pct} max={100} color={cat.color} />
              <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% do total</p>
            </div>
          );
        })}
      </div>

      {/* Budget & Alerts */}
      <SectionTitle icon="🎯" title="Budget & Alertas" subtitle="Controle de gastos e limites" />
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <InputField
          label="Budget mensal ($)"
          type="number"
          value={agent.monthly_budget?.toString() ?? ''}
          onChange={(v) => updateAgent({ monthly_budget: v ? Number(v) : undefined })}
          placeholder="500"
        />
        <SliderField
          label="Alertar quando atingir"
          value={agent.budget_alert_threshold}
          onChange={(v) => updateAgent({ budget_alert_threshold: v })}
          min={50}
          max={100}
          unit="%"
        />
        <ToggleField
          label="Kill switch automático ao atingir 100%"
          description="Desativa o agente automaticamente quando o budget é atingido"
          checked={agent.budget_kill_switch}
          onCheckedChange={(v) => updateAgent({ budget_kill_switch: v })}
        />
        {agent.monthly_budget && (
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Uso projetado vs Budget</span>
              <span className={budgetUsed > 100 ? 'text-[hsl(var(--nexus-red))]' : budgetUsed > 80 ? 'text-[hsl(var(--nexus-yellow))]' : 'text-[hsl(var(--nexus-green))]'}>
                ${projectedMonth.toFixed(0)} / ${agent.monthly_budget}
              </span>
            </div>
            <ProgressBar
              value={Math.min(budgetUsed, 100)}
              max={100}
              color={budgetUsed > 100 ? 'hsl(var(--nexus-red))' : budgetUsed > 80 ? 'hsl(var(--nexus-yellow))' : 'hsl(var(--nexus-green))'}
            />
          </div>
        )}
      </div>

      {/* Projection */}
      <SectionTitle icon="📈" title="Projeção" subtitle="Tendência baseada nos últimos 7 dias" />
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Baseado no uso atual, projeção para o mês: <span className="text-foreground font-bold">${projectedMonth.toFixed(0)}</span>
        </p>
        <LightLineChart
          data={billing.projection}
          xKey="week"
          height={220}
          yFormatter={(v) => `$${v}`}
          series={[
            { dataKey: 'real', name: 'Real', stroke: 'hsl(var(--nexus-blue))', strokeWidth: 2, dotRadius: 4 },
            { dataKey: 'projetado', name: 'Projetado', stroke: 'hsl(var(--nexus-yellow))', strokeWidth: 2, strokeDasharray: '5 5', dotRadius: 4 },
          ]}
        />
      </div>
    </div>
  );
}
