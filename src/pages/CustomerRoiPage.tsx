/**
 * Customer ROI Page — `/billing/roi`
 *
 * Dashboard voltado ao **comprador enterprise** — não ao admin técnico.
 * Expõe KPIs de impacto no negócio inspirados em Sierra, Decagon e Fin:
 *   - Autonomous resolution rate (% resolvido sem humano)
 *   - Pedidos fechados no período × ticket médio
 *   - Deflexão de ticket × custo evitado
 *   - Tempo médio de cotação
 *   - Outcome-based billing summary
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, TrendingUp, Clock, DollarSign } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useWorkspaceId } from '@/hooks/use-data';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_PRICING,
  rollupBilling,
  type OutcomeEvent,
  type OutcomeKind,
} from '@/services/outcomePricing';
import { computeAttribution, lastNDays, startOfMonth } from '@/services/costAttribution';

type Range = 'month' | 'last7' | 'last30';

/**
 * Lê `public.outcome_events` do workspace dentro da janela. A tabela é
 * criada pela migration `20260422180000_rodadas_6_8_tables.sql`. Antes
 * dela rodar no ambiente, o fetch devolve [] graceful-degrade.
 */
async function listOutcomeEvents(
  workspaceId: string,
  window: { from: string; to: string },
): Promise<OutcomeEvent[]> {
  try {
    const { data, error } = await supabase
      .from('outcome_events' as never)
      .select(
        'id, agent_id, workspace_id, kind, reference_id, metadata, occurred_at, unit_price_usd, billable',
      )
      .eq('workspace_id', workspaceId)
      .gte('occurred_at', window.from)
      .lte('occurred_at', window.to)
      .order('occurred_at', { ascending: false })
      .limit(2000);
    if (error) return [];
    return (data ?? []) as unknown as OutcomeEvent[];
  } catch {
    return [];
  }
}

export default function CustomerRoiPage() {
  const { data: workspaceId } = useWorkspaceId();
  const [range, setRange] = useState<Range>('month');

  const window = useMemo(() => {
    if (range === 'last7') return lastNDays(7);
    if (range === 'last30') return lastNDays(30);
    return startOfMonth();
  }, [range]);

  const { data: outcomes = [] } = useQuery({
    queryKey: ['outcome_events', workspaceId, range, window.from, window.to],
    enabled: !!workspaceId,
    queryFn: () => listOutcomeEvents(workspaceId!, window),
  });

  const { data: attribution } = useQuery({
    queryKey: ['cost_attribution_roi', range],
    queryFn: () => computeAttribution(window),
  });

  const billing = useMemo(() => {
    if (!workspaceId) return null;
    return rollupBilling(outcomes, window, workspaceId);
  }, [outcomes, window, workspaceId]);

  // KPIs derivados
  const kpis = useMemo(() => {
    const orders = outcomes.filter((o) => o.kind === 'order_closed').length;
    const quotes = outcomes.filter((o) => o.kind === 'quote_qualified').length;
    const resolutions = outcomes.filter((o) => o.kind === 'support_resolution').length;
    const escalations = outcomes.filter((o) => o.kind === 'escalation').length;
    const meetings = outcomes.filter((o) => o.kind === 'meeting_booked').length;

    const totalInteractions = outcomes.length || 1;
    const autonomousResolutionRate = resolutions / totalInteractions;
    const escalationRate = escalations / totalInteractions;

    // Custo evitado: R$ 25 médio por ticket humano no mercado BR SMB
    const HUMAN_TICKET_COST_BRL = 25;
    const cost_avoided_brl = resolutions * HUMAN_TICKET_COST_BRL;

    return {
      orders,
      quotes,
      resolutions,
      escalations,
      meetings,
      autonomousResolutionRate,
      escalationRate,
      cost_avoided_brl,
    };
  }, [outcomes]);

  const grossSpend = attribution?.total_usd ?? 0;
  const grossRevenue = billing?.total_usd ?? 0;
  const roiRatio = grossSpend > 0 ? grossRevenue / grossSpend : 0;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="ROI dos Agentes"
        description="Visão do impacto comercial — feita para o comprador, não para o admin."
        actions={
          <div className="flex gap-2">
            <RangeButton label="Mês" value="month" current={range} setCurrent={setRange} />
            <RangeButton label="7d" value="last7" current={range} setCurrent={setRange} />
            <RangeButton label="30d" value="last30" current={range} setCurrent={setRange} />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Pedidos fechados"
          value={kpis.orders}
          icon={<Award className="h-4 w-4 text-nexus-emerald" />}
        />
        <StatCard
          label="Cotações qualificadas"
          value={kpis.quotes}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Reuniões agendadas"
          value={kpis.meetings}
          icon={<Clock className="h-4 w-4 text-nexus-amber" />}
        />
        <StatCard
          label="Custo evitado (R$)"
          value={kpis.cost_avoided_brl.toFixed(0)}
          icon={<DollarSign className="h-4 w-4 text-nexus-emerald" />}
        />
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-heading font-semibold text-foreground">
          Autonomous Resolution Rate
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Progress value={kpis.autonomousResolutionRate * 100} className="h-3" />
          </div>
          <span className="text-lg font-bold text-foreground">
            {(kpis.autonomousResolutionRate * 100).toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Fração de interações resolvidas pelo agente sem escalação humana. Benchmark mercado:
          Sierra 60-75%, Intercom Fin 50%+.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-heading font-semibold text-foreground">ROI Gross</h2>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Receita outcome</p>
            <p className="text-lg font-bold text-nexus-emerald">US$ {grossRevenue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Custo LLM + eval</p>
            <p className="text-lg font-bold text-foreground">US$ {grossSpend.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ROI</p>
            <p className="text-lg font-bold text-primary">
              {roiRatio > 0 ? `${roiRatio.toFixed(1)}×` : '—'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-heading font-semibold text-foreground">
          Faturamento por outcome (pricing tiers)
        </h2>
        {billing && billing.lines.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {billing.lines.map((line) => (
              <li
                key={line.kind}
                className="flex items-center justify-between border-b border-border/30 pb-2"
              >
                <div>
                  <p className="font-medium text-foreground">{kindLabel(line.kind)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {DEFAULT_PRICING[line.kind]?.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">US$ {line.subtotal_usd.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {line.count} × US$ {line.unit_price_usd.toFixed(2)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nenhum outcome registrado no período. Eventos começam a popular quando agentes fecham
            cotações, pedidos e resoluções.
          </p>
        )}
      </Card>
    </div>
  );
}

function kindLabel(kind: OutcomeKind): string {
  const labels: Record<OutcomeKind, string> = {
    quote_qualified: 'Cotação qualificada',
    order_closed: 'Pedido fechado',
    support_resolution: 'Resolução de suporte',
    lead_qualified: 'Lead qualificado',
    meeting_booked: 'Reunião agendada',
    handoff_avoided: 'Handoff evitado',
    escalation: 'Escalação (não-billable)',
  };
  return labels[kind];
}

function RangeButton({
  label,
  value,
  current,
  setCurrent,
}: {
  label: string;
  value: Range;
  current: Range;
  setCurrent: (v: Range) => void;
}) {
  return (
    <Button
      size="sm"
      variant={current === value ? 'default' : 'outline'}
      onClick={() => setCurrent(value)}
      className="text-xs"
    >
      {label}
    </Button>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="nexus-card text-center py-3">
      <div className="flex items-center justify-center gap-1.5 mb-1">{icon}</div>
      <p className="text-xl font-heading font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
