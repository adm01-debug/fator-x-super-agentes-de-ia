/**
 * RoutingConfigPage — Nexus Agents Studio (sprint #4)
 * Unified cross-source view of agent_routing_config.
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Network, Search, Power, PowerOff, Trash2, Loader2,
  Building2, MessageCircle, Mail, Slack as SlackIcon, Globe,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import {
  listAllRoutes,
  summarizeRoutes,
  bulkToggleSource,
  toggleRoute,
  deleteRoute,
  getSourceLabel,
} from "@/services/agentRoutingService";
import { listAgents } from "@/lib/agentService";

const SOURCE_ICONS: Record<string, typeof Building2> = {
  bitrix24: Building2,
  whatsapp: MessageCircle,
  gmail: Mail,
  slack: SlackIcon,
};

export function RoutingConfigPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string | null>(null);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["agent_routing_all"],
    queryFn: listAllRoutes,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents_for_routing_unified"],
    queryFn: () => listAgents(),
  });

  const summaries = useMemo(() => summarizeRoutes(routes), [routes]);

  const filteredRoutes = useMemo(() => {
    let filtered = routes;
    if (filterSource) {
      filtered = filtered.filter((r) => r.source === filterSource);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((r) =>
        r.source.toLowerCase().includes(q) ||
        r.event_type.toLowerCase().includes(q) ||
        (agents.find((a) => a.id === r.agent_id)?.name?.toLowerCase().includes(q) ?? false)
      );
    }
    return filtered;
  }, [routes, filterSource, search, agents]);

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleRoute(id, !current);
      queryClient.invalidateQueries({ queryKey: ["agent_routing_all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoute(id);
      toast.success(t("routing.route_removed"));
      queryClient.invalidateQueries({ queryKey: ["agent_routing_all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleBulkToggle = async (source: string, enabled: boolean) => {
    try {
      const count = await bulkToggleSource(source, enabled);
      toast.success(`${count} rota${count === 1 ? '' : 's'} ${enabled ? 'ativada' : 'desativada'}${count === 1 ? '' : 's'}`);
      queryClient.invalidateQueries({ queryKey: ["agent_routing_all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const totalEnabled = routes.filter((r) => r.is_enabled).length;
  const orphanRoutes = routes.filter((r) => !r.agent_id).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Network className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("routing.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("routing.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">{routes.length} {t("routing.total_routes")}</Badge>
          <Badge variant="outline" className="text-xs border-nexus-emerald/50 text-nexus-emerald">
            {totalEnabled} {t("routing.active")}
          </Badge>
          {orphanRoutes > 0 && (
            <Badge variant="outline" className="text-xs border-nexus-amber/50 text-nexus-amber gap-1">
              <AlertCircle className="h-2.5 w-2.5" /> {orphanRoutes} {t("routing.orphans")}
            </Badge>
          )}
        </div>
      </header>

      {/* Per-source summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summaries.map((s) => {
          const Icon = SOURCE_ICONS[s.source] ?? Globe;
          const isActive = filterSource === s.source;
          return (
            <button
              key={s.source}
              onClick={() => setFilterSource(isActive ? null : s.source)}
              className={`nexus-card text-left transition-all ${isActive ? 'ring-2 ring-primary' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{getSourceLabel(s.source)}</h3>
                </div>
                <Badge variant="outline" className="text-[9px]">{s.total}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-nexus-emerald" />
                  <span className="text-foreground">{s.enabled} {t("routing.active")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{s.disabled} {t("routing.off")}</span>
                </div>
                <div className="col-span-2 text-[10px] text-muted-foreground">
                  {s.unique_agents} {t("routing.unique_agents")}
                </div>
              </div>
              <div className="flex gap-1 mt-3 pt-3 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleBulkToggle(s.source, true); }}
                  className="h-6 text-[10px] gap-1 text-nexus-emerald flex-1"
                >
                  <Power className="h-2.5 w-2.5" /> {t("routing.enable_all")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleBulkToggle(s.source, false); }}
                  className="h-6 text-[10px] gap-1 text-destructive flex-1"
                >
                  <PowerOff className="h-2.5 w-2.5" /> {t("routing.pause_all")}
                </Button>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("routing.search_placeholder")}
            className="pl-8 h-9 text-xs"
          />
        </div>
        {filterSource && (
          <Button variant="outline" size="sm" onClick={() => setFilterSource(null)} className="h-9 text-xs">
            {t("routing.clear_filter")}: {getSourceLabel(filterSource)}
          </Button>
        )}
      </div>

      {/* Unified table */}
      <div className="nexus-card overflow-hidden p-0">
        <div className="px-4 py-2 border-b border-border/40 bg-secondary/30 flex items-center justify-between">
          <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {t("routing.all_routes")} {filterSource ? `· ${getSourceLabel(filterSource)}` : ''}
          </h4>
          <Badge variant="outline" className="text-[9px]">
            {filteredRoutes.length} {t("routing.results")}
          </Badge>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredRoutes.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-muted-foreground">
            {routes.length === 0 ? t("routing.no_routes") : t("routing.no_results")}
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/30 sticky top-0 bg-card z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">{t("routing.source")}</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">{t("routing.event")}</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">{t("routing.agent")}</th>
                  <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">{t("routing.updated")}</th>
                  <th className="text-center px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">{t("routing.enabled")}</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((r) => {
                  const Icon = SOURCE_ICONS[r.source] ?? Globe;
                  const agent = agents.find((a) => a.id === r.agent_id);
                  return (
                    <tr key={r.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3 text-primary" />
                          <span className="text-foreground">{getSourceLabel(r.source)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <code className="text-[10px] font-mono text-foreground">{r.event_type}</code>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {agent?.name ?? <span className="text-nexus-amber italic text-[10px]">{t("routing.orphan_label")}</span>}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        {new Date(r.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Switch checked={r.is_enabled} onCheckedChange={() => handleToggle(r.id, r.is_enabled)} />
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDelete(r.id)}
                          aria-label={t("routing.delete")}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
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

export default RoutingConfigPage;
