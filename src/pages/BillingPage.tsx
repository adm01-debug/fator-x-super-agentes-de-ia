import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { usageBreakdown, costByModelData } from "@/lib/mock-data";
import { DollarSign, Cpu, Database, Wrench, Hash, HardDrive } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

export default function BillingPage() {
  const u = usageBreakdown;
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Billing & Usage" description="Acompanhe custos, orçamentos e consumo por recurso" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Custo total hoje" value={`R$ ${u.totalCost.toFixed(2)}`} icon={DollarSign} />
        <MetricCard title="Tokens (custo)" value={`R$ ${u.tokens.cost.toFixed(2)}`} icon={Hash} subtitle={`${(u.tokens.input / 1000).toFixed(0)}k in / ${(u.tokens.output / 1000).toFixed(0)}k out`} />
        <MetricCard title="Embeddings" value={`R$ ${u.embeddings.cost.toFixed(2)}`} icon={Cpu} subtitle={`${u.embeddings.vectors.toLocaleString()} vetores`} />
        <MetricCard title="Storage" value={`R$ ${u.storage.cost.toFixed(2)}`} icon={HardDrive} subtitle={`${u.storage.gb} GB`} />
        <MetricCard title="Tool calls" value={`R$ ${u.toolCalls.cost.toFixed(2)}`} icon={Wrench} subtitle={`${u.toolCalls.count.toLocaleString()} chamadas`} />
        <MetricCard title="Compute" value={`R$ ${u.compute.cost.toFixed(2)}`} icon={Database} subtitle={`${u.compute.hours}h`} />
      </div>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Custo por modelo (hoje)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={costByModelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
              {costByModelData.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-2">Orçamento mensal</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full nexus-gradient-bg" style={{ width: '62%' }} />
            </div>
          </div>
          <span className="text-sm font-heading font-bold text-foreground">R$ 3.240 <span className="text-muted-foreground font-normal">/ R$ 5.000</span></span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">62% do orçamento utilizado • Projeção: R$ 4.350 até fim do mês</p>
      </div>
    </div>
  );
}
