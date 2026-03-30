import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Plus, FileText, GitBranch, Copy } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { motion } from "framer-motion";

const prompts = [
  { id: '1', name: 'Suporte Premium L1', agent: 'Atlas', version: 'v2.4', status: 'active', score: 95, updated: '2026-03-28' },
  { id: '2', name: 'Pesquisador Analítico', agent: 'Scout', version: 'v1.3', status: 'active', score: 88, updated: '2026-03-29' },
  { id: '3', name: 'SDR Outbound Personalizado', agent: 'Cleo', version: 'v1.8', status: 'active', score: 82, updated: '2026-03-30' },
  { id: '4', name: 'Compliance Analyst Jurídico', agent: 'Sentinel', version: 'v0.9', status: 'active', score: 96, updated: '2026-03-27' },
  { id: '5', name: 'Copiloto de Código', agent: 'Nova', version: 'v0.5', status: 'draft', score: 68, updated: '2026-03-30' },
  { id: '6', name: 'Orquestrador Planner', agent: 'Orchestrator', version: 'v0.1', status: 'draft', score: 45, updated: '2026-03-29' },
];

export default function PromptsPage() {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Prompt Library"
        description="Biblioteca de prompts reutilizáveis com versionamento e scoring"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Novo prompt</Button>}
      />

      <InfoHint title="Versionamento de prompts">
        Cada alteração no prompt cria uma nova versão. Compare versões lado a lado, faça rollback e associe resultados de avaliação a cada iteração para melhorar continuamente.
      </InfoHint>

      <div className="nexus-card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 text-[11px] text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Prompt</th>
              <th className="text-left px-5 py-3 font-medium">Agente</th>
              <th className="text-left px-5 py-3 font-medium">Versão</th>
              <th className="text-left px-5 py-3 font-medium">Score</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p, i) => (
              <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{p.agent}</td>
                <td className="px-5 py-3"><span className="text-xs font-mono text-foreground">{p.version}</span></td>
                <td className="px-5 py-3">
                  <span className={`text-sm font-heading font-bold ${p.score >= 85 ? 'text-nexus-emerald' : p.score >= 70 ? 'text-nexus-amber' : 'text-nexus-rose'}`}>{p.score}</span>
                </td>
                <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{p.updated}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
