import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { createPromptVersion, listPromptVersions } from '@/services/knowledgeService';
import { getAuthUser } from '@/services/securityService';
import { toast } from 'sonner';

interface CreatePromptDialogProps {
  agents: Array<{ id: string; name: string }>;
  onCreated?: () => void;
}

export function CreatePromptDialog({ agents, onCreated }: CreatePromptDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');

  const handleCreate = async () => {
    if (!agentId) { toast.error('Selecione um agente'); return; }
    if (!content.trim()) { toast.error('Conteúdo é obrigatório'); return; }
    setLoading(true);
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Não autenticado');

      const versions = await listPromptVersions(agentId);
      const nextVersion = (versions[0]?.version || 0) + 1;

      await createPromptVersion({
        agent_id: agentId,
        user_id: user.id,
        content: content.trim(),
        change_summary: summary.trim() || `Versão ${nextVersion}`,
      });

      toast.success('Prompt criado!');
      setOpen(false);
      setContent(''); setSummary(''); setAgentId('');
      onCreated?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar prompt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo prompt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Novo Prompt</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Agente *</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição da versão</Label>
            <Input value={summary} onChange={e => setSummary(e.target.value)} placeholder="Ex: Ajuste de tom e persona" className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conteúdo do prompt *</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Você é um assistente..." className="bg-secondary/50 font-mono text-xs" rows={8} />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full nexus-gradient-bg text-primary-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Criar Prompt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
