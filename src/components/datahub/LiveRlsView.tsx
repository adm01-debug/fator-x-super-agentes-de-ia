import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Database, CheckCircle2, XCircle } from "lucide-react";
import { getDatahubRlsPolicies, type RlsPolicy } from "@/services/datahubService";

export function LiveRlsView() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["datahub_rls_policies"],
    queryFn: () => getDatahubRlsPolicies(),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mb-3" />
        <p className="text-sm font-semibold text-destructive">Erro ao buscar policies</p>
        <p className="text-[11px] text-muted-foreground mt-1">{error instanceof Error ? error.message : String(error)}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 h-7 text-xs">Tentar novamente</Button>
      </div>
    );
  }

  const connections = data?.connections ?? {};
  const totalPolicies = Object.values(connections).reduce((sum, c) => sum + (c.count ?? 0), 0);
  const reachableCount = Object.values(connections).filter((c) => c.ok).length;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Policies reais lidas de <code className="font-mono bg-secondary/40 px-1 rounded">pg_policies</code> em cada projeto Supabase remoto.
      </p>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px]">{reachableCount}/{Object.keys(connections).length} conexões OK</Badge>
          <Badge variant="outline" className="text-[10px]">{totalPolicies} policies reais</Badge>
          {data?.timestamp && <Badge variant="outline" className="text-[10px]">Lido em {new Date(data.timestamp).toLocaleTimeString('pt-BR')}</Badge>}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 gap-1.5 text-xs">
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />} Atualizar
        </Button>
      </div>

      {Object.entries(connections).map(([connId, conn]) => (
        <div key={connId} className="nexus-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{connId}</h4>
              {conn.ok ? (
                <Badge variant="outline" className="text-[10px] border-nexus-emerald/50 text-nexus-emerald gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> {conn.count} policies</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive gap-1"><XCircle className="h-2.5 w-2.5" /> Indisponível</Badge>
              )}
            </div>
          </div>

          {!conn.ok ? (
            <p className="text-[11px] text-destructive italic">{conn.error}</p>
          ) : (conn.policies?.length ?? 0) === 0 ? (
            <p className="text-[11px] text-muted-foreground italic">Nenhuma policy declarada (atenção: sem RLS = acesso total)</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/30 border-b border-border/40">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Tabela</th>
                    <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Policy</th>
                    <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Cmd</th>
                    <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Roles</th>
                    <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">USING</th>
                  </tr>
                </thead>
                <tbody>
                  {(conn.policies as RlsPolicy[]).map((p, i) => (
                    <tr key={`${p.table}-${p.name}-${i}`} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-2 py-1.5 font-mono text-foreground">{p.table}</td>
                      <td className="px-2 py-1.5 text-foreground">{p.name}</td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[9px] font-mono">{p.cmd}</Badge></td>
                      <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{p.roles.join(', ') || '—'}</td>
                      <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono truncate max-w-[200px]" title={p.using}>{p.using ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
