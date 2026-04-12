import { useMemo, useState } from "react";
import { LightAreaChart, LightBarChart, ComparisonToggle, generateComparisonData } from "@/components/charts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UsageRow {
  date: string;
  requests: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  total_cost_usd: number | null;
  avg_latency_ms: number | null;
  error_count?: number | null;
}

interface UsageChartsProps {
  data: UsageRow[];
}

function buildDailyMap(data: UsageRow[]) {
  const map = new Map<string, {
    requests: number;
    tokensIn: number;
    tokensOut: number;
    cost: number;
    latency: number;
    latencyCount: number;
    errors: number;
  }>();

  for (const row of data) {
    const key = row.date;
    const existing = map.get(key) ?? { requests: 0, tokensIn: 0, tokensOut: 0, cost: 0, latency: 0, latencyCount: 0, errors: 0 };
    existing.requests += row.requests ?? 0;
    existing.tokensIn += row.tokens_input ?? 0;
    existing.tokensOut += row.tokens_output ?? 0;
    existing.cost += Number(row.total_cost_usd ?? 0);
    if (row.avg_latency_ms) {
      existing.latency += row.avg_latency_ms;
      existing.latencyCount += 1;
    }
    existing.errors += row.error_count ?? 0;
    map.set(key, existing);
  }

  return map;
}

export function UsageCharts({ data }: UsageChartsProps) {
  const [compareRequests, setCompareRequests] = useState(false);
  const [compareCost, setCompareCost] = useState(false);

  const chartData = useMemo(() => {
    const today = new Date();
    const start = subDays(today, 29);
    const days = eachDayOfInterval({ start, end: today });
    const map = buildDailyMap(data);

    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const entry = map.get(key);
      return {
        date: key,
        label: format(d, "dd MMM", { locale: ptBR }),
        requests: entry?.requests ?? 0,
        tokensIn: entry?.tokensIn ?? 0,
        tokensOut: entry?.tokensOut ?? 0,
        cost: Number((entry?.cost ?? 0).toFixed(4)),
        latency: entry?.latencyCount ? Math.round(entry.latency / entry.latencyCount) : 0,
        errors: entry?.errors ?? 0,
      };
    });
  }, [data]);

  // Comparison data: shift 15 days back
  const requestsData = useMemo(
    () => compareRequests ? generateComparisonData(chartData, ['requests'], 15) : chartData,
    [chartData, compareRequests]
  );

  const costData = useMemo(
    () => compareCost ? generateComparisonData(chartData, ['cost'], 15) : chartData,
    [chartData, compareCost]
  );

  // Auto-detect peak day for annotation
  const peakRequestIdx = useMemo(() => {
    let maxIdx = 0, maxVal = 0;
    chartData.forEach((d, i) => {
      if (d.requests > maxVal) { maxVal = d.requests; maxIdx = i; }
    });
    return maxVal > 0 ? maxIdx : -1;
  }, [chartData]);

  const peakCostIdx = useMemo(() => {
    let maxIdx = 0, maxVal = 0;
    chartData.forEach((d, i) => {
      if (d.cost > maxVal) { maxVal = d.cost; maxIdx = i; }
    });
    return maxVal > 0 ? maxIdx : -1;
  }, [chartData]);

  const hasData = data.length > 0 && chartData.some(d => d.requests > 0 || d.cost > 0);

  if (!hasData) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {['Requests & Erros', 'Custo USD', 'Latência média', 'Tokens'].map(title => (
          <div key={title} className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
              {title} <span className="text-muted-foreground font-normal">(30 dias)</span>
            </h3>
            <div className="flex flex-col items-center justify-center h-[220px] text-center">
              <div className="h-12 w-12 rounded-xl bg-muted/20 flex items-center justify-center mb-3">
                <span className="text-2xl opacity-40" aria-hidden="true">📊</span>
              </div>
              <p className="text-sm text-muted-foreground">Sem dados neste período</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Os dados aparecerão quando seus agentes processarem requisições</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Requests & Errors */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Requests &amp; Erros <span className="text-muted-foreground font-normal">(30 dias)</span>
          </h3>
          <ComparisonToggle enabled={compareRequests} onToggle={setCompareRequests} label="vs anterior" />
        </div>
        <LightAreaChart
          data={requestsData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          showLegend
          series={[
            { dataKey: "requests", name: "Requests", stroke: "hsl(var(--primary))", gradientFrom: "hsl(var(--primary))" },
            { dataKey: "errors", name: "Erros", stroke: "#f43f5e", gradientFrom: "#f43f5e", strokeWidth: 1.5 },
            ...(compareRequests ? [{ dataKey: "prev_requests", name: "Anterior", stroke: "hsl(var(--muted-foreground))", gradientFrom: "hsl(var(--muted-foreground))", strokeWidth: 1 }] : []),
          ]}
        />
        {peakRequestIdx >= 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            Pico: {chartData[peakRequestIdx]?.label} ({chartData[peakRequestIdx]?.requests} requests)
          </p>
        )}
      </div>

      {/* Cost */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Custo USD <span className="text-muted-foreground font-normal">(30 dias)</span>
          </h3>
          <ComparisonToggle enabled={compareCost} onToggle={setCompareCost} label="vs anterior" />
        </div>
        <LightBarChart
          data={costData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          yFormatter={(v) => `$${v}`}
          tooltipFormatter={(v) => `$${v.toFixed(4)}`}
          showLegend={compareCost}
          series={[
            { dataKey: "cost", name: "Custo", color: "hsl(var(--primary))", radius: 3 },
            ...(compareCost ? [{ dataKey: "prev_cost", name: "Anterior", color: "hsl(var(--muted-foreground))", radius: 3 }] : []),
          ]}
        />
        {peakCostIdx >= 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-nexus-amber" />
            Pico: {chartData[peakCostIdx]?.label} (${chartData[peakCostIdx]?.cost})
          </p>
        )}
      </div>

      {/* Latency */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Latência média <span className="text-muted-foreground font-normal">(ms, 30 dias)</span>
        </h3>
        <LightAreaChart
          data={chartData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          yFormatter={(v) => `${v}ms`}
          tooltipFormatter={(v) => `${v}ms`}
          series={[
            { dataKey: "latency", name: "Latência", stroke: "#f59e0b", gradientFrom: "#f59e0b" },
          ]}
        />
      </div>

      {/* Tokens */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Tokens <span className="text-muted-foreground font-normal">(30 dias)</span>
        </h3>
        <LightBarChart
          data={chartData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          yFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          showLegend
          series={[
            { dataKey: "tokensIn", name: "Input", color: "hsl(var(--primary))", radius: 3, stackId: "tokens" },
            { dataKey: "tokensOut", name: "Output", color: "#8b5cf6", radius: 3, stackId: "tokens" },
          ]}
        />
      </div>
    </div>
  );
}
