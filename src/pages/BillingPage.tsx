import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { DollarSign, Hash, Loader2, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function BillingPage() {
  const { data: usage = [], isLoading } = useQuery({
    queryKey: ['agent_usage'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from('agent_usage')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = usage.reduce((acc, u) => ({
    cost: acc.cost + Number(u.total_cost_usd || 0),
    tokensIn: acc.tokensIn + (u.tokens_input || 0),
    tokensOut: acc.tokensOut + (u.tokens_output || 0),
    requests: acc.requests + (u.requests || 0),
    errors: acc.errors + (u.error_count || 0),
  }), { cost: 0, tokensIn: 0, tokensOut: 0, requests: 0, errors: 0 });

  const chartData = usage.map(u => ({
    date: new Date(u.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    cost: Number(u.total_cost_usd || 0),
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Billing & Usage" description="Acompanhe custos e consumo por recurso" />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : usage.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Sem dados de uso</h2>
          <p className="text-sm text-muted-foreground">Dados de uso aparecerão após o primeiro agente ativo.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard title="Custo total (30d)" value={`$${totals.cost.toFixed(2)}`} icon={DollarSign} />
            <MetricCard title="Requests" value={totals.requests.toLocaleString()} icon={Hash} />
            <MetricCard title="Tokens entrada" value={`${(totals.tokensIn / 1000).toFixed(0)}k`} icon={Hash} />
            <MetricCard title="Tokens saída" value={`${(totals.tokensOut / 1000).toFixed(0)}k`} icon={Hash} />
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Custo diário (últimos 30 dias)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
