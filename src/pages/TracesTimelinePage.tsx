import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, DollarSign, Filter, GitBranch, Search, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { logger } from "@/lib/logger";

type SpanRow = {
  id: string;
  agent_id: string;
  event: string;
  level: string | null;
  latency_ms: number | null;
  cost_usd: number | null;
  tokens_used: number | null;
  created_at: string;
  session_id: string | null;
  input: unknown;
  output: unknown;
  metadata: unknown;
};

type GroupedSession = {
  session_id: string;
  spans: SpanRow[];
  total_latency: number;
  total_cost: number;
  total_tokens: number;
  has_error: boolean;
  start: string;
};

const LEVEL_COLORS: Record<string, string> = {
  info: "bg-nexus-blue/15 text-nexus-blue border-nexus-blue/30",
  warning: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  debug: "bg-muted text-muted-foreground",
};

export default function TracesTimelinePage() {
  const [rows, setRows] = useState<SpanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [selected, setSelected] = useState<GroupedSession | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<SpanRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabaseExternal
          .from("agent_traces")
          .select("id,agent_id,event,level,latency_ms,cost_usd,tokens_used,created_at,session_id,input,output,metadata")
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        if (active) setRows((data as SpanRow[]) || []);
      } catch (e) {
        logger.error("Failed to load traces", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const grouped = useMemo<GroupedSession[]>(() => {
    const map = new Map<string, GroupedSession>();
    for (const r of rows) {
      const key = r.session_id ?? r.id;
      if (!map.has(key)) {
        map.set(key, { session_id: key, spans: [], total_latency: 0, total_cost: 0, total_tokens: 0, has_error: false, start: r.created_at });
      }
      const g = map.get(key)!;
      g.spans.push(r);
      g.total_latency += r.latency_ms ?? 0;
      g.total_cost += Number(r.cost_usd ?? 0);
      g.total_tokens += r.tokens_used ?? 0;
      if (r.level === "error") g.has_error = true;
      if (new Date(r.created_at) < new Date(g.start)) g.start = r.created_at;
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [rows]);

  const filtered = useMemo(() => {
    return grouped.filter((g) => {
      if (levelFilter === "errors" && !g.has_error) return false;
      if (search && !g.session_id.toLowerCase().includes(search.toLowerCase()) && !g.spans.some(s => s.event.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [grouped, search, levelFilter]);

  const maxLatency = useMemo(() => Math.max(...rows.map(r => r.latency_ms ?? 0), 1), [rows]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Traces & Observabilidade"
        description="Timeline interativa estilo LangSmith — waterfall de spans, custo por execução, replay e fork."
        icon={Activity}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Sessões</div><div className="text-2xl font-bold">{grouped.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Spans totais</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Custo total</div><div className="text-2xl font-bold">${grouped.reduce((s, g) => s + g.total_cost, 0).toFixed(4)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Erros</div><div className="text-2xl font-bold text-destructive">{grouped.filter(g => g.has_error).length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />Sessões recentes</CardTitle>
            <div className="flex gap-2 mt-2">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 pl-7 text-xs" />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="errors">Com erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading && <div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
              {!loading && filtered.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma sessão encontrada.</div>}
              <div className="divide-y divide-border/40">
                {filtered.map((g) => (
                  <button
                    key={g.session_id}
                    onClick={() => { setSelected(g); setSelectedSpan(null); }}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${selected?.session_id === g.session_id ? "bg-primary/8" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">{g.session_id.slice(0, 12)}...</span>
                      {g.has_error && <Badge variant="destructive" className="h-5 text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />ERROR</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{g.total_latency}ms</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${g.total_cost.toFixed(4)}</span>
                      <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{g.spans.length} spans</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{new Date(g.start).toLocaleString("pt-BR")}</div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Waterfall de Spans</CardTitle>
            {selected && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs"><GitBranch className="h-3 w-3 mr-1" />Fork</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">Replay</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selected && <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">Selecione uma sessão para ver a timeline</div>}
            {selected && (
              <Tabs defaultValue="waterfall">
                <TabsList className="mb-3">
                  <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
                  <TabsTrigger value="details" disabled={!selectedSpan}>Detalhes</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                </TabsList>

                <TabsContent value="waterfall" className="space-y-1.5">
                  <ScrollArea className="h-[540px]">
                    {selected.spans.map((s) => {
                      const widthPct = ((s.latency_ms ?? 0) / maxLatency) * 100;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSpan(s)}
                          className={`w-full text-left p-2 rounded-md hover:bg-muted/40 transition-colors ${selectedSpan?.id === s.id ? "bg-primary/8" : ""}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`h-5 text-[10px] ${LEVEL_COLORS[s.level ?? "info"] || ""}`}>{s.level ?? "info"}</Badge>
                              <span className="text-xs font-medium">{s.event}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{s.latency_ms ?? 0}ms · ${Number(s.cost_usd ?? 0).toFixed(5)}</span>
                          </div>
                          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.max(widthPct, 2)}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="details">
                  {selectedSpan && (
                    <div className="space-y-3 text-xs">
                      <div><div className="text-muted-foreground mb-1">Event</div><div className="font-mono">{selectedSpan.event}</div></div>
                      <div><div className="text-muted-foreground mb-1">Input</div><pre className="bg-muted/30 p-2 rounded overflow-x-auto">{JSON.stringify(selectedSpan.input, null, 2)}</pre></div>
                      <div><div className="text-muted-foreground mb-1">Output</div><pre className="bg-muted/30 p-2 rounded overflow-x-auto">{JSON.stringify(selectedSpan.output, null, 2)}</pre></div>
                      <div><div className="text-muted-foreground mb-1">Metadata</div><pre className="bg-muted/30 p-2 rounded overflow-x-auto">{JSON.stringify(selectedSpan.metadata, null, 2)}</pre></div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="raw">
                  <pre className="text-[10px] bg-muted/30 p-3 rounded overflow-auto max-h-[540px]">{JSON.stringify(selected, null, 2)}</pre>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
