/**
 * Nexus Agents Studio — SLO Dashboard
 * ═══════════════════════════════════════════════════════════════
 * Real-time view of Service Level Objectives.
 * Sprint 27 — Continuous Hardening.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, Check, Link2, RefreshCw, TrendingUp, Zap } from 'lucide-react';
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

/** Window options (hours). Used to validate the URL param. */
const WINDOW_OPTIONS = [1, 6, 24, 168] as const;
const DEFAULT_WINDOW_HOURS = 24;

// URL query param keys — short on purpose so shared links stay clean.
const QP_WINDOW = 'w';
const QP_AUTO = 'auto';
const QP_COMPARE = 'cmp';

/** Human-readable label for a window in hours. */
function windowLabel(hours: number): string {
  if (hours === 1) return '1h';
  if (hours < 24) return `${hours}h`;
  if (hours === 24) return '24h';
  if (hours === 168) return '7d';
  return `${hours}h`;
}

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

/** Parse + validate `?w=` from the URL. Falls back to the provided default. */
function parseWindowParam(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return (WINDOW_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

/** Parse + validate `?auto=` from the URL. Falls back to the provided default. */
function parseAutoParam(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return AUTO_REFRESH_OPTIONS.some((o) => o.value === n) ? n : fallback;
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
  /** Optional comparison value (raw number) for delta computation. */
  current?: number;
  previous?: number;
  /** When true, lower is better (latency). When false, higher is better (success rate). */
  lowerIsBetter?: boolean;
  /** Formatter applied to the previous value when shown. */
  formatPrev?: (n: number) => string;
  /** Label of the comparison window (e.g. "vs 7d"). */
  compareLabel?: string;
}

function formatDelta(curr: number, prev: number, lowerIsBetter: boolean): {
  pct: number;
  isImprovement: boolean;
  arrow: '↑' | '↓' | '→';
  className: string;
} {
  if (prev === 0) {
    return { pct: 0, isImprovement: true, arrow: '→', className: 'text-muted-foreground' };
  }
  const pct = ((curr - prev) / prev) * 100;
  const arrow = pct > 0.5 ? '↑' : pct < -0.5 ? '↓' : '→';
  const isImprovement = lowerIsBetter ? pct < 0 : pct > 0;
  const className =
    Math.abs(pct) < 0.5 ? 'text-muted-foreground'
      : isImprovement ? 'text-nexus-emerald'
      : 'text-destructive';
  return { pct, isImprovement, arrow, className };
}

function MetricCard({
  title, value, target, status, icon: Icon,
  current, previous, lowerIsBetter = true, formatPrev, compareLabel,
}: MetricCardProps) {
  const showDelta = current !== undefined && previous !== undefined;
  const delta = showDelta ? formatDelta(current, previous, lowerIsBetter) : null;
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
        {showDelta && delta && (
          <div
            className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]"
            title={`Comparado com ${compareLabel ?? 'janela anterior'}`}
          >
            <span className="text-muted-foreground font-mono">
              {compareLabel ?? 'anterior'}: {formatPrev ? formatPrev(previous!) : previous}
            </span>
            <span className={`font-mono font-semibold tabular-nums ${delta.className}`}>
              {delta.arrow} {Math.abs(delta.pct).toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SLODashboard() {
  // URL is the source of truth for *shareable* state (window + auto cadence).
  // localStorage stays as a per-user fallback when no param is present.
  const [searchParams, setSearchParams] = useSearchParams();

  const [summary, setSummary] = useState<SLOSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [windowHours, setWindowHours] = useState<number>(() =>
    parseWindowParam(searchParams.get(QP_WINDOW), DEFAULT_WINDOW_HOURS),
  );
  // User-controlled auto-refresh cadence. 0 = off. URL wins; otherwise fall
  // back to the persisted preference so opening the page fresh still works.
  const [autoRefreshMs, setAutoRefreshMs] = useState<number>(() =>
    parseAutoParam(searchParams.get(QP_AUTO), readStoredInterval()),
  );
  // Comparison window (0 = disabled). Encoded as `?cmp=` so a shared link
  // shows the same side-by-side view. Validated against WINDOW_OPTIONS.
  const [compareHours, setCompareHours] = useState<number>(() => {
    const raw = searchParams.get(QP_COMPARE);
    if (raw === null) return 0;
    const n = Number(raw);
    return (WINDOW_OPTIONS as readonly number[]).includes(n) ? n : 0;
  });
  const [compareSummary, setCompareSummary] = useState<SLOSummary | null>(null);

  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  // Re-renders the "X seg atrás" pill once a second without re-fetching data.
  const [, setNowTick] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── URL ⇄ state sync ───────────────────────────────────────────────────
  // Write current selections back to the URL (replace, not push, so the back
  // button doesn't fill up with intermediate values). Default values are
  // omitted to keep the URL clean; non-default values are encoded so the link
  // can be shared and reopened with the exact same view.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (windowHours === DEFAULT_WINDOW_HOURS) next.delete(QP_WINDOW);
    else next.set(QP_WINDOW, String(windowHours));

    if (autoRefreshMs === DEFAULT_AUTO_REFRESH_MS) next.delete(QP_AUTO);
    else next.set(QP_AUTO, String(autoRefreshMs));

    if (compareHours <= 0) next.delete(QP_COMPARE);
    else next.set(QP_COMPARE, String(compareHours));

    // Avoid an infinite update loop: only call setSearchParams when the
    // serialized result actually differs from what's already in the URL.
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [windowHours, autoRefreshMs, compareHours, searchParams, setSearchParams]);

  // React to back/forward navigation (or another link that mutates the URL)
  // by re-reading the params into local state.
  useEffect(() => {
    const wFromUrl = parseWindowParam(searchParams.get(QP_WINDOW), DEFAULT_WINDOW_HOURS);
    const aFromUrl = parseAutoParam(searchParams.get(QP_AUTO), autoRefreshMs);
    const cmpRaw = searchParams.get(QP_COMPARE);
    const cmpFromUrl = cmpRaw === null
      ? 0
      : ((WINDOW_OPTIONS as readonly number[]).includes(Number(cmpRaw)) ? Number(cmpRaw) : 0);
    if (wFromUrl !== windowHours) setWindowHours(wFromUrl);
    if (aFromUrl !== autoRefreshMs) setAutoRefreshMs(aFromUrl);
    if (cmpFromUrl !== compareHours) setCompareHours(cmpFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      // Fetch primary + comparison windows in parallel so the side-by-side
      // view updates atomically. If only one is selected, just await one.
      const [data, cmpData] = await Promise.all([
        fetchSLOSummary(windowHours),
        compareHours > 0 ? fetchSLOSummary(compareHours) : Promise.resolve(null),
      ]);
      if (!isMountedRef.current) return;
      setSummary(data);
      setCompareSummary(cmpData);
      setLastRefreshAt(new Date());
    } catch (err) {
      logger.error('Failed to load SLO summary', err);
      // Silent on auto-refresh — only toast on user-initiated reloads to
      // avoid spamming the operator if the backend hiccups for a beat.
      if (showSpinner) {
        toast.error('Erro ao carregar métricas SLO', {
          description: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [windowHours, compareHours]);

  // Initial load + scheduled auto-refresh. Runs invisibly (no spinner) so
  // the page doesn't flash; the manual button still shows the spinning icon.
  useEffect(() => {
    load();
    if (autoRefreshMs <= 0) return;
    const id = window.setInterval(() => {
      // Don't pile up requests in background tabs — browsers throttle the
      // interval already, but skipping when hidden also saves the API call.
      if (document.visibilityState === 'hidden') return;
      load(false);
    }, autoRefreshMs);
    return () => window.clearInterval(id);
  }, [load, autoRefreshMs]);

  // Tick the relative-time label ("há Xs") every second.
  useEffect(() => {
    if (!lastRefreshAt) return;
    const id = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [lastRefreshAt]);

  const handleAutoRefreshChange = (value: number) => {
    setAutoRefreshMs(value);
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(value));
    } catch {/* quota / privacy mode — ignore */}
    if (value > 0) {
      const label = AUTO_REFRESH_OPTIONS.find((o) => o.value === value)?.label;
      toast.success('Auto-atualização ativada', { description: `A cada ${label}` });
    } else {
      toast.info('Auto-atualização desligada');
    }
  };

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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Last-updated indicator + live pulse when auto-refresh is on */}
          {lastRefreshAt && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground"
              title={`Última atualização: ${lastRefreshAt.toLocaleString('pt-BR')}`}
            >
              {autoRefreshMs > 0 && (
                <span
                  className="relative inline-flex h-2 w-2"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-nexus-emerald opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-nexus-emerald" />
                </span>
              )}
              {(() => {
                const seconds = Math.max(0, Math.round((Date.now() - lastRefreshAt.getTime()) / 1000));
                if (seconds < 60) return `há ${seconds}s`;
                const m = Math.floor(seconds / 60);
                return `há ${m}min`;
              })()}
            </span>
          )}
          <select
            value={autoRefreshMs}
            onChange={(e) => handleAutoRefreshChange(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-ring"
            aria-label="Intervalo de auto-atualização"
            title="Atualiza SLOs e timeline automaticamente"
          >
            {AUTO_REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Auto: {o.label}
              </option>
            ))}
          </select>
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
          <select
            value={compareHours}
            onChange={(e) => setCompareHours(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-ring"
            aria-label="Janela de comparação"
            title="Compara a janela atual com outra para ver tendências"
          >
            <option value={0}>Comparar: —</option>
            {[1, 6, 24, 168]
              .filter((h) => h !== windowHours)
              .map((h) => (
                <option key={h} value={h}>
                  Comparar: {windowLabel(h)}
                </option>
              ))}
          </select>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-2">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Link copiado', { description: 'Janela e cadência preservadas na URL' });
              } catch {
                toast.error('Não foi possível copiar o link');
              }
            }}
            aria-label="Copiar link compartilhável da visualização atual"
            title="Copia URL com janela e auto-atualização preservadas"
          >
            <Link2 className="h-4 w-4" />
            <span className="ml-2 hidden md:inline">Copiar link</span>
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
