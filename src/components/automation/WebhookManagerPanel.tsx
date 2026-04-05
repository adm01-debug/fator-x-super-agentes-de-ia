import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Webhook } from 'lucide-react';
import { listWebhooks, WEBHOOK_TEMPLATES, type WebhookEndpoint } from '@/services/webhookTriggerService';
import { useToast } from '@/hooks/use-toast';

const AUTH_LABELS: Record<string, string> = {
  none: 'Sem Auth', header: 'Header', hmac_sha256: 'HMAC SHA-256',
  basic: 'Basic', bearer: 'Bearer', api_key: 'API Key',
};

export function WebhookManagerPanel() {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    listWebhooks().then(setWebhooks).catch(() => toast({ title: 'Erro ao carregar webhooks', variant: 'destructive' })).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Webhooks', value: webhooks.length, color: '#9B59B6' },
          { label: 'Ativos', value: webhooks.filter(w => w.status === 'active').length, color: '#6BCB77' },
          { label: 'Requests Total', value: webhooks.reduce((s, w) => s + w.request_count, 0), color: '#4D96FF' },
        ].map((s, i) => (
          <Card key={i} className="bg-[#111122] border-[#222244]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-[#111122] border-[#222244]">
        <CardHeader className="pb-3"><CardTitle className="text-sm text-gray-400">Templates Prontos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(WEBHOOK_TEMPLATES).map(([key, tpl]) => (
              <div key={key} className="p-3 rounded-lg bg-[#0a0a1a] border border-[#222244] hover:border-[#9B59B6]/50 cursor-pointer">
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-xs text-gray-400 mt-1">{tpl.description}</p>
                <Badge variant="outline" className="mt-2 text-[10px] border-[#222244]">{tpl.auth_type ? AUTH_LABELS[tpl.auth_type] ?? tpl.auth_type : 'N/A'}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando webhooks...</div>
      ) : webhooks.length === 0 ? (
        <Card className="bg-[#111122] border-[#222244]">
          <CardContent className="py-12 text-center text-gray-400">
            <Webhook size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum webhook configurado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <Card key={w.id} className="bg-[#111122] border-[#222244]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{w.name}</p>
                    <code className="text-xs text-gray-500 font-mono">{w.path}</code>
                    <div className="flex gap-2 mt-1">
                      {w.methods.map(m => <Badge key={m} variant="outline" className="text-[10px] border-[#222244]">{m}</Badge>)}
                      <Badge variant="outline" className="text-[10px] border-[#222244]">{AUTH_LABELS[w.auth_type] ?? w.auth_type}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={w.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{w.status}</Badge>
                    <p className="text-xs text-gray-500 mt-1">{w.request_count} requests</p>
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
