import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  const loadAgents = async () => {
    const { data } = await supabase.from('agents').select('id, name').order('name');
    if (data) setAgents(data);
    const { data: ds } = await supabase.from('evaluation_datasets').select('id, name, case_count').order('name');
    if (ds) setDatasets(ds);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!agentId) { toast.error('Selecione um agente'); return; }
    setLoading(true);
    try {
      const { data: member } = await supabase.from('workspace_members').select('workspace_id').limit(1).maybeSingle();
      const { data: evalRun, error } = await supabase.from('evaluation_runs').insert({
        name: name.trim(),
        test_cases: parseInt(testCases) || 5,
        agent_id: agentId,
        workspace_id: member?.workspace_id,
        status: 'running',
      }).select('id').single();
      if (error || !evalRun) throw error || new Error('Failed to create');

      // If a dataset is selected, call evaluation
      if (datasetId) {
        if (useJudge) {
          toast.info('Avaliando via LLM-as-Judge...');
          const { data: result, error: judgeError } = await supabase.functions.invoke('eval-judge', {
            body: { agent_id: agentId, dataset_id: datasetId, evaluation_run_id: evalRun.id, mode: judgeMode },
          });
          if (judgeError) {
            toast.warning(`Avaliação criada mas judge falhou: ${judgeError.message}`);
            await supabase.from('evaluation_runs').update({ status: 'failed' }).eq('id', evalRun.id);
          } else {
            toast.success(`Judge concluído: score médio ${result?.average_score?.toFixed(1)}/5 (${result?.total_cases} cases)`);
          }
        } else {
          toast.info('Executando testes via test-runner...');
          const { data: result, error: runError } = await supabase.functions.invoke('test-runner', {
            body: { agent_id: agentId, dataset_id: datasetId, evaluation_run_id: evalRun.id },
          });
          if (runError) {
            toast.warning(`Avaliação criada mas execução falhou: ${runError.message}`);
            await supabase.from('evaluation_runs').update({ status: 'failed' }).eq('id', evalRun.id);
          } else {
            toast.success(`Testes concluídos: ${result?.passed || 0}/${result?.total || 0} aprovados (${((result?.pass_rate || 0) * 100).toFixed(0)}%)`);
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
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Teste de Factualidade v2" className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agente</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
          </div>
          <div className="flex items-center gap-3 py-1">
            <input type="checkbox" checked={useJudge} onChange={e => setUseJudge(e.target.checked)} className="rounded" id="use-judge" />
            <label htmlFor="use-judge" className="text-xs text-foreground cursor-pointer">Usar LLM-as-Judge (avaliação automatizada por IA)</label>
          </div>
          {useJudge && (
            <div className="space-y-1.5">
              <Label className="text-xs">Modo do Judge</Label>
              <Select value={judgeMode} onValueChange={(v: any) => setJudgeMode(v)}>
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
