import { useMemo } from "react";
import { LightAreaChart, LightBarChart } from "@/components/charts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UsageRow {
  date: string;
  requests: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  total_cost_usd: number | null;
  avg_latency_ms: number | null;
  error_count: number | null;
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Requests & Errors */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Requests &amp; Erros <span className="text-muted-foreground font-normal">(30 dias)</span>
        </h3>
        <LightAreaChart
          data={chartData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          showLegend
          series={[
            { dataKey: "requests", name: "Requests", stroke: "hsl(var(--primary))", gradientFrom: "hsl(var(--primary))" },
            { dataKey: "errors", name: "Erros", stroke: "#f43f5e", gradientFrom: "#f43f5e", strokeWidth: 1.5 },
          ]}
        />
      </div>

      {/* Cost */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Custo USD <span className="text-muted-foreground font-normal">(30 dias)</span>
        </h3>
        <LightBarChart
          data={chartData}
          xKey="label"
          height={220}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          yFormatter={(v) => `$${v}`}
          tooltipFormatter={(v) => `$${v.toFixed(4)}`}
          series={[{ dataKey: "cost", name: "Custo", color: "hsl(var(--primary))", radius: 3 }]}
        />
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
