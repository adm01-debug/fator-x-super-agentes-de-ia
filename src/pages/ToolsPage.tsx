import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Search, Plug, Loader2, Wrench } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function ToolsPage() {
  const [search, setSearch] = useState('');

  const { data: tools = [], isLoading } = useQuery({
    queryKey: ['agent_tools'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('config');
      if (!data) return [];
      const toolSet = new Map<string, { name: string; category: string; count: number }>();
      for (const agent of data) {
        const config = agent.config as Record<string, any> | null;
        const agentTools = (config?.tools || []) as Array<{ name: string; category?: string; enabled?: boolean }>;
        for (const t of agentTools) {
          if (t.enabled) {
            const existing = toolSet.get(t.name);
            if (existing) existing.count++;
            else toolSet.set(t.name, { name: t.name, category: t.category || 'Custom', count: 1 });
          }
        }
      }
      return Array.from(toolSet.values());
    },
  });

  const filtered = tools.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Tools & Integrations" description="Ferramentas externas configuradas nos seus agentes" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ferramentas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma ferramenta configurada</h2>
          <p className="text-sm text-muted-foreground">Configure ferramentas no builder de agentes.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool, i) => (
            <motion.div key={tool.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="nexus-card">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{tool.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{tool.category}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Usado em {tool.count} agente(s)</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
