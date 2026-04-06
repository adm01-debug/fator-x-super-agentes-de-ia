import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { FileText, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreatePromptDialog } from "@/components/dialogs/CreatePromptDialog";

export default function PromptsPage() {
  const navigate = useNavigate();

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_for_prompts'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, avatar_emoji');
      return data ?? [];
    },
  });

  const { data: prompts = [], isLoading, refetch } = useQuery({
    queryKey: ['prompt_versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_versions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Group by agent_id, latest version per agent
  const agentMap = new Map(agents.map(a => [a.id, a]));
  const grouped = new Map<string, typeof prompts[0]>();
  for (const p of prompts) {
    if (!grouped.has(p.agent_id) || p.version > (grouped.get(p.agent_id)!.version)) {
      grouped.set(p.agent_id, p);
    }
  }
  const latestPrompts = Array.from(grouped.values());

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Biblioteca de Prompts"
        description="Biblioteca de prompts reutilizáveis com versionamento e scoring"
        actions={<CreatePromptDialog agents={agents} onCreated={() => refetch()} />}
      />

      <InfoHint title="Versionamento de prompts">
        Cada alteração no prompt cria uma nova versão. Compare versões lado a lado, faça rollback e associe resultados de avaliação a cada iteração para melhorar continuamente.
      </InfoHint>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : latestPrompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Nenhum prompt cadastrado</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">Crie seu primeiro prompt para começar a versionar e iterar com métricas.</p>
        </div>
      ) : (
        <div className="nexus-card overflow-hidden p-0 nexus-table-striped">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Prompt</th>
                <th className="text-left px-5 py-3 font-medium">Agente</th>
                <th className="text-left px-5 py-3 font-medium">Versão</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody>
              {latestPrompts.map((p) => {
                const agent = agentMap.get(p.agent_id);
                return (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/prompts/${p.agent_id}`)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{p.change_summary || 'Prompt'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{agent?.name || '—'}</td>
                    <td className="px-5 py-3"><span className="text-xs font-mono text-foreground">v{p.version}</span></td>
                    <td className="px-5 py-3"><StatusBadge status={p.is_active ? 'active' : 'draft'} /></td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
