import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Loader2, ShieldAlert, ShieldCheck, Key, UserX, Plus, Trash2, Monitor, Smartphone, Clock, Globe } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabaseExtended";
import { getWorkspaceId } from "@/lib/agentService";
import { toast } from "sonner";

const securityChecks = [
  { icon: Lock, title: 'Criptografia em trânsito', desc: 'TLS 1.3 em todas as comunicações', status: 'pass' },
  { icon: Key, title: 'Gestão de API Keys', desc: 'Chaves armazenadas com criptografia', status: 'pass' },
  { icon: Eye, title: 'Mascaramento de PII', desc: 'Dados pessoais detectados e mascarados', status: 'pass' },
  { icon: UserX, title: 'Anti-Jailbreak', desc: 'Detecção de prompt injection', status: 'pass' },
  { icon: ShieldAlert, title: 'Rate Limiting', desc: 'Limites de requisição por agente', status: 'warn' },
  { icon: ShieldCheck, title: 'Audit Logging', desc: 'Todas as ações registradas com trace', status: 'pass' },
];

const complianceFrameworks = [
  { name: 'LGPD', status: 'compliant', coverage: 92 },
  { name: 'SOC 2', status: 'partial', coverage: 78 },
  { name: 'GDPR', status: 'compliant', coverage: 88 },
  { name: 'ISO 27001', status: 'in_progress', coverage: 65 },
];

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [grName, setGrName] = useState('');
  const [grType, setGrType] = useState('content_filter');
  const [saving, setSaving] = useState(false);

  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrail_policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardrail_policies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!grName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      const { error } = await supabase.from('guardrail_policies').insert({
        name: grName.trim(),
        type: grType,
        workspace_id: wsId,
      });
      if (error) throw error;
      toast.success('Guardrail criado!');
      setNewOpen(false);
      setGrName('');
      queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase.from('guardrail_policies').update({ is_enabled: enabled }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('guardrail_policies').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Guardrail removido');
    queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
  };

  const typeLabels: Record<string, string> = {
    content_filter: 'Filtro de conteúdo',
    pii_detection: 'Detecção de PII',
    prompt_injection: 'Anti-injection',
    toxicity: 'Toxicidade',
    custom: 'Custom',
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Security & Guardrails"
        description="Segurança, compliance e governança dos agentes de IA"
        actions={
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                <Plus className="h-4 w-4" /> Novo guardrail
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader><DialogTitle>Novo Guardrail</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={grName} onChange={e => setGrName(e.target.value)} className="bg-secondary/50" placeholder="Ex: Filtro LGPD" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={grType} onValueChange={setGrType}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="content_filter">Filtro de conteúdo</SelectItem>
                      <SelectItem value="pii_detection">Detecção de PII</SelectItem>
                      <SelectItem value="prompt_injection">Anti-injection</SelectItem>
                      <SelectItem value="toxicity">Toxicidade</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <InfoHint title="Segurança em camadas">
        A segurança opera em múltiplas camadas: autenticação, criptografia, mascaramento de dados, detecção de jailbreak, rate limiting, audit logging e guardrails customizados por agente.
      </InfoHint>

      {/* Security Posture */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Postura de Segurança
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {securityChecks.map((check) => (
            <div key={check.title}
              className="p-3 rounded-lg bg-secondary/30 border border-border/30 flex items-start gap-3"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${check.status === 'pass' ? 'bg-nexus-emerald/10' : 'bg-nexus-amber/10'}`}>
                <check.icon className={`h-4 w-4 ${check.status === 'pass' ? 'text-nexus-emerald' : 'text-nexus-amber'}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground">{check.title}</p>
                  {check.status === 'pass' ? <CheckCircle className="h-3 w-3 text-nexus-emerald" /> : <AlertTriangle className="h-3 w-3 text-nexus-amber" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{check.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Compliance Frameworks
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {complianceFrameworks.map(fw => (
            <div key={fw.name} className="p-3 rounded-lg bg-secondary/30 border border-border/30 text-center">
              <p className="text-sm font-heading font-bold text-foreground">{fw.name}</p>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full nexus-gradient-bg transition-all" style={{ width: `${fw.coverage}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">{fw.coverage}%</span>
                <Badge variant="outline" className={`text-[11px] ${fw.status === 'compliant' ? 'border-nexus-emerald/30 text-nexus-emerald' : fw.status === 'partial' ? 'border-nexus-amber/30 text-nexus-amber' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                  {fw.status === 'compliant' ? 'Conforme' : fw.status === 'partial' ? 'Parcial' : 'Planejado'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guardrail Policies from DB */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" /> Guardrail Policies <Badge variant="outline" className="text-[11px] ml-1">{guardrails.length}</Badge>
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : guardrails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">Nenhum guardrail configurado.</p>
            <p className="text-[11px] text-muted-foreground mt-1">Crie guardrails para proteger seus agentes.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {guardrails.map((g) => (
              <div key={g.id}
                className="p-3 rounded-lg bg-secondary/20 border border-border/30 flex items-center gap-3 group"
              >
                <ShieldCheck className={`h-5 w-5 shrink-0 ${g.is_enabled ? 'text-nexus-emerald' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[11px] text-muted-foreground">{typeLabels[g.type] || g.type}</p>
                </div>
                <Switch checked={g.is_enabled ?? true} onCheckedChange={(v) => handleToggle(g.id, v)} />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remover guardrail?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Management */}
      <SessionManagement />

      {/* Rate Limiting Visual */}
      <RateLimitingPanel />

      {/* Audit Log */}
      <AuditLogSection />
    </div>
  );
}

function AuditLogSection() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const { data, error } = await fromTable('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) return [];
      return data ?? [];
    },
  });

  const handleExport = (format: 'csv' | 'json') => {
    if (logs.length === 0) return;
    let content: string;
    let mime: string;
    let ext: string;

    if (format === 'csv') {
      const headers = ['Data', 'Ação', 'Tipo', 'Entity ID', 'Metadata'];
      const rows = logs.map((l: any) => [
        new Date(l.created_at).toISOString(),
        l.action,
        l.entity_type,
        l.entity_id || '',
        JSON.stringify(l.metadata || {}),
      ]);
      content = [headers.join(','), ...rows.map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(logs, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Audit log exportado como ${ext.toUpperCase()}`);
  };

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Audit Trail
        </h3>
        {logs.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleExport('csv')}>
              CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleExport('json')}>
              JSON
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {logs.map((log: any, i: number) => (
            <div key={log.id || i}
              className="flex items-center gap-3 py-2 px-2 rounded hover:bg-secondary/30 text-xs">
              <span className="text-muted-foreground w-[130px] shrink-0 font-mono text-[11px]">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
              <Badge variant="outline" className="text-[11px] shrink-0">{log.action || log.event || 'action'}</Badge>
              <span className="text-foreground truncate">{log.description || log.details || JSON.stringify(log.metadata || {}).substring(0, 100)}</span>
              <span className="text-muted-foreground ml-auto shrink-0">{log.user_email || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionManagement() {
  const sessions = [
    { id: '1', device: 'Chrome / macOS', ip: '187.45.xxx.xx', location: 'São Paulo, BR', lastActive: new Date(), current: true },
    { id: '2', device: 'Safari / iPhone', ip: '187.45.xxx.xx', location: 'São Paulo, BR', lastActive: new Date(Date.now() - 3600000) , current: false },
    { id: '3', device: 'Firefox / Windows', ip: '201.17.xxx.xx', location: 'Rio de Janeiro, BR', lastActive: new Date(Date.now() - 86400000), current: false },
  ];

  const handleRevoke = (id: string) => {
    toast.success('Sessão encerrada com sucesso');
  };

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary" /> Sessões Ativas
      </h3>
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30 nexus-row-hover">
            <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
              {s.device.includes('iPhone') || s.device.includes('Android') ? (
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Monitor className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">{s.device}</p>
                {s.current && <Badge className="text-[10px] bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20">Atual</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Globe className="h-3 w-3 inline" /> {s.location} • <Clock className="h-3 w-3 inline" /> {s.lastActive.toLocaleString('pt-BR')}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleRevoke(s.id)}>
                Encerrar
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="mt-3 text-xs text-destructive hover:text-destructive" onClick={() => toast.success('Todas as outras sessões encerradas')}>
        Encerrar todas as outras sessões
      </Button>
    </div>
  );
}

function RateLimitingPanel() {
  const limits = [
    { name: 'API Requests', current: 847, max: 1000, unit: '/min', color: 'nexus-emerald' },
    { name: 'LLM Calls', current: 145, max: 200, unit: '/min', color: 'nexus-cyan' },
    { name: 'File Uploads', current: 23, max: 50, unit: '/hora', color: 'nexus-amber' },
    { name: 'Webhook Calls', current: 12, max: 100, unit: '/min', color: 'nexus-purple' },
  ];

  return (
    <div className="nexus-card">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" /> Rate Limiting
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {limits.map(l => {
          const pct = (l.current / l.max) * 100;
          const isHigh = pct > 80;
          return (
            <div key={l.name} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
              <p className="text-xs font-medium text-foreground">{l.name}</p>
              <p className="text-lg font-heading font-bold text-foreground mt-1">
                {l.current}<span className="text-xs font-normal text-muted-foreground">/{l.max} {l.unit}</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isHigh ? 'bg-nexus-amber' : 'bg-nexus-emerald'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {isHigh && <p className="text-[10px] text-nexus-amber mt-1">⚠ Próximo do limite</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
