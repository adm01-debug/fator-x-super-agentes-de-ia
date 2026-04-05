import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { listExecutions, getExecutionStats, type ExecutionRecord } from '@/services/executionHistoryService';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<string, string> = { running: 'bg-blue-500/20 text-blue-400', success: 'bg-green-500/20 text-green-400', failed: 'bg-red-500/20 text-red-400', cancelled: 'bg-gray-500/20 text-gray-400', timeout: 'bg-orange-500/20 text-orange-400', waiting: 'bg-yellow-500/20 text-yellow-400' };
const TYPE_ICONS: Record<string, string> = { workflow: '🔄', agent: '🤖', automation: '⚡', webhook: '🔗', schedule: '⏰', manual: '👤' };

export function ExecutionHistoryPanel() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getExecutionStats>> | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      listExecutions(search ? { search } : undefined, 50),
      getExecutionStats(24),
    ]).then(([{ data, total: t }, s]) => { setExecutions(data); setTotal(t); setStats(s); })
      .catch(() => toast({ title: 'Erro', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total (24h)', value: stats?.total ?? 0, color: '#4D96FF' },
          { label: 'Sucesso', value: stats?.success ?? 0, color: '#6BCB77' },
          { label: 'Falhas', value: stats?.failed ?? 0, color: '#FF6B6B' },
          { label: 'Taxa Sucesso', value: `${(stats?.success_rate ?? 0).toFixed(1)}%`, color: '#9B59B6' },
          { label: 'Custo (BRL)', value: `R$ ${(stats?.total_cost_brl ?? 0).toFixed(2)}`, color: '#FFD93D' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111122] border-[#222244]">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Buscar execuções..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-[#0a0a1a] border-[#222244]" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando histórico...</div>
      ) : executions.length === 0 ? (
        <Card className="bg-[#111122] border-[#222244]"><CardContent className="py-12 text-center text-gray-400"><History size={48} className="mx-auto mb-4 opacity-30" /><p>Nenhuma execução registrada.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {executions.map((e) => (
            <Card key={e.id} className="bg-[#111122] border-[#222244]">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-lg">{TYPE_ICONS[e.execution_type] ?? '⚡'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.source_name}</p>
                  <p className="text-[10px] text-gray-400">{e.trigger} • {e.steps.length} steps • {e.tokens_used} tokens</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge className={STATUS_COLORS[e.status] ?? 'bg-gray-500/20 text-gray-400'}>{e.status}</Badge>
                  <p className="text-[10px] text-gray-500 mt-1">{e.duration_ms ? `${(e.duration_ms / 1000).toFixed(1)}s` : '...'}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-gray-500 text-center">Mostrando {executions.length} de {total} execuções</p>
        </div>
      )}
    </div>
  );
}
