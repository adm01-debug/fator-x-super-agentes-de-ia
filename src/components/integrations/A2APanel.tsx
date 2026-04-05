/**
 * A2A Agent Cards Panel — Gestão de Agent Cards para protocolo A2A.
 * Mostra cards publicados, permite configurar skills e testar comunicação.
 */
import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from 'react';
import { invokeA2AServer } from '@/services/llmGatewayService';
import { getAuthSession } from '@/services/securityService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Globe, RefreshCw, Copy, Loader2, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: { streaming: boolean; pushNotifications: boolean; stateTransitionHistory: boolean };
  skills: Array<{ id: string; name: string; description: string; tags: string[] }>;
}

export function A2APanel() {
  const [card, setCard] = useState<AgentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const loadCard = useCallback(async () => {
    try {
      const session = await getAuthSession();
      if (!session) return;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/a2a-server`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (resp.ok) setCard(await resp.json() as AgentCard);
    } catch (err) {
      logger.error('Failed to load Agent Card:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCard(); }, [loadCard]);

  async function sendTestTask() {
    if (!testQuery.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await invokeA2AServer({
        message: { parts: [{ type: 'text', text: testQuery }] },
      }) as Record<string, unknown>;
      const result = data.result as Record<string, unknown>;
      const artifact = (result?.artifacts as Array<Record<string, unknown>>)?.[0];
      const text = (artifact?.parts as Array<Record<string, string>>)?.[0]?.text || JSON.stringify(data, null, 2);
      setTestResult(text);
    } catch (err) {
      setTestResult(`Erro: ${err instanceof Error ? err.message : 'Falha na comunicação'}`);
    } finally {
      setTesting(false);
    }
  }

  const cardUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/a2a-server`;

  if (loading) return <div className="animate-pulse bg-card rounded-xl h-40 border border-border" />;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">A2A — Agent-to-Agent Protocol</h3>
          <Badge variant="outline" className="text-[10px] border-primary text-primary">Google A2A v0.3</Badge>
        </div>
        <Button variant="ghost" size="sm" aria-label="Atualizar" onClick={loadCard}><RefreshCw className="w-3 h-3" /></Button>
      </div>

      {card && (
        <div className="bg-background rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground">{card.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </div>
            <Badge className="bg-nexus-emerald/20 text-nexus-emerald border-nexus-emerald">v{card.version}</Badge>
          </div>

          <div className="flex gap-2">
            {card.capabilities.streaming && <Badge variant="outline" className="text-[10px]">⚡ Streaming</Badge>}
            {card.capabilities.stateTransitionHistory && <Badge variant="outline" className="text-[10px]">📋 History</Badge>}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">
              <Users className="w-3 h-3 inline mr-1" />
              {card.skills.length} agent(s) publicado(s)
            </p>
            <div className="space-y-1">
              {card.skills.slice(0, 5).map(skill => (
                <div key={skill.id} className="flex items-center justify-between bg-card rounded px-3 py-1.5">
                  <div>
                    <span className="text-xs font-medium text-foreground">{skill.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{skill.description?.substring(0, 60)}</span>
                  </div>
                  <div className="flex gap-1">
                    {skill.tags?.slice(0, 2).map(tag => (
                      <Badge key={tag} variant="outline" className="text-[8px]">{tag}</Badge>
                    ))}
                  </div>
                </div>
              ))}
              {card.skills.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">+{card.skills.length - 5} mais</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-card rounded px-3 py-2">
            <code className="text-[10px] text-primary font-mono flex-1 truncate">{cardUrl}</code>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(cardUrl); toast.success('URL copiada!'); }}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-nexus-amber" />
          <span className="text-xs font-bold text-foreground">Testar Comunicação A2A</span>
        </div>

        <div className="flex gap-2">
          <Input
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Envie uma task para testar (ex: 'Liste os agentes disponíveis')"
            className="bg-background border-border text-xs h-9"
            onKeyDown={(e) => e.key === 'Enter' && sendTestTask()}
          />
          <Button onClick={sendTestTask} disabled={testing || !testQuery.trim()} size="sm" className="h-9 nexus-gradient-bg">
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          </Button>
        </div>

        {testResult && (
          <div className="bg-background rounded-lg p-3 max-h-48 overflow-y-auto">
            <pre className="text-xs text-foreground whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
