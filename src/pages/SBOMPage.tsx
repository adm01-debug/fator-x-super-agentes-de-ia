import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { Plus, Radar, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceId } from "@/hooks/use-data";
import {
  listSnapshots, createSnapshot, getSnapshotComponents, getSnapshotVulnerabilities,
  scanSnapshot, deleteSnapshot, parsePackageJson, severityCounts,
  type SBOMSnapshot, type SBOMComponent, type VulnerabilityFinding,
} from "@/services/sbomService";

const sevColor = (s: string) =>
  s === "critical" ? "bg-destructive text-destructive-foreground" :
  s === "high" ? "bg-nexus-amber text-background" :
  s === "medium" ? "bg-yellow-500/80 text-background" :
  "bg-muted text-muted-foreground";

export default function SBOMPage() {
  const { data: workspaceId } = useWorkspaceId();
  const [snapshots, setSnapshots] = useState<SBOMSnapshot[]>([]);
  const [vulnsBySnapshot, setVulnsBySnapshot] = useState<Record<string, VulnerabilityFinding[]>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [pkgJson, setPkgJson] = useState("");
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [detail, setDetail] = useState<SBOMSnapshot | null>(null);
  const [components, setComponents] = useState<SBOMComponent[]>([]);
  const [detailVulns, setDetailVulns] = useState<VulnerabilityFinding[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const snaps = await listSnapshots(workspaceId);
      setSnapshots(snaps);
      const byId: Record<string, VulnerabilityFinding[]> = {};
      await Promise.all(snaps.map(async (s) => { byId[s.id] = await getSnapshotVulnerabilities(s.id); }));
      setVulnsBySnapshot(byId);
    } catch (e) {
      toast.error("Falha ao carregar SBOMs", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  const onCreate = async () => {
    if (!workspaceId || !name.trim() || !pkgJson.trim()) return;
    setCreating(true);
    try {
      const components = parsePackageJson(pkgJson);
      if (!components.length) { toast.error("Nenhuma dependência encontrada"); return; }
      await createSnapshot(workspaceId, name.trim(), components, "package.json");
      toast.success(`SBOM criado: ${components.length} componentes`);
      setCreateOpen(false); setName(""); setPkgJson("");
      refresh();
    } catch (e) {
      toast.error("Falha ao criar SBOM", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const onScan = async (snap: SBOMSnapshot) => {
    if (!workspaceId) return;
    setScanning(snap.id);
    try {
      const r = await scanSnapshot(workspaceId, snap.id);
      toast.success(`Scan completo: ${r.scanned} componentes`, {
        description: `Critical: ${r.found_critical}, High: ${r.found_high}, Medium: ${r.found_medium}, Low: ${r.found_low}`,
      });
      refresh();
    } catch (e) {
      toast.error("Falha ao escanear", { description: (e as Error).message });
    } finally {
      setScanning(null);
    }
  };

  const onDelete = async (snap: SBOMSnapshot) => {
    if (!confirm(`Excluir SBOM "${snap.name}"?`)) return;
    try { await deleteSnapshot(snap.id); toast.success("SBOM excluído"); refresh(); }
    catch (e) { toast.error("Falha ao excluir", { description: (e as Error).message }); }
  };

  const openDetail = async (snap: SBOMSnapshot) => {
    setDetail(snap);
    const [c, v] = await Promise.all([getSnapshotComponents(snap.id), getSnapshotVulnerabilities(snap.id)]);
    setComponents(c); setDetailVulns(v);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="SBOM / Supply Chain"
        description="Inventário de dependências e detecção de vulnerabilidades conhecidas (CVEs)"
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!workspaceId}>
            <Plus className="h-4 w-4 mr-2" /> Novo SBOM
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>Snapshots</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div> :
            snapshots.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Nenhum SBOM ainda. Crie um colando o conteúdo do <code>package.json</code>.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Componentes</TableHead>
                    <TableHead>Vulnerabilidades (abertas)</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => {
                    const c = severityCounts(vulnsBySnapshot[s.id] || []);
                    return (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => openDetail(s)}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.total_components}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {c.critical > 0 && <Badge className={sevColor("critical")}>C {c.critical}</Badge>}
                            {c.high > 0 && <Badge className={sevColor("high")}>H {c.high}</Badge>}
                            {c.medium > 0 && <Badge className={sevColor("medium")}>M {c.medium}</Badge>}
                            {c.low > 0 && <Badge className={sevColor("low")}>L {c.low}</Badge>}
                            {c.critical + c.high + c.medium + c.low === 0 &&
                              <span className="text-xs text-muted-foreground">— nenhuma</span>}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{s.source}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => onScan(s)} disabled={scanning === s.id} loading={scanning === s.id}>
                            <Radar className="h-3.5 w-3.5 mr-1" /> Escanear
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(s)} className="ml-1 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          }
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo SBOM Snapshot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Production v1.2.3" />
            </div>
            <div>
              <Label>Conteúdo do package.json</Label>
              <Textarea
                value={pkgJson}
                onChange={(e) => setPkgJson(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder='{ "dependencies": { "react": "^18.0.0" }, "devDependencies": {} }'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={onCreate} loading={creating} disabled={!name.trim() || !pkgJson.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>{detail?.name}</SheetTitle></SheetHeader>
          {detail && (
            <Tabs defaultValue="components" className="mt-4">
              <TabsList>
                <TabsTrigger value="components">Componentes ({components.length})</TabsTrigger>
                <TabsTrigger value="vulns">Vulnerabilidades ({detailVulns.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="components">
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Versão</TableHead><TableHead>Tipo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {components.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.name}</TableCell>
                        <TableCell className="text-xs">{c.version}</TableCell>
                        <TableCell><Badge variant={c.direct ? "default" : "secondary"}>{c.direct ? "direct" : "dev"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="vulns">
                {detailVulns.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma vulnerabilidade. Execute "Escanear" para verificar.</div>
                ) : (
                  <div className="space-y-2">
                    {detailVulns.map((v) => (
                      <div key={v.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2 items-center">
                            <Badge className={sevColor(v.severity)}>{v.severity.toUpperCase()}</Badge>
                            <code className="text-xs">{v.cve_id}</code>
                            {v.cvss_score && <span className="text-xs text-muted-foreground">CVSS {v.cvss_score}</span>}
                          </div>
                          <Badge variant="outline">{v.status}</Badge>
                        </div>
                        {v.summary && <p className="text-xs text-muted-foreground">{v.summary}</p>}
                        {v.fixed_version && <p className="text-xs">Fix: <code>{v.fixed_version}</code></p>}
                        {v.reference_url && (
                          <a href={v.reference_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                            Detalhes <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
