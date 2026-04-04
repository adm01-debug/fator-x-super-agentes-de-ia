import { useState } from 'react';
import { SectionTitle, SliderField, InputField, ToggleField, ProgressBar } from '../ui';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MOCK_USAGE = [
  { date: 'Seg', llm: 12.5, embedding: 2.1, tools: 3.2, storage: 0.8, total: 18.6 },
  { date: 'Ter', llm: 15.3, embedding: 2.4, tools: 4.1, storage: 0.8, total: 22.6 },
  { date: 'Qua', llm: 9.8, embedding: 1.9, tools: 2.5, storage: 0.8, total: 15.0 },
  { date: 'Qui', llm: 18.2, embedding: 3.0, tools: 5.3, storage: 0.9, total: 27.4 },
  { date: 'Sex', llm: 14.1, embedding: 2.5, tools: 3.8, storage: 0.9, total: 21.3 },
  { date: 'Sáb', llm: 6.2, embedding: 1.2, tools: 1.5, storage: 0.9, total: 9.8 },
  { date: 'Dom', llm: 4.8, embedding: 0.9, tools: 1.0, storage: 0.9, total: 7.6 },
];

const MOCK_PROJECTION = [
  { week: 'S1', real: 122, projetado: 122 },
  { week: 'S2', real: 145, projetado: 145 },
  { week: 'S3', real: 138, projetado: 138 },
  { week: 'S4', real: null, projetado: 150 },
];

const COST_CATEGORIES = [
  { key: 'llm', label: '🧠 LLM Tokens', color: 'hsl(var(--nexus-blue))' },
  { key: 'embedding', label: '🔢 Embeddings', color: 'hsl(var(--nexus-green))' },
  { key: 'tools', label: '🔧 Tool Calls', color: 'hsl(var(--nexus-yellow))' },
  { key: 'storage', label: '💾 Storage', color: 'hsl(var(--nexus-purple))' },
];

export function BillingModule() {
  const { agent, updateAgent } = useAgentBuilderStore();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const totalWeek = MOCK_USAGE.reduce((s, d) => s + d.total, 0);
  const avgDaily = totalWeek / 7;
  const projectedMonth = avgDaily * 30;
  const budgetUsed = agent.monthly_budget ? (projectedMonth / agent.monthly_budget) * 100 : 0;

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
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={MOCK_USAGE}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Bar dataKey="llm" name="LLM" fill="hsl(var(--nexus-blue))" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="embedding" name="Embedding" fill="hsl(var(--nexus-green))" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="tools" name="Tools" fill="hsl(var(--nexus-yellow))" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="storage" name="Storage" fill="hsl(var(--nexus-purple))" radius={[0, 0, 4, 4]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {COST_CATEGORIES.map((cat) => {
          const total = MOCK_USAGE.reduce((s, d) => s + (d[cat.key as keyof typeof d] as number ?? 0), 0);
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
          min={0}
          value={agent.monthly_budget?.toString() ?? ''}
          onChange={(v) => {
            if (v === '') {
              updateAgent({ monthly_budget: undefined });
              return;
            }
            const num = Number(v);
            if (num < 0) return;
            updateAgent({ monthly_budget: num });
          }}
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
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={MOCK_PROJECTION}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
            <Line type="monotone" dataKey="real" name="Real" stroke="hsl(var(--nexus-blue))" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="projetado" name="Projetado" stroke="hsl(var(--nexus-yellow))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
