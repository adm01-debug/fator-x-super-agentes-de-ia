/**
 * Sprint 33 — On-call schedule
 * /observability/oncall
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Phone, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyWorkspaceId } from '@/lib/agentService';
import { listOncall, addOncallEntry, deleteOncallEntry, getCurrentOncall, type OncallEntry } from '@/services/incidentService';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OncallPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [entries, setEntries] = useState<OncallEntry[]>([]);
  const [current, setCurrent] = useState<Array<{ user_id: string; user_name?: string; user_email?: string; escalation_order: number; ends_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_name: '', user_email: '', starts_at: '', ends_at: '', escalation_order: 1, notes: '' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const wid = await getMyWorkspaceId();
        if (!wid) return;
        setWorkspaceId(wid);
        const [list, now] = await Promise.all([listOncall(wid), getCurrentOncall(wid)]);
        setEntries(list);
        setCurrent(now);
      } catch (e) { logger.error('load oncall failed', e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const refresh = async () => {
    if (!workspaceId) return;
    const [list, now] = await Promise.all([listOncall(workspaceId), getCurrentOncall(workspaceId)]);
    setEntries(list);
    setCurrent(now);
  };

  const handleAdd = async () => {
    if (!workspaceId || !user) return;
    if (!form.user_name || !form.starts_at || !form.ends_at) { toast.error('Preencha nome e datas'); return; }
    try {
      await addOncallEntry({
        workspace_id: workspaceId,
        user_id: user.id,
        user_name: form.user_name, user_email: form.user_email || null,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        escalation_order: form.escalation_order, notes: form.notes || null,
        created_by: user.id,
      });
      toast.success('Plantão adicionado');
      setDialogOpen(false);
      setForm({ user_name: '', user_email: '', starts_at: '', ends_at: '', escalation_order: 1, notes: '' });
      await refresh();
    } catch (e) { toast.error('Falha', { description: String(e) }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover plantão?')) return;
    try { await deleteOncallEntry(id); toast.success('Removido'); await refresh(); }
    catch (e) { toast.error('Falha', { description: String(e) }); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Escala On-Call</h1>
          <p className="text-muted-foreground text-sm mt-1">Quem responde a incidentes em cada janela</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Adicionar plantão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo plantão</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome do responsável</Label><Input value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
              </div>
              <div><Label>Ordem de escalação</Label><Input type="number" min={1} value={form.escalation_order} onChange={(e) => setForm({ ...form, escalation_order: Number(e.target.value) })} /></div>
              <div><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleAdd}>Adicionar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" />Quem está on-call agora</CardTitle>
        </CardHeader>
        <CardContent>
          {current.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém escalado para o momento atual.</p>
          ) : (
            <div className="space-y-2">
              {current.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">#{c.escalation_order}</Badge>
                    <span className="font-medium">{c.user_name ?? 'Sem nome'}</span>
                    {c.user_email && <span className="text-xs text-muted-foreground">{c.user_email}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">até {format(new Date(c.ends_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4" />Todos os plantões</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-muted-foreground text-sm">Carregando…</p> : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum plantão configurado.</p>
          ) : entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-4 py-2 border-b border-border/30 last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{e.escalation_order}</Badge>
                  <span className="font-medium text-sm">{e.user_name}</span>
                  {e.user_email && <span className="text-xs text-muted-foreground">{e.user_email}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(e.starts_at), "dd/MM/yy HH:mm", { locale: ptBR })} → {format(new Date(e.ends_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
