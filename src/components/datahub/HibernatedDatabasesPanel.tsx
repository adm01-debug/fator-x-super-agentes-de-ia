import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Snowflake,
  Power,
  CheckCircle2,
  RefreshCw,
  Database,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabaseExternal } from "@/integrations/supabase/externalClient";

interface HibernatedDb {
  project_ref: string;
  name: string;
  hibernated_since: string | null;
  last_attempt: string | null;
  reachable_after_wake: boolean | null;
  table_count: number | null;
}

interface HibernationReport {
  total: number;
  hibernated_count: number;
  active_count: number;
  databases: HibernatedDb[];
}

const KNOWN_HIBERNATED = [
  { project_ref: 'xyykivpcdbfukaongpbw', name: 'financeiro_promo', expected_tables: 25 },
];

export function HibernatedDatabasesPanel() {
  const queryClient = useQueryClient();
  const [wakingRef, setWakingRef] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ['hibernated-databases'],
    queryFn: async (): Promise<HibernationReport> => {
      const databases: HibernatedDb[] = [];

      for (const known of KNOWN_HIBERNATED) {
        try {
          const { data, error } = await supabase.functions.invoke('datahub-query', {
            body: { action: 'health_check', project_ref: known.project_ref },
          });

          databases.push({
            project_ref: known.project_ref,
            name: known.name,
            hibernated_since: null,
            last_attempt: new Date().toISOString(),
            reachable_after_wake: !error && !!data,
            table_count: typeof (data as Record<string, unknown>)?.table_count === 'number'
              ? (data as Record<string, number>).table_count
              : null,
          });
        } catch {
          databases.push({
            project_ref: known.project_ref,
            name: known.name,
            hibernated_since: null,
            last_attempt: new Date().toISOString(),
            reachable_after_wake: false,
            table_count: null,
          });
        }
      }

      const hibernatedCount = databases.filter((d) => !d.reachable_after_wake).length;
      const activeCount = databases.length - hibernatedCount;

      return {
        total: databases.length,
        hibernated_count: hibernatedCount,
        active_count: activeCount,
        databases,
      };
    },
    refetchInterval: 120_000,
  });

  const handleWake = async (db: HibernatedDb) => {
    setWakingRef(db.project_ref);
    try {
      // Issue 3 health checks in sequence — Supabase wakes hibernated projects on first request
      let success = false;
      for (let i = 0; i < 3; i++) {
        try {
          const { data } = await supabase.functions.invoke('datahub-query', {
            body: { action: 'health_check', project_ref: db.project_ref },
          });
          if (data) {
            success = true;
            break;
          }
        } catch {
          // expected on first attempt for hibernated dbs
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (success) {
        toast.success(`${db.name} reativado com sucesso`);
      } else {
        toast.error(`${db.name} ainda hibernado — tente novamente em alguns minutos`);
      }
      await queryClient.invalidateQueries({ queryKey: ['hibernated-databases'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao reativar');
    } finally {
      setWakingRef(null);
    }
  };

  return (
    <div className="nexus-card space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Snowflake className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Bancos Hibernados</h3>
          {report && (
            <Badge variant="outline" className="text-[10px]">
              {report.hibernated_count} de {report.total} hibernado(s)
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['hibernated-databases'] })}
          className="h-7 gap-1.5 text-xs"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Verificar
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Projetos Supabase hibernam após inatividade. Use o botão "Reativar" para acordar o projeto enviando 3 requisições em sequência.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (report?.databases ?? []).length === 0 ? (
        <p className="text-center text-xs text-muted-foreground italic py-4">
          Nenhum banco hibernado conhecido
        </p>
      ) : (
        <div className="space-y-2">
          {report?.databases.map((db) => (
            <div
              key={db.project_ref}
              className={`p-3 rounded-lg border ${
                db.reachable_after_wake
                  ? 'bg-nexus-emerald/5 border-nexus-emerald/30'
                  : 'bg-primary/5 border-primary/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {db.reachable_after_wake ? (
                    <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" />
                  ) : (
                    <Snowflake className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{db.name}</p>
                    <code className="text-[9px] text-muted-foreground font-mono block truncate">
                      {db.project_ref}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {db.reachable_after_wake && db.table_count != null && (
                    <Badge variant="outline" className="text-[9px]">
                      <Database className="h-2.5 w-2.5 mr-0.5" /> {db.table_count}
                    </Badge>
                  )}
                  {!db.reachable_after_wake && (
                    <Button
                      size="sm"
                      onClick={() => handleWake(db)}
                      disabled={wakingRef === db.project_ref}
                      className="h-7 text-xs gap-1.5"
                    >
                      {wakingRef === db.project_ref ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                      Reativar
                    </Button>
                  )}
                </div>
              </div>
              {db.last_attempt && (
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Última tentativa: {new Date(db.last_attempt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {report && report.hibernated_count === 0 && report.total > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-nexus-emerald/10 border border-nexus-emerald/30">
          <CheckCircle2 className="h-3.5 w-3.5 text-nexus-emerald" />
          <p className="text-xs text-nexus-emerald">Todos os bancos conhecidos estão ativos</p>
        </div>
      )}
    </div>
  );
}
