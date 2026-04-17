import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fromTable } from '@/lib/supabaseExtended';
import { promptExperimentService, type SuccessMetric } from '@/services/promptExperimentService';
import { toast } from 'sonner';

interface AgentMin { id: string; name: string }
interface VersionMin { id: string; version: number; name: string | null; agent_id: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
}

export function CreateExperimentDialog({ open, onOpenChange, workspaceId }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState<string>('');
  const [versionA, setVersionA] = useState<string>('');
  const [versionB, setVersionB] = useState<string>('');
  const [labelA, setLabelA] = useState('Controle');
  const [labelB, setLabelB] = useState('Challenger');
  const [split, setSplit] = useState(50);
  const [metric, setMetric] = useState<SuccessMetric>('quality');
  const [maxCost, setMaxCost] = useState(50);
  const [maxLat, setMaxLat] = useState(2000);
  const [minQual, setMinQual] = useState(0.6);

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-min', workspaceId],
    queryFn: async (): Promise<AgentMin[]> => {
      const { data, error } = await fromTable('agents').select('id,name').eq('workspace_id', workspaceId).limit(100);
      if (error) throw error;
      return (data ?? []) as AgentMin[];
    },
    enabled: open,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['agent-versions', agentId],
    queryFn: async (): Promise<VersionMin[]> => {
      if (!agentId) return [];
      const { data, error } = await fromTable('agent_versions')
        .select('id,version,name,agent_id')
        .eq('agent_id', agentId)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VersionMin[];
    },
    enabled: !!agentId,
  });

  const create = useMutation({
    mutationFn: () => promptExperimentService.create({
      workspace_id: workspaceId,
      agent_id: agentId,
      name,
      description,
      variant_a_version_id: versionA,
      variant_b_version_id: versionB,
      variant_a_label: labelA,
      variant_b_label: labelB,
      traffic_split: split,
      success_metric: metric,
      guardrails: { max_cost_increase_pct: maxCost, max_latency_increase_ms: maxLat, min_quality: minQual },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prompt_experiments', workspaceId] });
      toast.success('Experimento criado');
      onOpenChange(false);
      setName(''); setDescription(''); setAgentId(''); setVersionA(''); setVersionB('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = name.trim() && agentId && versionA && versionB && versionA !== versionB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo experimento A/B</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tom formal vs casual" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="O que está sendo testado?" />
          </div>

          <div>
            <Label>Agente</Label>
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); setVersionA(''); setVersionB(''); }}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Versão A (controle)</Label>
              <Select value={versionA} onValueChange={setVersionA} disabled={!agentId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => <SelectItem key={v.id} value={v.id}>v{v.version} {v.name ? `· ${v.name}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-2" value={labelA} onChange={(e) => setLabelA(e.target.value)} placeholder="Label A" />
            </div>
            <div>
              <Label>Versão B (challenger)</Label>
              <Select value={versionB} onValueChange={setVersionB} disabled={!agentId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {versions.filter((v) => v.id !== versionA).map((v) => <SelectItem key={v.id} value={v.id}>v{v.version} {v.name ? `· ${v.name}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-2" value={labelB} onChange={(e) => setLabelB(e.target.value)} placeholder="Label B" />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5"><Label>Split traffic</Label><span className="text-xs text-muted-foreground">A {split}% · B {100 - split}%</span></div>
            <Slider value={[split]} onValueChange={(v) => setSplit(v[0])} min={5} max={95} step={5} />
          </div>

          <div>
            <Label>Métrica primária</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as SuccessMetric)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quality">Qualidade</SelectItem>
                <SelectItem value="success_rate">Taxa de sucesso</SelectItem>
                <SelectItem value="latency">Latência (menor é melhor)</SelectItem>
                <SelectItem value="cost">Custo (menor é melhor)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 p-3 bg-muted/30 rounded">
            <div className="text-xs font-semibold">Guardrails</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Custo máx +%</Label>
                <Input type="number" value={maxCost} onChange={(e) => setMaxCost(Number(e.target.value))} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Latência máx +ms</Label>
                <Input type="number" value={maxLat} onChange={(e) => setMaxLat(Number(e.target.value))} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Qualidade mín</Label>
                <Input type="number" step="0.05" min="0" max="1" value={minQual} onChange={(e) => setMinQual(Number(e.target.value))} className="h-8" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!valid} loading={create.isPending}>Criar como rascunho</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
