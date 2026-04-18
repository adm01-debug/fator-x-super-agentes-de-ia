import { logger } from "@/lib/logger";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, AlertTriangle, ShieldCheck, FileText, Clock, RefreshCw, ExternalLink, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/shared/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceId } from "@/lib/agentService";
import {
  listVendors, getVendorSummary, registerVendor, assessVendor, offboardVendor,
  listAssessments, listDocuments, uploadVendorDocument,
  isDpaExpired, isDpaExpiringSoon, isCertExpired, isReviewOverdue,
  criticalityColor, statusColor,
  type Vendor, type VendorAssessment, type VendorDocument,
  type VendorType, type Criticality, type DataClassification, type DocType,
} from "@/services/vendorRiskService";

const VENDOR_TYPES: { v: VendorType; l: string }[] = [
  { v: "saas", l: "SaaS" }, { v: "processor", l: "Processador de dados" },
  { v: "api", l: "API externa" }, { v: "infra", l: "Infraestrutura" },
  { v: "consulting", l: "Consultoria" }, { v: "other", l: "Outro" },
];
const CRITICALITIES: Criticality[] = ["critical", "high", "medium", "low"];
const DATA_CLASSES: { v: DataClassification; l: string }[] = [
  { v: "pii", l: "PII" }, { v: "phi", l: "PHI" }, { v: "financial", l: "Financeiro" },
  { v: "confidential", l: "Confidencial" }, { v: "public", l: "Público" },
];
const DOC_TYPES: { v: DocType; l: string }[] = [
  { v: "dpa", l: "DPA" }, { v: "soc2", l: "SOC 2" }, { v: "iso27001", l: "ISO 27001" },
  { v: "pentest_report", l: "Relatório Pentest" }, { v: "questionnaire", l: "Questionário" },
  { v: "contract", l: "Contrato" }, { v: "other", l: "Outro" },
];

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}
function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export default function VendorsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [filterCrit, setFilterCrit] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Vendor | null>(null);

  useEffect(() => {
    if (user) getWorkspaceId().then(setWorkspaceId).catch((e: unknown) => logger.error("ws", e));
  }, [user]);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", workspaceId],
    queryFn: () => listVendors(workspaceId!),
    enabled: !!workspaceId,
  });
  const { data: summary } = useQuery({
    queryKey: ["vendor-summary", workspaceId],
    queryFn: () => getVendorSummary(workspaceId!),
    enabled: !!workspaceId,
  });

  const filtered = useMemo(() => vendors.filter(v =>
    (filterCrit === "all" || v.criticality === filterCrit) &&
    (filterType === "all" || v.vendor_type === filterType) &&
    (filterStatus === "all" || v.status === filterStatus)
  ), [vendors, filterCrit, filterType, filterStatus]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["vendors", workspaceId] });
    qc.invalidateQueries({ queryKey: ["vendor-summary", workspaceId] });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Fornecedores"
        description="Gestão de risco de terceiros (TPRM) — SOC 2 CC9.2 / ISO 27001 A.15 / LGPD Art.39"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh} aria-label="Atualizar">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={!workspaceId}>
              <Plus className="h-4 w-4 mr-2" /> Novo fornecedor
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Ativos" value={summary?.active ?? 0} icon={Building2} />
        <MetricCard title="Críticos" value={summary?.critical ?? 0} icon={AlertTriangle} />
        <MetricCard title="DPAs vencendo" value={summary?.dpa_expiring ?? 0} icon={Clock} />
        <MetricCard title="DPAs/Certs expirados" value={(summary?.dpa_expired ?? 0) + (summary?.certs_expired ?? 0)} icon={FileText} />
        <MetricCard title="Reviews atrasados" value={summary?.overdue_reviews ?? 0} icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Inventário de fornecedores</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={filterCrit} onValueChange={setFilterCrit}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Criticidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas criticidades</SelectItem>
                  {CRITICALITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {VENDOR_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="under_review">Em revisão</SelectItem>
                  <SelectItem value="suspended">Suspensos</SelectItem>
                  <SelectItem value="offboarded">Encerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Building2} title="Sem fornecedores" description="Cadastre seu primeiro fornecedor para começar." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Criticidade</TableHead>
                  <TableHead>Dados</TableHead>
                  <TableHead>DPA</TableHead>
                  <TableHead>Certificações</TableHead>
                  <TableHead>Próxima review</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const dpaExp = isDpaExpired(v);
                  const dpaSoon = isDpaExpiringSoon(v);
                  const soc2Exp = isCertExpired(v.soc2_valid_until);
                  const isoExp = isCertExpired(v.iso27001_valid_until);
                  const reviewOverdue = isReviewOverdue(v);
                  return (
                    <TableRow key={v.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(v)}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{VENDOR_TYPES.find(t => t.v === v.vendor_type)?.l ?? v.vendor_type}</TableCell>
                      <TableCell><Badge variant="outline" className={criticalityColor(v.criticality)}>{v.criticality}</Badge></TableCell>
                      <TableCell className="text-xs uppercase tracking-wider text-muted-foreground">{v.data_classification}</TableCell>
                      <TableCell>
                        {!v.dpa_signed ? (
                          <Badge variant="outline" className="bg-secondary text-muted-foreground">Não assinado</Badge>
                        ) : dpaExp ? (
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 animate-pulse">Expirado</Badge>
                        ) : dpaSoon ? (
                          <Badge variant="outline" className="bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30">{daysUntil(v.dpa_expires_at)}d</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {v.soc2_valid_until && (
                            <Badge variant="outline" className={soc2Exp ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse" : "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30"}>
                              SOC2
                            </Badge>
                          )}
                          {v.iso27001_valid_until && (
                            <Badge variant="outline" className={isoExp ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse" : "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30"}>
                              ISO
                            </Badge>
                          )}
                          {!v.soc2_valid_until && !v.iso27001_valid_until && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {reviewOverdue ? (
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 animate-pulse">Atrasada</Badge>
                        ) : (
                          <span className="text-muted-foreground">{fmtDate(v.next_review_due)}</span>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(v.status)}>{v.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {workspaceId && (
        <CreateVendorDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          workspaceId={workspaceId}
          onCreated={refresh}
        />
      )}

      <VendorDrawer
        vendor={selected}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />
    </div>
  );
}

// ============ Create Dialog ============

function CreateVendorDialog({
  open, onOpenChange, workspaceId, onCreated,
}: {
  open: boolean; onOpenChange: (b: boolean) => void; workspaceId: string; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [vendorType, setVendorType] = useState<VendorType>("saas");
  const [criticality, setCriticality] = useState<Criticality>("medium");
  const [dataClass, setDataClass] = useState<DataClassification>("confidential");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dpaSigned, setDpaSigned] = useState(false);
  const [dpaExpiresAt, setDpaExpiresAt] = useState("");
  const [soc2, setSoc2] = useState("");
  const [iso, setIso] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      await registerVendor({
        workspaceId, name: name.trim(), vendorType, criticality, dataClassification: dataClass,
        website: website || undefined,
        contactEmail: contactEmail || undefined,
        dpaSigned, dpaExpiresAt: dpaExpiresAt || null,
        soc2ValidUntil: soc2 || null, iso27001ValidUntil: iso || null,
        notes: notes || undefined,
      });
      toast.success("Fornecedor cadastrado");
      onOpenChange(false);
      setName(""); setWebsite(""); setContactEmail(""); setDpaSigned(false); setDpaExpiresAt(""); setSoc2(""); setIso(""); setNotes("");
      onCreated();
    } catch (e) {
      toast.error("Falha ao cadastrar", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="OpenAI, Stripe, AWS…" />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={vendorType} onValueChange={v => setVendorType(v as VendorType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VENDOR_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Criticidade</Label>
            <Select value={criticality} onValueChange={v => setCriticality(v as Criticality)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CRITICALITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Classificação de dados</Label>
            <Select value={dataClass} onValueChange={v => setDataClass(v as DataClassification)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DATA_CLASSES.map(d => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>E-mail de contato</Label>
            <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} type="email" />
          </div>
          <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-border/40 p-3">
            <Switch checked={dpaSigned} onCheckedChange={setDpaSigned} id="dpa" />
            <Label htmlFor="dpa" className="cursor-pointer">DPA assinado</Label>
            {dpaSigned && (
              <Input type="date" value={dpaExpiresAt} onChange={e => setDpaExpiresAt(e.target.value)} className="ml-auto max-w-[200px]" placeholder="Validade" />
            )}
          </div>
          <div>
            <Label>SOC 2 válido até</Label>
            <Input type="date" value={soc2} onChange={e => setSoc2(e.target.value)} />
          </div>
          <div>
            <Label>ISO 27001 válido até</Label>
            <Input type="date" value={iso} onChange={e => setIso(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Cadastrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Drill-in Sheet ============

function VendorDrawer({ vendor, onClose, onChanged }: { vendor: Vendor | null; onClose: () => void; onChanged: () => void }) {
  if (!vendor) return null;
  return (
    <Sheet open={!!vendor} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> {vendor.name}
          </SheetTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className={criticalityColor(vendor.criticality)}>{vendor.criticality}</Badge>
            <Badge variant="outline" className={statusColor(vendor.status)}>{vendor.status}</Badge>
            <Badge variant="outline">{VENDOR_TYPES.find(t => t.v === vendor.vendor_type)?.l}</Badge>
          </div>
        </SheetHeader>
        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
            <TabsTrigger value="assessments" className="flex-1">Assessments</TabsTrigger>
            <TabsTrigger value="documents" className="flex-1">Documentos</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <DetailsTab vendor={vendor} onChanged={onChanged} onClose={onClose} />
          </TabsContent>
          <TabsContent value="assessments">
            <AssessmentsTab vendor={vendor} onChanged={onChanged} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab vendor={vendor} onChanged={onChanged} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function DetailsTab({ vendor, onChanged, onClose }: { vendor: Vendor; onChanged: () => void; onClose: () => void }) {
  const [offboarding, setOffboarding] = useState(false);
  const offboard = async () => {
    if (!confirm(`Encerrar fornecedor "${vendor.name}"? Essa ação marca como offboarded e mantém histórico.`)) return;
    setOffboarding(true);
    try {
      await offboardVendor(vendor.id);
      toast.success("Fornecedor encerrado");
      onChanged(); onClose();
    } catch (e) {
      toast.error("Falha ao encerrar", { description: e instanceof Error ? e.message : "" });
    } finally { setOffboarding(false); }
  };
  return (
    <div className="space-y-3 mt-4 text-sm">
      <Field label="Website">
        {vendor.website ? <a href={vendor.website} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">{vendor.website} <ExternalLink className="h-3 w-3" /></a> : "—"}
      </Field>
      <Field label="Contato">{vendor.contact_email || "—"}</Field>
      <Field label="Classificação de dados">{vendor.data_classification.toUpperCase()}</Field>
      <Field label="Onboarded em">{fmtDate(vendor.onboarded_at)}</Field>
      <Field label="DPA">
        {vendor.dpa_signed ? `Assinado · validade ${fmtDate(vendor.dpa_expires_at)}` : "Não assinado"}
      </Field>
      <Field label="SOC 2">{fmtDate(vendor.soc2_valid_until)}</Field>
      <Field label="ISO 27001">{fmtDate(vendor.iso27001_valid_until)}</Field>
      <Field label="Próxima review">{fmtDate(vendor.next_review_due)}</Field>
      {vendor.notes && <Field label="Notas">{vendor.notes}</Field>}
      {vendor.status !== "offboarded" && (
        <div className="pt-4 border-t border-border/40">
          <Button variant="destructive" size="sm" onClick={offboard} disabled={offboarding}>
            <Trash2 className="h-4 w-4 mr-2" /> Encerrar fornecedor
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function AssessmentsTab({ vendor, onChanged }: { vendor: Vendor; onChanged: () => void }) {
  const { data: list = [], refetch } = useQuery({
    queryKey: ["vendor-assessments", vendor.id],
    queryFn: () => listAssessments(vendor.id),
  });
  const [sec, setSec] = useState(3);
  const [comp, setComp] = useState(3);
  const [op, setOp] = useState(3);
  const [findings, setFindings] = useState("");
  const [recs, setRecs] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await assessVendor({
        vendorId: vendor.id, securityScore: sec, complianceScore: comp, operationalScore: op,
        findings: findings.split("\n").map(s => s.trim()).filter(Boolean),
        recommendations: recs || undefined,
      });
      toast.success("Assessment registrado");
      setFindings(""); setRecs("");
      refetch(); onChanged();
    } catch (e) {
      toast.error("Falha ao registrar", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Novo assessment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ScoreInput label="Segurança" value={sec} onChange={setSec} />
          <ScoreInput label="Compliance" value={comp} onChange={setComp} />
          <ScoreInput label="Operacional" value={op} onChange={setOp} />
          <div>
            <Label>Findings (uma linha cada)</Label>
            <Textarea value={findings} onChange={e => setFindings(e.target.value)} rows={3} placeholder="Ex.: SOC2 vencendo em 60d&#10;Logs sem retenção configurada" />
          </div>
          <div>
            <Label>Recomendações</Label>
            <Textarea value={recs} onChange={e => setRecs(e.target.value)} rows={2} />
          </div>
          <Button onClick={submit} disabled={saving} size="sm">Registrar assessment</Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Histórico ({list.length})</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem avaliações ainda.</p>
        ) : (
          <div className="space-y-2">
            {list.map((a: VendorAssessment) => (
              <Card key={a.id}>
                <CardContent className="pt-4 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{new Date(a.assessed_at).toLocaleString("pt-BR")}</span>
                    <Badge variant="outline" className={a.risk_score >= 15 ? "bg-destructive/15 text-destructive border-destructive/30" : a.risk_score >= 9 ? "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30" : "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30"}>
                      Risco {a.risk_score}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <span>Segurança: <strong>{a.security_score}/5</strong></span>
                    <span>Compliance: <strong>{a.compliance_score}/5</strong></span>
                    <span>Operacional: <strong>{a.operational_score}/5</strong></span>
                  </div>
                  {a.findings?.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {a.findings.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                  {a.recommendations && <p className="text-xs italic text-muted-foreground">→ {a.recommendations}</p>}
                  {a.next_review_due && <p className="text-xs text-muted-foreground">Próxima review: {fmtDate(a.next_review_due)}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <Label>{label}</Label>
        <span className="text-muted-foreground">{value}/5</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-8 rounded-md text-xs font-medium border transition-colors ${value === n ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-muted-foreground border-border/40 hover:bg-secondary/80"}`}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab({ vendor, onChanged }: { vendor: Vendor; onChanged: () => void }) {
  const { data: docs = [], refetch } = useQuery({
    queryKey: ["vendor-docs", vendor.id],
    queryFn: () => listDocuments(vendor.id),
  });
  const [docType, setDocType] = useState<DocType>("dpa");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      await uploadVendorDocument({
        vendorId: vendor.id, docType, title: title.trim(),
        fileUrl: fileUrl || undefined, validUntil: validUntil || null,
      });
      toast.success("Documento registrado");
      setTitle(""); setFileUrl(""); setValidUntil("");
      refetch(); onChanged();
    } catch (e) {
      toast.error("Falha ao registrar", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Novo documento</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={docType} onValueChange={v => setDocType(v as DocType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="DPA OpenAI 2026" />
          </div>
          <div>
            <Label>URL (opcional)</Label>
            <Input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." />
          </div>
          <Button onClick={submit} disabled={saving} size="sm">Registrar</Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Documentos ({docs.length})</h3>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem documentos.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d: VendorDocument) => {
              const expired = isCertExpired(d.valid_until);
              const soonDays = daysUntil(d.valid_until);
              const soon = soonDays !== null && soonDays >= 0 && soonDays <= 30;
              return (
                <Card key={d.id}>
                  <CardContent className="pt-4 flex items-center justify-between text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{DOC_TYPES.find(t => t.v === d.doc_type)?.l ?? d.doc_type}</Badge>
                        <span className="font-medium">{d.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enviado em {new Date(d.uploaded_at).toLocaleDateString("pt-BR")}
                        {d.valid_until && <> · Válido até {fmtDate(d.valid_until)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {expired && <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 animate-pulse">Expirado</Badge>}
                      {!expired && soon && <Badge variant="outline" className="bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30">{soonDays}d</Badge>}
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
