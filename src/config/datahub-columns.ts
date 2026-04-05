import { logger } from '@/lib/logger';
/**
 * Column definitions per entity for DataHub list/detail views.
 * Controls which columns are visible, their labels, widths, and formatting.
 */

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  format?: 'cnpj' | 'phone' | 'date' | 'currency' | 'boolean' | 'truncate' | 'sensitive';
  width?: string; // tailwind class e.g. 'w-[200px]'
  hideOnMobile?: boolean;
}

export interface FilterOption {
  column: string;
  label: string;
  type: 'text' | 'select' | 'boolean';
  options?: { label: string; value: string }[];
}

export const ENTITY_DISPLAY_COLUMNS: Record<string, ColumnDef[]> = {
  cliente: [
    { key: 'razao_social', label: 'Razão Social', sortable: true, width: 'min-w-[220px] max-w-[300px]' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', sortable: true, width: 'min-w-[160px] max-w-[220px]', hideOnMobile: true },
    { key: 'cnpj', label: 'CNPJ', format: 'cnpj', width: 'w-[160px]', hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true, width: 'w-[90px]' },
    { key: 'grupo_economico_id', label: 'Grupo Econ.', width: 'w-[100px]', hideOnMobile: true, format: 'truncate' },
    { key: 'updated_at', label: 'Atualizado', format: 'date', sortable: true, width: 'w-[110px]', hideOnMobile: true },
  ],
  fornecedor: [
    { key: 'razao_social', label: 'Razão Social', sortable: true, width: 'min-w-[220px] max-w-[300px]' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', sortable: true, width: 'min-w-[160px] max-w-[220px]', hideOnMobile: true },
    { key: 'cnpj', label: 'CNPJ', format: 'cnpj', width: 'w-[160px]', hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true, width: 'w-[90px]' },
    { key: 'updated_at', label: 'Atualizado', format: 'date', sortable: true, width: 'w-[110px]', hideOnMobile: true },
  ],
  transportadora: [
    { key: 'razao_social', label: 'Razão Social', sortable: true, width: 'min-w-[220px] max-w-[300px]' },
    { key: 'nome_fantasia', label: 'Nome Fantasia', sortable: true, width: 'min-w-[160px]', hideOnMobile: true },
    { key: 'cnpj', label: 'CNPJ', format: 'cnpj', width: 'w-[160px]', hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true, width: 'w-[90px]' },
  ],
  produto: [
    { key: 'name', label: 'Nome', sortable: true, width: 'min-w-[220px] max-w-[350px]' },
    { key: 'slug', label: 'Slug', width: 'min-w-[140px]', hideOnMobile: true, format: 'truncate' },
    { key: 'is_active', label: 'Ativo', format: 'boolean', width: 'w-[70px]' },
    { key: 'updated_at', label: 'Atualizado', format: 'date', sortable: true, width: 'w-[110px]', hideOnMobile: true },
  ],
  colaborador: [
    { key: 'nome_completo', label: 'Nome', sortable: true, width: 'min-w-[200px] max-w-[280px]' },
    { key: 'email', label: 'Email', width: 'min-w-[180px]', hideOnMobile: true },
    { key: 'cpf', label: 'CPF', format: 'sensitive', width: 'w-[130px]', hideOnMobile: true },
    { key: 'salario', label: 'Salário', format: 'sensitive', width: 'w-[100px]', hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true, width: 'w-[90px]' },
  ],
  conversa_whatsapp: [
    { key: 'name', label: 'Nome', sortable: true, width: 'min-w-[200px] max-w-[300px]' },
    { key: 'phone', label: 'Telefone', format: 'phone', width: 'w-[150px]' },
    { key: 'updated_at', label: 'Último contato', format: 'date', sortable: true, width: 'w-[130px]', hideOnMobile: true },
  ],
};

export const ENTITY_FILTER_OPTIONS: Record<string, FilterOption[]> = {
  cliente: [
    { column: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ]},
    { column: 'nome_fantasia', label: 'Nome Fantasia', type: 'text' },
    { column: 'cnpj', label: 'CNPJ', type: 'text' },
    { column: 'grupo_economico_id', label: 'Grupo Econômico', type: 'text' },
  ],
  fornecedor: [
    { column: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ]},
    { column: 'cnpj', label: 'CNPJ', type: 'text' },
    { column: 'nome_fantasia', label: 'Nome Fantasia', type: 'text' },
  ],
  transportadora: [
    { column: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ]},
    { column: 'cnpj', label: 'CNPJ', type: 'text' },
  ],
  produto: [
    { column: 'is_active', label: 'Ativo', type: 'boolean' },
    { column: 'name', label: 'Nome', type: 'text' },
    { column: 'slug', label: 'Slug', type: 'text' },
  ],
  colaborador: [
    { column: 'status', label: 'Status', type: 'select', options: [
      { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' },
    ]},
    { column: 'email', label: 'Email', type: 'text' },
  ],
  conversa_whatsapp: [
    { column: 'phone', label: 'Telefone', type: 'text' },
    { column: 'name', label: 'Nome', type: 'text' },
  ],
};

/* ── Formatting helpers ─────────────────────────────── */

export function formatCNPJ(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return value;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatPhone(value: string | null): string {
  if (!value) return '—';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch (err) { logger.error("Operation failed:", err); return value; }
}

export function formatCellValue(value: unknown, format?: ColumnDef['format']): string {
  if (value === null || value === undefined) return '—';
  if (format === 'cnpj') return formatCNPJ(String(value));
  if (format === 'phone') return formatPhone(String(value));
  if (format === 'date') return formatDate(String(value));
  if (format === 'boolean') return value === true ? '✅' : value === false ? '❌' : '—';
  if (format === 'currency') return `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (format === 'sensitive') return String(value).includes('REDACTED') || String(value) === '***' ? '🔒 ***' : String(value);
  if (format === 'truncate') return String(value).length > 12 ? `${String(value).slice(0, 12)}…` : String(value);
  return String(value);
}

/* ── CSV Export ──────────────────────────────────────── */

export function exportToCSV(data: Record<string, unknown>[], columns: ColumnDef[], entityName: string): void {
  if (!data.length) return;

  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      if (c.format === 'sensitive' && (String(val).includes('REDACTED') || String(val) === '***')) return '[REDACTED]';
      return String(val).replace(/"/g, '""');
    })
  );

  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `datahub_${entityName}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ── JSON Export ─────────────────────────────────────── */

export function exportToJSON(data: Record<string, unknown>[], columns: ColumnDef[], entityName: string): void {
  if (!data.length) return;

  const sanitized = data.map(row => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      const val = row[col.key];
      if (col.format === 'sensitive' && (String(val).includes('REDACTED') || String(val) === '***')) {
        obj[col.key] = '[REDACTED]';
      } else {
        obj[col.key] = val ?? null;
      }
    }
    return obj;
  });

  const json = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `datahub_${entityName}_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
