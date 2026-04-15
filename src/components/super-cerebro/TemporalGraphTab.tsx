import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, TrendingUp, Calendar, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTemporalSnapshot,
  listRecentMemoryEvents,
  type TemporalWindow,
} from "@/services/temporalKnowledgeService";

const WINDOW_LABELS: Record<TemporalWindow, string> = {
  '1h': 'Última hora',
  '24h': 'Últimas 24h',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  all: 'Todo o histórico',
};

function TimelineSparkline({ buckets }: { buckets: Array<{ memories_created: number; chunks_created: number }> }) {
  if (!buckets || buckets.length === 0) return null;
  const maxVal = Math.max(
    ...buckets.map((b) => b.memories_created + b.chunks_created),
    1
  );
  const width = 700;
  const height = 100;
  const barWidth = Math.max(2, width / buckets.length - 1);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {buckets.map((b, i) => {
        const x = i * (width / buckets.length);
        const memHeight = (b.memories_created / maxVal) * (height - 10);
        const chunkHeight = (b.chunks_created / maxVal) * (height - 10);
        return (
          <g key={i}>
            <rect
              x={x}
              y={height - memHeight}
              width={barWidth}
              height={memHeight}
              fill="#9B59B6"
              fillOpacity="0.7"
              rx="1"
            />
            <rect
              x={x}
              y={height - memHeight - chunkHeight}
              width={barWidth}
              height={chunkHeight}
              fill="#4D96FF"
              fillOpacity="0.7"
              rx="1"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function TemporalGraphTab() {
  const [window, setWindow] = useState<TemporalWindow>('7d');

  const { data: snapshot, isLoading: snapLoading, refetch: refetchSnap } = useQuery({
    queryKey: ['temporal-snapshot', window],
    queryFn: () => getTemporalSnapshot(window),
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['temporal-timeline'],
    queryFn: () => listRecentMemoryEvents(30),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Temporal Knowledge Graph
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Como o conhecimento evoluiu ao longo do tempo — velocidade, frescor e timeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={window} onValueChange={(v) => setWindow(v as TemporalWindow)}>
            <SelectTrigger className="bg-secondary/50 h-8 text-xs w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WINDOW_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchSnap()} className="h-8" disabled={snapLoading}>
            {snapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Memórias</p>
          <p className="text-xl font-bold text-nexus-purple mt-1">
            {snapshot?.total_memories ?? 0}
          </p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Chunks</p>
          <p className="text-xl font-bold text-primary mt-1">
            {snapshot?.total_chunks ?? 0}
          </p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Velocidade</p>
          <p className="text-xl font-bold text-nexus-emerald mt-1 flex items-center justify-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {snapshot?.velocity_per_day ?? 0}
          </p>
          <p className="text-[10px] text-muted-foreground">/dia</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Janela</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {WINDOW_LABELS[window]}
          </p>
          <p className="text-[10px] text-muted-foreground">{snapshot?.buckets?.length ?? 0} buckets</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Atividade ao longo do tempo
          </h4>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded bg-nexus-purple" /> Memórias
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded bg-primary" /> Chunks
            </span>
          </div>
        </div>
        {snapLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (snapshot?.buckets?.length ?? 0) === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8 italic">
            Nenhum dado para esta janela
          </p>
        ) : (
          <TimelineSparkline buckets={snapshot?.buckets ?? []} />
        )}
      </div>

      {/* Recent timeline */}
      <div className="nexus-card">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Eventos Recentes ({timeline.length})
        </h4>
        {timelineLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8 italic">
            Sem eventos recentes
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {timeline.map((m: any) => {
              const memory = m as Record<string, unknown>;
              const content = String(memory.content ?? '');
              const memType = String(memory.memory_type ?? 'semantic');
              const source = String(memory.source ?? '');
              const createdAt = memory.created_at ? new Date(String(memory.created_at)) : null;
              const relevance = typeof memory.relevance_score === 'number' ? memory.relevance_score : null;
              return (
                <div
                  key={String(memory.id)}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/20"
                >
                  <div className="text-[10px] text-muted-foreground font-mono shrink-0 w-16 text-right pt-0.5">
                    {createdAt ? createdAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-2">{content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] border-border">{memType}</Badge>
                      {source && <span className="text-[10px] text-muted-foreground">{source}</span>}
                      {relevance != null && (
                        <span className="text-[10px] text-nexus-amber">
                          {(relevance * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
