import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Search, ShieldAlert, AlertCircle, Calendar, Eye } from "lucide-react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceInfo } from "@/lib/agentService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  type Asset, type AssetAudit, type AssetSummary, type AssetType,
  type AssetEnvironment, type AssetClassification, type AssetStatus,
  listAssets, getAssetSummary, registerAsset, auditAsset, decommissionAsset,
  listAssetAudits, isWarrantyExpiring, isAuditOverdue,
} from "@/services/assetInventoryService";

const TYPE_LABELS: Record<AssetType, string> = {
  hardware: "Hardware",
  software: "Software",
  cloud_resource: "Cloud",
  saas_account: "SaaS",
  network_device: "Rede",
  mobile_device: "Mobile",
  iot: "IoT",
  other: "Outro",
};

const CLASSIFICATION_VARIANT: Record<AssetClassification, "outline" | "secondary" | "default" | "destructive"> = {
  public: "outline",
  internal: "secondary",
  confidential: "default",
  restricted: "destructive",
};

const STATUS_VARIANT: Record<AssetStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  maintenance: "secondary",
  decommissioned: "outline",
  lost: "destructive",
};

export default function AssetInventoryPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [drillAsset, setDrillAsset] = useState<Asset | null>(null);
  const [audits, setAudits] = useState<AssetAudit[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: "", asset_type: "hardware" as AssetType, classification: "internal" as AssetClassification,
    environment: "production" as AssetEnvironment, vendor: "", model: "", serial_number: "",
    hostname: "", ip_address: "", os: "", version: "", location: "",
    purchased_at: "", warranty_until: "", category: "",
  });

  // Audit form
  const [auditForm, setAuditForm] = useState({ findings: "", status_after: "active" as AssetStatus, notes: "" });

  const load = async (wsId: string) => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([listAssets(wsId), getAssetSummary(wsId)]);
      setAssets(list);
      setSummary(sum);
    } catch (err) {
      logger.error("load assets failed:", err);
      toast({ title: "Erro ao carregar", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const info = await getWorkspaceInfo();
      const wsId = (info as { workspaceId?: string } | null)?.workspaceId
        ?? (await supabase.from("workspaces").select("id").eq("owner_id", user.id).maybeSingle()).data?.id;
      if (!wsId) return;
      setWorkspaceId(wsId);
      const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", wsId).maybeSingle();
      setIsAdmin(ws?.owner_id === user.id);
      await load(wsId);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
      if (envFilter !== "all" && a.environment !== envFilter) return false;
      if (classFilter !== "all" && a.classification !== classFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          (a.hostname?.toLowerCase().includes(q) ?? false) ||
          (a.serial_number?.toLowerCase().includes(q) ?? false) ||
          (a.ip_address?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [assets, typeFilter, envFilter, classFilter, statusFilter, search]);

  const handleCreate = async () => {
    if (!workspaceId || !form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    try {
      await registerAsset({
        workspace_id: workspaceId,
        name: form.name.trim(),
        asset_type: form.asset_type,
        classification: form.classification,
        environment: form.environment,
        category: form.category || null,
        vendor: form.vendor || null,
        model: form.model || null,
        serial_number: form.serial_number || null,
        hostname: form.hostname || null,
        ip_address: form.ip_address || null,
        os: form.os || null,
        version: form.version || null,
        location: form.location || null,
        purchased_at: form.purchased_at || null,
        warranty_until: form.warranty_until || null,
      });
      toast({ title: "Ativo cadastrado" });
      setCreateOpen(false);
      setForm({
        name: "", asset_type: "hardware", classification: "internal", environment: "production",
        vendor: "", model: "", serial_number: "", hostname: "", ip_address: "", os: "",
        version: "", location: "", purchased_at: "", warranty_until: "", category: "",
      });
      await load(workspaceId);
    } catch (err) {
      toast({ title: "Erro ao cadastrar", description: String(err), variant: "destructive" });
    }
  };

  const openDrill = async (asset: Asset) => {
    setDrillAsset(asset);
    try {
      const a = await listAssetAudits(asset.id);
      setAudits(a);
    } catch (err) {
      logger.error("load audits failed:", err);
    }
  };

  const handleAudit = async () => {
    if (!drillAsset || !auditForm.findings.trim()) {
      toast({ title: "Achados obrigatórios", variant: "destructive" });
      return;
    }
    try {
      await auditAsset(drillAsset.id, auditForm.findings, auditForm.status_after, auditForm.notes || undefined);
      toast({ title: "Auditoria registrada" });
      setAuditForm({ findings: "", status_after: "active", notes: "" });
      const a = await listAssetAudits(drillAsset.id);
      setAudits(a);
      if (workspaceId) await load(workspaceId);
      const updated = (await listAssets(workspaceId!)).find(x => x.id === drillAsset.id);
      if (updated) setDrillAsset(updated);
    } catch (err) {
      toast({ title: "Erro ao auditar", description: String(err), variant: "destructive" });
    }
  };

  const handleDecommission = async () => {
    if (!drillAsset) return;
    const reason = window.prompt("Motivo do decomissionamento:");
    if (!reason) return;
    try {
      await decommissionAsset(drillAsset.id, reason);
      toast({ title: "Ativo decomissionado" });
      setDrillAsset(null);
      if (workspaceId) await load(workspaceId);
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Inventário (CMDB)"
        description="Inventário de ativos — hardware, software, cloud, SaaS e dispositivos. ISO 27001 A.5.9 / SOC2 CC6.1 / NIST CSF ID.AM."
        actions={
          isAdmin ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Novo ativo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar ativo</DialogTitle>
                  <DialogDescription>Registre um novo ativo no inventário.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="MacBook Pro CTO" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.asset_type} onValueChange={v => setForm({ ...form, asset_type: v as AssetType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Classificação</Label>
                    <Select value={form.classification} onValueChange={v => setForm({ ...form, classification: v as AssetClassification })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Público</SelectItem>
                        <SelectItem value="internal">Interno</SelectItem>
                        <SelectItem value="confidential">Confidencial</SelectItem>
                        <SelectItem value="restricted">Restrito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select value={form.environment} onValueChange={v => setForm({ ...form, environment: v as AssetEnvironment })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Produção</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="development">Desenvolvimento</SelectItem>
                        <SelectItem value="testing">Testes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Notebook, API, etc." />
                  </div>
                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Apple" />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="MBP M3 Max" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nº de série</Label>
                    <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hostname</Label>
                    <Input value={form.hostname} onChange={e => setForm({ ...form, hostname: e.target.value })} placeholder="cto-mbp.local" />
                  </div>
                  <div className="space-y-2">
                    <Label>IP</Label>
                    <Input value={form.ip_address} onChange={e => setForm({ ...form, ip_address: e.target.value })} placeholder="10.0.0.5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Sistema operacional</Label>
                    <Input value={form.os} onChange={e => setForm({ ...form, os: e.target.value })} placeholder="macOS 15.1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Versão</Label>
                    <Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização</Label>
                    <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Escritório SP" />
                  </div>
                  <div className="space-y-2">
                    <Label>Compra</Label>
                    <Input type="date" value={form.purchased_at} onChange={e => setForm({ ...form, purchased_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Garantia até</Label>
                    <Input type="date" value={form.warranty_until} onChange={e => setForm({ ...form, warranty_until: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate}>Cadastrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de ativos" value={summary?.total ?? 0} icon={Boxes} />
        <StatCard label="Sem dono" value={summary?.no_owner ?? 0} icon={AlertCircle} variant={summary && summary.no_owner > 0 ? "warn" : "ok"} />
        <StatCard label="Sem auditoria 90d" value={summary?.audit_overdue ?? 0} icon={Eye} variant={summary && summary.audit_overdue > 0 ? "warn" : "ok"} pulse={!!(summary && summary.audit_overdue > 0)} />
        <StatCard label="Garantia vencendo 30d" value={summary?.warranty_expiring ?? 0} icon={Calendar} variant={summary && summary.warranty_expiring > 0 ? "warn" : "ok"} pulse={!!(summary && summary.warranty_expiring > 0)} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar nome, hostname, IP, serial..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={envFilter} onValueChange={setEnvFilter}>
            <SelectTrigger><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ambientes</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Desenvolvimento</SelectItem>
              <SelectItem value="testing">Testes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas classificações</SelectItem>
              <SelectItem value="public">Público</SelectItem>
              <SelectItem value="internal">Interno</SelectItem>
              <SelectItem value="confidential">Confidencial</SelectItem>
              <SelectItem value="restricted">Restrito</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
              <SelectItem value="decommissioned">Decomissionado</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ativos ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum ativo encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Classif.</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hostname / IP</TableHead>
                  <TableHead>Garantia</TableHead>
                  <TableHead>Última auditoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(a => {
                  const warnExp = isWarrantyExpiring(a);
                  const auditOver = isAuditOverdue(a);
                  return (
                    <TableRow key={a.id} onClick={() => openDrill(a)} className="cursor-pointer">
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{TYPE_LABELS[a.asset_type]}</TableCell>
                      <TableCell><Badge variant={CLASSIFICATION_VARIANT[a.classification]}>{a.classification}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{a.environment}</Badge></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.hostname ?? "—"}{a.ip_address ? ` / ${a.ip_address}` : ""}
                      </TableCell>
                      <TableCell>
                        {a.warranty_until ? (
                          <span className={warnExp ? "text-nexus-amber font-medium animate-glow-pulse" : "text-xs text-muted-foreground"}>
                            {a.warranty_until}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {auditOver ? (
                          <Badge variant="destructive" className="animate-glow-pulse">Atrasada</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{a.last_seen_at ? new Date(a.last_seen_at).toLocaleDateString("pt-BR") : "Nunca"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill-in sheet */}
      <Sheet open={!!drillAsset} onOpenChange={o => !o && setDrillAsset(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {drillAsset && (
            <>
              <SheetHeader>
                <SheetTitle>{drillAsset.name}</SheetTitle>
                <SheetDescription>
                  {TYPE_LABELS[drillAsset.asset_type]} · {drillAsset.environment} · <Badge variant={CLASSIFICATION_VARIANT[drillAsset.classification]}>{drillAsset.classification}</Badge>
                </SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="details" className="mt-6">
                <TabsList>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="audits">Auditorias ({audits.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Status" value={<Badge variant={STATUS_VARIANT[drillAsset.status]}>{drillAsset.status}</Badge>} />
                    <Field label="Categoria" value={drillAsset.category ?? "—"} />
                    <Field label="Fornecedor" value={drillAsset.vendor ?? "—"} />
                    <Field label="Modelo" value={drillAsset.model ?? "—"} />
                    <Field label="Serial" value={drillAsset.serial_number ?? "—"} />
                    <Field label="Hostname" value={drillAsset.hostname ?? "—"} />
                    <Field label="IP" value={drillAsset.ip_address ?? "—"} />
                    <Field label="OS" value={drillAsset.os ?? "—"} />
                    <Field label="Versão" value={drillAsset.version ?? "—"} />
                    <Field label="Localização" value={drillAsset.location ?? "—"} />
                    <Field label="Compra" value={drillAsset.purchased_at ?? "—"} />
                    <Field label="Garantia" value={drillAsset.warranty_until ?? "—"} />
                    <Field label="Última auditoria" value={drillAsset.last_seen_at ? new Date(drillAsset.last_seen_at).toLocaleString("pt-BR") : "Nunca"} />
                  </div>
                  {isAdmin && drillAsset.status !== "decommissioned" && (
                    <div className="pt-4 border-t">
                      <Button variant="destructive" size="sm" onClick={handleDecommission}>
                        <ShieldAlert className="h-4 w-4 mr-2" />Decomissionar
                      </Button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="audits" className="space-y-4">
                  {isAdmin && (
                    <div className="space-y-3 p-3 rounded-lg border bg-secondary/20">
                      <p className="text-sm font-medium">Nova auditoria</p>
                      <Textarea
                        placeholder="Achados..."
                        value={auditForm.findings}
                        onChange={e => setAuditForm({ ...auditForm, findings: e.target.value })}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Select value={auditForm.status_after} onValueChange={v => setAuditForm({ ...auditForm, status_after: v as AssetStatus })}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                            <SelectItem value="lost">Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Notas (opcional)" value={auditForm.notes} onChange={e => setAuditForm({ ...auditForm, notes: e.target.value })} />
                        <Button onClick={handleAudit}>Registrar</Button>
                      </div>
                    </div>
                  )}
                  {audits.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma auditoria registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {audits.map(a => (
                        <div key={a.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant={STATUS_VARIANT[a.status_after]}>{a.status_after}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(a.audited_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-sm">{a.findings}</p>
                          {a.notes && <p className="text-xs text-muted-foreground mt-1">{a.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, variant = "ok", pulse }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  variant?: "ok" | "warn"; pulse?: boolean;
}) {
  const color = variant === "warn" ? "text-nexus-amber" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-glow-pulse" : ""}`} />
        </div>
        <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
