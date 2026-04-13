import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoHint } from '@/components/shared/InfoHint';
import { Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { createSchedule, listSchedules, deleteSchedule, updateSchedule, type ScheduleFrequency } from '@/services/cronSchedulerService';
import { toast } from 'sonner';

const cronLabels: Record<string, { label: string; cron: string; next: () => string }> = {
  'every-5m': { label: 'A cada 5 min', cron: '*/5 * * * *', next: () => { const d = new Date(); d.setMinutes(d.getMinutes() + 5); return d.toLocaleString('pt-BR'); } },
  hourly: { label: 'A cada hora', cron: '0 * * * *', next: () => { const d = new Date(); d.setHours(d.getHours() + 1, 0); return d.toLocaleString('pt-BR'); } },
  daily: { label: 'Diariamente (9h)', cron: '0 9 * * *', next: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0); return d.toLocaleString('pt-BR'); } },
  weekly: { label: 'Semanal (seg 9h)', cron: '0 9 * * 1', next: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7)); d.setHours(9, 0); return d.toLocaleString('pt-BR'); } },
};

export function WorkflowScheduler({ workflows }: { workflows: Array<Record<string, unknown>> }) {
  const queryClient = useQueryClient();
  const { data: schedules = [] } = useQuery({ queryKey: ['workflow-schedules'], queryFn: () => listSchedules() });
  const [selWf, setSelWf] = useState('');
  const [selCron, setSelCron] = useState('daily');

  const handleAdd = async () => {
    if (!selWf) { toast.error('Selecione um workflow'); return; }
    const cronInfo = cronLabels[selCron];
    const wf = workflows.find((w) => String(w.id) === selWf);
    try {
      await createSchedule({ name: `Agendamento: ${String(wf?.name || 'Workflow')}`, frequency: selCron as ScheduleFrequency, cron_expression: cronInfo.cron, timezone: 'America/Sao_Paulo', target_type: 'workflow', target_id: selWf, target_config: {} });
      queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] });
      toast.success('Agendamento criado!');
      setSelWf('');
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro ao criar agendamento'); }
  };

  const handleToggle = async (id: string, currentlyEnabled: boolean) => {
    try { await updateSchedule(id, { status: currentlyEnabled ? 'paused' : 'active' }); queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] }); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro ao atualizar agendamento'); }
  };

  const handleRemove = async (id: string) => {
    try { await deleteSchedule(id); queryClient.invalidateQueries({ queryKey: ['workflow-schedules'] }); toast.success('Agendamento removido'); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro ao remover agendamento'); }
  };

  return (
    <div className="space-y-4">
      <InfoHint title="Agendamento de Workflows">Configure execuções automáticas de workflows em intervalos regulares.</InfoHint>
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Novo Agendamento</h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label className="text-xs">Workflow</Label>
            <Select value={selWf} onValueChange={setSelWf}><SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{workflows.map((wf) => <SelectItem key={String(wf.id)} value={String(wf.id)}>{String(wf.name)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1 min-w-[160px]">
            <Label className="text-xs">Frequência</Label>
            <Select value={selCron} onValueChange={setSelCron}><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(cronLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button onClick={handleAdd} className="gap-1.5 nexus-gradient-bg text-primary-foreground"><Plus className="h-3.5 w-3.5" /> Agendar</Button>
        </div>
      </div>

      {schedules.length > 0 && (
        <div className="space-y-2">
          {schedules.map((s: Record<string, unknown>) => {
            const isActive = s.status === 'active';
            const wf = workflows.find((w) => String(w.id) === String(s.target_id));
            const nextRun = s.next_run_at ? new Date(String(s.next_run_at)).toLocaleString('pt-BR') : '—';
            return (
              <div key={String(s.id)} className="nexus-card flex items-center gap-3">
                <Calendar className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{String(s.name || wf?.name || 'Workflow')}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{String(s.cron_expression)} • Próxima: {nextRun}</p>
                </div>
                <Switch checked={isActive} onCheckedChange={() => handleToggle(String(s.id), isActive)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(String(s.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            );
          })}
        </div>
      )}
      {schedules.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Nenhum agendamento configurado.</div>}
    </div>
  );
}
