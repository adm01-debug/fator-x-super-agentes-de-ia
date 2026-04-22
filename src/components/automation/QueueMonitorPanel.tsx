import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListOrdered, Loader2, Play } from 'lucide-react';
import {
  listQueues,
  runQueueWorker,
  QUEUE_PRESETS,
  type QueueDefinition,
} from '@/services/queueManagerService';
import { useToast } from '@/hooks/use-toast';

const STRATEGY_LABELS: Record<string, string> = {
  fifo: 'FIFO',
  lifo: 'LIFO',
  priority: 'Prioridade',
};

export function QueueMonitorPanel() {
  const [queues, setQueues] = useState<QueueDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadQueues = async () => {
    try {
      const data = await listQueues();
      setQueues(data);
    } catch {
      toast({ title: 'Erro ao carregar filas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunWorker = async (q: QueueDefinition) => {
    setRunningId(q.id);
    try {
      const result = await runQueueWorker({ queue_id: q.id, batch_size: 10 });
      const summary = result.results?.[0];
      toast({
        title: 'Worker executado',
        description: summary
          ? `${q.name}: ${summary.items_processed} processados (${summary.successes} ok, ${summary.failures} falhas)`
          : `${q.name} drenada`,
      });
      await loadQueues();
    } catch (e) {
      toast({
        title: 'Falha ao executar worker',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">Presets de Fila</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(QUEUE_PRESETS).map(([key, preset]) => (
              <div
                key={key}
                className="p-3 rounded-lg bg-background border border-border hover:border-destructive/50 cursor-pointer"
              >
                <p className="font-medium text-sm">{preset.name}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{preset.description}</p>
                <div className="flex gap-1 mt-2">
                  <Badge variant="outline" className="text-[10px] border-border">
                    {STRATEGY_LABELS[preset.strategy ?? 'fifo']}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border">
                    {preset.max_concurrency} threads
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando filas...</div>
      ) : queues.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListOrdered size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhuma fila criada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queues.map((q) => (
            <Card key={q.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListOrdered size={16} className="text-destructive" />
                    <p className="font-medium">{q.name}</p>
                    <Badge variant="outline" className="text-[10px] border-border">
                      {STRATEGY_LABELS[q.strategy]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        q.is_paused
                          ? 'bg-nexus-amber/20 text-nexus-amber'
                          : 'bg-nexus-emerald/20 text-nexus-emerald'
                      }
                    >
                      {q.is_paused ? 'Pausada' : 'Ativa'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-border hover:bg-accent hover:border-destructive"
                      disabled={runningId === q.id || q.is_paused || q.current_size === 0}
                      onClick={() => handleRunWorker(q)}
                    >
                      {runningId === q.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run Worker
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center text-xs">
                  <div>
                    <p className="text-lg font-bold text-primary">{q.current_size}</p>
                    <p className="text-muted-foreground">Na fila</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-nexus-emerald">{q.processed_count}</p>
                    <p className="text-muted-foreground">Processados</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-destructive">{q.failed_count}</p>
                    <p className="text-muted-foreground">Falhas</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-nexus-purple">{q.avg_processing_ms}ms</p>
                    <p className="text-muted-foreground">Avg Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
