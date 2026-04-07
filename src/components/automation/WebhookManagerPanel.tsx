import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Webhook, Loader2, Send } from 'lucide-react';
import {
  listWebhooks,
  triggerWebhookViaEF,
  WEBHOOK_TEMPLATES,
  type WebhookEndpoint,
} from '@/services/webhookTriggerService';
import { useToast } from '@/hooks/use-toast';

const AUTH_LABELS: Record<string, string> = {
  none: 'Sem Auth', header: 'Header', hmac_sha256: 'HMAC SHA-256',
  basic: 'Basic', bearer: 'Bearer', api_key: 'API Key',
};

export function WebhookManagerPanel() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    listWebhooks()
      .then(setWebhooks)
      .catch(() => toast({ title: 'Erro ao carregar webhooks', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async (w: WebhookEndpoint) => {
    setTestingId(w.id);
    try {
      const result = await triggerWebhookViaEF({
        path: w.path,
        payload: { test: true, source: 'webhook-manager-panel', ts: Date.now() },
      });
      toast({
        title: 'Webhook disparado',
        description: `${w.name} — status ${result.status}`,
      });
    } catch (e) {
      toast({
        title: 'Falha no teste',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Webhooks', value: webhooks.length, color: '#9B59B6' },
          { label: 'Ativos', value: webhooks.filter(w => w.status === 'active').length, color: '#6BCB77' },
          { label: 'Requests Total', value: webhooks.reduce((s, w) => s + w.request_count, 0), color: '#4D96FF' },
        ].map((s, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Templates Prontos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(WEBHOOK_TEMPLATES).map(([key, tpl]) => (
              <div key={key} className="p-3 rounded-lg bg-background border border-border hover:border-[#9B59B6]/50 cursor-pointer">
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                <Badge variant="outline" className="mt-2 text-[10px] border-border">{tpl.auth_type ? AUTH_LABELS[tpl.auth_type] ?? tpl.auth_type : 'N/A'}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando webhooks...</div>
      ) : webhooks.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Webhook size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum webhook configurado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <Card key={w.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{w.name}</p>
                    <code className="text-xs text-muted-foreground font-mono">{w.path}</code>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {w.methods.map(m => <Badge key={m} variant="outline" className="text-[10px] border-border">{m}</Badge>)}
                      <Badge variant="outline" className="text-[10px] border-border">{AUTH_LABELS[w.auth_type] ?? w.auth_type}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge className={w.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{w.status}</Badge>
                    <p className="text-xs text-muted-foreground">{w.request_count} requests</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-border hover:bg-accent hover:border-primary"
                      disabled={testingId === w.id || w.status !== 'active'}
                      onClick={() => handleTest(w)}
                    >
                      {testingId === w.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Testar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
