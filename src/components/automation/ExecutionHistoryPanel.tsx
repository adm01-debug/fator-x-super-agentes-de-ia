import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  listExecutions,
  getExecutionStats,
  type ExecutionRecord,
} from '@/services/executionHistoryService';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-nexus-blue/20 text-nexus-blue',
  success: 'bg-nexus-emerald/20 text-nexus-emerald',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  timeout: 'bg-nexus-orange/20 text-nexus-orange',
  waiting: 'bg-nexus-amber/20 text-nexus-amber',
};
const TYPE_ICONS: Record<string, string> = {
  workflow: '🔄',
  agent: '🤖',
  automation: '⚡',
  webhook: '🔗',
  schedule: '⏰',
  manual: '👤',
};

export function ExecutionHistoryPanel() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getExecutionStats>> | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([listExecutions(search ? { search } : undefined, 50), getExecutionStats(24)])
      .then(([{ data, total: t }, s]) => {
        setExecutions(data);
        setTotal(t);
        setStats(s);
      })
      .catch(() => toast({ title: 'Erro', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [search, toast]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total (24h)', value: stats?.total ?? 0, color: 'hsl(var(--nexus-blue))' },
          { label: 'Sucesso', value: stats?.success ?? 0, color: 'hsl(var(--nexus-emerald))' },
          { label: 'Falhas', value: stats?.failed ?? 0, color: 'hsl(var(--nexus-red))' },
          {
            label: 'Taxa Sucesso',
            value: `${(stats?.success_rate ?? 0).toFixed(1)}%`,
            color: 'hsl(var(--nexus-purple))',
          },
          {
            label: 'Custo (BRL)',
            value: `R$ ${(stats?.total_cost_brl ?? 0).toFixed(2)}`,
            color: 'hsl(var(--nexus-yellow))',
          },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Buscar execuções..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background border-border"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando histórico...</div>
      ) : executions.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <History size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhuma execução registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {executions.map((e) => (
            <Card key={e.id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-lg">{TYPE_ICONS[e.execution_type] ?? '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.source_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {e.trigger} • {e.steps.length} steps • {e.tokens_used} tokens
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={STATUS_COLORS[e.status] ?? 'bg-muted text-muted-foreground'}>
                    {e.status}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {e.duration_ms ? `${(e.duration_ms / 1000).toFixed(1)}s` : '...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center">
            Mostrando {executions.length} de {total} execuções
          </p>
        </div>
      )}
    </div>
  );
}
