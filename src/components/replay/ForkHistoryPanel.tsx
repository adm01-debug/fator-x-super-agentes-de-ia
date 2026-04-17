/**
 * ForkHistoryPanel — shows previous forks with status, cost, and re-run actions.
 */
import { GitBranch, Loader2, CheckCircle2, XCircle, Clock, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReplayFork } from "@/services/replayForkService";

interface Props {
  forks: ReplayFork[];
  loading: boolean;
  onExecute: (forkId: string) => void;
  onDelete: (forkId: string) => void;
  onSelect: (fork: ReplayFork) => void;
  selectedId: string | null;
}

const statusConfig = {
  pending: { icon: Clock, color: "text-muted-foreground", label: "Pendente" },
  running: { icon: Loader2, color: "text-blue-500 animate-spin", label: "Executando" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Concluído" },
  failed: { icon: XCircle, color: "text-rose-500", label: "Falhou" },
} as const;

export function ForkHistoryPanel({ forks, loading, onExecute, onDelete, onSelect, selectedId }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Histórico de Forks
          <Badge variant="outline" className="ml-auto text-[10px]">{forks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          {loading && (
            <div className="p-4 text-xs text-muted-foreground">Carregando forks...</div>
          )}
          {!loading && forks.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              Nenhum fork ainda. Selecione um step e clique em <strong>Fork</strong>.
            </div>
          )}
          <div className="divide-y divide-border/40">
            {forks.map((f) => {
              const cfg = statusConfig[f.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              const selected = selectedId === f.id;
              return (
                <div
                  key={f.id}
                  className={`p-3 transition-colors ${selected ? "bg-primary/8" : "hover:bg-muted/40"}`}
                >
                  <button onClick={() => onSelect(f)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium truncate">{f.name}</span>
                      <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>step {f.fork_step_index}</span>
                      <span>·</span>
                      <span>{cfg.label}</span>
                      {f.cost_usd > 0 && <><span>·</span><span>${f.cost_usd.toFixed(4)}</span></>}
                      {f.duration_ms && <><span>·</span><span>{f.duration_ms}ms</span></>}
                    </div>
                  </button>
                  <div className="flex gap-1 mt-2">
                    {(f.status === "pending" || f.status === "failed") && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={() => onExecute(f.id)}>
                        <Play className="h-2.5 w-2.5 mr-1" /> Executar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
