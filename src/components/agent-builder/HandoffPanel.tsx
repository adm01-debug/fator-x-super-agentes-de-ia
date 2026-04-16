/**
 * HandoffPanel — Agent Handoff configuration and history.
 * Wires agentHandoffService into the Agent Builder OrchestrationModule.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft, Loader2, Plus, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { getHandoffHistory, initiateHandoff, acceptHandoff, rejectHandoff, type HandoffRecord, type HandoffReason } from '@/services/agentHandoffService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STATUS_META: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <Clock className="h-3 w-3" />, color: 'text-nexus-amber' },
  accepted: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-nexus-blue' },
  completed: { icon: <CheckCircle2 className="h-3 w-3" />, color: 'text-nexus-emerald' },
  rejected: { icon: <XCircle className="h-3 w-3" />, color: 'text-destructive' },
  failed: { icon: <AlertTriangle className="h-3 w-3" />, color: 'text-destructive' },
};

interface Props {
  agentId: string;
}

export function HandoffPanel({ agentId }: Props) {
  const [initiating, setInitiating] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [reason, setReason] = useState<HandoffReason>('capability_match');

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['handoff_history', agentId],
    queryFn: () => getHandoffHistory(agentId, 20),
    enabled: !!agentId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents_for_handoff'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name, avatar_emoji').order('name');
      return (data ?? []).filter(a => a.id !== agentId);
    },
  });

  const handleInitiate = async () => {
    if (!targetAgentId) return;
    setInitiating(true);
    try {
      await initiateHandoff({
        sourceAgentId: agentId,
        targetAgentId,
        reason,
        context: { messages: [], metadata: {}, summary: 'Manual handoff from builder' },
      });
      toast.success('Handoff iniciado!');
      refetch();
      setTargetAgentId('');
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : 'Falha ao iniciar handoff'}`);
    } finally {
      setInitiating(false);
    }
  };

  const handleAction = async (id: string, action: 'accept' | 'reject') => {
    try {
      if (action === 'accept') await acceptHandoff(id);
      else await rejectHandoff(id, 'Rejeitado manualmente');
      toast.success(action === 'accept' ? 'Handoff aceito' : 'Handoff rejeitado');
      refetch();
    } catch {
      toast.error('Erro ao processar handoff');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-lg bg-nexus-purple/10 flex items-center justify-center">
          <ArrowRightLeft className="h-4 w-4 text-nexus-purple" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">Agent Handoff</h4>
          <p className="text-[11px] text-muted-foreground">Transferência formal de contexto entre agentes</p>
        </div>
        <Badge variant="outline" className="ml-auto text-[10px]">A2A Protocol</Badge>
      </div>

      {/* Initiate new handoff */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Novo Handoff</p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={targetAgentId} onValueChange={setTargetAgentId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Agente destino" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.avatar_emoji || '🤖'} {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reason} onValueChange={v => setReason(v as HandoffReason)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="capability_match">Capacidade</SelectItem>
              <SelectItem value="escalation">Escalação</SelectItem>
              <SelectItem value="specialization">Especialização</SelectItem>
              <SelectItem value="load_balancing">Load Balance</SelectItem>
              <SelectItem value="user_request">Solicitação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleInitiate} disabled={initiating || !targetAgentId}>
          {initiating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Iniciar Handoff
        </Button>
      </div>

      {/* History */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Histórico ({history.length})</p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum handoff registrado</p>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-auto">
            {history.map((h: HandoffRecord) => {
              const meta = STATUS_META[h.status] ?? STATUS_META.pending;
              const isSent = h.source_agent_id === agentId;
              return (
                <div key={h.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2">
                  <span className={meta.color}>{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">
                      {isSent ? '→ Enviado' : '← Recebido'} · {h.reason}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.created_at ? new Date(h.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{h.status}</Badge>
                  {h.status === 'pending' && !isSent && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => handleAction(h.id, 'accept')}>✓</Button>
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => handleAction(h.id, 'reject')}>✕</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
