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
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Loader2, ShieldAlert, ShieldCheck, Key, UserX, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
    } catch (e: any) {
      toast.error(e.message);
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
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
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
          {securityChecks.map((check, i) => (
            <motion.div key={check.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-3 rounded-lg bg-secondary/30 border border-border/30 flex items-start gap-3"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${check.status === 'pass' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <check.icon className={`h-4 w-4 ${check.status === 'pass' ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground">{check.title}</p>
                  {check.status === 'pass' ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{check.desc}</p>
              </div>
            </motion.div>
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
                <span className="text-[10px] text-muted-foreground">{fw.coverage}%</span>
                <Badge variant="outline" className={`text-[9px] ${fw.status === 'compliant' ? 'border-emerald-500/30 text-emerald-400' : fw.status === 'partial' ? 'border-amber-500/30 text-amber-400' : 'border-muted-foreground/30 text-muted-foreground'}`}>
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
          <ShieldAlert className="h-4 w-4 text-primary" /> Guardrail Policies <Badge variant="outline" className="text-[9px] ml-1">{guardrails.length}</Badge>
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : guardrails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">Nenhum guardrail configurado.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Crie guardrails para proteger seus agentes.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {guardrails.map((g, i) => (
              <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-3 rounded-lg bg-secondary/20 border border-border/30 flex items-center gap-3 group"
              >
                <ShieldCheck className={`h-5 w-5 shrink-0 ${g.is_enabled ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{typeLabels[g.type] || g.type}</p>
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
