import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TraceLevel } from '@/services/agentTracesService';
import type { AgentSummary } from '@/services/agentsService';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  level: TraceLevel | 'all';
  onLevel: (v: TraceLevel | 'all') => void;
  event: string;
  onEvent: (v: string) => void;
  agentId: string;
  onAgent: (v: string) => void;
  sinceHours: number;
  onSinceHours: (v: number) => void;
  events: string[];
  agents: AgentSummary[];
}

const RANGES: Array<[number, string]> = [
  [1, 'Última hora'],
  [24, 'Últimas 24h'],
  [24 * 7, 'Últimos 7 dias'],
  [24 * 30, 'Últimos 30 dias'],
  [0, 'Tudo'],
];

export function TracesFilters({
  search, onSearch, level, onLevel, event, onEvent,
  agentId, onAgent, sinceHours, onSinceHours, events, agents,
}: Props) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border border-border/40 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[1fr_140px_180px_200px_160px] gap-2">
      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar evento, session_id, payload..."
          className="h-9 pl-8 text-xs"
          aria-label="Buscar traces"
        />
      </div>

      <Select value={level} onValueChange={(v) => onLevel(v as TraceLevel | 'all')}>
        <SelectTrigger className="h-9 text-xs" aria-label="Filtrar por nível"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos níveis</SelectItem>
          <SelectItem value="info">ℹ Info</SelectItem>
          <SelectItem value="warning">⚠ Warning</SelectItem>
          <SelectItem value="error">✗ Error</SelectItem>
        </SelectContent>
      </Select>

      <Select value={event} onValueChange={onEvent}>
        <SelectTrigger className="h-9 text-xs" aria-label="Filtrar por evento"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos eventos</SelectItem>
          {events.map((e) => (
            <SelectItem key={e} value={e}>{e}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={agentId} onValueChange={onAgent}>
        <SelectTrigger className="h-9 text-xs" aria-label="Filtrar por agente"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos agentes</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(sinceHours)} onValueChange={(v) => onSinceHours(Number(v))}>
        <SelectTrigger className="h-9 text-xs" aria-label="Janela temporal"><SelectValue /></SelectTrigger>
        <SelectContent>
          {RANGES.map(([h, label]) => (
            <SelectItem key={h} value={String(h)}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
