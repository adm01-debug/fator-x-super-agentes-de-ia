import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { listAgentsForSelect, listEvaluationDatasets, createEvaluationRun, updateEvaluationRun, invokeEvalJudge } from '@/services/evaluationsService';
import { invokeTestRunner } from '@/services/llmGatewayService';
import { getWorkspaceId } from '@/lib/agentService';
import { createEvaluationSchema } from '@/lib/validations/dialogSchemas';
import { toast } from 'sonner';

interface CreateEvaluationDialogProps {
  onCreated?: () => void;
}

export function CreateEvaluationDialog({ onCreated }: CreateEvaluationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [testCases, setTestCases] = useState('5');
  const [agentId, setAgentId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [useJudge, setUseJudge] = useState(false);
  const [judgeMode, setJudgeMode] = useState<'pointwise' | 'faithfulness'>('pointwise');
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string; case_count: number | null }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadAgents = async () => {
    const agents = await listAgentsForSelect();
    setAgents(agents);
    const ds = await listEvaluationDatasets();
    setDatasets(ds);
  };

  const handleCreate = async () => {
    const result = createEvaluationSchema.safeParse({ name, agentId, datasetId: datasetId || undefined, testCases, useJudge, judgeMode });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(i => { fieldErrors[String(i.path[0])] = i.message; });
      setErrors(fieldErrors);
      toast.error(Object.values(fieldErrors)[0]);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const wsId = await getWorkspaceId();
      const evalRun = await createEvaluationRun({
        name: result.data.name,
        test_cases: result.data.testCases,
        agent_id: result.data.agentId,
        dataset_id: result.data.datasetId ?? '',
        workspace_id: wsId,
        status: 'running',
      });

      if (result.data.datasetId) {
        if (result.data.useJudge) {
          toast.info('Avaliando via LLM-as-Judge...');
          try {
            const judgeResult = await invokeEvalJudge({ agent_id: result.data.agentId, dataset_id: result.data.datasetId, evaluation_run_id: evalRun.id, mode: result.data.judgeMode });
            toast.success(`Judge concluído: score médio ${judgeResult?.average_score?.toFixed(1)}/5 (${judgeResult?.total_cases} cases)`);
          } catch (judgeErr: unknown) {
            toast.warning(`Avaliação criada mas judge falhou: ${judgeErr instanceof Error ? judgeErr.message : 'Erro'}`);
            await updateEvaluationRun(evalRun.id, { status: 'failed' });
          }
        } else {
          toast.info('Executando testes via test-runner...');
          try {
            const runResult = await invokeTestRunner({ agent_id: result.data.agentId, dataset_id: result.data.datasetId, evaluation_run_id: evalRun.id });
            toast.success(`Testes concluídos: ${runResult?.passed || 0}/${runResult?.total || 0} aprovados (${((runResult?.pass_rate || 0) * 100).toFixed(0)}%)`);
          } catch (runErr: unknown) {
            toast.warning(`Avaliação criada mas execução falhou: ${runErr instanceof Error ? runErr.message : 'Erro'}`);
            await updateEvaluationRun(evalRun.id, { status: 'failed' });
          }
        }
      } else {
        toast.success('Avaliação criada (sem dataset — execute manualmente)');
      }
      setOpen(false);
      setName('');
      setDatasetId('');
      onCreated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar avaliação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadAgents(); }}>
      <DialogTrigger asChild>
        <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova avaliação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Nova Avaliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Teste de Factualidade v2" className={`bg-secondary/50 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agente *</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className={`bg-secondary/50 ${errors.agentId ? 'border-destructive' : ''}`}><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.agentId && <p className="text-xs text-destructive">{errors.agentId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Dataset de Testes</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione um dataset (opcional)" /></SelectTrigger>
              <SelectContent>
                {datasets.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.case_count} cases)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número de test cases</Label>
            <Input type="number" value={testCases} onChange={e => setTestCases(e.target.value)} min="1" max="100" className="bg-secondary/50" />
            {errors.testCases && <p className="text-xs text-destructive">{errors.testCases}</p>}
          </div>
          <div className="flex items-center gap-3 py-1">
            <input type="checkbox" checked={useJudge} onChange={e => setUseJudge(e.target.checked)} className="rounded" id="use-judge" />
            <label htmlFor="use-judge" className="text-xs text-foreground cursor-pointer">Usar LLM-as-Judge (avaliação automatizada por IA)</label>
          </div>
          {useJudge && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modo do Judge</Label>
              <Select value={judgeMode} onValueChange={(v) => setJudgeMode(v as "faithfulness" | "pointwise")}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pointwise">Pointwise (score 0-5 em 5 critérios)</SelectItem>
                  <SelectItem value="faithfulness">Faithfulness (verificação de alucinações)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleCreate} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar Avaliação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}