import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--foreground))",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: 11, marginBottom: 4 },
};

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
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--nexus-rose, 0 84% 60%))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--nexus-rose, 0 84% 60%))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="requests" name="Requests" stroke="hsl(var(--primary))" fill="url(#gradReq)" strokeWidth={2} />
              <Area type="monotone" dataKey="errors" name="Erros" stroke="#f43f5e" fill="url(#gradErr)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Custo USD <span className="text-muted-foreground font-normal">(30 dias)</span>
        </h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [`$${value.toFixed(4)}`, "Custo"]} />
              <Bar dataKey="cost" name="Custo" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Latência média <span className="text-muted-foreground font-normal">(ms, 30 dias)</span>
        </h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradLat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
              <Tooltip {...tooltipStyle} formatter={(value: number) => [`${value}ms`, "Latência"]} />
              <Area type="monotone" dataKey="latency" name="Latência" stroke="#f59e0b" fill="url(#gradLat)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tokens */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">
          Tokens <span className="text-muted-foreground font-normal">(30 dias)</span>
        </h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip {...tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="tokensIn" name="Input" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={12} stackId="tokens" />
              <Bar dataKey="tokensOut" name="Output" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={12} stackId="tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
