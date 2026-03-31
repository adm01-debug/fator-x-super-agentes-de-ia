import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Rocket, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function DeploymentsPage() {
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, avatar_emoji, status, config, version, updated_at')
        .in('status', ['production', 'staging', 'monitoring']);
      if (!data) return [];
      return data.map(a => {
        const config = a.config as Record<string, any> | null;
        const channels = (config?.deploy_channels || []) as Array<{ name: string; enabled: boolean }>;
        return {
          id: a.id,
          name: a.name,
          emoji: a.avatar_emoji,
          status: a.status,
          version: `v${a.version}`,
          channels: channels.filter(c => c.enabled).map(c => c.name),
          environment: config?.deploy_environment || 'production',
          updated: a.updated_at,
        };
      });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Deployments" description="Agentes em produção e staging" />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : deployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum agente deployado</h2>
          <p className="text-sm text-muted-foreground">Mude o status de um agente para "production" ou "staging" no builder.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deployments.map((dep, i) => (
            <motion.div key={dep.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="nexus-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">{dep.emoji || '🤖'}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{dep.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{dep.version} • {dep.environment}</p>
                  </div>
                </div>
                <StatusBadge status={dep.status || 'draft'} />
              </div>
              {dep.channels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {dep.channels.map(c => <span key={c} className="nexus-badge-primary text-[10px]">{c}</span>)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">{new Date(dep.updated).toLocaleDateString('pt-BR')}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
