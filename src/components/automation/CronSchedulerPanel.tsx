import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, RefreshCw, Play, Loader2 } from 'lucide-react';
import {
  listSchedules,
  runCronExecutor,
  CRON_PRESETS,
  getScheduleStats,
  describeCronExpression,
  type CronSchedule,
  type ScheduleStats,
} from '@/services/cronSchedulerService';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-nexus-emerald/20 text-nexus-emerald',
  paused: 'bg-nexus-amber/20 text-nexus-amber',
  completed: 'bg-nexus-blue/20 text-nexus-blue',
  failed: 'bg-destructive/20 text-destructive',
  expired: 'bg-muted text-muted-foreground',
};

export function CronSchedulerPanel() {
  const [schedules, setSchedules] = useState<CronSchedule[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedulesData, statsData] = await Promise.all([listSchedules(), getScheduleStats()]);
      setSchedules(schedulesData);
      setStats(statsData);
    } catch {
      toast({ title: 'Erro ao carregar agendamentos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, []);

  const handleRunPending = async () => {
    setRunning(true);
    try {
      const result = await runCronExecutor();
      const count = result.results?.length ?? result.executed ?? 0;
      const succ = result.results?.filter((r) => r.status === 'success').length ?? 0;
      toast({
        title: 'Cron-executor disparado',
        description: count
          ? `${count} agendamentos executados (${succ} ok)`
          : 'Nenhum agendamento pendente',
      });
      await loadData();
    } catch {
      toast({
        title: 'Falha ao executar pendentes',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats?.total_schedules ?? 0, color: 'hsl(var(--nexus-blue))' },
          {
            label: 'Ativos',
            value: stats?.active_schedules ?? 0,
            color: 'hsl(var(--nexus-emerald))',
          },
          {
            label: 'Pausados',
            value: stats?.paused_schedules ?? 0,
            color: 'hsl(var(--nexus-yellow))',
          },
          {
            label: 'Taxa Sucesso',
            value: `${(stats?.success_rate ?? 0).toFixed(1)}%`,
            color: 'hsl(var(--nexus-purple))',
          },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Agendamentos</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunPending}
            disabled={running}
            className="border-border hover:border-primary"
          >
            {running ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Play size={14} className="mr-1" />
            )}
            Executar Pendentes
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="border-border">
            <RefreshCw size={14} className="mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Presets */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Presets Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CRON_PRESETS).map(([key, preset]) => (
              <Badge
                key={key}
                variant="outline"
                className="border-border text-xs cursor-pointer hover:bg-accent"
                title={preset.description}
              >
                <Clock size={10} className="mr-1 text-primary" />
                {preset.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedules List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando agendamentos...</div>
      ) : schedules.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum agendamento criado ainda.</p>
            <p className="text-sm mt-1">
              Use os presets acima ou crie um agendamento personalizado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-primary" />
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.cron_expression
                          ? describeCronExpression(s.cron_expression)
                          : s.frequency}
                        {s.next_run_at &&
                          ` • Próx: ${new Date(s.next_run_at).toLocaleString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[s.status] ?? 'bg-muted text-muted-foreground'}>
                      {s.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.run_count} runs</span>
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
