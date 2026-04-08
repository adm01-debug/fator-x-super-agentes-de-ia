import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listPendingApprovals, approveWorkflowRun, rejectWorkflowRun } from '@/services/approvalService';

import { toast } from 'sonner';

export default function ApprovalQueuePage() {
  const queryClient = useQueryClient();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  // Load pending approval runs
  const { data: pendingRuns = [], isLoading } = useQuery({
    queryKey: ['hitl_pending'],
    queryFn: listPendingApprovals,
    refetchInterval: 10000,
  });

  const handleApprove = async (runId: string) => {
    setProcessing(true);
    try {
      const run = pendingRuns.find((r: Record<string, unknown>) => r.id === runId);
      const data = await approveWorkflowRun(runId, String(run?.workflow_id), feedback);
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
      await rejectWorkflowRun(runId, feedback);
      toast.success('Workflow rejeitado');
      setSelectedRun(null);
      setFeedback('');
      queryClient.invalidateQueries({ queryKey: ['hitl_pending'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Aprovações Pendentes" description="Human-in-the-Loop: workflows aguardando revisão humana" />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : pendingRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="h-12 w-12 text-nexus-emerald mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma aprovação pendente</h2>
          <p className="text-sm text-muted-foreground">Workflows com gates HITL aparecerão aqui quando precisarem de aprovação humana.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRuns.map((run) => {
            const output = run.output as Record<string, unknown> | null;
            const pending = output?.pending_approval as Record<string, unknown> | undefined;
            const isSelected = selectedRun === run.id;
            const workflows = run.workflows as { name?: string } | null;
            return (
              <div key={run.id}
                className={`nexus-card ${isSelected ? 'border-primary/30' : ''}`}>
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setSelectedRun(isSelected ? null : run.id)}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-nexus-amber" />
                      <p className="text-sm font-semibold text-foreground">{workflows?.name || 'Workflow'}</p>
                      <Badge variant="outline" className="text-[11px] text-nexus-amber border-nexus-amber/30">Aguardando aprovação</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Etapa {run.current_step}/{run.total_steps} • Nodo: {pending?.label || 'HITL Gate'}
                    </p>
                    {pending?.context && <p className="text-xs text-foreground/80 mt-1 max-w-xl">{String(pending.context)}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{run.started_at ? new Date(run.started_at).toLocaleString('pt-BR') : ''}</span>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                    <Textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback ou modificações (opcional)"
                      className="bg-secondary/50 text-xs min-h-[60px]" />
                    <div className="flex gap-2">
                      <Button onClick={() => handleApprove(String(run.id))} disabled={processing} className="nexus-gradient-bg text-primary-foreground gap-1.5 text-xs">
                        {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Aprovar e Continuar
                      </Button>
                      <Button variant="destructive" onClick={() => handleReject(String(run.id))} disabled={processing} className="gap-1.5 text-xs">
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
