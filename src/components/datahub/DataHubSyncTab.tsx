import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Database,
  Brain,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SyncStatus {
  source_db: string;
  source_table: string;
  records_total: number;
  records_synced: number;
  last_sync_at: string | null;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'partial';
  enabled: boolean;
  next_sync_at: string | null;
  error?: string;
}

interface SyncReport {
  configured_count: number;
  total_records: number;
  synced_records: number;
  last_run_at: string | null;
  statuses: SyncStatus[];
}

const STATUS_CFG: Record<SyncStatus['status'], { color: string; label: string; icon: typeof CheckCircle2 }> = {
  pending: { color: 'hsl(var(--muted-foreground))', label: 'Pendente', icon: Clock },
  syncing: { color: 'hsl(var(--nexus-blue))', label: 'Sincronizando', icon: Loader2 },
  synced: { color: 'hsl(var(--nexus-emerald))', label: 'Sincronizado', icon: CheckCircle2 },
  failed: { color: 'hsl(var(--nexus-red))', label: 'Falhou', icon: AlertTriangle },
  partial: { color: 'hsl(var(--nexus-yellow))', label: 'Parcial', icon: AlertTriangle },
};

const DB_LABELS: Record<string, string> = {
  bancodadosclientes: 'CRM',
  'supabase-fuchsia-kite': 'Catálogo',
  backupgiftstore: 'WhatsApp',
  gestao_time_promo: 'HR',
  financeiro_promo: 'Financeiro',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

export function DataHubSyncTab() {
  const queryClient = useQueryClient();
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['datahub-sync-status'],
    queryFn: async (): Promise<SyncReport> => {
      try {
        const { data, error } = await supabase.functions.invoke('datahub-query', {
          body: { action: 'sync_status' },
        });
        if (error) throw new Error(error.message);
        const r = data as Record<string, unknown>;
        return {
          configured_count: typeof r?.configured_count === 'number' ? r.configured_count : 0,
          total_records: typeof r?.total_records === 'number' ? r.total_records : 0,
          synced_records: typeof r?.synced_records === 'number' ? r.synced_records : 0,
          last_run_at: typeof r?.last_run_at === 'string' ? r.last_run_at : null,
          statuses: (r?.statuses ?? []) as SyncStatus[],
        };
      } catch {
        // Return empty report instead of throwing — sync infra may not be ready yet
        return {
          configured_count: 0,
          total_records: 0,
          synced_records: 0,
          last_run_at: null,
          statuses: [],
        };
      }
    },
    refetchInterval: 30_000,
  });

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const { error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'sync_to_cerebro' },
      });
      if (error) throw new Error(error.message);
      toast.success('Sincronização iniciada');
      await queryClient.invalidateQueries({ queryKey: ['datahub-sync-status'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao sincronizar');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleSync = async (status: SyncStatus, enabled: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('datahub-query', {
        body: {
          action: 'toggle_sync',
          source_db: status.source_db,
          source_table: status.source_table,
          enabled,
        },
      });
      if (error) throw new Error(error.message);
      toast.success(enabled ? 'Sync habilitada' : 'Sync desabilitada');
      await queryClient.invalidateQueries({ queryKey: ['datahub-sync-status'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha');
    }
  };

  const syncProgress = report && report.total_records > 0
    ? (report.synced_records / report.total_records) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Sync para Super Cérebro
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Sincroniza dados dos 5 bancos do DataHub para o knowledge graph do Super Cérebro como fatos consumíveis pelos agentes.
          </p>
        </div>
        <Button
          onClick={handleSyncAll}
          disabled={syncingAll || isLoading}
          className="gap-1.5"
        >
          {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Sincronizar Tudo
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tabelas Configuradas</p>
          <p className="text-xl font-bold text-primary mt-1">{report?.configured_count ?? 0}</p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total de Registros</p>
          <p className="text-xl font-bold text-nexus-purple mt-1">
            {report?.total_records?.toLocaleString('pt-BR') ?? 0}
          </p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sincronizados</p>
          <p className="text-xl font-bold text-nexus-emerald mt-1">
            {report?.synced_records?.toLocaleString('pt-BR') ?? 0}
          </p>
        </div>
        <div className="nexus-card text-center py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Última Execução</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {formatRelativeTime(report?.last_run_at ?? null)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progresso de sincronização</span>
          <span className="text-xs font-mono font-semibold text-primary">
            {syncProgress.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-nexus-emerald transition-all duration-500"
            style={{ width: `${syncProgress}%` }}
          />
        </div>
      </div>

      {/* Per-table status */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (report?.statuses?.length ?? 0) === 0 ? (
        <div className="nexus-card text-center py-12">
          <Database className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma tabela configurada para sincronização</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Configure mapeamentos de entidade na aba Schema para ativar a sincronização
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {report?.statuses.map((s, i) => {
            const cfg = STATUS_CFG[s.status];
            const StatusIcon = cfg.icon;
            const dbLabel = DB_LABELS[s.source_db] ?? s.source_db;
            const tableProgress = s.records_total > 0 ? (s.records_synced / s.records_total) * 100 : 0;

            return (
              <div key={i} className="nexus-card">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <StatusIcon
                      className={`h-4 w-4 shrink-0 ${s.status === 'syncing' ? 'animate-spin' : ''}`}
                      style={{ color: cfg.color }}
                    />
                    <Badge variant="outline" className="text-[10px] shrink-0">{dbLabel}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <code className="text-xs font-mono truncate">{s.source_table}</code>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Brain className="h-3 w-3 text-primary shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-[9px]"
                      style={{ borderColor: cfg.color + '80', color: cfg.color }}
                    >
                      {cfg.label}
                    </Badge>
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(checked) => handleToggleSync(s, checked)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-[11px] text-muted-foreground mb-2">
                  <span>
                    Total: <span className="text-foreground font-semibold">{s.records_total.toLocaleString('pt-BR')}</span>
                  </span>
                  <span>
                    Sincronizados: <span className="text-nexus-emerald font-semibold">{s.records_synced.toLocaleString('pt-BR')}</span>
                  </span>
                  <span>
                    Última: <span className="text-foreground">{formatRelativeTime(s.last_sync_at)}</span>
                  </span>
                </div>

                <div className="h-1 rounded-full bg-secondary/40 overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${tableProgress}%`,
                      backgroundColor: cfg.color,
                    }}
                  />
                </div>

                {s.error && (
                  <p className="text-[10px] text-destructive mt-2 italic">{s.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
