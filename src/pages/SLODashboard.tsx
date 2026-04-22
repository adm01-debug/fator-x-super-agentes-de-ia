/**
 * Nexus Agents Studio — SLO Dashboard
 * ═══════════════════════════════════════════════════════════════
 * Real-time view of Service Level Objectives.
 * Sprint 27 — Continuous Hardening.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
const QP_FAILURE_MODES = 'fm';

/**
 * Failure modes that count toward "violations" in the timeline.
 * - `error`    → bucket has any traces with level=error
 * - `critical` → bucket P95 exceeds the P99 target (severe latency outliers)
 * - `latency`  → bucket P95 exceeds the P95 target
 * Tool-failure granularity isn't exposed by `get_slo_summary` yet, so we
 * deliberately omit it instead of showing a filter that does nothing.
 */
type FailureMode = 'error' | 'critical' | 'latency';
const ALL_FAILURE_MODES: readonly FailureMode[] = ['error', 'critical', 'latency'] as const;
const FAILURE_MODE_META: Record<FailureMode, { label: string; description: string }> = {
  error:    { label: 'Erros',    description: 'Buckets com pelo menos 1 trace com level=error' },
  critical: { label: 'Crítico',  description: 'P95 do bucket excede o alvo de P99 (outliers severos)' },
  latency:  { label: 'Latência', description: 'P95 do bucket excede o alvo de P95' },
};

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

  // Failure-mode filters for the timeline. Each toggle controls which kind of
  // bucket is *highlighted* as a violation and counted in the violation total.
  // Persisted in URL as `?fm=` (comma-separated) so a shared link reproduces
  // the same view. `tool` is intentionally disabled — the SLO RPC doesn't yet
  // break tool failures out of the generic `error` level.
  const [failureModes, setFailureModes] = useState<Set<FailureMode>>(() => {
    const raw = searchParams.get(QP_FAILURE_MODES);
    if (raw === null) return new Set(ALL_FAILURE_MODES);
    const picked = raw.split(',').filter((m): m is FailureMode =>
      (ALL_FAILURE_MODES as readonly string[]).includes(m),
    );
    return picked.length ? new Set(picked) : new Set(ALL_FAILURE_MODES);
  });
  const toggleFailureMode = useCallback((mode: FailureMode) => {
    setFailureModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      // Always keep at least one selected to avoid an empty chart.
      if (next.size === 0) return prev;
      return next;
    });
  }, []);

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

    // Failure-mode filters: omit when "all selected" (default), otherwise
    // serialize as a stable comma-separated list so URLs are deterministic.
    const fmArr = ALL_FAILURE_MODES.filter((m) => failureModes.has(m));
    if (fmArr.length === ALL_FAILURE_MODES.length) next.delete(QP_FAILURE_MODES);
    else next.set(QP_FAILURE_MODES, fmArr.join(','));

    // Avoid an infinite update loop: only call setSearchParams when the
    // serialized result actually differs from what's already in the URL.
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [windowHours, autoRefreshMs, compareHours, failureModes, searchParams, setSearchParams]);

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

    const fmRaw = searchParams.get(QP_FAILURE_MODES);
    const fmFromUrl = fmRaw === null
      ? new Set<FailureMode>(ALL_FAILURE_MODES)
      : new Set<FailureMode>(
          fmRaw.split(',').filter((m): m is FailureMode =>
            (ALL_FAILURE_MODES as readonly string[]).includes(m),
          ),
        );
    if (fmFromUrl.size > 0) {
      const sameMembers = fmFromUrl.size === failureModes.size
        && [...fmFromUrl].every((m) => failureModes.has(m));
      if (!sameMembers) setFailureModes(fmFromUrl);
    }
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

  /**
   * Classify a single timeseries bucket against the active failure-mode set.
   * A bucket counts as a "violation" when it triggers at least one selected
   * failure mode. We expose the matched modes so the chart can color-tag them.
   */
  const classifyBucket = useCallback((p: { errors: number; p95_ms: number }): FailureMode[] => {
    const matched: FailureMode[] = [];
    if (failureModes.has('error') && p.errors > 0) matched.push('error');
    if (failureModes.has('critical') && p.p95_ms > SLO_TARGETS.p99LatencyMs) matched.push('critical');
    if (failureModes.has('latency') && p.p95_ms > SLO_TARGETS.p95LatencyMs) matched.push('latency');
    return matched;
  }, [failureModes]);

  const chartData = summary?.timeseries.map((p) => ({
    time: new Date(p.bucket_hour).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    p95: p.p95_ms,
    p50: p.p50_ms,
    target: SLO_TARGETS.p95LatencyMs,
  })) ?? [];

  // Total violation buckets under the current filter — surfaced in the
  // comparison table and the timeline header chip.
  const filteredViolations = (summary?.timeseries ?? []).filter(
    (p) => classifyBucket(p).length > 0,
  ).length;
  const filteredViolationsCompare = (compareSummary?.timeseries ?? []).filter(
    (p) => classifyBucket(p).length > 0,
  ).length;

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Atualizar dados manualmente"
          >
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
              current={summary.success_rate}
              previous={compareSummary?.success_rate}
              lowerIsBetter={false}
              formatPrev={(n) => `${n.toFixed(2)}%`}
              compareLabel={compareSummary ? `vs ${windowLabel(compareHours)}` : undefined}
            />
            <MetricCard
              title="Latência P95"
              value={`${summary.p95_latency_ms}ms`}
              target={`< ${SLO_TARGETS.p95LatencyMs}ms`}
              status={p95Status}
              icon={Zap}
              current={summary.p95_latency_ms}
              previous={compareSummary?.p95_latency_ms}
              lowerIsBetter
              formatPrev={(n) => `${n}ms`}
              compareLabel={compareSummary ? `vs ${windowLabel(compareHours)}` : undefined}
            />
            <MetricCard
              title="Latência P99"
              value={`${summary.p99_latency_ms}ms`}
              target={`< ${SLO_TARGETS.p99LatencyMs}ms`}
              status={p99Status}
              icon={TrendingUp}
              current={summary.p99_latency_ms}
              previous={compareSummary?.p99_latency_ms}
              lowerIsBetter
              formatPrev={(n) => `${n}ms`}
              compareLabel={compareSummary ? `vs ${windowLabel(compareHours)}` : undefined}
            />
            <MetricCard
              title="Error Budget Consumido"
              value={`${errorBudgetConsumed.toFixed(1)}%`}
              target={`≤ 100%`}
              status={budgetStatus}
              icon={AlertTriangle}
              current={errorBudgetConsumed}
              previous={compareSummary && compareSummary.total_traces > 0
                ? Math.min(((compareSummary.error_count / compareSummary.total_traces) * 100) / SLO_TARGETS.errorBudgetPct * 100, 999)
                : undefined}
              lowerIsBetter
              formatPrev={(n) => `${n.toFixed(1)}%`}
              compareLabel={compareSummary ? `vs ${windowLabel(compareHours)}` : undefined}
            />
          </div>

          {/* Drill-down — only meaningful when a comparison window is selected,
              because "contribution to delta" needs a baseline. We surface the
              3 buckets/agents that pulled each KPI hardest, with deep links
              into the trace explorer scoped to that hour or that agent. */}
          {compareSummary && (() => {
            const buckets = summary.timeseries ?? [];
            // Per-bucket trace URL — TracesTimelinePage doesn't yet read these
            // params, but we set a stable contract so the deep links keep working
            // once the page is wired to filter by from/to/agent.
            const bucketHref = (iso: string) => {
              const from = new Date(iso);
              const to = new Date(from.getTime() + 60 * 60 * 1000);
              const qp = new URLSearchParams({
                from: from.toISOString(),
                to: to.toISOString(),
              });
              return `/traces?${qp.toString()}`;
            };
            const fmtBucketLabel = (iso: string) => {
              const d = new Date(iso);
              return d.toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              });
            };

            // Average baseline from comparison window — represents "normal"
            // behavior. Buckets are scored by absolute distance from baseline
            // (signed so we can show whether they pushed the metric up/down).
            const cmpBuckets = compareSummary.timeseries ?? [];
            const baselineP95 = cmpBuckets.length
              ? cmpBuckets.reduce((s, b) => s + b.p95_ms, 0) / cmpBuckets.length
              : 0;
            const baselineErrors = cmpBuckets.length
              ? cmpBuckets.reduce((s, b) => s + b.errors, 0) / cmpBuckets.length
              : 0;

            type Contributor = {
              key: string;
              label: string;
              detail: string;
              delta: number;
              deltaLabel: string;
              href: string;
              worse: boolean;
            };

            // Top 3 buckets that drove P95 the hardest (absolute deviation
            // from comparison baseline). Sign tells us if it's regression.
            const topLatency: Contributor[] = [...buckets]
              .map((b) => ({
                bucket: b,
                delta: b.p95_ms - baselineP95,
              }))
              .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
              .slice(0, 3)
              .map((row) => ({
                key: row.bucket.bucket_hour,
                label: fmtBucketLabel(row.bucket.bucket_hour),
                detail: `P95 ${row.bucket.p95_ms}ms · ${row.bucket.total} traces`,
                delta: row.delta,
                deltaLabel: `${row.delta > 0 ? '+' : ''}${Math.round(row.delta)}ms vs baseline`,
                href: bucketHref(row.bucket.bucket_hour),
                worse: row.delta > 0,
              }));

            // Top 3 buckets contributing the most errors above baseline.
            const topErrors: Contributor[] = [...buckets]
              .filter((b) => b.errors > 0)
              .map((b) => ({ bucket: b, delta: b.errors - baselineErrors }))
              .sort((a, b) => b.delta - a.delta)
              .slice(0, 3)
              .map((row) => ({
                key: row.bucket.bucket_hour,
                label: fmtBucketLabel(row.bucket.bucket_hour),
                detail: `${row.bucket.errors} erros em ${row.bucket.total} traces`,
                delta: row.delta,
                deltaLabel: `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(1)} vs média`,
                href: bucketHref(row.bucket.bucket_hour),
                worse: row.delta > 0,
              }));

            // Top 3 agents pulling P95 up — straight from the RPC's top_agents.
            const topAgents: Contributor[] = (summary.top_agents ?? [])
              .slice(0, 3)
              .map((a) => ({
                key: a.agent_id,
                label: a.agent_name,
                detail: `${a.traces} traces · ${a.errors} erros · ${(a.success_rate ?? 100).toFixed(1)}% sucesso`,
                delta: a.p95_ms,
                deltaLabel: `P95 ${a.p95_ms}ms`,
                href: `/agents/${a.agent_id}/traces`,
                worse: a.p95_ms > SLO_TARGETS.p95LatencyMs,
              }));

            const sections: Array<{ title: string; kpi: string; rows: Contributor[]; empty: string }> = [
              { title: 'Latência (P95)', kpi: 'P95', rows: topLatency, empty: 'Sem buckets com latência registrada.' },
              { title: 'Erros', kpi: 'erros', rows: topErrors, empty: 'Nenhum bucket com erros nesta janela.' },
              { title: 'Agentes', kpi: 'agentes', rows: topAgents, empty: 'Nenhum agente com tráfego nesta janela.' },
            ];

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Drill-down do delta
                  </CardTitle>
                  <CardDescription>
                    Top 3 contribuintes para cada KPI vs. baseline de {windowLabel(compareHours)}.
                    Clique em um item para abrir os traces relacionados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  {sections.map((section) => (
                    <div key={section.title} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                          {section.title}
                        </h4>
                        <Badge variant="outline" className="text-[10px]">{section.kpi}</Badge>
                      </div>
                      {section.rows.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic py-3">{section.empty}</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {section.rows.map((row, idx) => (
                            <li key={row.key}>
                              <Link
                                to={row.href}
                                className="flex items-start gap-2 p-2 rounded-md border border-border/40 bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-colors group focus-ring"
                                title={`Abrir traces: ${row.label}`}
                              >
                                <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-4 mt-0.5">
                                  #{idx + 1}
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-xs font-medium text-foreground truncate group-hover:text-primary">
                                    {row.label}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground truncate">
                                    {row.detail}
                                  </span>
                                  <span className={`block text-[10px] font-mono font-semibold mt-0.5 ${
                                    row.worse ? 'text-destructive' : 'text-nexus-emerald'
                                  }`}>
                                    {row.deltaLabel}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {(() => {
            const buckets = summary.timeseries ?? [];
            // RPC buckets are hourly; expected = window hours.
            const expectedBuckets = Math.max(1, windowHours);
            const bucketsWithData = buckets.filter((b) => (b.total ?? 0) > 0).length;
            const coveragePct = Math.min(100, (bucketsWithData / expectedBuckets) * 100);
            const missingBuckets = Math.max(0, expectedBuckets - bucketsWithData);
            const tracesPerHour = summary.total_traces / expectedBuckets;
            const coverageStatus: SLOStatus =
              coveragePct >= 90 ? 'healthy' : coveragePct >= 60 ? 'warning' : 'breached';
            const coverageColor =
              coverageStatus === 'healthy' ? 'bg-nexus-emerald'
                : coverageStatus === 'warning' ? 'bg-nexus-amber'
                : 'bg-destructive';
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Cobertura dos dados
                  </CardTitle>
                  <CardDescription>
                    Quantos traces e qual fração do período de {windowLabel(windowHours)} foi efetivamente usada no cálculo. Lacunas indicam dados faltantes — as métricas podem estar enviesadas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-border/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Traces analisados</p>
                      <p className="text-2xl font-bold tabular-nums mt-1">{summary.total_traces.toLocaleString('pt-BR')}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        ~{tracesPerHour.toFixed(tracesPerHour < 10 ? 1 : 0)}/h em média
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Cobertura temporal</p>
                      <p className={`text-2xl font-bold tabular-nums mt-1 ${statusColor[coverageStatus]}`}>
                        {coveragePct.toFixed(1)}%
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {bucketsWithData}/{expectedBuckets} janelas horárias com dados
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Lacunas</p>
                      <p className="text-2xl font-bold tabular-nums mt-1">{missingBuckets}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {missingBuckets === 0 ? 'sem horas vazias' : `hora${missingBuckets > 1 ? 's' : ''} sem traces`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Confiança</p>
                      <p className={`text-2xl font-bold mt-1 ${statusColor[coverageStatus]}`}>
                        {coverageStatus === 'healthy' ? 'Alta' : coverageStatus === 'warning' ? 'Média' : 'Baixa'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        baseada na cobertura
                      </p>
                    </div>
                  </div>

                  {/* Visual bar — proportion of buckets with data. */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Janela de {windowLabel(windowHours)}</span>
                      <span className="font-mono tabular-nums">
                        {bucketsWithData} de {expectedBuckets} buckets
                      </span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full bg-secondary/40 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Number(coveragePct.toFixed(1))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Cobertura temporal dos dados"
                    >
                      <div
                        className={`h-full ${coverageColor} transition-all`}
                        style={{ width: `${coveragePct}%` }}
                      />
                    </div>
                  </div>

                  {missingBuckets > 0 && (
                    <div className="flex items-start gap-2 text-[11px] p-2.5 rounded-md bg-nexus-amber/10 border border-nexus-amber/20 text-nexus-amber">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>
                        {missingBuckets} {missingBuckets > 1 ? 'horas não tiveram traces' : 'hora não teve traces'} no período.
                        Os percentis (P50/P95/P99) refletem apenas as {bucketsWithData} {bucketsWithData > 1 ? 'horas com atividade' : 'hora com atividade'} —
                        considere ampliar a janela ou verificar a ingestão se a lacuna for inesperada.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {compareSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Comparação: {windowLabel(windowHours)} vs {windowLabel(compareHours)}
                </CardTitle>
                <CardDescription>
                  Lado a lado — latências, erros e violações entre as duas janelas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 font-semibold">Métrica</th>
                        <th className="text-right py-2 font-semibold">{windowLabel(windowHours)} (atual)</th>
                        <th className="text-right py-2 font-semibold">{windowLabel(compareHours)}</th>
                        <th className="text-right py-2 font-semibold">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        { label: 'P50 (latência)', curr: summary.p50_latency_ms, prev: compareSummary.p50_latency_ms, suffix: 'ms', lowerBetter: true },
                        { label: 'P95 (latência)', curr: summary.p95_latency_ms, prev: compareSummary.p95_latency_ms, suffix: 'ms', lowerBetter: true },
                        { label: 'P99 (latência)', curr: summary.p99_latency_ms, prev: compareSummary.p99_latency_ms, suffix: 'ms', lowerBetter: true },
                        { label: 'Taxa de sucesso', curr: summary.success_rate, prev: compareSummary.success_rate, suffix: '%', lowerBetter: false, decimals: 2 },
                        { label: 'Total de traces', curr: summary.total_traces, prev: compareSummary.total_traces, suffix: '', lowerBetter: false },
                        { label: 'Erros', curr: summary.error_count, prev: compareSummary.error_count, suffix: '', lowerBetter: true },
                        {
                          label: `Violações (${[...failureModes].map((m) => FAILURE_MODE_META[m].label.toLowerCase()).join(' + ')})`,
                          curr: filteredViolations,
                          prev: filteredViolationsCompare,
                          suffix: '',
                          lowerBetter: true,
                        },
                        { label: 'Custo total', curr: summary.total_cost_usd, prev: compareSummary.total_cost_usd, suffix: '', prefix: '$', lowerBetter: true, decimals: 4 },
                        { label: 'Tokens', curr: summary.total_tokens, prev: compareSummary.total_tokens, suffix: '', lowerBetter: true },
                      ] as Array<{ label: string; curr: number; prev: number; suffix: string; prefix?: string; lowerBetter: boolean; decimals?: number }>).map((row) => {
                        const fmt = (n: number) =>
                          `${row.prefix ?? ''}${row.decimals !== undefined ? n.toFixed(row.decimals) : n.toLocaleString('pt-BR')}${row.suffix}`;
                        const d = formatDelta(row.curr, row.prev, row.lowerBetter);
                        return (
                          <tr key={row.label} className="border-b last:border-b-0 hover:bg-secondary/30">
                            <td className="py-2.5 font-medium">{row.label}</td>
                            <td className="text-right tabular-nums font-semibold">{fmt(row.curr)}</td>
                            <td className="text-right tabular-nums text-muted-foreground">{fmt(row.prev)}</td>
                            <td className={`text-right tabular-nums font-mono font-semibold ${d.className}`}>
                              {d.arrow} {Math.abs(d.pct).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights detalhados — evidências numéricas com indicadores de
              tendência. Métricas derivadas (custo/req, tokens/req, taxa de
              erro normalizada) são calculadas client-side a partir dos
              agregados do RPC para evitar alterações de schema. */}
          {(() => {
            const cmp = compareSummary;
            const safeRate = (n: number, d: number) => (d > 0 ? n / d : 0);

            const costPerReq = safeRate(summary.total_cost_usd, summary.total_traces);
            const tokensPerReq = safeRate(summary.total_tokens, summary.total_traces);
            const errorRate = safeRate(summary.error_count, summary.total_traces) * 100;
            const tailSpread = summary.p99_latency_ms - summary.p95_latency_ms;

            const cmpCostPerReq = cmp ? safeRate(cmp.total_cost_usd, cmp.total_traces) : undefined;
            const cmpTokensPerReq = cmp ? safeRate(cmp.total_tokens, cmp.total_traces) : undefined;
            const cmpErrorRate = cmp ? safeRate(cmp.error_count, cmp.total_traces) * 100 : undefined;
            const cmpTailSpread = cmp ? cmp.p99_latency_ms - cmp.p95_latency_ms : undefined;

            type Trend = ReturnType<typeof formatDelta>;
            const trend = (curr: number, prev: number | undefined, lowerIsBetter: boolean): Trend | null =>
              prev === undefined ? null : formatDelta(curr, prev, lowerIsBetter);

            const rows: Array<{
              label: string;
              value: string;
              prevValue?: string;
              prevLabel?: string;
              trend: Trend | null;
              hint: string;
            }> = [
              {
                label: 'P99 (cauda extrema)',
                value: `${summary.p99_latency_ms}ms`,
                prevValue: cmp ? `${cmp.p99_latency_ms}ms` : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(summary.p99_latency_ms, cmp?.p99_latency_ms, true),
                hint: 'Latência sentida pelos 1% piores casos. Spikes aqui indicam outliers críticos.',
              },
              {
                label: 'Spread P95 → P99',
                value: `${tailSpread}ms`,
                prevValue: cmp ? `${cmpTailSpread}ms` : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(tailSpread, cmpTailSpread, true),
                hint: 'Diferença entre P95 e P99. Spread grande = poucos requests dominam a cauda.',
              },
              {
                label: 'Taxa de erro (level=error)',
                value: `${errorRate.toFixed(2)}%`,
                prevValue: cmpErrorRate !== undefined ? `${cmpErrorRate.toFixed(2)}%` : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(errorRate, cmpErrorRate, true),
                hint: `${summary.error_count} de ${summary.total_traces.toLocaleString('pt-BR')} traces. Granularidade por nível (warn/critical/tool) requer extensão do RPC.`,
              },
              {
                label: 'Custo médio por requisição',
                value: `$${costPerReq.toFixed(6)}`,
                prevValue: cmpCostPerReq !== undefined ? `$${cmpCostPerReq.toFixed(6)}` : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(costPerReq, cmpCostPerReq, true),
                hint: `Total $${summary.total_cost_usd.toFixed(4)} ÷ ${summary.total_traces.toLocaleString('pt-BR')} traces.`,
              },
              {
                label: 'Tokens médios por requisição',
                value: tokensPerReq.toFixed(0),
                prevValue: cmpTokensPerReq !== undefined ? cmpTokensPerReq.toFixed(0) : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(tokensPerReq, cmpTokensPerReq, true),
                hint: `Total ${summary.total_tokens.toLocaleString('pt-BR')} tokens ÷ ${summary.total_traces.toLocaleString('pt-BR')} traces.`,
              },
              {
                label: 'Taxa de sucesso',
                value: `${summary.success_rate.toFixed(2)}%`,
                prevValue: cmp ? `${cmp.success_rate.toFixed(2)}%` : undefined,
                prevLabel: cmp ? `vs ${windowLabel(compareHours)}` : undefined,
                trend: trend(summary.success_rate, cmp?.success_rate, false),
                hint: `Alvo SLO ≥ ${SLO_TARGETS.successRatePct}%. Inverte a taxa de erro: 100 − error_rate.`,
              },
            ];

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Insights detalhados — evidências numéricas
                  </CardTitle>
                  <CardDescription>
                    Métricas derivadas com {cmp ? `tendência vs. ${windowLabel(compareHours)}` : 'valores atuais (ative comparação para ver tendências)'}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {rows.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-lg border border-border/40 bg-secondary/10 p-3 hover:bg-secondary/30 transition-colors"
                        title={row.hint}
                      >
                        <p className="text-[11px] uppercase text-muted-foreground tracking-wide">
                          {row.label}
                        </p>
                        <div className="flex items-baseline justify-between gap-2 mt-1">
                          <p className="text-xl font-bold tabular-nums">{row.value}</p>
                          {row.trend && (
                            <span
                              className={`text-xs font-mono font-semibold tabular-nums ${row.trend.className}`}
                              aria-label={`Variação de ${Math.abs(row.trend.pct).toFixed(1)} por cento`}
                            >
                              {row.trend.arrow} {Math.abs(row.trend.pct).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        {row.prevValue && (
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {row.prevLabel}: <span className="tabular-nums">{row.prevValue}</span>
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/80 mt-2 leading-snug">
                          {row.hint}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle>Latência ao longo do tempo</CardTitle>
                    <CardDescription>
                      P95 e P50 — linha pontilhada indica o alvo de {SLO_TARGETS.p95LatencyMs}ms.
                      {' '}
                      <span className="font-medium text-foreground">
                        {filteredViolations} {filteredViolations === 1 ? 'violação' : 'violações'}
                      </span>
                      {' '}sob o filtro atual.
                    </CardDescription>
                  </div>
                </div>
                {/* Failure-mode filters: choose which signals count as a
                    violation in the timeline + comparison table. */}
                <div className="flex items-center gap-2 flex-wrap pt-2">
                  <span className="text-[11px] uppercase text-muted-foreground tracking-wide">
                    Tipos de falha:
                  </span>
                  {ALL_FAILURE_MODES.map((mode) => {
                    const active = failureModes.has(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => toggleFailureMode(mode)}
                        title={FAILURE_MODE_META[mode].description}
                        aria-pressed={active}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors focus-ring ${
                          active
                            ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                            : 'bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/60'
                        }`}
                      >
                        {FAILURE_MODE_META[mode].label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled
                    title="Granularidade de falhas de ferramentas requer extensão do RPC get_slo_summary — em breve."
                    className="px-2.5 py-1 text-xs rounded-full border border-dashed border-border text-muted-foreground/60 cursor-not-allowed"
                  >
                    Tool failures (em breve)
                  </button>
                </div>
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
