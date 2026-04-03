import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DollarSign, Hash, Loader2, BarChart3, Plus, Trash2, Wallet, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabaseExtended";
import { getWorkspaceId } from "@/lib/agentService";
import { LightBarChart } from "@/components/charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [newBudgetOpen, setNewBudgetOpen] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('100');
  const [saving, setSaving] = useState(false);

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

  // Budgets
  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('budgets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Usage records
  const { data: usageRecords = [] } = useQuery({
    queryKey: ['usage_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
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

  const handleCreateBudget = async () => {
    if (!budgetName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      const { error } = await supabase.from('budgets').insert({
        name: budgetName.trim(),
        limit_usd: parseFloat(budgetLimit) || 100,
        workspace_id: wsId,
      });
      if (error) throw error;
      toast.success('Orçamento criado!');
      setNewBudgetOpen(false);
      setBudgetName('');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Orçamento removido');
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Billing & Usage" description="Acompanhe custos, orçamentos e consumo por recurso" />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="budgets">Orçamentos</TabsTrigger>
          <TabsTrigger value="records">Registros de uso</TabsTrigger>
          <TabsTrigger value="pricing">Preços por modelo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
                <LightBarChart
                  data={chartData}
                  xKey="date"
                  height={250}
                  yFormatter={(v) => `$${v}`}
                  tooltipFormatter={(v) => `$${v.toFixed(2)}`}
                  series={[{ dataKey: 'cost', name: 'Custo', color: 'hsl(var(--primary))', radius: 4 }]}
                />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="budgets">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-heading font-semibold text-foreground">Orçamentos</h3>
            <Dialog open={newBudgetOpen} onOpenChange={setNewBudgetOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Plus className="h-3 w-3" /> Novo orçamento</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={budgetName} onChange={e => setBudgetName(e.target.value)} className="bg-secondary/50" placeholder="Ex: Mensal Produção" /></div>
                  <div className="space-y-1"><Label className="text-xs">Limite (USD)</Label><Input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} className="bg-secondary/50" /></div>
                  <Button onClick={handleCreateBudget} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingBudgets ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Nenhum orçamento configurado</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {budgets.map((b) => {
                const pct = b.limit_usd > 0 ? ((b.current_usd ?? 0) / b.limit_usd) * 100 : 0;
                const overThreshold = pct >= (b.alert_threshold ?? 80) * 100;
                return (
                  <div key={b.id} className="nexus-card group">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{b.name}</h4>
                        <p className="text-[11px] text-muted-foreground">{b.period} • {b.is_active ? 'Ativo' : 'Inativo'}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remover orçamento?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBudget(b.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-xl font-heading font-bold text-foreground">${(b.current_usd ?? 0).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">/ ${b.limit_usd.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-nexus-amber' : 'bg-primary'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    {overThreshold && (
                      <div className="flex items-center gap-1 mt-2 text-nexus-amber">
                        <AlertTriangle className="h-3 w-3" />
                        <span className="text-[11px]">Alerta: {pct.toFixed(0)}% do limite</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="records">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Registros de uso recentes</h3>
          {usageRecords.length === 0 ? (
            <div className="text-center py-12"><p className="text-xs text-muted-foreground">Nenhum registro encontrado</p></div>
          ) : (
            <div className="nexus-card overflow-hidden p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium">Tokens</th>
                    <th className="text-left px-4 py-2 font-medium">Custo</th>
                    <th className="text-left px-4 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {usageRecords.map(r => (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-2"><Badge variant="outline" className="text-[11px]">{r.record_type}</Badge></td>
                      <td className="px-4 py-2 text-xs text-foreground">{(r.tokens ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs text-foreground">${Number(r.cost_usd ?? 0).toFixed(4)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pricing">
          <PricingTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PricingTable() {
  const { data: pricing = [], isLoading } = useQuery({
    queryKey: ['model_pricing'],
    queryFn: async () => {
      const { data, error } = await fromTable('model_pricing').select('*').order('model_pattern');
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="nexus-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="border-b border-border/50 text-muted-foreground">
          <th className="text-left p-3 font-medium">Modelo</th>
          <th className="text-right p-3 font-medium">Input ($/1K tokens)</th>
          <th className="text-right p-3 font-medium">Output ($/1K tokens)</th>
          <th className="text-right p-3 font-medium">Custo estimado / 1M tokens</th>
        </tr></thead>
        <tbody>
          {pricing.map((p: any) => (
            <tr key={p.id} className="border-b border-border/20 hover:bg-secondary/30">
              <td className="p-3 font-mono text-foreground">{p.model_pattern}</td>
              <td className="p-3 text-right text-foreground">${Number(p.input_cost_per_1k).toFixed(6)}</td>
              <td className="p-3 text-right text-foreground">${Number(p.output_cost_per_1k).toFixed(6)}</td>
              <td className="p-3 text-right text-muted-foreground">${((Number(p.input_cost_per_1k) + Number(p.output_cost_per_1k)) * 500).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
