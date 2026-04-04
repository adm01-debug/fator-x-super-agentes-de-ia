import { ShieldCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabaseExtended";
import { toast } from "sonner";

export function AuditLogSection() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_log'],
    queryFn: async () => {
      const { data, error } = await fromTable('audit_log').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) return [];
      return data ?? [];
    },
  });

  const handleExport = (format: 'csv' | 'json') => {
    if (logs.length === 0) return;
    let content: string;
    let mime: string;
    let ext: string;

    if (format === 'csv') {
      const headers = ['Data', 'Ação', 'Tipo', 'Entity ID', 'Metadata'];
      const rows = logs.map((l: Record<string, unknown>) => [
        new Date(l.created_at as string).toISOString(),
        l.action,
        l.entity_type,
        l.entity_id || '',
        JSON.stringify(l.metadata || {}),
      ]);
      content = [headers.join(','), ...rows.map((r: unknown[]) => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else {
      content = JSON.stringify(logs, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Audit log exportado como ${ext.toUpperCase()}`);
  };

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Audit Trail
        </h3>
        {logs.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleExport('csv')}>
              CSV
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleExport('json')}>
              JSON
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {logs.map((log: Record<string, unknown>, i: number) => (
            <div key={(log.id as string) || i}
              className="flex items-center gap-3 py-2 px-2 rounded hover:bg-secondary/30 text-xs">
              <span className="text-muted-foreground w-[130px] shrink-0 font-mono text-[11px]">{new Date(log.created_at as string).toLocaleString('pt-BR')}</span>
              <Badge variant="outline" className="text-[11px] shrink-0">{(log.action as string) || 'action'}</Badge>
              <span className="text-foreground truncate">{(log.description as string) || (log.details as string) || JSON.stringify(log.metadata || {}).substring(0, 100)}</span>
              <span className="text-muted-foreground ml-auto shrink-0">{(log.user_email as string) || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
