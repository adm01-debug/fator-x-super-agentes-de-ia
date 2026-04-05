import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListOrdered, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listQueues, QUEUE_PRESETS, type QueueDefinition } from '@/services/queueManagerService';
import { useToast } from '@/hooks/use-toast';

const STRATEGY_LABELS: Record<string, string> = { fifo: 'FIFO', lifo: 'LIFO', priority: 'Prioridade' };

export function QueueMonitorPanel() {
  const [queues, setQueues] = useState<QueueDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    listQueues().then(setQueues).catch(() => toast({ title: 'Erro', variant: 'destructive' })).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-[#111122] border-[#222244]">
        <CardContent className="p-4">
          <p className="text-sm text-gray-400 mb-3">Presets de Fila</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(QUEUE_PRESETS).map(([key, preset]) => (
              <div key={key} className="p-3 rounded-lg bg-[#0a0a1a] border border-[#222244] hover:border-[#FF6B6B]/50 cursor-pointer">
                <p className="font-medium text-sm">{preset.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">{preset.description}</p>
                <div className="flex gap-1 mt-2">
                  <Badge variant="outline" className="text-[10px] border-[#222244]">{STRATEGY_LABELS[preset.strategy ?? 'fifo']}</Badge>
                  <Badge variant="outline" className="text-[10px] border-[#222244]">{preset.max_concurrency} threads</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando filas...</div>
      ) : queues.length === 0 ? (
        <Card className="bg-[#111122] border-[#222244]"><CardContent className="py-12 text-center text-gray-400"><ListOrdered size={48} className="mx-auto mb-4 opacity-30" /><p>Nenhuma fila criada.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {queues.map((q) => (
            <Card key={q.id} className="bg-[#111122] border-[#222244]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ListOrdered size={16} className="text-[#FF6B6B]" />
                    <p className="font-medium">{q.name}</p>
                    <Badge variant="outline" className="text-[10px] border-[#222244]">{STRATEGY_LABELS[q.strategy]}</Badge>
                  </div>
                  <Badge className={q.is_paused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}>
                    {q.is_paused ? 'Pausada' : 'Ativa'}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center text-xs">
                  <div><p className="text-lg font-bold text-[#4D96FF]">{q.current_size}</p><p className="text-gray-400">Na fila</p></div>
                  <div><p className="text-lg font-bold text-[#6BCB77]">{q.processed_count}</p><p className="text-gray-400">Processados</p></div>
                  <div><p className="text-lg font-bold text-[#FF6B6B]">{q.failed_count}</p><p className="text-gray-400">Falhas</p></div>
                  <div><p className="text-lg font-bold text-[#9B59B6]">{q.avg_processing_ms}ms</p><p className="text-gray-400">Avg Time</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
