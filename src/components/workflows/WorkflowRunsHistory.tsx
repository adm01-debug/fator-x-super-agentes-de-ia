import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { listWorkflowRuns } from '@/services/workflowsService';

export function WorkflowRunsHistory() {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['workflow_runs'],
    queryFn: () => listWorkflowRuns(),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (runs.length === 0) return <div className="text-center py-12 text-sm text-muted-foreground">Nenhuma execução registrada. Execute um workflow salvo no banco.</div>;

  return (
    <div className="space-y-3">
      {runs.map((run) => {
        const wfData = run.workflows as Record<string, unknown> | null;
        return (
          <div key={String(run.id)} className="nexus-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{(wfData?.name as string) || 'Workflow'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {String(run.total_steps)} etapas • {String(run.current_step || 0)} tokens
                  {run.started_at && ` • ${new Date(String(run.started_at)).toLocaleString('pt-BR')}`}
                </p>
              </div>
              <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'outline'} className="text-[11px]">
                {String(run.status)}
              </Badge>
            </div>
            {run.error && <p className="text-xs text-destructive mt-2">{String(run.error)}</p>}
          </div>
        );
      })}
    </div>
  );
}
