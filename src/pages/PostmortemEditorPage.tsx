import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Save, Send, Plus, Trash2, CheckCircle2, Clock, ListChecks } from "lucide-react";
import {
  getPostmortem, updatePostmortem, publishPostmortem,
  listActionItems, createActionItem, updateActionItem, deleteActionItem,
  type Postmortem, type ActionItem, type PostmortemSeverity, type PostmortemStatus, type ActionPriority, type ActionStatus, type TimelineEvent,
} from "@/services/postmortemService";

const SEV_COLORS: Record<PostmortemSeverity, string> = {
  SEV1: "bg-destructive/15 text-destructive border-destructive/30",
  SEV2: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  SEV3: "bg-primary/10 text-primary border-primary/30",
  SEV4: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_COLORS: Record<ActionPriority, string> = {
  P0: "bg-destructive/15 text-destructive border-destructive/30",
  P1: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  P2: "bg-muted text-muted-foreground border-border",
};

export default function PostmortemEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pm, setPm] = useState<Postmortem | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // form fields
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<PostmortemSeverity>("SEV3");
  const [status, setStatus] = useState<PostmortemStatus>("draft");
  const [summary, setSummary] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [contributing, setContributing] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [wentWrong, setWentWrong] = useState("");
  const [lessons, setLessons] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // new action item
  const [newActDesc, setNewActDesc] = useState("");
  const [newActOwner, setNewActOwner] = useState("");
  const [newActDue, setNewActDue] = useState("");
  const [newActPrio, setNewActPrio] = useState<ActionPriority>("P2");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, a] = await Promise.all([getPostmortem(id), listActionItems(id)]);
      if (!p) {
        toast.error("Postmortem não encontrado");
        navigate("/observability/postmortems");
        return;
      }
      setPm(p);
      setActions(a);
      setTitle(p.title);
      setSeverity(p.severity);
      setStatus(p.status);
      setSummary(p.summary ?? "");
      setRootCause(p.root_cause ?? "");
      setContributing((p.contributing_factors ?? []).join("\n"));
      setWentWell((p.what_went_well ?? []).join("\n"));
      setWentWrong((p.what_went_wrong ?? []).join("\n"));
      setLessons(p.lessons_learned ?? "");
      setTimeline(p.timeline ?? []);
    } catch (e) {
      logger.error("load postmortem failed", e);
      toast.error("Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!pm) return;
    setSaving(true);
    try {
      await updatePostmortem(pm.id, {
        title: title.trim(),
        severity,
        status,
        summary: summary.trim() || null,
        root_cause: rootCause.trim() || null,
        contributing_factors: contributing.split("\n").map(s => s.trim()).filter(Boolean),
        what_went_well: wentWell.split("\n").map(s => s.trim()).filter(Boolean),
        what_went_wrong: wentWrong.split("\n").map(s => s.trim()).filter(Boolean),
        lessons_learned: lessons.trim() || null,
        timeline,
      });
      toast.success("Salvo");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!pm) return;
    setPublishing(true);
    try {
      await handleSave();
      const r = await publishPostmortem(pm.id);
      toast.success(`Publicado — ${r.action_items} ações`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function addTimelineRow() {
    setTimeline([...timeline, { at: new Date().toISOString(), event: "", detail: "" }]);
  }

  function updateTimelineRow(idx: number, patch: Partial<TimelineEvent>) {
    setTimeline(timeline.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }

  function removeTimelineRow(idx: number) {
    setTimeline(timeline.filter((_, i) => i !== idx));
  }

  async function handleAddAction() {
    if (!pm || !newActDesc.trim()) return;
    try {
      const created = await createActionItem({
        postmortem_id: pm.id,
        description: newActDesc.trim(),
        owner_id: null,
        owner_name: newActOwner.trim() || null,
        due_date: newActDue || null,
        priority: newActPrio,
        status: "open",
      });
      setActions([...actions, created]);
      setNewActDesc(""); setNewActOwner(""); setNewActDue(""); setNewActPrio("P2");
      toast.success("Ação adicionada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleUpdateAction(actId: string, patch: Partial<ActionItem>) {
    try {
      await updateActionItem(actId, patch);
      setActions(actions.map(a => a.id === actId ? { ...a, ...patch } : a));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDeleteAction(actId: string) {
    try {
      await deleteActionItem(actId);
      setActions(actions.filter(a => a.id !== actId));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return <div className="space-y-3 page-enter"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!pm) return null;

  const canPublish =
    status !== "published"
    && summary.trim().length >= 10
    && rootCause.trim().length >= 10
    && actions.length >= 1;

  return (
    <div className="space-y-5 page-enter max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate("/observability/postmortems")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xl font-bold border-0 px-0 h-auto py-0 focus-visible:ring-0 focus-visible:border-0 bg-transparent" />
            <div className="flex gap-2 mt-2 items-center flex-wrap">
              <Badge variant="outline" className={SEV_COLORS[severity]}>{severity}</Badge>
              <Badge variant="outline">{pm.incident_source.replace("_", " ")}</Badge>
              <Badge variant="outline">{status === "draft" ? "Rascunho" : status === "review" ? "Em revisão" : "Publicado"}</Badge>
              {pm.published_at && (
                <span className="text-xs text-muted-foreground">
                  Publicado em {new Date(pm.published_at).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button onClick={handlePublish} disabled={!canPublish || publishing}>
            <Send className="h-4 w-4 mr-2" /> {publishing ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </header>

      {!canPublish && status !== "published" && (
        <div className="rounded-lg border border-nexus-amber/30 bg-nexus-amber/10 p-3 text-xs text-nexus-amber">
          Para publicar: resumo (≥10 chars), causa raiz (≥10 chars) e pelo menos 1 action item.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <Label className="text-xs">Severidade</Label>
          <Select value={severity} onValueChange={(v) => setSeverity(v as PostmortemSeverity)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SEV1">SEV1</SelectItem>
              <SelectItem value="SEV2">SEV2</SelectItem>
              <SelectItem value="SEV3">SEV3</SelectItem>
              <SelectItem value="SEV4">SEV4</SelectItem>
            </SelectContent>
          </Select>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PostmortemStatus)} disabled={status === "published"}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="review">Em revisão</SelectItem>
            </SelectContent>
          </Select>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <Label className="text-xs">Origem</Label>
          <p className="text-sm font-medium mt-1.5 capitalize">{pm.incident_source.replace("_", " ")}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo executivo</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="O que aconteceu, impacto, duração — em 2-4 frases."
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</CardTitle>
            <Button size="sm" variant="outline" onClick={addTimelineRow}><Plus className="h-3.5 w-3.5 mr-1" /> Evento</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {timeline.length === 0 && <p className="text-xs text-muted-foreground">Sem eventos. Adicione cronologia do incidente.</p>}
          {timeline.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input
                type="datetime-local"
                value={t.at ? new Date(t.at).toISOString().slice(0, 16) : ""}
                onChange={(e) => updateTimelineRow(i, { at: new Date(e.target.value).toISOString() })}
                className="col-span-3 text-xs"
              />
              <Input
                value={t.event}
                onChange={(e) => updateTimelineRow(i, { event: e.target.value })}
                placeholder="Evento"
                className="col-span-3 text-xs"
              />
              <Input
                value={t.detail ?? ""}
                onChange={(e) => updateTimelineRow(i, { detail: e.target.value })}
                placeholder="Detalhe"
                className="col-span-5 text-xs"
              />
              <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeTimelineRow(i)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Causa raiz</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            placeholder="Por que aconteceu? Use 5 Whys: 1) ... 2) ... 3) ..."
            rows={6}
          />
          <p className="text-xs text-muted-foreground">
            Dica: aplique a técnica 5 Whys — pergunte "por quê?" cinco vezes para chegar à causa real, não ao sintoma.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card><CardHeader><CardTitle className="text-sm">O que deu certo</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} rows={4} placeholder="Uma linha por item" />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-sm">O que deu errado</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={wentWrong} onChange={(e) => setWentWrong(e.target.value)} rows={4} placeholder="Uma linha por item" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Fatores contribuintes</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={contributing} onChange={(e) => setContributing(e.target.value)} rows={3} placeholder="Uma linha por fator" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Action items ({actions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              <Label className="text-xs">Descrição</Label>
              <Input value={newActDesc} onChange={(e) => setNewActDesc(e.target.value)} placeholder="Ação a tomar" />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Responsável</Label>
              <Input value={newActOwner} onChange={(e) => setNewActOwner(e.target.value)} placeholder="Nome" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={newActDue} onChange={(e) => setNewActDue(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Prio</Label>
              <Select value={newActPrio} onValueChange={(v) => setNewActPrio(v as ActionPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="P0">P0</SelectItem>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="col-span-1" onClick={handleAddAction} disabled={!newActDesc.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border border-border bg-card">
                <Badge variant="outline" className={`col-span-1 justify-center ${PRIORITY_COLORS[a.priority]}`}>{a.priority}</Badge>
                <span className="col-span-4 text-sm truncate">{a.description}</span>
                <span className="col-span-2 text-xs text-muted-foreground truncate">{a.owner_name || "—"}</span>
                <span className="col-span-2 text-xs tabular-nums text-muted-foreground">{a.due_date || "—"}</span>
                <Select value={a.status} onValueChange={(v) => handleUpdateAction(a.id, { status: v as ActionStatus })}>
                  <SelectTrigger className="col-span-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="col-span-1 h-7 w-7" onClick={() => handleDeleteAction(a.id)}>
                  {a.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                </Button>
              </div>
            ))}
            {actions.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhuma ação ainda.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Lições aprendidas</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} rows={3} placeholder="Conhecimento que fica para o time" />
        </CardContent>
      </Card>
    </div>
  );
}
