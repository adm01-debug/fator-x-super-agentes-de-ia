import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Shield, Download, RefreshCw, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import {
  listAuditEntries,
  listAuditEntriesByAction,
  type AuditAction,
  type AuditLogEntry,
  type AuditStatus,
} from '@/services/auditLogService';

const ACTION_LABELS: Record<string, string> = {
  delete: 'Excluir',
  bulk_delete: 'Excluir em massa',
  update: 'Atualizar',
  create: 'Criar',
  revoke: 'Revogar',
  rotate: 'Rotacionar',
  export: 'Exportar',
  import: 'Importar',
  deploy: 'Deploy',
  undeploy: 'Undeploy',
  promote: 'Promover',
  role_change: 'Mudança de papel',
  permission_grant: 'Conceder permissão',
  permission_revoke: 'Revogar permissão',
  credential_access: 'Acesso a credencial',
  data_erasure: 'Apagamento de dados',
  settings_change: 'Alteração de config',
};

const STATUS_STYLES: Record<AuditStatus, { color: string; icon: typeof CheckCircle2 }> = {
  success: { color: 'bg-nexus-emerald/20 text-nexus-emerald border-nexus-emerald/30', icon: CheckCircle2 },
  failed: { color: 'bg-destructive/20 text-destructive border-destructive/30', icon: AlertTriangle },
  denied: { color: 'bg-nexus-amber/20 text-nexus-amber border-nexus-amber/30', icon: Ban },
};

export function AuditTrailPanel() {
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-trail', actionFilter],
    queryFn: () =>
      actionFilter === 'all'
        ? listAuditEntries(200)
        : listAuditEntriesByAction(actionFilter, 200),
    refetchInterval: 60_000,
  });

  const exportCsv = () => {
    if (entries.length === 0) {
      toast.error('Nada para exportar');
      return;
    }
    const headers = [
      'created_at',
      'user_id',
      'workspace_id',
      'action',
      'resource_type',
      'resource_id',
      'resource_name',
      'status',
      'reason',
    ];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = entries.map((e) =>
      headers.map((h) => escape((e as unknown as Record<string, unknown>)[h])).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${entries.length} entradas exportadas`);
  };

  const stats = {
    total: entries.length,
    success: entries.filter((e) => e.status === 'success').length,
    failed: entries.filter((e) => e.status === 'failed').length,
    denied: entries.filter((e) => e.status === 'denied').length,
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-nexus-purple" />
            Audit Trail
            <Badge variant="outline" className="text-[10px] border-border">
              últimas 200 entradas
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
              <SelectTrigger className="bg-background border-border h-8 text-xs w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 border-border"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              className="h-8 border-border gap-1.5"
              disabled={entries.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-background border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold text-primary mt-1">{stats.total}</p>
          </div>
          <div className="p-3 rounded-lg bg-background border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sucessos</p>
            <p className="text-xl font-bold text-nexus-emerald mt-1">{stats.success}</p>
          </div>
          <div className="p-3 rounded-lg bg-background border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Falhas</p>
            <p className="text-xl font-bold text-destructive mt-1">{stats.failed}</p>
          </div>
          <div className="p-3 rounded-lg bg-background border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Negadas</p>
            <p className="text-xl font-bold text-nexus-amber mt-1">{stats.denied}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando audit trail...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma entrada de audit ainda.</p>
            <p className="text-xs mt-1 opacity-70">Ações sensíveis serão registradas aqui automaticamente.</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {entries.map((e: AuditLogEntry, idx) => {
              const statusStyle = STATUS_STYLES[(e.status ?? 'success') as AuditStatus];
              const StatusIcon = statusStyle.icon;
              return (
                <div
                  key={e.id ?? idx}
                  className="p-3 rounded-lg bg-background border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${
                        e.status === 'success' ? 'text-nexus-emerald' :
                        e.status === 'failed' ? 'text-destructive' :
                        'text-nexus-amber'
                      }`} />
                      <Badge variant="outline" className="text-[10px] border-border font-mono shrink-0">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </Badge>
                      <span className="text-xs text-foreground/80 truncate">
                        {e.resource_type}
                        {e.resource_name && (
                          <>: <span className="font-mono text-muted-foreground">{e.resource_name}</span></>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : '—'}
                    </span>
                  </div>
                  {e.reason && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2 pl-5">
                      "{e.reason}"
                    </p>
                  )}
                  {e.user_id && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1 pl-5 font-mono">
                      user: {e.user_id.slice(0, 8)}…
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
