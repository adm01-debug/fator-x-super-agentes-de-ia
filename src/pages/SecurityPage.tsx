import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, AlertTriangle, CheckCircle, Loader2, ShieldAlert, ShieldCheck, Key, UserX } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  { name: 'ISO 27001', status: 'planned', coverage: 45 },
];

export default function SecurityPage() {
  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrails'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('config, name, avatar_emoji');
      if (!data) return [];
      const all: Array<{ name: string; severity: string; agentName: string; emoji: string; type: string }> = [];
      for (const agent of data) {
        const config = agent.config as Record<string, any> | null;
        const gs = (config?.guardrails || []) as Array<{ name: string; severity?: string; enabled?: boolean; type?: string }>;
        for (const g of gs) {
          if (g.enabled) all.push({ name: g.name, severity: g.severity || 'medium', agentName: agent.name, emoji: agent.avatar_emoji || '🤖', type: g.type || 'custom' });
        }
      }
      return all;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Security & Guardrails" description="Segurança, compliance e governança dos agentes de IA" />

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

      {/* Agent Guardrails */}
      <div className="nexus-card">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" /> Guardrails por Agente
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : guardrails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">Nenhum guardrail configurado nos agentes.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Configure no builder de cada agente → aba Guardrails.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {guardrails.map((g, i) => (
              <motion.div key={`${g.name}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-3 rounded-lg bg-secondary/20 border border-border/30 flex items-center gap-3"
              >
                <span className="text-lg">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                  <p className="text-[10px] text-muted-foreground">{g.agentName}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${g.severity === 'critical' ? 'border-red-500/30 text-red-400' : g.severity === 'high' ? 'border-amber-500/30 text-amber-400' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                  {g.severity}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
