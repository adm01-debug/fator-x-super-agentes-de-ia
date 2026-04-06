import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Database, Server, HardDrive, Cpu, Radio, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const stores = [
  { icon: Database, name: 'pgvector', type: 'Vector DB', status: 'active' as const, latency: '12ms', desc: 'Banco vetorial integrado via extensão PostgreSQL' },
  { icon: Server, name: 'PostgreSQL', type: 'Relational DB', status: 'active' as const, latency: '5ms', desc: 'Banco principal para dados estruturados' },
  { icon: HardDrive, name: 'Object Storage', type: 'Files', status: 'active' as const, latency: '45ms', desc: 'Armazenamento de arquivos e artefatos' },
  { icon: Cpu, name: 'Redis Cache', type: 'Cache', status: 'planned' as const, latency: '1ms', desc: 'Cache de sessão e estado do agente (requer Upstash ou similar)' },
  { icon: FileText, name: 'pgvector Store', type: 'Vector DB', status: 'active' as const, latency: '8ms', desc: 'Chunks + embeddings para RAG e memória semântica' },
  { icon: Radio, name: 'Workflow Engine', type: 'Edge Functions', status: 'active' as const, latency: '3ms', desc: 'Orquestração sequencial via Edge Functions' },
];

export default function DataStoragePage() {
  // Real counts from db
  const { data: stats } = useQuery({
    queryKey: ['data_storage_stats'],
    queryFn: async () => {
      const [agents, kbs, traces, evals, prompts] = await Promise.all([
        supabase.from('agents').select('id', { count: 'exact', head: true }),
        supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }),
        supabase.from('agent_traces').select('id', { count: 'exact', head: true }),
        supabase.from('evaluation_runs').select('id', { count: 'exact', head: true }),
        supabase.from('prompt_versions').select('id', { count: 'exact', head: true }),
      ]);
      return {
        agents: agents.count ?? 0,
        knowledgeBases: kbs.count ?? 0,
        traces: traces.count ?? 0,
        evaluations: evals.count ?? 0,
        prompts: prompts.count ?? 0,
        total: (agents.count ?? 0) + (kbs.count ?? 0) + (traces.count ?? 0) + (evals.count ?? 0) + (prompts.count ?? 0),
      };
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Dados & Armazenamento" description="Arquitetura de dados: bancos vetoriais, relacionais, cache e storage" />

      <InfoHint title="Por que banco vetorial?">
        Bancos vetoriais armazenam embeddings — representações numéricas de texto. Permitem busca semântica, onde o agente encontra informações por significado, não por palavras-chave exatas. Essencial para RAG de alta qualidade.
      </InfoHint>

      {/* Real usage stats */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Agentes', value: stats.agents },
            { label: 'Knowledge Bases', value: stats.knowledgeBases },
            { label: 'Traces', value: stats.traces },
            { label: 'Avaliações', value: stats.evaluations },
            { label: 'Prompt Versions', value: stats.prompts },
            { label: 'Total de registros', value: stats.total },
          ].map(s => (
            <div key={s.label} className="nexus-card text-center py-3">
              <p className="text-lg font-heading font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <div key={s.name} className="nexus-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{s.type}</p>
                </div>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
            <div className="text-xs border-t border-border/50 pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Latência típica</span><span className="text-foreground font-mono">{s.latency}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
