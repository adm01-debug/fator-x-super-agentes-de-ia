import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, RefreshCw, Play, Loader2 } from 'lucide-react';
import { listSchedules, runCronExecutor, CRON_PRESETS, getScheduleStats, describeCronExpression, type CronSchedule, type ScheduleStats } from '@/services/cronSchedulerService';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  expired: 'bg-gray-500/20 text-gray-400',
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
      const [schedulesData, statsData] = await Promise.all([
        listSchedules(),
        getScheduleStats(),
      ]);
      setSchedules(schedulesData);
      setStats(statsData);
    } catch (e) {
      toast({ title: 'Erro ao carregar agendamentos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRunPending = async () => {
    setRunning(true);
    try {
      const result = await runCronExecutor();
      const count = result.results?.length ?? result.executed ?? 0;
      const succ = result.results?.filter(r => r.status === 'success').length ?? 0;
      toast({
        title: 'Cron-executor disparado',
        description: count
          ? `${count} agendamentos executados (${succ} ok)`
          : 'Nenhum agendamento pendente',
      });
      await loadData();
    } catch (e) {
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
          { label: 'Total', value: stats?.total_schedules ?? 0, color: '#4D96FF' },
          { label: 'Ativos', value: stats?.active_schedules ?? 0, color: '#6BCB77' },
          { label: 'Pausados', value: stats?.paused_schedules ?? 0, color: '#FFD93D' },
          { label: 'Taxa Sucesso', value: `${(stats?.success_rate ?? 0).toFixed(1)}%`, color: '#9B59B6' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111122] border-[#222244]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
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
            className="border-[#222244] hover:border-[#4D96FF]"
          >
            {running ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Play size={14} className="mr-1" />
            )}
            Executar Pendentes
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="border-[#222244]">
            <RefreshCw size={14} className="mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Presets */}
      <Card className="bg-[#111122] border-[#222244]">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-gray-400">Presets Disponíveis</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CRON_PRESETS).map(([key, preset]) => (
              <Badge key={key} variant="outline" className="border-[#222244] text-xs cursor-pointer hover:bg-[#1a1a3e]" title={preset.description}>
                <Clock size={10} className="mr-1 text-[#4D96FF]" />
                {preset.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedules List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando agendamentos...</div>
      ) : schedules.length === 0 ? (
        <Card className="bg-[#111122] border-[#222244]">
          <CardContent className="py-12 text-center text-gray-400">
            <Clock size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum agendamento criado ainda.</p>
            <p className="text-sm mt-1">Use os presets acima ou crie um agendamento personalizado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} className="bg-[#111122] border-[#222244]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={18} className="text-[#4D96FF]" />
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.cron_expression ? describeCronExpression(s.cron_expression) : s.frequency}
                        {s.next_run_at && ` • Próx: ${new Date(s.next_run_at).toLocaleString('pt-BR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[s.status] ?? 'bg-gray-500/20 text-gray-400'}>
                      {s.status}
                    </Badge>
                    <span className="text-xs text-gray-500">{s.run_count} runs</span>
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
