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
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  const loadAgents = async () => {
    const { data } = await supabase.from('agents').select('id, name').order('name');
    if (data) setAgents(data);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    setLoading(true);
    try {
      const { data: member } = await supabase.from('workspace_members').select('workspace_id').limit(1).single();
      const { error } = await supabase.from('evaluation_runs').insert({
        name: name.trim(),
        test_cases: parseInt(testCases) || 5,
        agent_id: agentId || null,
        workspace_id: member?.workspace_id,
        status: 'queued',
      });
      if (error) throw error;
      toast.success('Avaliação criada!');
      setOpen(false);
      setName('');
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar avaliação');
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
            <Label className="text-xs">Número de test cases</Label>
            <Input type="number" value={testCases} onChange={e => setTestCases(e.target.value)} min="1" max="100" className="bg-secondary/50" />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar Avaliação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
