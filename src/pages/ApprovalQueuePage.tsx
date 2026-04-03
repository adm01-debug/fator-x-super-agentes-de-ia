import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';
import { toast } from 'sonner';

export default function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load pending approval runs
  const { data: pendingRuns = [], isLoading } = useQuery({
    queryKey: ['hitl_pending'],
    queryFn: async () => {
      const { data } = await fromTable('workflow_runs')
        .select('id, workflow_id, status, output, started_at, current_step, total_steps, workflows(name)')
        .eq('status', 'awaiting_approval')
        .order('started_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 10000, // Poll every 10s
  });

  const handleApprove = async (runId: string) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('workflow-engine-v2', {
        body: { workflow_id: pendingRuns.find((r: any) => r.id === runId)?.workflow_id, resume_run_id: runId, input: feedback || 'Approved' },
      });
      if (error) throw error;
      toast.success(`Workflow aprovado e retomado! Status: ${data.status}`);
      setSelectedRun(null);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['hitl_pending'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setProcessing(false); }
  };

  const handleReject = async (runId: string) => {
    setProcessing(true);
    try {
      await fromTable('workflow_runs').update({
        status: 'failed', error: `Rejected by human: ${feedback || 'No reason provided'}`,
        completed_at: new Date().toISOString(),
      }).eq('id', runId);
      toast.success('Workflow rejeitado');
      setSelectedRun(null);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['hitl_pending'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Aprovações Pendentes" description="Human-in-the-Loop: workflows aguardando revisão humana" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : pendingRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma aprovação pendente</h2>
          <p className="text-sm text-muted-foreground">Workflows com gates HITL aparecerão aqui quando precisarem de aprovação humana.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRuns.map((run: any) => {
            const pending = run.output?.pending_approval;
            const isSelected = selectedRun === run.id;
            return (
              <div key={run.id}
                className={`nexus-card ${isSelected ? 'border-primary/30' : ''}`}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setSelectedRun(isSelected ? null : run.id)}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <p className="text-sm font-semibold text-foreground">{run.workflows?.name || 'Workflow'}</p>
                      <Badge variant="outline" className="text-[11px] text-amber-400 border-amber-400/30">Aguardando aprovação</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Etapa {run.current_step}/{run.total_steps} • Nodo: {pending?.label || 'HITL Gate'}
                    </p>
                    {pending?.context && <p className="text-xs text-foreground/80 mt-1 max-w-xl">{pending.context}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{run.started_at ? new Date(run.started_at).toLocaleString('pt-BR') : ''}</span>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                    <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback ou modificações (opcional)"
                      className="bg-secondary/50 text-xs min-h-[60px]" />
                    <div className="flex gap-2">
                      <Button onClick={() => handleApprove(run.id)} disabled={processing} className="nexus-gradient-bg text-primary-foreground gap-1.5 text-xs">
                        {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Aprovar e Continuar
                      </Button>
                      <Button variant="destructive" onClick={() => handleReject(run.id)} disabled={processing} className="gap-1.5 text-xs">
                        {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} Rejeitar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
