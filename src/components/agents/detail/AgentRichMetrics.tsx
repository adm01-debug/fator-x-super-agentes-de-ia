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
  buildSLOTargets,
  formatCost,
  formatNumber,
  type DailyPoint,
} from './agentMetricsHelpers';
import { SLOPanel } from './SLOPanel';
import { DayDrillDownDrawer } from './DayDrillDownDrawer';

interface Props {
  agentId: string;
  days?: number;
}

export function AgentRichMetrics({ agentId, days = 14 }: Props) {
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
  const sloTargets = useMemo(() => buildSLOTargets(slo), [slo]);

  const totals = useMemo(() => {
    const totalRequests = daily.reduce((s, d) => s + d.requests, 0);
    const totalCost = daily.reduce((s, d) => s + d.cost, 0);
    const totalTokens = daily.reduce((s, d) => s + d.tokens, 0);
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    const last7Req = last7.reduce((s, d) => s + d.requests, 0);
    const prev7Req = prev7.reduce((s, d) => s + d.requests, 0);
    const reqTrend = prev7Req > 0 ? ((last7Req - prev7Req) / prev7Req) * 100 : 0;
    const last7Cost = last7.reduce((s, d) => s + d.cost, 0);
    const prev7Cost = prev7.reduce((s, d) => s + d.cost, 0);
    const costTrend = prev7Cost > 0 ? ((last7Cost - prev7Cost) / prev7Cost) * 100 : 0;
    return { totalRequests, totalCost, totalTokens, reqTrend, costTrend };
  }, [daily]);

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
      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Requisições"
          value={formatNumber(totals.totalRequests)}
          subtitle={`Últimos ${days} dias`}
          icon={Activity}
          trend={Math.abs(totals.reqTrend) > 0.5 ? { value: `${totals.reqTrend >= 0 ? '+' : ''}${totals.reqTrend.toFixed(1)}% vs sem. ant.`, positive: totals.reqTrend >= 0 } : undefined}
          sparklineData={daily.map((d) => d.requests)}
        />
        <MetricCard
          title="Custo total"
          value={formatCost(totals.totalCost)}
          subtitle={`${formatNumber(totals.totalTokens)} tokens`}
          icon={DollarSign}
          trend={Math.abs(totals.costTrend) > 0.5 ? { value: `${totals.costTrend >= 0 ? '+' : ''}${totals.costTrend.toFixed(1)}%`, positive: totals.costTrend < 0 } : undefined}
          sparklineData={daily.map((d) => d.cost)}
          sparklineColor="hsl(var(--nexus-amber))"
        />
        <MetricCard
          title="Latência p95"
          value={`${formatNumber(slo.p95)}ms`}
          subtitle={`p50 ${slo.p50}ms · p99 ${slo.p99}ms`}
          icon={Zap}
          sparklineData={daily.map((d) => d.avgLatency)}
        />
        <MetricCard
          title="Taxa de sucesso"
          value={`${slo.successRate.toFixed(1)}%`}
          subtitle={`${slo.successCount}/${slo.totalTraces} traces`}
          icon={ShieldCheck}
          trend={{ value: `${slo.errorCount} erros`, positive: slo.errorCount === 0 }}
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

        <ChartCard title="Custo por dia (USD)" subtitle="Gasto diário com modelos" icon={DollarSign}>
          {daily.some((d) => d.cost > 0) ? (
            <LightBarChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'cost', name: 'Custo', color: 'hsl(var(--nexus-amber))' }]}
              height={200}
              tooltipFormatter={(v) => formatCost(v)}
              yFormatter={(v) => v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(0)}`}
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

        <ChartCard title="Tokens por dia" subtitle="Input + output" icon={Cpu}>
          {daily.some((d) => d.tokens > 0) ? (
            <LightBarChart
              data={daily}
              xKey="label"
              series={[{ dataKey: 'tokens', name: 'Tokens', color: 'hsl(var(--primary))' }]}
              height={200}
              tooltipFormatter={(v) => `${formatNumber(v)} tokens`}
              yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
          ) : (
            <EmptyChart label="Sem consumo de tokens" />
          )}
        </ChartCard>
      </div>

      {/* SLO + status distribution */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SLOPanel targets={sloTargets} />
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
                <tr key={d.date} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
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
