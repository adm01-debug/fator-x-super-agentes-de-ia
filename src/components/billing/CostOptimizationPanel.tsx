/**
 * Cost Optimization Panel — AI-powered cost reduction recommendations.
 * Analyzes agent usage patterns and suggests model downgrades, caching, and budget alerts.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  TrendingDown,
  ArrowRight,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { getAgentUsage, getModelPricing } from '@/services/billingService';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Recommendation {
  id: string;
  type:
    | 'model_downgrade'
    | 'cache_opportunity'
    | 'idle_agent'
    | 'budget_alert'
    | 'batch_optimization';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  savingsEstimate?: string;
  actionLabel?: string;
  actionPath?: string;
}

export function CostOptimizationPanel() {
  const navigate = useNavigate();
  const { data: usage = [] } = useQuery({
    queryKey: ['agent_usage_opt'],
    queryFn: () => getAgentUsage(30),
  });
  const { data: pricing = [] } = useQuery({
    queryKey: ['model_pricing_opt'],
    queryFn: getModelPricing,
  });
  const { data: agents = [] } = useQuery({
    queryKey: ['agents_for_opt'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, model, status, updated_at');
      return data ?? [];
    },
  });

  const recommendations = useMemo<Recommendation[]>(() => {
    const recs: Recommendation[] = [];

    // 1. Detect expensive models that could be downgraded
    const expensiveModels = ['gpt-5', 'claude-sonnet-4', 'gemini-2.5-pro'];
    const cheaperAlts: Record<string, string> = {
      'gpt-5': 'gpt-5-mini (-60% custo)',
      'claude-sonnet-4': 'claude-haiku-4 (-75% custo)',
      'gemini-2.5-pro': 'gemini-2.5-flash (-80% custo)',
    };

    agents.forEach((agent) => {
      if (agent.status === 'production' || agent.status === 'monitoring') {
        const model = agent.model || '';
        const match = expensiveModels.find((m) => model.includes(m));
        if (match) {
          recs.push({
            id: `downgrade-${agent.id}`,
            type: 'model_downgrade',
            severity: 'high',
            title: `Considere downgrade do modelo em "${agent.name}"`,
            description: `Usando ${model}. Alternativa mais barata: ${cheaperAlts[match] || 'modelo flash/mini'}. Teste no playground antes de migrar.`,
            savingsEstimate: '40-80%',
            actionLabel: 'Abrir no Builder',
            actionPath: `/builder/${agent.id}`,
          });
        }
      }
    });

    // 2. Detect idle agents (in production but no usage in 7+ days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    agents.forEach((agent) => {
      if ((agent.status === 'production' || agent.status === 'staging') && agent.updated_at) {
        const lastUpdate = new Date(agent.updated_at);
        if (lastUpdate < sevenDaysAgo) {
          const agentUsage = usage.filter((u) => u.agent_id === agent.id);
          const recentUsage = agentUsage.filter((u) => new Date(u.date) > sevenDaysAgo);
          if (recentUsage.length === 0) {
            recs.push({
              id: `idle-${agent.id}`,
              type: 'idle_agent',
              severity: 'medium',
              title: `"${agent.name}" parece inativo`,
              description:
                'Nenhum uso nos últimos 7 dias. Considere mover para staging ou arquivar para economizar recursos.',
              actionLabel: 'Gerenciar',
              actionPath: `/builder/${agent.id}`,
            });
          }
        }
      }
    });

    // 3. High error rate = wasted cost
    const agentUsageMap = new Map<string, { cost: number; errors: number; requests: number }>();
    usage.forEach((u) => {
      const existing = agentUsageMap.get(u.agent_id) || { cost: 0, errors: 0, requests: 0 };
      existing.cost += Number(u.total_cost_usd || 0);
      existing.errors += Number(u.error_count || 0);
      existing.requests += Number(u.requests || 0);
      agentUsageMap.set(u.agent_id, existing);
    });

    agentUsageMap.forEach((stats, agentId) => {
      if (stats.requests > 10 && stats.errors / stats.requests > 0.15) {
        const agent = agents.find((a) => a.id === agentId);
        recs.push({
          id: `errors-${agentId}`,
          type: 'batch_optimization',
          severity: 'high',
          title: `Alta taxa de erros em "${agent?.name || agentId.slice(0, 8)}"`,
          description: `${((stats.errors / stats.requests) * 100).toFixed(0)}% de erros — ~$${(stats.cost * (stats.errors / stats.requests)).toFixed(2)} desperdiçados. Revise guardrails e prompts.`,
          savingsEstimate: `$${(stats.cost * (stats.errors / stats.requests)).toFixed(2)}`,
          actionLabel: 'Ver traces',
          actionPath: '/monitoring',
        });
      }
    });

    // 4. General tips if no specific issues
    if (recs.length === 0) {
      recs.push({
        id: 'tip-caching',
        type: 'cache_opportunity',
        severity: 'low',
        title: 'Dica: Habilite cache de respostas',
        description:
          'Respostas idênticas para consultas repetidas podem ser cacheadas para reduzir custos em até 30%.',
      });
    }

    return recs;
  }, [agents, usage, pricing]);

  const totalSavings = recommendations.filter((r) => r.severity === 'high').length;
  const severityColors = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
    low: 'bg-nexus-emerald/10 text-nexus-emerald border-nexus-emerald/20',
  };
  const severityIcons = {
    high: <AlertTriangle className="h-4 w-4" />,
    medium: <Lightbulb className="h-4 w-4" />,
    low: <CheckCircle2 className="h-4 w-4" />,
  };

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-nexus-emerald/10 flex items-center justify-center">
            <TrendingDown className="h-4 w-4 text-nexus-emerald" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Otimização de Custos</h3>
            <p className="text-[11px] text-muted-foreground">Recomendações baseadas no seu uso</p>
          </div>
        </div>
        {totalSavings > 0 && (
          <Badge className="bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20 text-[11px] gap-1">
            <Zap className="h-3 w-3" /> {totalSavings} ação{totalSavings > 1 ? 'ões' : ''}{' '}
            prioritária{totalSavings > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className={`rounded-lg border p-3 ${severityColors[rec.severity]}`}>
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{severityIcons[rec.severity]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold">{rec.title}</p>
                  {rec.savingsEstimate && (
                    <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                      <DollarSign className="h-2.5 w-2.5" /> Economia: {rec.savingsEstimate}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">{rec.description}</p>
              </div>
              {rec.actionPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-[11px] gap-1"
                  onClick={() => navigate(rec.actionPath!)}
                >
                  {rec.actionLabel} <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
