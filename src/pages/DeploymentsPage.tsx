import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Rocket, Loader2, Link2, Copy, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabaseExtended";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function DeploymentsPage() {
  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, avatar_emoji, status, config, version, updated_at')
        .in('status', ['production', 'staging', 'monitoring']);
      if (!data) return [];
      // Fetch deploy_connections for all deployed agents
      const agentIds = data.map(a => a.id);
      const { data: connections } = await supabase.from('deploy_connections').select('agent_id, channel, status, message_count, last_message_at, error_message').in('agent_id', agentIds);
      const connMap = new Map<string, any[]>();
      for (const c of (connections || [])) {
        if (!connMap.has(c.agent_id)) connMap.set(c.agent_id, []);
        connMap.get(c.agent_id)!.push(c);
      }
      return data.map(a => {
        const config = a.config as Record<string, any> | null;
        const configChannels = (config?.deploy_channels || []) as Array<{ channel: string; name: string; enabled: boolean }>;
        const liveConns = connMap.get(a.id) || [];
        return {
          id: a.id,
          name: a.name,
          emoji: a.avatar_emoji,
          status: a.status,
          version: `v${a.version}`,
          channels: configChannels.filter(c => c.enabled).map(c => {
            const live = liveConns.find((lc: any) => lc.channel === c.channel);
            return { name: c.name || c.channel, status: live?.status || 'inactive', messages: live?.message_count || 0, lastMsg: live?.last_message_at, error: live?.error_message };
          }),
          environment: config?.deploy_environment || 'production',
          updated: a.updated_at,
        };
      });
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Deployments" description="Agentes em produção e staging" actions={<EndpointGeneratorButton />} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : deployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Rocket className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum agente deployado</h2>
          <p className="text-sm text-muted-foreground">Mude o status de um agente para "production" ou "staging" no builder.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deployments.map((dep) => (
            <div key={dep.id} className="nexus-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">{dep.emoji || '🤖'}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{dep.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{dep.version} • {dep.environment}</p>
                  </div>
                </div>
                <StatusBadge status={dep.status || 'draft'} />
              </div>
              {dep.channels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {dep.channels.map((c: any) => (
                    <span key={c.name} className={`text-[11px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-nexus-emerald/10 text-nexus-emerald' : c.status === 'error' ? 'bg-destructive/10 text-destructive' : 'nexus-badge-primary'}`} title={c.error || `${c.messages} msgs`}>
                      {c.name} {c.messages > 0 ? `(${c.messages})` : ''}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">{new Date(dep.updated).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EndpointGeneratorButton() {
  const [copied, setCopied] = useState<string | null>(null);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'tifbqkyumdxzmxyyoqlu';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1`;

  const endpoints = [
    { name: 'LLM Gateway', path: 'llm-gateway', method: 'POST', desc: 'Envie mensagens para qualquer modelo configurado' },
    { name: 'RAG Query', path: 'cerebro-query', method: 'POST', desc: 'Consulta com retrieval-augmented generation' },
    { name: 'Workflow Engine', path: 'workflow-engine-v2', method: 'POST', desc: 'Execute workflows multi-agente' },
    { name: 'Oracle Council', path: 'oracle-council', method: 'POST', desc: 'Consulta multi-modelo com consenso' },
  ];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="h-4 w-4" /> Endpoints API
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" /> Endpoints de Integração
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
            <p className="text-xs font-medium text-foreground mb-1">Base URL</p>
            <div className="flex items-center gap-2">
              <Input value={baseUrl} readOnly className="text-xs font-mono bg-secondary/50 h-8" />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleCopy(baseUrl, 'base')}>
                {copied === 'base' ? <CheckCircle className="h-3.5 w-3.5 text-nexus-emerald" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {endpoints.map(ep => {
            const url = `${baseUrl}/${ep.path}`;
            const curl = `curl -X ${ep.method} '${url}' \\\n  -H 'Authorization: Bearer YOUR_ANON_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"model":"google/gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'`;
            return (
              <div key={ep.path} className="rounded-lg border border-border/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{ep.name}</p>
                    <p className="text-[11px] text-muted-foreground">{ep.desc}</p>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-mono">{ep.method}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-primary font-mono truncate flex-1">{url}</code>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleCopy(curl, ep.path)}>
                    {copied === ep.path ? <CheckCircle className="h-3 w-3 text-nexus-emerald" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-muted-foreground">
            💡 Use a anon key do projeto no header Authorization. Para produção, use service role key com cuidado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
