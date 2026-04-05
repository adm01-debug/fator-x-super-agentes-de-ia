import { getAuditLog } from '@/services/securityService';
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'agent.create': { label: 'Agente criado', color: 'text-nexus-emerald' },
  'agent.update': { label: 'Agente atualizado', color: 'text-primary' },
  'agent.delete': { label: 'Agente removido', color: 'text-destructive' },
  'agent.deploy': { label: 'Agente implantado', color: 'text-nexus-cyan' },
  'agent.duplicate': { label: 'Agente duplicado', color: 'text-nexus-purple' },
  'kb.create': { label: 'Knowledge base criada', color: 'text-nexus-emerald' },
  'kb.update': { label: 'Knowledge base atualizada', color: 'text-primary' },
  'kb.delete': { label: 'Knowledge base removida', color: 'text-destructive' },
  'prompt.create': { label: 'Prompt criado', color: 'text-nexus-emerald' },
  'prompt.activate': { label: 'Prompt ativado', color: 'text-nexus-amber' },
  'secret.create': { label: 'Secret criado', color: 'text-nexus-emerald' },
  'secret.delete': { label: 'Secret removido', color: 'text-destructive' },
  'member.invite': { label: 'Membro convidado', color: 'text-nexus-cyan' },
  'member.remove': { label: 'Membro removido', color: 'text-destructive' },
  'auth.login': { label: 'Login', color: 'text-muted-foreground' },
  'auth.logout': { label: 'Logout', color: 'text-muted-foreground' },
};

function getRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function ActivityFeed() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity_feed'],
    queryFn: () => getAuditLog({ limit: 15 }),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Nenhuma atividade registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[320px] overflow-y-auto">
      {logs.map((log) => {
        const action = String(log.action ?? '');
        const info = ACTION_LABELS[action] || { label: action, color: 'text-muted-foreground' };
        const meta = log.metadata as Record<string, string> | null;
        const detail = meta?.name || meta?.email || meta?.keyName || '';

        return (
          <div key={log.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-secondary/30 text-xs transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${info.color.replace('text-', 'bg-')}`} />
            <div className="flex-1 min-w-0">
              <span className={`font-medium ${info.color}`}>{info.label}</span>
              {detail && <span className="text-muted-foreground ml-1.5 truncate">— {detail}</span>}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{getRelativeTime(log.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
