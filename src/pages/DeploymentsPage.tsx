import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { deployments } from "@/lib/mock-data";
import { Rocket, MessageSquare, Globe, Code, Hash, Smartphone } from "lucide-react";

const channelIcons: Record<string, React.ElementType> = {
  'Widget de Chat': MessageSquare,
  'API Endpoint': Code,
  'Web App Embed': Globe,
  'Slack Bot': Hash,
  'Internal Assistant': Smartphone,
};

export default function DeploymentsPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Deployments" description="Gerencie deploys dos agentes em múltiplos canais e ambientes" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deployments.map((dep, i) => {
          const Icon = channelIcons[dep.channel] || Rocket;
          return (
            <div key={dep.id} className="nexus-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{dep.channel}</h3>
                    <p className="text-[11px] text-muted-foreground">{dep.agent.split('—')[0].trim()}</p>
                  </div>
                </div>
                <StatusBadge status={dep.status} />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Ambiente</span><StatusBadge status={dep.environment} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Versão</span><span className="text-foreground font-mono">{dep.version}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tráfego</span><span className="text-foreground">{dep.traffic}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deploy</span><span className="text-foreground">{dep.lastDeployed.split(' ')[0]}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
