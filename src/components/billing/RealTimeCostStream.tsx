/**
 * RealTimeCostStream — Nexus Agents Studio (T18)
 *
 * Live ticker of usage_records inserts via Supabase realtime.
 * Shows running totals (cost, tokens, events) for the current session,
 * a streaming list of the last N events, and per-type aggregation.
 *
 * Pure read-only: subscribes on mount, unsubscribes on unmount.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, DollarSign, Hash, Pause, Play, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";

interface StreamEvent {
  id: string;
  record_type: string;
  tokens: number;
  cost_usd: number;
  model?: string | null;
  agent_id?: string | null;
  created_at: string;
  receivedAt: number;
}

const MAX_EVENTS = 50;

function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s atrás`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  return `${Math.floor(diff / 3_600_000)}h atrás`;
}

export function RealTimeCostStream() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0); // force re-render for relative timestamps
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Subscribe to usage_records inserts
  useEffect(() => {
    const channel = supabase
      .channel("billing-cost-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "usage_records" },
        (payload) => {
          if (pausedRef.current) return;
          const row = payload.new as Record<string, unknown>;
          const evt: StreamEvent = {
            id: String(row.id ?? `${Date.now()}-${Math.random()}`),
            record_type: String(row.record_type ?? "llm"),
            tokens: Number(row.tokens ?? 0),
            cost_usd: Number(row.cost_usd ?? 0),
            model: (row.model as string | null) ?? null,
            agent_id: (row.agent_id as string | null) ?? null,
            created_at: String(row.created_at ?? new Date().toISOString()),
            receivedAt: Date.now(),
          };
          setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        logger.info("RealTimeCostStream subscription status", { status });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tick every 5s to refresh relative timestamps
  useEffect(() => {
    const int = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(int);
  }, []);

  const totals = useMemo(() => {
    return events.reduce(
      (acc, e) => ({
        cost: acc.cost + e.cost_usd,
        tokens: acc.tokens + e.tokens,
        count: acc.count + 1,
      }),
      { cost: 0, tokens: 0, count: 0 }
    );
  }, [events]);

  const byType = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>();
    events.forEach((e) => {
      const cur = map.get(e.record_type) ?? { cost: 0, count: 0 };
      cur.cost += e.cost_usd;
      cur.count += 1;
      map.set(e.record_type, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].cost - a[1].cost);
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Header with connection state + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connected && !paused ? "animate-ping bg-emerald-400" : ""
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                paused
                  ? "bg-nexus-amber"
                  : connected
                    ? "bg-emerald-500"
                    : "bg-muted-foreground"
              }`}
            />
          </div>
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Stream em tempo real
          </h3>
          <Badge variant="outline" className="text-[10px]">
            {paused ? "PAUSADO" : connected ? "AO VIVO" : "CONECTANDO"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            className="h-7 gap-1.5 text-xs"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" /> Retomar
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" /> Pausar
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEvents([])}
            disabled={events.length === 0}
            className="h-7 gap-1.5 text-xs"
          >
            <Trash2 className="h-3 w-3" /> Limpar
          </Button>
        </div>
      </div>

      {/* Live totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="nexus-card">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Custo (sessão)
            </span>
          </div>
          <p className="text-xl font-heading font-bold text-foreground tabular-nums">
            ${totals.cost.toFixed(4)}
          </p>
        </div>
        <div className="nexus-card">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Tokens
            </span>
          </div>
          <p className="text-xl font-heading font-bold text-foreground tabular-nums">
            {totals.tokens.toLocaleString()}
          </p>
        </div>
        <div className="nexus-card">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Eventos
            </span>
          </div>
          <p className="text-xl font-heading font-bold text-foreground tabular-nums">
            {totals.count}
          </p>
        </div>
      </div>

      {/* Per-type breakdown */}
      {byType.length > 0 && (
        <div className="nexus-card">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
            Por tipo
          </h4>
          <div className="flex flex-wrap gap-2">
            {byType.map(([type, agg]) => (
              <Badge
                key={type}
                variant="outline"
                className="text-[11px] gap-1.5"
              >
                <span className="font-mono">{type}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-foreground tabular-nums">
                  ${agg.cost.toFixed(4)}
                </span>
                <span className="text-muted-foreground">
                  ({agg.count})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Event ticker */}
      <div className="nexus-card overflow-hidden p-0">
        <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Últimos eventos (máx {MAX_EVENTS})
          </h4>
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">
              Aguardando eventos de uso...
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Eventos aparecerão aqui assim que agentes consumirem tokens.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-2 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2 font-medium">Modelo</th>
                  <th className="text-right px-4 py-2 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2 font-medium">Custo</th>
                  <th className="text-right px-4 py-2 font-medium">Quando</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, idx) => (
                  <tr
                    key={e.id}
                    className={`border-b border-border/30 hover:bg-secondary/30 transition-colors ${
                      idx === 0 ? "animate-pulse-once bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {e.record_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                      {e.model ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-foreground tabular-nums">
                      {e.tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-foreground tabular-nums">
                      ${e.cost_usd.toFixed(6)}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] text-muted-foreground">
                      {formatRelative(e.receivedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RealTimeCostStream;
