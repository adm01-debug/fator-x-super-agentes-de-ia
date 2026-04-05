/**
 * Bitrix24 Connect — Botão de OAuth para conectar com Bitrix24 CRM.
 * Chama bitrix24-oauth Edge Function.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Unlink, ExternalLink } from 'lucide-react';

export function Bitrix24Connect() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bitrix24-oauth?action=status`,
        { headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await resp.json() as Record<string, unknown>;
      setConnected(!!data.connected);
      setDomain(data.domain as string || null);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function handleConnect() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bitrix24-oauth?action=authorize`,
        { headers: { 'Authorization': `Bearer ${session.access_token}`, 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const data = await resp.json() as Record<string, string>;
      if (data.auth_url) window.open(data.auth_url, '_blank', 'width=600,height=700');
    } catch (err) {
      console.error('Bitrix24 connect failed:', err);
    }
  }

  if (loading) return <div className="animate-pulse bg-[#111122] rounded-xl h-20" />;

  return (
    <div className="bg-[#111122] rounded-xl border border-[#222244] p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#2FC6F6]/10 flex items-center justify-center text-lg">🔗</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Bitrix24 CRM</span>
            <Badge variant={connected ? 'default' : 'outline'} className={`text-[10px] ${connected ? 'bg-[#6BCB77]/20 text-[#6BCB77] border-[#6BCB77]' : ''}`}>
              {connected ? '● Conectado' : 'Desconectado'}
            </Badge>
          </div>
          {domain && <span className="text-xs text-[#888888]">{domain}</span>}
        </div>
      </div>

      <Button
        onClick={connected ? undefined : handleConnect}
        variant={connected ? 'outline' : 'default'}
        size="sm"
        className={connected ? 'border-[#222244]' : 'bg-[#2FC6F6] hover:bg-[#2FC6F6]/80'}
      >
        {connected ? (
          <><Unlink className="w-3 h-3 mr-1" /> Desconectar</>
        ) : (
          <><ExternalLink className="w-3 h-3 mr-1" /> Conectar</>
        )}
      </Button>
    </div>
  );
}
