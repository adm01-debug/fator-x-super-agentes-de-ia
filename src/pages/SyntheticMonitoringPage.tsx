/**
 * SyntheticMonitoringPage — manage canary checks running 24/7.
 * Route: /observability/synthetic
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Plus, Play, Trash2, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  listSyntheticChecks, createSyntheticCheck, toggleSyntheticCheck, deleteSyntheticCheck,
  getSyntheticSummary, runSyntheticCheckNow,
  type SyntheticCheck, type SyntheticTarget, type SyntheticSummary,
} from "@/services/syntheticService";
import { getWorkspaceId } from "@/lib/agentService";

function Sparkline({ data }: { data: SyntheticSummary["recent"] }) {
  if (!data.length) return <div className="text-xs text-muted-foreground">Sem dados</div>;
  const max = Math.max(...data.map((d) => d.latency_ms ?? 0), 1);
  return (
    <div className="flex items-end gap-px h-10">
      {data.map((d, i) => {
        const h = Math.max(2, ((d.latency_ms ?? 0) / max) * 40);
        return (
          <div
            key={i}
            className={`w-1 rounded-sm ${d.success ? "bg-primary/70" : "bg-destructive"}`}
            style={{ height: `${h}px` }}
            title={`${new Date(d.ran_at).toLocaleTimeString()} — ${d.success ? "ok" : "fail"} ${d.latency_ms}ms`}
          />
        );
      })}
    </div>
  );
}

function CheckCard({ check, onChanged }: { check: SyntheticCheck; onChanged: () => void }) {
  const { data: summary } = useQuery({
    queryKey: ["synthetic-summary", check.id],
    queryFn: () => getSyntheticSummary(check.id, 24),
    refetchInterval: 60_000,
  });

  const handleRun = async () => {
    try {
      await runSyntheticCheckNow(check.id);
      toast.success("Check executado");
      onChanged();
    } catch (e) {
      toast.error("Falha ao executar", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleToggle = async (enabled: boolean) => {
    try {
      await toggleSyntheticCheck(check.id, enabled);
      onChanged();
    } catch (e) {
      toast.error("Falha ao alterar", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remover check "${check.name}"?`)) return;
    try {
      await deleteSyntheticCheck(check.id);
      toast.success("Check removido");
      onChanged();
    } catch (e) {
      toast.error("Falha ao remover", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const uptimeColor =
    !summary || summary.uptime_pct >= 99 ? "text-emerald-500"
    : summary.uptime_pct >= 95 ? "text-amber-500"
    : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{check.name}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline">{check.target}</Badge>
              <Badge variant="outline">a cada {check.interval_minutes}min</Badge>
              <Badge variant="outline">≤{check.expected_status_max_ms}ms</Badge>
              {check.consecutive_failures >= 3 && (
                <Badge variant="destructive">{check.consecutive_failures} falhas seguidas</Badge>
              )}
            </div>
          </div>
          <Switch checked={check.enabled} onCheckedChange={handleToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Uptime 24h</div>
            <div className={`text-lg font-semibold ${uptimeColor}`}>{summary?.uptime_pct?.toFixed(1) ?? "—"}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">P95</div>
            <div className="text-lg font-semibold">{summary?.p95_latency_ms ?? "—"}ms</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Runs</div>
            <div className="text-lg font-semibold">{summary?.total_runs ?? 0}</div>
          </div>
        </div>
        <Sparkline data={summary?.recent ?? []} />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={handleRun}>
            <Play className="w-3.5 h-3.5 mr-1.5" /> Executar agora
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SyntheticMonitoringPage() {
  const qc = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<SyntheticTarget>("llm-gateway");
  const [interval, setInterval] = useState(5);
  const [threshold, setThreshold] = useState(3000);

  useEffect(() => {
    getWorkspaceId().then(setWorkspaceId).catch(() => {});
  }, []);

  const { data: checks = [], refetch } = useQuery({
    queryKey: ["synthetic-checks", workspaceId],
    queryFn: () => listSyntheticChecks(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSyntheticCheck({
        workspace_id: workspaceId!,
        name: name.trim(),
        target,
        interval_minutes: interval,
        expected_status_max_ms: threshold,
      }),
    onSuccess: () => {
      toast.success("Check criado");
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["synthetic-checks"] });
    },
    onError: (e) => toast.error("Falha ao criar", { description: e instanceof Error ? e.message : String(e) }),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Synthetic Monitoring"
        description="Pings automáticos 24/7 simulando jornadas críticas. Detecta falhas mesmo sem tráfego real."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Novo check
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar synthetic check</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="LLM Gateway — production probe" />
                </div>
                <div>
                  <Label>Target</Label>
                  <Select value={target} onValueChange={(v) => setTarget(v as SyntheticTarget)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llm-gateway">llm-gateway</SelectItem>
                      <SelectItem value="agent-workflow-runner">agent-workflow-runner</SelectItem>
                      <SelectItem value="health">health (REST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Intervalo (min)</Label>
                    <Input type="number" min={1} max={60} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Threshold latência (ms)</Label>
                    <Input type="number" min={100} max={30000} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}>
                  {createMut.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {checks.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhum synthetic check configurado"
          description="Crie checks que pingam endpoints críticos a cada 1–60 minutos, mesmo sem tráfego real. Recomendado: 1 check por endpoint público."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map((c) => <CheckCard key={c.id} check={c} onChanged={refetch} />)}
        </div>
      )}
    </div>
  );
}
