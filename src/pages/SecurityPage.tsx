import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { guardrails } from "@/lib/mock-data";
import { InfoHint } from "@/components/shared/InfoHint";
import { Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SecurityPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Security & Guardrails"
        description="Políticas de segurança, moderação, compliance e governança dos agentes"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"><Plus className="h-4 w-4" /> Nova política</Button>}
      />

      <InfoHint title="Guardrails protegem seus agentes">
        Guardrails são regras aplicadas em tempo real: mascaramento de dados pessoais, detecção de jailbreak, limites de custo e gates de aprovação humana. Essenciais para agentes em produção.
      </InfoHint>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {guardrails.map((g, i) => (
          <div key={g.id} className="nexus-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                  <p className="text-[11px] text-muted-foreground">{g.type}</p>
                </div>
              </div>
              <StatusBadge status={g.status} />
            </div>
            <p className="text-xs text-muted-foreground mb-4">{g.description}</p>
            <div className="space-y-2 text-xs border-t border-border/50 pt-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Triggers hoje</span><span className="text-foreground font-medium">{g.triggersToday}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Taxa de bloqueio</span><span className="text-nexus-emerald font-medium">{g.blockRate}%</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
