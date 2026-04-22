/**
 * Nexus Agents Studio — SLO Dashboard
 * ═══════════════════════════════════════════════════════════════
 * Real-time view of Service Level Objectives.
 * Sprint 27 — Continuous Hardening.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Check, Pause, Play, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { LightAreaChart } from '@/components/charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSLOSummary, type SLOSummary } from '@/lib/slo/sloService';
import {
  SLO_TARGETS,
  errorBudgetStatus,
  latencyStatus,
  statusBg,
  statusColor,
  statusLabel,
  successRateStatus,
  type SLOStatus,
} from '@/lib/slo/sloTargets';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

/** Auto-refresh interval options (ms). 0 = disabled. */
const AUTO_REFRESH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Desligado' },
  { value: 30_000, label: '30 segundos' },
  { value: 60_000, label: '1 minuto' },
];
const AUTO_REFRESH_STORAGE_KEY = 'nexus.slo.autoRefreshMs';
const DEFAULT_AUTO_REFRESH_MS = 60_000;

function readStoredInterval(): number {
  try {
    const raw = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
    if (raw === null) return DEFAULT_AUTO_REFRESH_MS;
    const n = Number(raw);
    return AUTO_REFRESH_OPTIONS.some((o) => o.value === n) ? n : DEFAULT_AUTO_REFRESH_MS;
  } catch {
    return DEFAULT_AUTO_REFRESH_MS;
  }
}

