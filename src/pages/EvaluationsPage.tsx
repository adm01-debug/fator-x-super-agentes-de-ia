import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { evaluations } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Plus, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";

export default function EvaluationsPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Evaluations Lab"
        description="Avalie agentes com métricas de factualidade, groundedness, sucesso e segurança"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Nova avaliação</Button>}
      />

      <InfoHint title="Por que avaliar agentes?">
        Avaliações sistemáticas detectam regressões, alucinações e falhas antes que cheguem aos usuários. Compare versões de prompts, modelos e configurações para garantir qualidade contínua.
      </InfoHint>

      <div className="space-y-4">
        {evaluations.map((ev, i) => (
          <motion.div key={ev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="nexus-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FlaskConical className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{ev.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{ev.agent} • {ev.createdAt}</p>
                </div>
              </div>
              <StatusBadge status={ev.status} size="md" />
            </div>

            {ev.status === 'completed' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mt-4">
                {[
                  { label: 'Factualidade', value: `${ev.factuality}%`, good: ev.factuality > 85 },
                  { label: 'Groundedness', value: `${ev.groundedness}%`, good: ev.groundedness > 85 },
                  { label: 'Task Success', value: `${ev.taskSuccess}%`, good: ev.taskSuccess > 80 },
                  { label: 'Hallucination', value: `${ev.hallucinationRisk}%`, good: ev.hallucinationRisk < 10 },
                  { label: 'Latência (avg)', value: `${ev.latencyAvg}s`, good: ev.latencyAvg < 3 },
                  { label: 'Custo total', value: `R$${ev.costTotal.toFixed(2)}`, good: true },
                  { label: 'Test cases', value: ev.testCases.toString(), good: true },
                  { label: 'Pass rate', value: `${ev.passRate}%`, good: ev.passRate > 85 },
                ].map(m => (
                  <div key={m.label} className="text-center rounded-lg bg-secondary/30 p-3">
                    <p className={`text-lg font-heading font-bold ${m.good ? 'text-nexus-emerald' : 'text-nexus-amber'}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            ) : ev.status === 'running' ? (
              <div className="flex items-center gap-2 mt-3">
                <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full w-2/5 rounded-full nexus-gradient-bg animate-pulse" />
                </div>
                <span className="text-xs text-muted-foreground">{ev.testCases} test cases</span>
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
