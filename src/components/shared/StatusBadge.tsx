import { memo } from "react";

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { className: string; label: string }> = {
  active: { className: 'nexus-badge-success', label: 'Ativo' },
  connected: { className: 'nexus-badge-success', label: 'Conectado' },
  synced: { className: 'nexus-badge-success', label: 'Sincronizado' },
  completed: { className: 'nexus-badge-success', label: 'Concluído' },
  success: { className: 'nexus-badge-success', label: 'Sucesso' },
  production: { className: 'nexus-badge-success', label: 'Produção' },
  monitoring: { className: 'nexus-badge-success', label: 'Monitorando' },
  tested: { className: 'nexus-badge-info', label: 'Testado' },
  draft: { className: 'nexus-badge-info', label: 'Rascunho' },
  configured: { className: 'nexus-badge-info', label: 'Configurado' },
  syncing: { className: 'nexus-badge-info', label: 'Sincronizando' },
  running: { className: 'nexus-badge-info', label: 'Executando' },
  deploying: { className: 'nexus-badge-info', label: 'Deploy...' },
  review: { className: 'nexus-badge-warning', label: 'Revisão' },
  staging: { className: 'nexus-badge-warning', label: 'Staging' },
  paused: { className: 'nexus-badge-warning', label: 'Pausado' },
  pending: { className: 'nexus-badge-warning', label: 'Pendente' },
  queued: { className: 'nexus-badge-warning', label: 'Na fila' },
  testing: { className: 'nexus-badge-warning', label: 'Testando' },
  invited: { className: 'nexus-badge-warning', label: 'Convidado' },
  warning: { className: 'nexus-badge-warning', label: 'Aviso' },
  deprecated: { className: 'nexus-badge-danger', label: 'Depreciado' },
  archived: { className: 'nexus-badge-danger', label: 'Arquivado' },
  error: { className: 'nexus-badge-danger', label: 'Erro' },
  critical: { className: 'nexus-badge-danger', label: 'Crítico' },
  failed: { className: 'nexus-badge-danger', label: 'Falhou' },
  timeout: { className: 'nexus-badge-danger', label: 'Timeout' },
  disconnected: { className: 'nexus-badge-danger', label: 'Desconectado' },
  disabled: { className: 'nexus-badge-danger', label: 'Desabilitado' },
  inactive: { className: 'nexus-badge-danger', label: 'Inativo' },
  prototype: { className: 'nexus-badge-primary', label: 'Protótipo' },
  development: { className: 'nexus-badge-primary', label: 'Dev' },
  info: { className: 'nexus-badge-info', label: 'Info' },
  debug: { className: 'nexus-badge-info', label: 'Debug' },
};

export const StatusBadge = memo(function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || { className: 'nexus-badge-info', label: status };
  return (
    <span className={`${config.className} ${size === 'md' ? 'px-2.5 py-1 text-xs' : ''}`} role="status">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {config.label}
    </span>
  );
});
