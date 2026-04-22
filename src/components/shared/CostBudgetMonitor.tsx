/**
 * CostBudgetMonitor — compact pill + inline gate for call sites.
 *
 * Usado em headers de páginas que disparam ações custosas (ex.: teste
 * rápido de agente, re-ingestão RAG, evals). Mostra % do orçamento
 * mensal gasto e vira destructive quando `shouldBlockCall` = true.
 *
 * `children` (opcional) recebe a snapshot para permitir que o call site
 * desabilite botões.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wallet, ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

import { useWorkspaceId } from '@/hooks/use-data';
import { getBudgetSnapshot, shouldBlockCall, type BudgetSnapshot } from '@/services/costBudget';

export interface CostBudgetMonitorProps {
  /** render prop — recebe snapshot + gate para uso em call sites */
  children?: (args: { snapshot: BudgetSnapshot | null; blocked: boolean }) => React.ReactNode;
  /** esconde o pill quando não há budget configurado */
  hideWhenUnconfigured?: boolean;
}

export function CostBudgetMonitor({
  children,
  hideWhenUnconfigured = false,
}: CostBudgetMonitorProps) {
  const { data: workspaceId } = useWorkspaceId();

  const { data: snapshot = null } = useQuery({
    queryKey: ['cost_budget_snapshot', workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 60_000,
    queryFn: () => getBudgetSnapshot(workspaceId!),
  });

  const blocked = useMemo(() => (snapshot ? shouldBlockCall(snapshot) : false), [snapshot]);

  if (children) {
    return <>{children({ snapshot, blocked })}</>;
  }

  if (!snapshot) return null;
  if (!snapshot.configured && hideWhenUnconfigured) return null;

  if (!snapshot.configured) {
    return (
      <Link
        to="/settings/budget"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-muted/40 border border-border/40 hover:bg-muted/60"
      >
        <Wallet className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Sem orçamento</span>
      </Link>
    );
  }

  const variant = blocked
    ? {
        bg: 'bg-destructive/10',
        text: 'text-destructive',
        border: 'border-destructive/30',
        Icon: ShieldAlert,
      }
    : snapshot.warning
      ? {
          bg: 'bg-nexus-amber/10',
          text: 'text-nexus-amber',
          border: 'border-nexus-amber/30',
          Icon: AlertTriangle,
        }
      : {
          bg: 'bg-nexus-emerald/10',
          text: 'text-nexus-emerald',
          border: 'border-nexus-emerald/30',
          Icon: ShieldCheck,
        };

  const label = blocked
    ? 'Orçamento esgotado'
    : snapshot.warning
      ? `${snapshot.monthly_pct.toFixed(0)}% do mês`
      : `${snapshot.monthly_pct.toFixed(0)}% do mês`;

  return (
    <Link
      to="/settings/budget"
      title={snapshot.reason ?? 'Abrir configurações de orçamento'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border ${variant.bg} ${variant.text} ${variant.border} hover:opacity-80`}
    >
      <variant.Icon className="h-3 w-3" />
      <span className="font-medium">{label}</span>
    </Link>
  );
}
