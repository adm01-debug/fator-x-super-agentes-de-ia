/* eslint-disable react-refresh/only-export-components */
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Link2, Clock, Snowflake, XCircle, AlertTriangle } from 'lucide-react';
import { ENTITY_LIST } from '@/config/datahub-entities';

export interface ConnectionDef {
  id: string;
  label: string;
  desc: string;
  status: 'connected' | 'disconnected' | 'error' | 'hibernated';
  tables: number;
  icon: string;
  count?: number;
  error?: string;
  lastTested?: Date;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  return `${Math.floor(minutes / 60)}h atrás`;
}

export function ConnectionCard({ conn }: { conn: ConnectionDef }) {
  const entitiesUsing = ENTITY_LIST.filter((e) => e.primary.connection === conn.id);
  const crossRefs = ENTITY_LIST.filter((e) => e.cross_db?.some((c) => c.connection === conn.id));
  const isHibernated = conn.status === 'hibernated';

  return (
    <div
      className={`nexus-card group transition-colors ${isHibernated ? 'opacity-60' : 'hover:border-primary/30'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
            {conn.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{conn.label}</h3>
            <p className="text-[11px] text-muted-foreground font-mono">{conn.id}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isHibernated ? (
            <Badge variant="outline" className="gap-1 text-[11px] border-primary/30 text-primary">
              <Snowflake className="h-3 w-3" /> Hibernado
            </Badge>
          ) : (
            <StatusBadge
              status={
                conn.status === 'connected'
                  ? 'active'
                  : conn.status === 'error'
                    ? 'error'
                    : 'planned'
              }
            />
          )}
          {conn.lastTested && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {timeAgo(conn.lastTested)}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{conn.desc}</p>

      <div className="space-y-2 border-t border-border/50 pt-3">
        {conn.status === 'connected' && conn.count !== undefined && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Registros (tabela principal)</span>
            <span className="text-foreground font-mono">{conn.count.toLocaleString()}</span>
          </div>
        )}
        {!isHibernated && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tabelas mapeadas</span>
            <span className="text-foreground font-mono">{conn.tables}</span>
          </div>
        )}
        {entitiesUsing.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entitiesUsing.map((e) => (
              <Badge key={e.id} variant="secondary" className="text-[11px] gap-1">
                {e.icon} {e.name}
              </Badge>
            ))}
          </div>
        )}
        {crossRefs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {crossRefs.map((e) => (
              <Badge
                key={e.id}
                variant="outline"
                className="text-[11px] gap-1 border-nexus-cyan/30 text-nexus-cyan"
              >
                <Link2 className="h-2.5 w-2.5" /> {e.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {conn.status === 'error' && conn.error && (
        <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-[11px] text-destructive">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {conn.error}
        </div>
      )}
      {conn.status === 'disconnected' && (
        <div className="mt-3 p-2 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 flex items-center gap-2 text-[11px] text-nexus-amber">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Aguardando teste de conexão...
        </div>
      )}
      {isHibernated && (
        <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-[11px] text-primary">
          <Snowflake className="h-3.5 w-3.5 shrink-0" />
          Projeto Supabase pausado. Score: 0/100.
        </div>
      )}
    </div>
  );
}

export const DEFAULT_CONNECTIONS: ConnectionDef[] = [
  {
    id: 'bancodadosclientes',
    label: 'CRM Clientes',
    desc: 'Companies, customers, contacts, interactions',
    status: 'disconnected',
    tables: 14,
    icon: '👤',
  },
  {
    id: 'supabase-fuchsia-kite',
    label: 'Catálogo Produtos',
    desc: 'Products, variants, suppliers, pricing',
    status: 'disconnected',
    tables: 12,
    icon: '📦',
  },
  {
    id: 'gestao_time_promo',
    label: 'Gestão RH',
    desc: 'Colaboradores, ponto, departamentos, cargos',
    status: 'disconnected',
    tables: 6,
    icon: '👨‍💼',
  },
  {
    id: 'backupgiftstore',
    label: 'WhatsApp Backup',
    desc: 'Contacts, messages, media',
    status: 'disconnected',
    tables: 3,
    icon: '💬',
  },
  {
    id: 'financeiro_promo',
    label: 'Financeiro Promo',
    desc: 'Contas a pagar/receber, fluxo de caixa — HIBERNADO',
    status: 'hibernated',
    tables: 0,
    icon: '💰',
  },
];
