import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Star, Copy, Wand2, Download, Loader2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type AgentRow = Tables<'agents'>;

interface AgentCardProps {
  agent: AgentRow;
  isFav: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  cloning: boolean;
  onNavigate: (id: string) => void;
  onToggleFav: (e: React.MouseEvent, id: string) => void;
  onClone: (e: React.MouseEvent, agent: AgentRow) => void;
  onAutoTag: (e: React.MouseEvent, agent: AgentRow) => void;
  onExport: (e: React.MouseEvent, agent: AgentRow) => void;
  onToggleSelect: (e: React.MouseEvent, id: string) => void;
}

export function AgentCard({
  agent, isFav, isSelected, selectionMode, cloning,
  onNavigate, onToggleFav, onClone, onAutoTag, onExport, onToggleSelect,
}: AgentCardProps) {
  const config = (agent.config as Record<string, unknown>) ?? {};

  return (
    <div
      className={`nexus-card nexus-card-interactive cursor-pointer group relative overflow-hidden min-h-[180px] flex flex-col ${isSelected ? 'ring-2 ring-primary border-primary/40' : ''}`}
      onClick={() => selectionMode ? onToggleSelect({ stopPropagation: () => {} } as React.MouseEvent, agent.id) : onNavigate(agent.id)}
    >
      <div className={`absolute top-3 left-3 z-10 transition-opacity ${selectionMode || 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => onToggleSelect(e, agent.id)}>
        <Checkbox checked={isSelected} className="h-4 w-4" />
      </div>

      <div className={`flex items-start justify-between mb-3 ${selectionMode ? 'ml-7' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center text-xl shadow-sm group-hover:shadow-md transition-shadow">
              {agent.avatar_emoji || '🤖'}
            </div>
            <span
              className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                agent.status === 'production' || agent.status === 'monitoring' ? 'bg-nexus-emerald animate-glow-pulse'
                : agent.status === 'deprecated' || agent.status === 'archived' ? 'bg-destructive'
                : agent.status === 'draft' ? 'bg-muted-foreground/40' : 'bg-nexus-amber'
              }`} aria-hidden="true"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{agent.name}</h3>
            <p className="text-[11px] text-muted-foreground">{(config.type as string) || agent.persona} • {agent.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={(e) => onExport(e, agent)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-nexus-cyan hover:bg-nexus-cyan/10 opacity-0 group-hover:opacity-100 transition-all" title="Exportar JSON">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => onAutoTag(e, agent)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-nexus-purple hover:bg-nexus-purple/10 opacity-0 group-hover:opacity-100 transition-all" title="Auto-tag">
            <Wand2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={(e) => onClone(e, agent)} className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100 transition-all" disabled={cloning === agent.id}>
            {cloning === agent.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button onClick={(e) => onToggleFav(e, agent.id)} className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${isFav ? 'text-nexus-amber' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'} hover:text-nexus-amber hover:bg-nexus-amber/10`}>
            <Star className={`h-3.5 w-3.5 ${isFav ? 'fill-nexus-amber' : ''}`} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{agent.mission || 'Sem descrição'}</p>

      <div className="flex items-center gap-2 flex-wrap mt-auto">
        <StatusBadge status={agent.status || 'draft'} />
        {(agent.tags ?? []).slice(0, 2).map(tag => (
          <Badge key={tag} variant="outline" className="text-[11px] h-5 border-border/50">{tag}</Badge>
        ))}
        {(agent.tags ?? []).length > 2 && <span className="text-[11px] text-muted-foreground">+{(agent.tags ?? []).length - 2}</span>}
        {agent.version && <span className="text-[11px] text-muted-foreground ml-auto">v{agent.version}</span>}
      </div>
    </div>
  );
}
