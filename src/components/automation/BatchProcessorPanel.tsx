import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Play, Pause, XCircle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { listBatchJobs, getBatchStats, type BatchJob } from '@/services/batchProcessorService';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Play }> = {
  pending: { color: 'bg-gray-500/20 text-muted-foreground', icon: Layers },
  running: { color: 'bg-blue-500/20 text-blue-400', icon: Play },
  paused: { color: 'bg-yellow-500/20 text-yellow-400', icon: Pause },
  completed: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  failed: { color: 'bg-red-500/20 text-red-400', icon: XCircle },
  cancelled: { color: 'bg-gray-500/20 text-muted-foreground', icon: XCircle },
  partial: { color: 'bg-orange-500/20 text-orange-400', icon: CheckCircle },
};

export function BatchProcessorPanel() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getBatchStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listBatchJobs(undefined, 50), getBatchStats()])
      .then(([j, s]) => { setJobs(j); setStats(s); })
      .catch(() => toast({ title: 'Erro', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Jobs', value: stats?.total_jobs ?? 0, color: 'hsl(var(--nexus-blue))' },
          { label: 'Concluídos', value: stats?.completed ?? 0, color: 'hsl(var(--nexus-emerald))' },
          { label: 'Itens Processados', value: (stats?.total_items_processed ?? 0).toLocaleString(), color: 'hsl(var(--nexus-purple))' },
          { label: 'Taxa Sucesso', value: `${(stats?.success_rate ?? 0).toFixed(1)}%`, color: 'hsl(var(--nexus-yellow))' },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando batch jobs...</div>
      ) : jobs.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Layers size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum batch job executado.</p>
            <p className="text-sm mt-1">Use a API processBatch() para processar grandes volumes de dados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <Card key={job.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-primary" />
                      <p className="font-medium text-sm">{job.name}</p>
                    </div>
                    <Badge className={cfg.color}>{job.status}</Badge>
                  </div>
                  <Progress value={job.progress_pct} className="h-2 mb-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{job.processed_items.toLocaleString()} / {job.total_items.toLocaleString()} itens ({job.progress_pct}%)</span>
                    <span>
                      ✅ {job.successful_items} • ❌ {job.failed_items}
                      {job.duration_ms && ` • ${(job.duration_ms / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                  {job.errors.length > 0 && (
                    <p className="text-[10px] text-red-400 mt-2">{job.errors.length} erros registrados</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