function StatusBadge({ status }: { status: SLOStatus }) {
  const Icon = status === 'healthy' ? Check : status === 'warning' ? AlertTriangle : AlertTriangle;
  return (
    <Badge variant="outline" className={`${statusBg[status]} gap-1 font-semibold`}>
      <Icon className="h-3 w-3" />
      {statusLabel[status]}
    </Badge>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  target: string;
  status: SLOStatus;
  icon: React.ElementType;
}

function MetricCard({ title, value, target, status, icon: Icon }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${statusColor[status]}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${statusColor[status]}`}>{value}</div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">Alvo: {target}</p>
          <StatusBadge status={status} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SLODashboard() {
  const [summary, setSummary] = useState<SLOSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [windowHours, setWindowHours] = useState<number>(24);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await fetchSLOSummary(windowHours);
      setSummary(data);
    } catch (err) {
      logger.error('Failed to load SLO summary', err);
      toast.error('Erro ao carregar métricas SLO', {
        description: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowHours]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => load(false), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const isEmpty = !loading && summary && summary.total_traces === 0;

  const p95Status = summary ? latencyStatus(summary.p95_latency_ms, SLO_TARGETS.p95LatencyMs) : 'healthy';
  const p99Status = summary ? latencyStatus(summary.p99_latency_ms, SLO_TARGETS.p99LatencyMs) : 'healthy';
  const successStatus = summary ? successRateStatus(summary.success_rate) : 'healthy';
  const errorBudgetConsumed = summary && summary.total_traces > 0
    ? Math.min(((summary.error_count / summary.total_traces) * 100) / SLO_TARGETS.errorBudgetPct * 100, 999)
    : 0;
  const budgetStatus = errorBudgetStatus(errorBudgetConsumed);

  const chartData = summary?.timeseries.map((p) => ({
    time: new Date(p.bucket_hour).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    p95: p.p95_ms,
    p50: p.p50_ms,
    target: SLO_TARGETS.p95LatencyMs,
  })) ?? [];

  return (
    <div className="space-y-6 p-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text">
            SLO Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Service Level Objectives — saúde do sistema em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-ring"
            aria-label="Janela de tempo"
          >
            <option value={1}>Última 1h</option>
            <option value={6}>Últimas 6h</option>
            <option value={24}>Últimas 24h</option>
            <option value={168}>Últimos 7d</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sem dados ainda</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Execute um agente ou workflow para gerar traces — as métricas de SLO aparecerão aqui em tempo real.
            </p>
            <Button className="mt-4" onClick={() => { window.location.href = '/agents'; }}>
              Ir para Agentes
            </Button>
          </CardContent>
        </Card>
      ) : summary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Taxa de Sucesso"
              value={`${summary.success_rate.toFixed(2)}%`}
              target={`≥ ${SLO_TARGETS.successRatePct}%`}
              status={successStatus}
              icon={Check}
            />
            <MetricCard
              title="Latência P95"
              value={`${summary.p95_latency_ms}ms`}
              target={`< ${SLO_TARGETS.p95LatencyMs}ms`}
              status={p95Status}
              icon={Zap}
            />
            <MetricCard
              title="Latência P99"
              value={`${summary.p99_latency_ms}ms`}
              target={`< ${SLO_TARGETS.p99LatencyMs}ms`}
              status={p99Status}
              icon={TrendingUp}
            />
            <MetricCard
              title="Error Budget Consumido"
              value={`${errorBudgetConsumed.toFixed(1)}%`}
              target={`≤ 100%`}
              status={budgetStatus}
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Latência ao longo do tempo</CardTitle>
                <CardDescription>
                  P95 e P50 — linha pontilhada indica o alvo de {SLO_TARGETS.p95LatencyMs}ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    Sem dados temporais para esta janela
                  </div>
                ) : (
                  <LightAreaChart
                    data={chartData}
                    xKey="time"
                    height={280}
                    yFormatter={(v) => `${v}ms`}
                    tooltipFormatter={(v, name) => `${v}ms (${name})`}
                    showLegend
                    series={[
                      { dataKey: 'p95', name: 'P95', stroke: 'hsl(var(--primary))', strokeWidth: 2 },
                      { dataKey: 'p50', name: 'P50', stroke: 'hsl(var(--muted-foreground))', fill: 'transparent', strokeWidth: 1.5 },
                      { dataKey: 'target', name: `Alvo ${SLO_TARGETS.p95LatencyMs}ms`, stroke: 'hsl(var(--destructive))', fill: 'transparent', strokeWidth: 1 },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
                <CardDescription>Janela: {summary.window_hours}h</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total traces</span>
                  <span className="font-semibold tabular-nums">{summary.total_traces.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Erros</span>
                  <span className="font-semibold tabular-nums text-destructive">{summary.error_count.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P50</span>
                  <span className="font-semibold tabular-nums">{summary.p50_latency_ms}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo total</span>
                  <span className="font-semibold tabular-nums">${summary.total_cost_usd.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-semibold tabular-nums">{summary.total_tokens.toLocaleString('pt-BR')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 — Agentes com pior performance</CardTitle>
              <CardDescription>Ordenados por P95 (latência mais alta primeiro)</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.top_agents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum agente com dados suficientes nesta janela.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 font-semibold">Agente</th>
                        <th className="text-right py-2 font-semibold">Traces</th>
                        <th className="text-right py-2 font-semibold">Erros</th>
                        <th className="text-right py-2 font-semibold">Sucesso</th>
                        <th className="text-right py-2 font-semibold">P95</th>
                        <th className="text-right py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.top_agents.map((a) => {
                        const s = latencyStatus(a.p95_ms, SLO_TARGETS.p95LatencyMs);
                        return (
                          <tr key={a.agent_id} className="border-b last:border-b-0 hover:bg-secondary/30">
                            <td className="py-3 font-medium">{a.agent_name}</td>
                            <td className="text-right tabular-nums">{a.traces}</td>
                            <td className="text-right tabular-nums text-destructive">{a.errors}</td>
                            <td className="text-right tabular-nums">{(a.success_rate ?? 100).toFixed(1)}%</td>
                            <td className={`text-right tabular-nums font-semibold ${statusColor[s]}`}>{a.p95_ms}ms</td>
                            <td className="text-right"><StatusBadge status={s} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
