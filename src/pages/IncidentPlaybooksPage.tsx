/**
 * Sprint 33 — Incident Playbooks page
 * /observability/playbooks
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Play, Trash2, BookOpen, Activity, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkspaceId } from '@/lib/agentService';
import {
  listPlaybooks, createPlaybook, togglePlaybook, deletePlaybook,
  listRuns, triggerPlaybookManually, PLAYBOOK_TEMPLATES,
  type IncidentPlaybook, type IncidentRun, type TriggerType, type ActionType, type PlaybookAction,
} from '@/services/incidentService';
import { logger } from '@/lib/logger';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  slo_breach: 'SLO violado',
  synthetic_fail: 'Synthetic falhou',
  cost_anomaly: 'Anomalia de custo',
  budget_block: 'Budget bloqueado',
  manual: 'Manual',
};

const ACTION_LABELS: Record<ActionType, string> = {
  notify: 'Notificar',
  disable_chaos: 'Desativar chaos',
  pause_agent: 'Pausar agente',
  switch_provider: 'Trocar provedor LLM',
  page_oncall: 'Acionar on-call',
};

export default function IncidentPlaybooksPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<IncidentPlaybook[]>([]);
  const [runs, setRuns] = useState<IncidentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', trigger_type: 'manual' as TriggerType, cooldown_minutes: 5,
    actions: [{ type: 'notify' as ActionType, config: { message: 'Incidente detectado' } }] as PlaybookAction[],
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const wid = await getWorkspaceId();
        if (!wid) return;
        setWorkspaceId(wid);
        const [pb, rn] = await Promise.all([listPlaybooks(wid), listRuns(wid, 30)]);
        setPlaybooks(pb);
        setRuns(rn);
      } catch (e) { logger.error('load playbooks failed', e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    const [pb, rn] = await Promise.all([listPlaybooks(workspaceId), listRuns(workspaceId, 30)]);
    setPlaybooks(pb);
    setRuns(rn);
  };

  const handleCreate = async () => {
    if (!workspaceId || !user) return;
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    try {
      await createPlaybook({
        workspace_id: workspaceId, name: form.name, description: form.description,
        trigger_type: form.trigger_type, trigger_config: {}, actions: form.actions,
        enabled: true, cooldown_minutes: form.cooldown_minutes, created_by: user.id,
      });
      toast.success('Playbook criado');
      setDialogOpen(false);
      setForm({ name: '', description: '', trigger_type: 'manual', cooldown_minutes: 5, actions: [{ type: 'notify', config: { message: 'Incidente detectado' } }] });
      await refresh();
    } catch (e) { toast.error('Falha ao criar', { description: String(e) }); }
  };

  const useTemplate = async (idx: number) => {
    if (!workspaceId || !user) return;
    const t = PLAYBOOK_TEMPLATES[idx];
    try {
      await createPlaybook({ ...t, workspace_id: workspaceId, created_by: user.id });
      toast.success(`Template "${t.name}" instalado`);
      await refresh();
    } catch (e) { toast.error('Falha ao instalar template', { description: String(e) }); }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try { await togglePlaybook(id, enabled); await refresh(); }
    catch (e) { toast.error('Falha', { description: String(e) }); }
  };

  const handleTrigger = async (id: string) => {
    try {
      const res = await triggerPlaybookManually(id);
      if (res?.skipped) toast.info('Playbook em cooldown');
      else toast.success(`Playbook executado: ${res?.status}`);
      await refresh();
    } catch (e) { toast.error('Falha ao disparar', { description: String(e) }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir playbook?')) return;
    try { await deletePlaybook(id); toast.success('Excluído'); await refresh(); }
    catch (e) { toast.error('Falha', { description: String(e) }); }
  };

  const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type: 'notify', config: {} }] }));
  const removeAction = (i: number) => setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  const updateAction = (i: number, type: ActionType) => setForm((f) => ({
    ...f, actions: f.actions.map((a, idx) => idx === i ? { type, config: {} } : a),
  }));

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Playbooks de Incidente
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Auto-remediação para reduzir MTTR de minutos para segundos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo playbook</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Criar playbook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Provider down → switch" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Trigger</Label>
                  <Select value={form.trigger_type} onValueChange={(v: TriggerType) => setForm({ ...form, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cooldown (minutos)</Label>
                  <Input type="number" min={1} value={form.cooldown_minutes} onChange={(e) => setForm({ ...form, cooldown_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><Label>Ações</Label><Button type="button" size="sm" variant="outline" onClick={addAction}><Plus className="h-3 w-3 mr-1" />Adicionar</Button></div>
                <div className="space-y-2">
                  {form.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={a.type} onValueChange={(v: ActionType) => updateAction(i, v)}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeAction(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="playbooks">
        <TabsList>
          <TabsTrigger value="playbooks"><BookOpen className="h-4 w-4 mr-2" />Playbooks ({playbooks.length})</TabsTrigger>
          <TabsTrigger value="runs"><Activity className="h-4 w-4 mr-2" />Histórico ({runs.length})</TabsTrigger>
          <TabsTrigger value="templates"><Sparkles className="h-4 w-4 mr-2" />Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="playbooks" className="space-y-3">
          {loading ? <p className="text-muted-foreground">Carregando…</p> : playbooks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Nenhum playbook ainda. Crie um do zero ou instale um template.
            </CardContent></Card>
          ) : playbooks.map((pb) => (
            <Card key={pb.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{pb.name}</h3>
                      <Badge variant="outline">{TRIGGER_LABELS[pb.trigger_type]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">cooldown {pb.cooldown_minutes}m</Badge>
                      <Badge variant="secondary" className="text-[10px]">{pb.run_count} execuções</Badge>
                    </div>
                    {pb.description && <p className="text-sm text-muted-foreground">{pb.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pb.actions.map((a, i) => <Badge key={i} variant="outline" className="text-[10px]">{ACTION_LABELS[a.type]}</Badge>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={pb.enabled} onCheckedChange={(v) => handleToggle(pb.id, v)} />
                    <Button size="sm" variant="outline" onClick={() => handleTrigger(pb.id)}><Play className="h-3 w-3 mr-1" />Disparar</Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(pb.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2">
          {runs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma execução ainda.</CardContent></Card>
          ) : runs.map((r) => {
            const pb = playbooks.find((p) => p.id === r.playbook_id);
            return (
              <Card key={r.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{pb?.name ?? 'Playbook removido'}</span>
                        <Badge variant={r.status === 'succeeded' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.action_results.length} ações · origem: {r.triggered_by ?? 'sistema'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="templates" className="grid gap-3 md:grid-cols-2">
          {PLAYBOOK_TEMPLATES.map((t, i) => (
            <Card key={i} className="hover:border-primary/40 transition-colors">
              <CardHeader><CardTitle className="text-base">{t.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{TRIGGER_LABELS[t.trigger_type]}</Badge>
                  {t.actions.map((a, j) => <Badge key={j} variant="secondary" className="text-[10px]">{ACTION_LABELS[a.type]}</Badge>)}
                </div>
                <Button size="sm" className="w-full" onClick={() => useTemplate(i)}>Usar template</Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
