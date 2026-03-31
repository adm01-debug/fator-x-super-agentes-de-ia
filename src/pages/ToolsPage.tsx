import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plug, Loader2, Wrench, Globe, Database, Mail, FileSearch, Code, Webhook } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const builtInTools = [
  { name: 'Web Search', category: 'Pesquisa', icon: Globe, desc: 'Busca na web em tempo real', built_in: true },
  { name: 'Knowledge Search', category: 'RAG', icon: FileSearch, desc: 'Busca semântica nas bases de conhecimento', built_in: true },
  { name: 'SQL Query', category: 'Database', icon: Database, desc: 'Consultas SQL no banco de dados', built_in: true },
  { name: 'Email Send', category: 'Comunicação', icon: Mail, desc: 'Envio de emails transacionais', built_in: true },
  { name: 'Code Executor', category: 'Código', icon: Code, desc: 'Execução de código Python/JS', built_in: true },
  { name: 'Webhook', category: 'Integração', icon: Webhook, desc: 'Chamadas HTTP para APIs externas', built_in: true },
];

const iconMap: Record<string, React.ElementType> = {
  Pesquisa: Globe, RAG: FileSearch, Database: Database, Comunicação: Mail, Código: Code, Integração: Webhook, Custom: Wrench,
};

export default function ToolsPage() {
  const [search, setSearch] = useState('');

  const { data: agentTools = [], isLoading } = useQuery({
    queryKey: ['agent_tools'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('config, name');
      if (!data) return [];
      const toolSet = new Map<string, { name: string; category: string; count: number; agents: string[] }>();
      for (const agent of data) {
        const config = agent.config as Record<string, any> | null;
        const agentTools = (config?.tools || []) as Array<{ name: string; category?: string; enabled?: boolean }>;
        for (const t of agentTools) {
          if (t.enabled) {
            const existing = toolSet.get(t.name);
            if (existing) { existing.count++; existing.agents.push(agent.name); }
            else toolSet.set(t.name, { name: t.name, category: t.category || 'Custom', count: 1, agents: [agent.name] });
          }
        }
      }
      return Array.from(toolSet.values());
    },
  });

  const allTools = [
    ...builtInTools.map(t => ({ ...t, count: 0, agents: [] as string[], built_in: true })),
    ...agentTools.map(t => ({ ...t, icon: iconMap[t.category] || Wrench, desc: `Usado em ${t.count} agente(s)`, built_in: false })),
  ];

  const filtered = allTools.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Tools & Integrations" description="Ferramentas disponíveis e integrações configuradas" />

      <InfoHint title="O que são tools?">
        Tools são capacidades que os agentes podem usar: buscar na web, consultar bancos, enviar emails, chamar APIs. Cada tool é uma função que o agente pode invocar durante uma conversação para obter dados ou executar ações.
      </InfoHint>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ferramentas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool, i) => (
            <motion.div key={`${tool.name}-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="nexus-card">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-foreground truncate">{tool.name}</h3>
                    {tool.built_in && <Badge variant="outline" className="text-[8px] shrink-0">Built-in</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{tool.category}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
              {!tool.built_in && tool.agents.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tool.agents.slice(0, 3).map(a => <Badge key={a} variant="secondary" className="text-[9px]">{a}</Badge>)}
                  {tool.agents.length > 3 && <Badge variant="secondary" className="text-[9px]">+{tool.agents.length - 3}</Badge>}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
