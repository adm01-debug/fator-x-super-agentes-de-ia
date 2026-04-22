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
