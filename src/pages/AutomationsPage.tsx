import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Play, Trash2, Zap, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAutomationRules, type TriggerType, type ActionType } from '@/hooks/useAutomationRules';
import { useWorkspace } from '@/hooks/useWorkspace';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TRIGGERS: { value: TriggerType; label: string }[] = [
  { value: 'interaction_created', label: 'Interação criada' },
  { value: 'interaction_length', label: 'Tamanho da interação' },
  { value: 'manual', label: 'Manual' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'webhook', label: 'Webhook' },
];
const ACTIONS: { value: ActionType; label: string }[] = [
  { value: 'disc_analysis', label: 'Análise DISC' },
  { value: 'eq_analysis', label: 'Análise EQ' },
  { value: 'bias_analysis', label: 'Análise de Viés' },
  { value: 'full_pipeline', label: 'Pipeline Completo' },
  { value: 'notify', label: 'Notificação' },
  { value: 'webhook', label: 'Webhook' },
];

export default function AutomationsPage() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id ?? null;
  const { rules, logs, loading, createRule, toggleRule, deleteRule, runRule } = useAutomationRules(wsId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '',
    trigger_type: 'manual' as TriggerType,
    action_type: 'full_pipeline' as ActionType,
    min_length: 100,
    webhook_url: '',
  });

  const submit = async () => {
    if (!wsId || !form.name.trim()) return;
    await createRule({
      workspace_id: wsId,
      name: form.name.trim(),
      description: form.description || null,
      trigger_type: form.trigger_type,
      trigger_config: form.trigger_type === 'interaction_length' ? { min_length: form.min_length } : {},
      action_type: form.action_type,
      action_config: form.action_type === 'webhook' ? { url: form.webhook_url } : {},
      is_active: true,
    });
    setOpen(false);
    setForm({ name: '', description: '', trigger_type: 'manual', action_type: 'full_pipeline', min_length: 100, webhook_url: '' });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="🤖 Automações"
        description="Crie regras que disparam análises DISC, EQ e Viés automaticamente"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova Regra de Automação</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Analisar interações longas" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gatilho</Label>
                    <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v as TriggerType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ação</Label>
                    <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v as ActionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {form.trigger_type === 'interaction_length' && (
                  <div>
                    <Label>Tamanho mínimo (caracteres)</Label>
                    <Input type="number" value={form.min_length} onChange={(e) => setForm({ ...form, min_length: Number(e.target.value) })} />
                  </div>
                )}
                {form.action_type === 'webhook' && (
                  <div>
                    <Label>URL do Webhook</Label>
                    <Input value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} placeholder="https://..." />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={!form.name.trim()}>Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules"><Zap className="h-4 w-4 mr-2" />Regras ({rules.length})</TabsTrigger>
          <TabsTrigger value="logs"><History className="h-4 w-4 mr-2" />Histórico ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3 mt-4">
          {loading && <p className="text-muted-foreground text-sm">Carregando…</p>}
          {!loading && rules.length === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Nenhuma regra criada ainda. Clique em "Nova Regra" para começar.
            </CardContent></Card>
          )}
          {rules.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {r.name}
                    <Badge variant={r.is_active ? 'default' : 'secondary'}>{r.is_active ? 'Ativa' : 'Pausada'}</Badge>
                  </CardTitle>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  <div className="flex gap-2 mt-2 text-xs">
                    <Badge variant="outline">{TRIGGERS.find(t => t.value === r.trigger_type)?.label}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="outline">{ACTIONS.find(a => a.value === r.action_type)?.label}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={r.is_active} onCheckedChange={(v) => toggleRule(r.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => runRule(r.id)} title="Executar agora"><Play className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteRule(r.id)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                Execuções: {r.run_count}
                {r.last_run_at && ` • Última: ${formatDistanceToNow(new Date(r.last_run_at), { locale: ptBR, addSuffix: true })}`}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="space-y-2 mt-4">
          {logs.length === 0 && <p className="text-muted-foreground text-sm">Sem execuções ainda.</p>}
          {logs.map((l) => (
            <Card key={l.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {l.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                  <div>
                    <p className="text-sm font-medium">{rules.find(r => r.id === l.rule_id)?.name ?? l.rule_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(l.created_at), { locale: ptBR, addSuffix: true })}
                      {l.duration_ms && ` • ${l.duration_ms}ms`}
                    </p>
                  </div>
                </div>
                <Badge variant={l.status === 'success' ? 'default' : 'destructive'}>{l.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
