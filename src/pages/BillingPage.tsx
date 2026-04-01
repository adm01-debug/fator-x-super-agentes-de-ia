import { useState, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Button } from "@/components/ui/button";
import { usageBreakdown, costByModelData } from "@/lib/mock-data";
import { DollarSign, Cpu, Database, Wrench, Hash, HardDrive, Save, AlertTriangle, TrendingUp, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from "recharts";
import { toast } from "sonner";

const DAILY_COSTS = [
  { day: 'Seg', real: 98, projected: 95 }, { day: 'Ter', real: 112, projected: 100 },
  { day: 'Qua', real: 87, projected: 105 }, { day: 'Qui', real: 134, projected: 110 },
  { day: 'Sex', real: 156, projected: 115 }, { day: 'Sáb', real: 45, projected: 60 },
  { day: 'Dom', real: 22, projected: 40 },
];

export default function BillingPage() {
  const u = usageBreakdown;
  const [budget, setBudget] = useState(5000);
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [editingBudget, setEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(budget);
  const [tempThreshold, setTempThreshold] = useState(alertThreshold);

  const spent = 3240;
  const pct = Math.round(spent / budget * 100);
  const projection = 4350;

  const saveBudget = useCallback(() => {
    setBudget(tempBudget);
    setAlertThreshold(tempThreshold);
    setEditingBudget(false);
    toast.success(`Budget: R$ ${tempBudget.toLocaleString()}, alerta: ${tempThreshold}%`);
  }, [tempBudget, tempThreshold]);

  const exportReport = useCallback(() => {
    const report = { date: new Date().toISOString(), budget, spent, projection, breakdown: usageBreakdown, dailyCosts: DAILY_COSTS };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `billing_${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success('Relatório exportado');
  }, [budget, spent, projection]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Billing & Usage" description="Acompanhe custos, orçamentos e consumo por recurso"
        actions={<Button variant="outline" size="sm" className="gap-1" onClick={exportReport}><Download className="h-3.5 w-3.5" /> Exportar Relatório</Button>} />

      {/* Alert if over threshold */}
      {pct >= alertThreshold && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center gap-2 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Atenção: {pct}% do orçamento utilizado (alerta configurado em {alertThreshold}%). Projeção: R$ {projection.toLocaleString()} até fim do mês.</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Custo total hoje" value={`R$ ${u.totalCost.toFixed(2)}`} icon={DollarSign} />
        <MetricCard title="Tokens (custo)" value={`R$ ${u.tokens.cost.toFixed(2)}`} icon={Hash} subtitle={`${(u.tokens.input / 1000).toFixed(0)}k in / ${(u.tokens.output / 1000).toFixed(0)}k out`} />
        <MetricCard title="Embeddings" value={`R$ ${u.embeddings.cost.toFixed(2)}`} icon={Cpu} subtitle={`${u.embeddings.vectors.toLocaleString()} vetores`} />
        <MetricCard title="Storage" value={`R$ ${u.storage.cost.toFixed(2)}`} icon={HardDrive} subtitle={`${u.storage.gb} GB`} />
        <MetricCard title="Tool calls" value={`R$ ${u.toolCalls.cost.toFixed(2)}`} icon={Wrench} subtitle={`${u.toolCalls.count.toLocaleString()} chamadas`} />
        <MetricCard title="Compute" value={`R$ ${u.compute.cost.toFixed(2)}`} icon={Database} subtitle={`${u.compute.hours}h`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cost by model */}
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Custo por modelo (hoje)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={costByModelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>{costByModelData.map((e, i) => <Cell key={i} fill={e.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily trend */}
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Custo diário (Real vs Projetado)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={DAILY_COSTS}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickFormatter={v => `R$${v}`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Real" />
              <Line type="monotone" dataKey="projected" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Projetado" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Budget */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-foreground">Orçamento mensal</h3>
          <Button variant="outline" size="sm" onClick={() => { setEditingBudget(!editingBudget); setTempBudget(budget); setTempThreshold(alertThreshold); }}>
            {editingBudget ? 'Cancelar' : 'Editar Budget'}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-rose-500' : pct >= alertThreshold ? 'bg-amber-500' : 'nexus-gradient-bg'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <span className="text-sm font-heading font-bold text-foreground">R$ {spent.toLocaleString()} <span className="text-muted-foreground font-normal">/ R$ {budget.toLocaleString()}</span></span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{pct}% utilizado • Projeção: R$ {projection.toLocaleString()} até fim do mês</p>

        {editingBudget && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
            <div><label className="text-xs text-muted-foreground">Budget mensal (R$)</label>
              <input type="number" value={tempBudget} onChange={e => setTempBudget(Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono mt-1" />
            </div>
            <div><label className="text-xs text-muted-foreground">Alerta em (%)</label>
              <input type="number" value={tempThreshold} onChange={e => setTempThreshold(Number(e.target.value))} min={50} max={100} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono mt-1" />
            </div>
            <div className="flex items-end"><Button onClick={saveBudget} className="gap-1 w-full"><Save className="h-3.5 w-3.5" /> Salvar</Button></div>
          </div>
        )}
      </div>

      {/* Cost breakdown table */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Breakdown por recurso</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2">Recurso</th><th className="text-right py-2">Custo</th><th className="text-right py-2">% do total</th><th className="text-right py-2">Volume</th>
            </tr></thead>
            <tbody>
              {[
                { name: 'Tokens (LLM)', cost: u.tokens.cost, vol: `${((u.tokens.input + u.tokens.output) / 1000).toFixed(0)}K tokens` },
                { name: 'Embeddings', cost: u.embeddings.cost, vol: `${u.embeddings.vectors.toLocaleString()} vetores` },
                { name: 'Storage', cost: u.storage.cost, vol: `${u.storage.gb} GB` },
                { name: 'Tool Calls', cost: u.toolCalls.cost, vol: `${u.toolCalls.count.toLocaleString()} calls` },
                { name: 'Compute', cost: u.compute.cost, vol: `${u.compute.hours}h` },
              ].map(r => (
                <tr key={r.name} className="border-b border-border/30">
                  <td className="py-2 text-foreground">{r.name}</td>
                  <td className="py-2 text-right font-mono text-foreground">R$ {r.cost.toFixed(2)}</td>
                  <td className="py-2 text-right text-muted-foreground">{u.totalCost > 0 ? Math.round(r.cost / u.totalCost * 100) : 0}%</td>
                  <td className="py-2 text-right text-muted-foreground">{r.vol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
