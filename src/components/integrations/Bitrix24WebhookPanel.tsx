/**
 * Bitrix24WebhookPanel — Nexus Agents Studio (next-frontier #3)
 *
 * Lets the operator configure which agent handles which Bitrix24 event,
 * shows the webhook URL to paste into Bitrix24, and lists recent received
 * events with their routing status.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Webhook, Copy, CheckCircle2, XCircle, AlertCircle, Loader2,
  Plus, Trash2, Power, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  BITRIX24_EVENT_TYPES,
  type Bitrix24EventType,
  listBitrix24Routes,
  upsertBitrix24Route,
  deleteBitrix24Route,
  toggleBitrix24Route,
  listRecentBitrix24Events,
  getBitrix24WebhookUrl,
} from "@/services/bitrix24WebhookService";
import { listAgents } from "@/lib/agentService";

export function Bitrix24WebhookPanel() {
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState<Bitrix24EventType | "">("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ["bitrix24_routes"],
    queryFn: listBitrix24Routes,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents_for_routing"],
    queryFn: () => listAgents(),
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["bitrix24_webhook_events"],
    queryFn: () => listRecentBitrix24Events(20),
    refetchInterval: 30_000,
  });

  const webhookUrl = getBitrix24WebhookUrl();

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada");
  };

  const handleAddRoute = async () => {
    if (!selectedEvent || !selectedAgent) {
      toast.error("Escolha um evento e um agente");
      return;
    }
    setAdding(true);
    try {
      await upsertBitrix24Route(selectedEvent as Bitrix24EventType, selectedAgent);
      toast.success("Rota criada");
      setSelectedEvent("");
      setSelectedAgent("");
      queryClient.invalidateQueries({ queryKey: ["bitrix24_routes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBitrix24Route(id);
      toast.success("Rota removida");
      queryClient.invalidateQueries({ queryKey: ["bitrix24_routes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleBitrix24Route(id, !current);
      queryClient.invalidateQueries({ queryKey: ["bitrix24_routes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const usedEventTypes = new Set(routes.map((r) => r.event_type));
  const availableEvents = BITRIX24_EVENT_TYPES.filter((e) => !usedEventTypes.has(e.id));

  const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    routed: { label: "Roteado", color: "text-nexus-emerald border-nexus-emerald/50", icon: CheckCircle2 },
    no_route: { label: "Sem rota", color: "text-muted-foreground border-border/50", icon: AlertCircle },
    failed: { label: "Falhou", color: "text-destructive border-destructive/50", icon: XCircle },
    invalid_signature: { label: "Assinatura inválida", color: "text-destructive border-destructive/50", icon: XCircle },
    pending: { label: "Pendente", color: "text-nexus-amber border-nexus-amber/50", icon: Loader2 },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Webhook className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Webhooks Bitrix24</h3>
        <Badge variant="outline" className="text-[10px]">
          {routes.length} rota{routes.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {/* Webhook URL */}
      <div className="nexus-card">
        <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          URL do webhook (cole no Bitrix24)
        </h4>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[11px] font-mono bg-secondary/40 px-3 py-2 rounded truncate" title={webhookUrl}>
            {webhookUrl}
          </code>
          <Button variant="outline" size="sm" onClick={handleCopyUrl} className="h-8 gap-1.5 text-xs shrink-0">
            <Copy className="h-3 w-3" /> Copiar
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          No Bitrix24, vá em <strong>Aplicativos → Webhooks → Outbound</strong>, cole esta URL,
          escolha os eventos abaixo, e configure o <code className="bg-secondary/40 px-1">application_token</code>{" "}
          como variável de ambiente <code className="bg-secondary/40 px-1">BITRIX24_APP_TOKEN</code> no Supabase.
        </p>
      </div>

      {/* Add new route */}
      {availableEvents.length > 0 && (
        <div className="nexus-card">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
            Adicionar rota
          </h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v as Bitrix24EventType)}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                {availableEvents.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    <div className="flex flex-col">
                      <span>{e.label}</span>
                      <span className="text-[10px] text-muted-foreground">{e.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue placeholder="Agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 ? (
                  <SelectItem value="__none__" disabled className="text-xs">Nenhum agente disponível</SelectItem>
                ) : (
                  agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button onClick={handleAddRoute} disabled={adding || !selectedEvent || !selectedAgent} className="gap-1.5 h-9 text-xs">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Active routes */}
      <div className="nexus-card overflow-hidden p-0">
        <div className="px-4 py-2 border-b border-border/40 bg-secondary/30">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">Rotas ativas</h4>
        </div>
        {loadingRoutes ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : routes.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground">
            Nenhuma rota configurada — adicione uma acima para começar a receber eventos.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-border/30">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Evento</th>
                <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Agente</th>
                <th className="text-center px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Ativo</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => {
                const eventCfg = BITRIX24_EVENT_TYPES.find((e) => e.id === r.event_type);
                const agent = agents.find((a) => a.id === r.agent_id);
                return (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <code className="text-[11px] font-mono text-foreground">{r.event_type}</code>
                        <span className="text-[10px] text-muted-foreground">{eventCfg?.label ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">{agent?.name ?? <span className="text-muted-foreground italic">deletado</span>}</td>
                    <td className="px-3 py-2 text-center">
                      <Switch checked={r.is_enabled} onCheckedChange={() => handleToggle(r.id, r.is_enabled)} />
                    </td>
                    <td className="px-2 py-2">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(r.id)} aria-label="Remover">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent events */}
      <div className="nexus-card overflow-hidden p-0">
        <div className="px-4 py-2 border-b border-border/40 bg-secondary/30">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Eventos recebidos ({events.length})
          </h4>
        </div>
        {loadingEvents ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground">
            Nenhum evento recebido ainda. Configure o webhook no Bitrix24 e dispare uma ação para começar.
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/30 sticky top-0 bg-card">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Quando</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Evento</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">Trace</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const cfg = STATUS_CONFIG[e.routing_status] ?? STATUS_CONFIG.pending;
                  const Icon = cfg.icon;
                  return (
                    <tr key={e.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        {new Date(e.received_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2">
                        <code className="text-[10px] font-mono text-foreground">{e.event_type}</code>
                        {e.bitrix_event_id && <span className="text-[9px] text-muted-foreground ml-1">#{e.bitrix_event_id}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[9px] gap-1 ${cfg.color}`}>
                          <Icon className="h-2.5 w-2.5" /> {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {e.trace_id ? (
                          <code className="text-[9px] font-mono text-muted-foreground">{e.trace_id.slice(0, 8)}</code>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Bitrix24WebhookPanel;
