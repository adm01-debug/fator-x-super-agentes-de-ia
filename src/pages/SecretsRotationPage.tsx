import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getWorkspaceInfo } from "@/lib/agentService";
import {
  listManagedSecrets, getSecretsSummary, registerManagedSecret,
  recordSecretRotation, markSecretRetired, refreshSecretsStatus,
  SECRET_CATEGORY_LABELS, ROTATION_REASON_LABELS, SECRET_TEMPLATES,
  getDaysUntilRotation, getStatusVariant,
  type ManagedSecret, type SecretsSummary, type SecretCategory,
  type SecretEnvironment, type RotationReason,
} from "@/services/secretsRotationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { KeyRound, RefreshCw, AlertTriangle, CheckCircle2, Clock, Archive, Plus, RotateCw, ShieldAlert } from "lucide-react";
import { logger } from "@/lib/logger";

export default function SecretsRotationPage() {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<ManagedSecret[]>([]);
  const [summary, setSummary] = useState<SecretsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterEnv, setFilterEnv] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Register dialog
  const [registerOpen, setRegisterOpen] = useState(false);
  const [regName, setRegName] = useState("");
  const [regCategory, setRegCategory] = useState<SecretCategory>("api_key");
  const [regProvider, setRegProvider] = useState("");
  const [regEnv, setRegEnv] = useState<SecretEnvironment>("prod");
  const [regInterval, setRegInterval] = useState(90);
  const [regNotes, setRegNotes] = useState("");

  // Rotate dialog
  const [rotateSecret, setRotateSecret] = useState<ManagedSecret | null>(null);
  const [rotateReason, setRotateReason] = useState<RotationReason>("scheduled");
  const [rotateNotes, setRotateNotes] = useState("");

  const load = useCallback(async (wsId: string) => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([listManagedSecrets(wsId), getSecretsSummary(wsId)]);
      setSecrets(list);
      setSummary(sum);
    } catch (err) {
      logger.error("Failed to load secrets:", err);
      toast.error("Falha ao carregar secrets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    getWorkspaceInfo().then(async (info) => {
      if (!info) return;
      // workspace info doesn't include id directly — fetch from supabase
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).maybeSingle();
      if (data?.id) {
        setWorkspaceId(data.id);
        load(data.id);
      }
    });
  }, [user, load]);

  const handleRefreshStatus = async () => {
    try {
      const r = await refreshSecretsStatus();
      toast.success(`${r.marked_overdue} marcados como overdue, ${r.marked_pending} como pending`);
      if (workspaceId) load(workspaceId);
    } catch (err) {
      toast.error("Falha ao atualizar status");
    }
  };

  const handleRegister = async () => {
    if (!workspaceId || !regName.trim()) return;
    try {
      await registerManagedSecret({
        workspace_id: workspaceId,
        name: regName.trim(),
        category: regCategory,
        provider: regProvider.trim() || undefined,
        environment: regEnv,
        rotation_interval_days: regInterval,
        notes: regNotes.trim() || undefined,
      });
      toast.success("Secret cadastrado");
      setRegisterOpen(false);
      setRegName(""); setRegProvider(""); setRegNotes(""); setRegInterval(90);
      load(workspaceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(`Falha: ${msg}`);
    }
  };

  const applyTemplate = (tpl: typeof SECRET_TEMPLATES[number]) => {
    setRegName(tpl.name);
    setRegCategory(tpl.category);
    setRegInterval(tpl.rotation_interval_days);
    if (tpl.provider) setRegProvider(tpl.provider);
  };

  const handleRotate = async () => {
    if (!rotateSecret) return;
    try {
      await recordSecretRotation(rotateSecret.id, rotateReason, rotateNotes.trim() || undefined);
      toast.success("Rotação registrada");
      setRotateSecret(null);
      setRotateNotes("");
      setRotateReason("scheduled");
      if (workspaceId) load(workspaceId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro";
      toast.error(`Falha: ${msg}`);
    }
  };

  const handleRetire = async (secret: ManagedSecret) => {
    if (!confirm(`Aposentar "${secret.name}"? Essa ação marca o secret como descomissionado.`)) return;
    try {
      await markSecretRetired(secret.id);
      toast.success("Secret aposentado");
      if (workspaceId) load(workspaceId);
    } catch (err) {
      toast.error("Falha ao aposentar");
    }
  };

  const filtered = secrets.filter(s =>
    (filterCategory === "all" || s.category === filterCategory) &&
    (filterEnv === "all" || s.environment === filterEnv) &&
    (filterStatus === "all" || s.status === filterStatus)
  );

  return (
    <div className="container py-8 max-w-7xl space-y-6 animate-page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            <KeyRound className="inline h-7 w-7 mr-2 text-primary" />
            Rotação de Secrets
          </h1>
          <p className="text-muted-foreground mt-1.5">
            Inventário e cadência de rotação de credenciais — SOC2 CC6.1 / ISO 27001 A.9.2.4
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshStatus}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar status
          </Button>
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Novo secret</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Cadastrar secret gerenciado</DialogTitle>
                <DialogDescription>
                  Apenas metadata é armazenada. Valores reais ficam em Vault/Cloud Secrets.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Templates</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {SECRET_TEMPLATES.map(t => (
                      <Button key={t.name} type="button" variant="outline" size="sm" onClick={() => applyTemplate(t)} className="h-7 text-xs">
                        {t.name} ({t.rotation_interval_days}d)
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={regName} onChange={e => setRegName(e.target.value)} placeholder="OpenAI API Key" />
                  </div>
                  <div>
                    <Label>Provedor</Label>
                    <Input value={regProvider} onChange={e => setRegProvider(e.target.value)} placeholder="OpenAI" />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={regCategory} onValueChange={(v) => setRegCategory(v as SecretCategory)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SECRET_CATEGORY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ambiente</Label>
                    <Select value={regEnv} onValueChange={(v) => setRegEnv(v as SecretEnvironment)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prod">Produção</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="dev">Dev</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Intervalo de rotação (dias)</Label>
                    <Input type="number" min={1} value={regInterval} onChange={e => setRegInterval(parseInt(e.target.value) || 90)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Notas</Label>
                    <Textarea value={regNotes} onChange={e => setRegNotes(e.target.value)} rows={2} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRegisterOpen(false)}>Cancelar</Button>
                <Button onClick={handleRegister} disabled={!regName.trim()}>Cadastrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={summary?.total ?? 0} icon={<KeyRound className="h-4 w-4" />} tone="default" />
        <StatCard label="Overdue" value={summary?.overdue ?? 0} icon={<ShieldAlert className="h-4 w-4" />} tone="destructive" pulse={!!summary?.overdue} />
        <StatCard label="Pendentes" value={summary?.pending ?? 0} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <StatCard label="Ativos" value={summary?.active ?? 0} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="Aposentados" value={summary?.retired ?? 0} icon={<Archive className="h-4 w-4" />} tone="muted" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">Inventário ({filtered.length})</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(SECRET_CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEnv} onValueChange={setFilterEnv}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ambientes</SelectItem>
                  <SelectItem value="prod">Produção</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="dev">Dev</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="pending_rotation">Pendente</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="retired">Aposentado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum secret cadastrado. Comece adicionando suas credenciais críticas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Última rotação</TableHead>
                  <TableHead>Próxima rotação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const days = getDaysUntilRotation(s.next_rotation_due);
                  const variant = getStatusVariant(s.status, days);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <div>{s.name}</div>
                        {s.provider && <div className="text-xs text-muted-foreground">{s.provider}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">{SECRET_CATEGORY_LABELS[s.category]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.environment === 'prod' ? 'default' : 'outline'} className="font-normal text-xs">
                          {s.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {s.last_rotated_at ? new Date(s.last_rotated_at).toLocaleDateString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.next_rotation_due ? (
                          <div>
                            <div>{new Date(s.next_rotation_due).toLocaleDateString('pt-BR')}</div>
                            {days !== null && s.status !== 'retired' && (
                              <div className={`text-xs ${days < 0 ? 'text-destructive' : days < 7 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                {days < 0 ? `${Math.abs(days)}d atrasado` : `em ${days}d`}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={variant} status={s.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status !== 'retired' && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setRotateSecret(s)}>
                              <RotateCw className="h-3 w-3 mr-1" /> Rotacionar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => handleRetire(s)}>
                              <Archive className="h-3 w-3" />
                            </Button>
                          </div>
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

      {/* Rotate dialog */}
      <Dialog open={!!rotateSecret} onOpenChange={(o) => !o && setRotateSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar rotação</DialogTitle>
            <DialogDescription>
              {rotateSecret?.name} — recalcula próxima data ({rotateSecret?.rotation_interval_days}d)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo</Label>
              <Select value={rotateReason} onValueChange={(v) => setRotateReason(v as RotationReason)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROTATION_REASON_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={rotateNotes} onChange={e => setRotateNotes(e.target.value)} rows={3} placeholder="Detalhes da rotação, ticket relacionado, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRotateSecret(null)}>Cancelar</Button>
            <Button onClick={handleRotate}>Registrar rotação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon, tone, pulse }: { label: string; value: number; icon: React.ReactNode; tone: 'default' | 'destructive' | 'warning' | 'success' | 'muted'; pulse?: boolean }) {
  const toneClasses = {
    default: 'text-foreground',
    destructive: 'text-destructive',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    muted: 'text-muted-foreground',
  };
  return (
    <Card className={pulse ? 'animate-pulse-subtle border-destructive/40' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className={toneClasses[tone]}>{icon}</span>
        </div>
        <div className={`text-2xl font-bold mt-1 tabular-nums ${toneClasses[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ variant, status }: { variant: 'overdue' | 'urgent' | 'soon' | 'ok' | 'retired'; status: string }) {
  const config = {
    overdue: { label: 'Overdue', cls: 'bg-destructive/15 text-destructive border-destructive/30 animate-pulse-subtle' },
    urgent: { label: '<7d', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
    soon: { label: '<30d', cls: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
    ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
    retired: { label: 'Aposentado', cls: 'bg-muted text-muted-foreground border-border' },
  }[variant];
  return (
    <Badge variant="outline" className={`${config.cls} font-medium text-xs`}>
      {config.label}
    </Badge>
  );
}
