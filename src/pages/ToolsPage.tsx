import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { tools } from "@/lib/mock-data";
import { Search, Globe, Code, Database, Users, Mail, Calendar, MessageSquare, FileText, Webhook, Plug, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const iconMap: Record<string, React.ElementType> = {
  Search, Globe, Code, Database, Users, Mail, Calendar, MessageSquare, FileText, Webhook, Plug, UserCheck,
};

export default function ToolsPage() {
  const [search, setSearch] = useState('');
  const filtered = tools.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Tools & Integrations" description="Gerencie ferramentas externas que seus agentes podem utilizar" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ferramentas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tool, i) => {
          const Icon = iconMap[tool.icon] || Plug;
          return (
            <div key={tool.id} className="nexus-card cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{tool.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{tool.category}</p>
                  </div>
                </div>
                <StatusBadge status={tool.status} />
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate limit</span><span className="text-foreground">{tool.rateLimit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Chamadas hoje</span><span className="text-foreground font-medium">{tool.callsToday.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Último uso</span><span className="text-foreground">{tool.lastUsed}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
