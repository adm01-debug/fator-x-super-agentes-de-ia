import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Shield, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function SecurityPage() {
  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrails'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('config, name');
      if (!data) return [];
      const all: Array<{ name: string; severity: string; agentName: string }> = [];
      for (const agent of data) {
        const config = agent.config as Record<string, any> | null;
        const gs = (config?.guardrails || []) as Array<{ name: string; severity?: string; enabled?: boolean }>;
        for (const g of gs) {
          if (g.enabled) all.push({ name: g.name, severity: g.severity || 'medium', agentName: agent.name });
        }
      }
      return all;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Security & Guardrails" description="Políticas de segurança e governança dos agentes" />

      <InfoHint title="Guardrails protegem seus agentes">
        Guardrails são regras aplicadas em tempo real: mascaramento de dados pessoais, detecção de jailbreak, limites de custo e gates de aprovação humana.
      </InfoHint>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : guardrails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum guardrail configurado</h2>
          <p className="text-sm text-muted-foreground">Configure guardrails no builder de agentes.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guardrails.map((g, i) => (
            <motion.div key={`${g.name}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="nexus-card">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{g.agentName}</p>
                </div>
              </div>
              <span className="nexus-badge-primary text-[10px]">{g.severity}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
