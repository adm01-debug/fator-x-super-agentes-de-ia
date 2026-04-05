/**
 * Bitrix24 Connect — Botão de OAuth para conectar com Bitrix24 CRM.
 * Chama bitrix24-oauth Edge Function via service layer.
 */
import { useState, useEffect } from 'react';
import { invokeBitrix24OAuth } from '@/services/llmGatewayService';
import { getAuthSession } from '@/services/securityService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Unlink, ExternalLink } from 'lucide-react';

export function Bitrix24Connect() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const session = await getAuthSession();
      if (!session) return;
      const data = await invokeBitrix24OAuth({ action: 'status' }) as Record<string, unknown>;
      setConnected(!!data.connected);
      setDomain(data.domain as string || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function handleConnect() {
    try {
      const data = await invokeBitrix24OAuth({ action: 'authorize' }) as Record<string, string>;
      if (data.auth_url) window.open(data.auth_url, '_blank', 'width=600,height=700');
    } catch (err) {
      console.error('Bitrix24 connect failed:', err);
    }
  }

  if (loading) return <div className="animate-pulse bg-secondary/30 rounded-xl h-20" />;

  return (
    <div className="nexus-card flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">🔗</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">Bitrix24 CRM</span>
            <Badge variant={connected ? 'default' : 'outline'} className={`text-[10px] ${connected ? 'bg-nexus-emerald/20 text-nexus-emerald border-nexus-emerald' : ''}`}>
              {connected ? '● Conectado' : 'Desconectado'}
            </Badge>
          </div>
          {domain && <span className="text-xs text-muted-foreground">{domain}</span>}
        </div>
      </div>

      <Button onClick={connected ? undefined : handleConnect} variant={connected ? 'outline' : 'default'} size="sm">
        {connected ? <><Unlink className="w-3 h-3 mr-1" /> Desconectar</> : <><ExternalLink className="w-3 h-3 mr-1" /> Conectar</>}
      </Button>
    </div>
  );
}
