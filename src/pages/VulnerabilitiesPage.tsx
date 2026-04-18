import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShieldAlert, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceId } from "@/hooks/use-data";
import {
  listWorkspaceVulnerabilities, acknowledgeVulnerability, markVulnerabilityFixed,
  type VulnerabilityFinding,
} from "@/services/sbomService";

const sevColor = (s: string) =>
  s === "critical" ? "bg-destructive text-destructive-foreground" :
  s === "high" ? "bg-nexus-amber text-background" :
  s === "medium" ? "bg-yellow-500/80 text-background" :
  "bg-muted text-muted-foreground";

export default function VulnerabilitiesPage() {
  const { data: workspaceId } = useWorkspaceId();
  const [findings, setFindings] = useState<VulnerabilityFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [actionTarget, setActionTarget] = useState<{ finding: VulnerabilityFinding; type: "ack" | "fix" } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      setFindings(await listWorkspaceVulnerabilities(workspaceId));
    } catch (e) {
      toast.error("Falha ao carregar vulnerabilidades", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => findings.filter((f) =>
    (filterSeverity === "all" || f.severity === filterSeverity) &&
    (filterStatus === "all" || f.status === filterStatus)
  ), [findings, filterSeverity, filterStatus]);

  const stats = useMemo(() => {
    const open = findings.filter((f) => f.status === "open");
    const critical = open.filter((f) => f.severity === "critical").length;
    const fixed = findings.filter((f) => f.status === "fixed" && f.resolved_at);
    let mttrHours = 0;
    if (fixed.length) {
      mttrHours = fixed.reduce((sum, f) => {
        const d = new Date(f.resolved_at!).getTime() - new Date(f.discovered_at).getTime();
        return sum + d / (1000 * 60 * 60);
      }, 0) / fixed.length;
    }
    return { totalOpen: open.length, critical, mttrHours: Math.round(mttrHours) };
  }, [findings]);

  const onSubmit = async () => {
    if (!actionTarget) return;
    setSubmitting(true);
    try {
      if (actionTarget.type === "ack") await acknowledgeVulnerability(actionTarget.finding.id, notes);
      else await markVulnerabilityFixed(actionTarget.finding.id, notes);
      toast.success(actionTarget.type === "ack" ? "Vulnerabilidade reconhecida" : "Marcada como corrigida");
      setActionTarget(null); setNotes("");
      refresh();
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Vulnerabilidades"
        description="CVEs detectados em todos os SBOMs do workspace, com SLA por severidade"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{stats.totalOpen}</div><div className="text-xs text-muted-foreground mt-1">Total em aberto</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-destructive">{stats.critical}</div><div className="text-xs text-muted-foreground mt-1">Critical (SLA: 24h)</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{stats.mttrHours}h</div><div className="text-xs text-muted-foreground mt-1">MTTR médio (corrigidas)</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Findings</CardTitle>
            <div className="flex gap-2">
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas severidades</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="open">Abertas</SelectItem>
                  <SelectItem value="acknowledged">Reconhecidas</SelectItem>
                  <SelectItem value="fixed">Corrigidas</SelectItem>
                  <SelectItem value="accepted_risk">Risco aceito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div> :
            filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Nenhuma vulnerabilidade encontrada com os filtros atuais.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidade</TableHead>
                    <TableHead>CVE</TableHead>
                    <TableHead>Resumo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detectado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell><Badge className={sevColor(f.severity)}>{f.severity.toUpperCase()}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">
                        <a href={f.reference_url || `https://osv.dev/vulnerability/${f.cve_id}`} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                          {f.cve_id} <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted-foreground">{f.summary || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(f.discovered_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        {f.status === "open" && (
                          <Button size="sm" variant="outline" onClick={() => setActionTarget({ finding: f, type: "ack" })}>
                            Reconhecer
                          </Button>
                        )}
                        {(f.status === "open" || f.status === "acknowledged") && (
                          <Button size="sm" variant="outline" className="ml-1" onClick={() => setActionTarget({ finding: f, type: "fix" })}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Corrigida
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </CardContent>
      </Card>

      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.type === "ack" ? "Reconhecer vulnerabilidade" : "Marcar como corrigida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground"><code>{actionTarget?.finding.cve_id}</code></p>
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Justificativa, link para PR, etc." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionTarget(null)}>Cancelar</Button>
            <Button onClick={onSubmit} loading={submitting}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
