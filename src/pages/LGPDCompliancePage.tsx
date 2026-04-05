import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Trash2, Download, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { toast } from 'sonner';

export default function LGPDCompliancePage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Consent records
  const { data: consents = [] } = useQuery({
    queryKey: ['lgpd_consents'],
    queryFn: async () => {
      const { data } = await supabase.from('consent_records').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  // Deletion requests
  const { data: deletions = [] } = useQuery({
    queryKey: ['lgpd_deletions'],
    queryFn: async () => {
      const { data } = await supabase.from('data_deletion_requests').select('*').order('requested_at', { ascending: false });
      return data ?? [];
    },
  });

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('lgpd-manager', {
        body: { action: 'get_my_data' },
      });
      if (error) throw error;
      // Download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`Dados exportados: ${data.traces} traces, ${data.sessions} sessões, ${data.memories} memórias`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setExporting(false); }
  };

  const handleRequestDeletion = async (scope: string) => {
    if (!confirm(`Tem certeza? Isso irá deletar ${scope === 'all' ? 'TODOS os seus dados' : `seus dados de ${scope}`} permanentemente.`)) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('lgpd-manager', {
        body: { action: 'request_deletion', scope },
      });
      if (error) throw error;
      toast.success(`${data.items_deleted} itens deletados (escopo: ${scope})`);
      queryClient.invalidateQueries({ queryKey: ['lgpd_deletions'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
    finally { setDeleting(false); }
  };

  const handleConsent = async (purpose: string, grant: boolean) => {
    try {
      await supabase.functions.invoke('lgpd-manager', {
        body: { action: grant ? 'consent_grant' : 'consent_revoke', purpose, legal_basis: 'consent' },
      });
      toast.success(grant ? 'Consentimento registrado' : 'Consentimento revogado');
      queryClient.invalidateQueries({ queryKey: ['lgpd_consents'] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erro inesperado"); }
  };

  const purposes = [
    { key: 'ai_processing', label: 'Processamento por IA', desc: 'Suas mensagens são processadas por modelos de linguagem para gerar respostas.' },
    { key: 'data_storage', label: 'Armazenamento de Dados', desc: 'Traces, sessões e memórias são armazenados para histórico e melhoria.' },
    { key: 'analytics', label: 'Analytics e Métricas', desc: 'Dados agregados de uso para dashboards e relatórios.' },
  ];

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="LGPD Compliance" description="Gerencie consentimento, dados pessoais e solicitações de exclusão" />

      <Tabs defaultValue="consent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consent" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Consentimento</TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Meus Dados</TabsTrigger>
          <TabsTrigger value="deletion" className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Exclusão</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="consent" className="space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Bases Legais para Processamento</h3>
            <div className="space-y-4">
              {purposes.map(p => {
                const consent = consents.find((c: Record<string, unknown>) => c.purpose === p.key && c.granted);
                return (
                  <div key={p.key} className="flex items-start justify-between py-3 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                      {consent && <p className="text-[11px] text-nexus-emerald mt-1">Consentido em {new Date(consent.created_at).toLocaleDateString('pt-BR')}</p>}
                    </div>
                    <div className="flex gap-2">
                      {consent ? (
                        <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => handleConsent(p.key, false)}>Revogar</Button>
                      ) : (
                        <Button size="sm" className="text-xs nexus-gradient-bg text-primary-foreground" onClick={() => handleConsent(p.key, true)}>Consentir</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Exportar Meus Dados</h3>
            <p className="text-xs text-muted-foreground mb-4">Baixe todos os seus dados pessoais em formato JSON, conforme Art. 18 da LGPD (direito de acesso).</p>
            <Button onClick={handleExportData} disabled={exporting} className="nexus-gradient-bg text-primary-foreground gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar dados (JSON)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="deletion" className="space-y-4">
          <div className="nexus-card border-destructive/20">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Solicitação de Exclusão
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Conforme Art. 18 da LGPD, você tem direito à eliminação dos seus dados pessoais. Esta ação é irreversível.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['traces', 'sessions', 'memories', 'all'].map(scope => (
                <Button key={scope} variant={scope === 'all' ? 'destructive' : 'outline'} size="sm" className="text-xs"
                  onClick={() => handleRequestDeletion(scope)} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  {scope === 'all' ? 'Deletar TUDO' : `Deletar ${scope}`}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {deletions.length === 0 && consents.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Nenhum registro de consentimento ou exclusão.</div>
          ) : (
            <div className="space-y-2">
              {[...deletions.map((d: Record<string, unknown>) => ({ ...d, _type: 'deletion' })), ...consents.map((c: Record<string, unknown>) => ({ ...c, _type: 'consent' }))]
                .sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.created_at || b.requested_at).getTime() - new Date(a.created_at || a.requested_at).getTime())
                .slice(0, 30)
                .map((item: Record<string, unknown>) => (
                <div key={item.id}
                  className="nexus-card flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {item._type === 'deletion' ? <Trash2 className="h-3.5 w-3.5 text-destructive" /> : <Shield className="h-3.5 w-3.5 text-primary" />}
                    <div>
                      <span className="text-foreground font-medium">
                        {item._type === 'deletion' ? `Exclusão: ${item.scope}` : `${item.granted ? 'Consentimento' : 'Revogação'}: ${item.purpose}`}
                      </span>
                      <p className="text-[11px] text-muted-foreground">{new Date(item.created_at || item.requested_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <Badge variant={item.status === 'completed' || item.granted ? 'default' : item.status === 'failed' ? 'destructive' : 'outline'} className="text-[11px]">
                    {item.status || (item.granted ? 'ativo' : 'revogado')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
