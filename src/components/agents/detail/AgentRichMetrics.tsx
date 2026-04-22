import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, DollarSign, Zap, ShieldCheck, AlertCircle, Cpu, Loader2 } from 'lucide-react';
import { MetricCard } from '@/components/shared/MetricCard';
import { LightAreaChart } from '@/components/charts/LightAreaChart';
import { LightBarChart } from '@/components/charts/LightBarChart';
import { getAgentDetailTraces, getAgentUsage, getAgentRecentAlerts } from '@/services/agentsService';
import {
  buildDailySeries,
  computeSLO,
  compareWindows,
  compareSuccessRateWindows,
  formatCost,
  formatNumber,
  type DailyPoint,
} from './agentMetricsHelpers';
import { InteractiveSLOPanel } from './InteractiveSLOPanel';
import { DayDrillDownDrawer } from './DayDrillDownDrawer';
import { AgentFailuresTable } from './AgentFailuresTable';
import { TrendInsightsBanner } from './TrendInsightsBanner';
import { KPIDeepInsightsPanel } from './KPIDeepInsightsPanel';


interface Props {
  agentId: string;
  agentName?: string;
  days?: number;
}

export function AgentRichMetrics({ agentId, agentName, days = 14 }: Props) {
  const { data: usage = [], isLoading: usageLoading } = useQuery({
    queryKey: ['agent_usage_rich', agentId, days],
    queryFn: () => getAgentUsage(agentId, days),
  });

  const { data: traces = [], isLoading: tracesLoading } = useQuery({
    queryKey: ['agent_traces_rich', agentId],
    queryFn: () => getAgentDetailTraces(agentId, 200),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['agent_alerts_rich', agentId],
    queryFn: () => getAgentRecentAlerts(agentId, 10),
  });

  const daily = useMemo(() => buildDailySeries(usage, days), [usage, days]);
  const slo = useMemo(() => computeSLO(traces), [traces]);

  const totals = useMemo(() => {
    const totalRequests = daily.reduce((s, d) => s + d.requests, 0);
    const totalCost = daily.reduce((s, d) => s + d.cost, 0);
    const totalTokens = daily.reduce((s, d) => s + d.tokens, 0);
    const reqCmp = compareWindows(daily, (d) => d.requests);
    const costCmp = compareWindows(daily, (d) => d.cost, { inverted: true });
    // latency p95 proxy: média da janela de avgLatency (menor = melhor)
    const latCmp = compareWindows(daily, (d) => d.avgLatency, { inverted: true });
    const successCmp = compareSuccessRateWindows(traces);
    return { totalRequests, totalCost, totalTokens, reqCmp, costCmp, latCmp, successCmp };
  }, [daily, traces]);

  const activeAlerts = alerts.filter((a) => !a.is_resolved).length;

  const [selectedDay, setSelectedDay] = useState<DailyPoint | null>(null);

  if (usageLoading || tracesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TrendInsightsBanner
        insights={[
          { key: 'success', label: 'Taxa de sucesso', cmp: totals.successCmp, format: (v) => `${v.toFixed(1)}%`, priority: 1 },
          { key: 'latency', label: 'Latência média', cmp: totals.latCmp, format: (v) => `${Math.round(v)}ms`, priority: 2 },
          { key: 'cost', label: 'Custo', cmp: totals.costCmp, format: (v) => formatCost(v), priority: 3 },
          { key: 'requests', label: 'Volume de requisições', cmp: totals.reqCmp, format: (v) => formatNumber(Math.round(v)), priority: 4 },
        ]}
      />

      <KPIDeepInsightsPanel daily={daily} traces={traces} />

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Requisições"
          value={formatNumber(totals.totalRequests)}
          subtitle={`Últimos ${days} dias`}
          icon={Activity}
          trend={totals.reqCmp.hasPrev && totals.reqCmp.trend !== 'flat' ? {
            value: `${totals.reqCmp.deltaPct >= 0 ? '+' : ''}${totals.reqCmp.deltaPct.toFixed(1)}% vs 7d ant.`,
            positive: totals.reqCmp.isPositive,
          } : undefined}
          sparklineData={daily.map((d) => d.requests)}
        />
        <MetricCard
          title="Custo total"
          value={formatCost(totals.totalCost)}
          subtitle={`${formatNumber(totals.totalTokens)} tokens`}
          icon={DollarSign}
          trend={totals.costCmp.hasPrev && totals.costCmp.trend !== 'flat' ? {
            value: `${totals.costCmp.deltaPct >= 0 ? '+' : ''}${totals.costCmp.deltaPct.toFixed(1)}% vs 7d ant.`,
            positive: totals.costCmp.isPositive,
          } : undefined}
          sparklineData={daily.map((d) => d.cost)}
          sparklineColor="hsl(var(--nexus-amber))"
        />
        <MetricCard
          title="Latência p95"
          value={`${formatNumber(slo.p95)}ms`}
          subtitle={`p50 ${slo.p50}ms · p99 ${slo.p99}ms`}
          icon={Zap}
          trend={totals.latCmp.hasPrev && totals.latCmp.trend !== 'flat' ? {
            value: `${totals.latCmp.deltaPct >= 0 ? '+' : ''}${totals.latCmp.deltaPct.toFixed(1)}% vs 7d ant.`,
            positive: totals.latCmp.isPositive,
          } : undefined}
          sparklineData={daily.map((d) => d.avgLatency)}
        />
        <MetricCard
          title="Taxa de sucesso"
          value={`${slo.successRate.toFixed(1)}%`}
          subtitle={`${slo.successCount}/${slo.totalTraces} traces`}
          icon={ShieldCheck}
          trend={totals.successCmp.hasPrev && totals.successCmp.trend !== 'flat' ? {
            value: `${totals.successCmp.deltaPct >= 0 ? '+' : ''}${totals.successCmp.deltaPct.toFixed(1)}% vs 7d ant.`,
            positive: totals.successCmp.isPositive,
          } : { value: `${slo.errorCount} erros`, positive: slo.errorCount === 0 }}
        />
      </div>

      {/* Trend charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Requisições por dia" subtitle={`Volume nos últimos ${days} dias`} icon={Activity}>
          {daily.some((d) => d.requests > 0) ? (
            <LightAreaChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'requests', name: 'Requests', stroke: 'hsl(var(--primary))' }]}
              height={200}
              tooltipFormatter={(v) => `${formatNumber(v)} req`}
              yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
          ) : (
            <EmptyChart label="Sem requisições no período" />
          )}
        </ChartCard>

        <ChartCard title="Custo por dia (USD)" subtitle="Clique em uma barra para detalhar o dia" icon={DollarSign}>
          {daily.some((d) => d.cost > 0) ? (
            <LightBarChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'cost', name: 'Custo', color: 'hsl(var(--nexus-amber))' }]}
              height={200}
              tooltipFormatter={(v) => formatCost(v)}
              yFormatter={(v) => v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`}
              onBarClick={(d) => setSelectedDay(d as DailyPoint)}
            />
          ) : (
            <EmptyChart label="Sem custos registrados" />
          )}
        </ChartCard>

        <ChartCard title="Latência média (ms)" subtitle="Tendência diária" icon={Zap}>
          {daily.some((d) => d.avgLatency > 0) ? (
            <LightAreaChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'avgLatency', name: 'Latência', stroke: 'hsl(var(--primary))', gradientFrom: 'hsl(var(--primary))' }]}
              height={200}
              tooltipFormatter={(v) => `${Math.round(v)}ms`}
              yFormatter={(v) => `${Math.round(v)}ms`}
            />
          ) : (
            <EmptyChart label="Sem dados de latência" />
          )}
        </ChartCard>

        <ChartCard title="Tokens por dia" subtitle="Clique em uma barra para detalhar o dia" icon={Cpu}>
          {daily.some((d) => d.tokens > 0) ? (
            <LightBarChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'tokens', name: 'Tokens', color: 'hsl(var(--primary))' }]}
              height={200}
              tooltipFormatter={(v) => `${formatNumber(v)} tokens`}
              yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              onBarClick={(d) => setSelectedDay(d as DailyPoint)}
            />
          ) : (
            <EmptyChart label="Sem consumo de tokens" />
          )}
        </ChartCard>
      </div>

      {/* SLO + status distribution */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <InteractiveSLOPanel
            agentId={agentId}
            agentName={agentName}
            slo={slo}
            traces={traces}
            daily={daily}
            onDayClick={setSelectedDay}
          />
        </div>

        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Distribuição de traces</h3>
          <div className="space-y-3">
            <StatusBar label="Sucesso" count={slo.successCount} total={slo.totalTraces} color="bg-nexus-emerald" />
            <StatusBar label="Avisos" count={slo.warningCount} total={slo.totalTraces} color="bg-nexus-amber" />
            <StatusBar label="Erros" count={slo.errorCount} total={slo.totalTraces} color="bg-destructive" />
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Custo médio/req</p>
              <p className="font-mono font-semibold text-foreground mt-0.5">{formatCost(slo.avgCost)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tokens totais</p>
              <p className="font-mono font-semibold text-foreground mt-0.5">{formatNumber(slo.totalTokens)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily history table */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-heading font-semibold text-foreground">Histórico por dia</h3>
            <p className="text-[11px] text-muted-foreground">Detalhamento dos últimos {days} dias</p>
          </div>
          {activeAlerts > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
              <AlertCircle className="h-3 w-3" /> {activeAlerts} alerta{activeAlerts !== 1 ? 's' : ''} ativo{activeAlerts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="py-2 px-2 font-medium">Data</th>
                <th className="py-2 px-2 font-medium text-right">Requests</th>
                <th className="py-2 px-2 font-medium text-right">Tokens</th>
                <th className="py-2 px-2 font-medium text-right">Custo</th>
                <th className="py-2 px-2 font-medium text-right">Latência</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((d) => (
                <tr
                  key={d.date}
                  className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedDay(d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDay(d); } }}
                >
                  <td className="py-2 px-2 font-mono text-foreground">{d.label}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-foreground">{formatNumber(d.requests)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatNumber(d.tokens)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatCost(d.cost)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{d.avgLatency > 0 ? `${Math.round(d.avgLatency)}ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AgentFailuresTable agentId={agentId} />

      <DayDrillDownDrawer
        open={!!selectedDay}
        onOpenChange={(o) => { if (!o) setSelectedDay(null); }}
        agentId={agentId}
        day={selectedDay}
      />
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      {children}
    </div>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{count} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
