import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, Database, ArrowRight, ExternalLink, AlertTriangle,
  Users, Factory, Truck, Package, UserCheck, MessageCircle,
  Link2, Eye, RefreshCcw, Table2, GitBranch, Loader2, CheckCircle2,
  XCircle, Snowflake, Clock,
} from "lucide-react";
import { ENTITY_MAPPINGS, ENTITY_LIST } from "@/config/datahub-entities";
import type { EntityMapping, SecondaryMapping, CrossDbMapping } from "@/config/datahub-entities";
import { DATAHUB_TABLE_BLACKLIST } from "@/config/datahub-blacklist";
import { DataBrowser } from "@/components/datahub/DataBrowser";
import { DataHubStats } from "@/components/datahub/DataHubStats";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ── Connection definitions ──────────────────────────── */
interface ConnectionDef {
  id: string;
  label: string;
  desc: string;
  status: "connected" | "disconnected" | "error" | "hibernated";
  tables: number;
  icon: string;
  count?: number;
  error?: string;
  lastTested?: Date;
}

const DEFAULT_CONNECTIONS: ConnectionDef[] = [
  { id: "bancodadosclientes", label: "CRM Clientes", desc: "Companies, customers, contacts, interactions", status: "disconnected", tables: 14, icon: "👤" },
  { id: "supabase-fuchsia-kite", label: "Catálogo Produtos", desc: "Products, variants, suppliers, pricing", status: "disconnected", tables: 12, icon: "📦" },
  { id: "gestao_time_promo", label: "Gestão RH", desc: "Colaboradores, ponto, departamentos, cargos", status: "disconnected", tables: 6, icon: "👨‍💼" },
  { id: "backupgiftstore", label: "WhatsApp Backup", desc: "Contacts, messages, media", status: "disconnected", tables: 3, icon: "💬" },
  { id: "financeiro_promo", label: "Financeiro Promo", desc: "Contas a pagar/receber, fluxo de caixa — HIBERNADO", status: "hibernated", tables: 0, icon: "💰" },
];

/* ── Entity icon map ─────────────────────────────────── */
const ENTITY_ICONS: Record<string, React.ElementType> = {
  cliente: Users,
  fornecedor: Factory,
  transportadora: Truck,
  produto: Package,
  colaborador: UserCheck,
  conversa_whatsapp: MessageCircle,
};

/* ── Helpers ─────────────────────────────────────────── */
function getConnectionLabel(connId: string): string {
  return DEFAULT_CONNECTIONS.find(c => c.id === connId)?.label ?? connId;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s atrás`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m atrás`;
  return `${Math.floor(minutes / 60)}h atrás`;
}

/* ── Connection Card ─────────────────────────────────── */
function ConnectionCard({ conn }: { conn: ConnectionDef }) {
  const entitiesUsing = ENTITY_LIST.filter(e => e.primary.connection === conn.id);
  const crossRefs = ENTITY_LIST.filter(e =>
    e.cross_db?.some(c => c.connection === conn.id)
  );

  const isHibernated = conn.status === "hibernated";

  return (
    <div className={`nexus-card group transition-colors ${isHibernated ? 'opacity-60' : 'hover:border-primary/30'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
            {conn.icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{conn.label}</h3>
            <p className="text-[11px] text-muted-foreground font-mono">{conn.id}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isHibernated ? (
            <Badge variant="outline" className="gap-1 text-[11px] border-primary/30 text-primary">
              <Snowflake className="h-3 w-3" /> Hibernado
            </Badge>
          ) : (
            <StatusBadge status={conn.status === "connected" ? "active" : conn.status === "error" ? "error" : "planned"} />
          )}
          {conn.lastTested && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {timeAgo(conn.lastTested)}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">{conn.desc}</p>

      <div className="space-y-2 border-t border-border/50 pt-3">
        {conn.status === "connected" && conn.count !== undefined && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Registros (tabela principal)</span>
            <span className="text-foreground font-mono">{conn.count.toLocaleString()}</span>
          </div>
        )}
        {!isHibernated && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Tabelas mapeadas</span>
            <span className="text-foreground font-mono">{conn.tables}</span>
          </div>
        )}

        {entitiesUsing.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entitiesUsing.map(e => (
              <Badge key={e.id} variant="secondary" className="text-[11px] gap-1">
                {e.icon} {e.name}
              </Badge>
            ))}
          </div>
        )}

        {crossRefs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {crossRefs.map(e => (
              <Badge key={e.id} variant="outline" className="text-[11px] gap-1 border-nexus-cyan/30 text-nexus-cyan">
                <Link2 className="h-2.5 w-2.5" /> {e.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {conn.status === "error" && conn.error && (
        <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-[11px] text-destructive">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {conn.error}
        </div>
      )}

      {conn.status === "disconnected" && (
        <div className="mt-3 p-2 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 flex items-center gap-2 text-[11px] text-nexus-amber">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Aguardando teste de conexão...
        </div>
      )}

      {isHibernated && (
        <div className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-[11px] text-primary">
          <Snowflake className="h-3.5 w-3.5 shrink-0" />
          Projeto Supabase pausado. Score: 0/100.
        </div>
      )}
    </div>
  );
}

/* ── Entity Detail Panel ─────────────────────────────── */
function EntityDetailPanel({ entityId, mapping, onBrowse }: { entityId: string; mapping: EntityMapping; onBrowse: (entityId: string) => void }) {
  const Icon = ENTITY_ICONS[entityId] ?? Database;

  return (
    <div className="nexus-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">{mapping.name}</h3>
            <p className="text-xs text-muted-foreground">
              Banco primário: <span className="font-mono text-foreground">{getConnectionLabel(mapping.primary.connection)}</span>
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => onBrowse(entityId)}>
          <Eye className="h-3.5 w-3.5" /> Explorar Dados
        </Button>
      </div>

      {mapping.note && (
        <div className="p-2.5 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 text-[11px] text-nexus-amber">
          ⚠️ {mapping.note}
        </div>
      )}

      {mapping.group_by && (
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-primary">
          🏢 Agrupável por: <span className="font-mono">{mapping.group_by}</span>
          {mapping.exclude_self && <span className="text-muted-foreground ml-2">(exclui a própria empresa no grupo)</span>}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-primary" /> Tabela Primária
        </h4>
        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">tabela</span><span className="text-foreground">{mapping.primary.table}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">id</span><span className="text-foreground">{mapping.primary.id_column ?? "id"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">display</span><span className="text-foreground">{mapping.primary.display_column ?? "—"}</span></div>
          {mapping.primary.filter && (
            <div className="pt-1.5 border-t border-border/30">
              <span className="text-muted-foreground">filtro: </span>
              <span className="text-nexus-cyan text-[11px] break-all">{mapping.primary.filter}</span>
            </div>
          )}
        </div>
      </div>

      {mapping.secondary && mapping.secondary.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-nexus-cyan" /> Tabelas Secundárias ({mapping.secondary.length})
          </h4>
          <div className="space-y-1.5">
            {mapping.secondary.map((sec: SecondaryMapping, i: number) => (
              <div key={i} className="rounded-lg bg-secondary/20 border border-border/20 p-2.5 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">{sec.table}</span>
                  <div className="flex gap-1">
                    {sec.aggregate && <Badge variant="outline" className="text-[11px] h-4">{sec.aggregate}</Badge>}
                    {sec.limit && <Badge variant="outline" className="text-[11px] h-4">limit {sec.limit}</Badge>}
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] mt-0.5">JOIN: {sec.join}</p>
                {sec.fields && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sec.fields.map(f => (
                      <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f}</span>
                    ))}
                  </div>
                )}
                {sec.note && <p className="text-[11px] text-nexus-amber mt-1">⚠️ {sec.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {mapping.cross_db && mapping.cross_db.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-nexus-emerald" /> Cross-Database ({mapping.cross_db.length})
          </h4>
          {mapping.cross_db.map((cross: CrossDbMapping, i: number) => (
            <div key={i} className="rounded-lg bg-nexus-emerald/5 border border-nexus-emerald/20 p-3 text-[11px] space-y-1.5">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-3 w-3 text-nexus-emerald" />
                <span className="font-mono text-foreground">{getConnectionLabel(cross.connection)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-foreground">{cross.table}</span>
              </div>
              <p className="text-muted-foreground font-mono text-[11px]">match: {cross.match_with} → {cross.match_by}</p>
              {cross.fallback && <p className="text-[11px] text-nexus-amber">fallback: {cross.fallback}</p>}
              {cross.enrich && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {cross.enrich.map(f => (
                    <span key={f} className="text-[11px] px-1.5 py-0.5 rounded bg-nexus-emerald/10 text-nexus-emerald">{f}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mapping.sensitive_fields && mapping.sensitive_fields.length > 0 && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px]">
          <span className="text-destructive font-semibold">🔒 Campos sensíveis (LGPD): </span>
          <span className="text-muted-foreground font-mono">{mapping.sensitive_fields.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */
export default function DataHubPage() {
  const [search, setSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [browsingEntity, setBrowsingEntity] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionDef[]>(DEFAULT_CONNECTIONS);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [testingConnections, setTestingConnections] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const testConnections = useCallback(async () => {
    setTestingConnections(true);
    try {
      const { data, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'test_connections' },
      });
      if (error) throw error;
      const now = new Date();
      setConnections(prev => prev.map(c => {
        if (c.status === 'hibernated') return c;
        const result = data.connections?.[c.id];
        if (!result) return c;
        return {
          ...c,
          status: result.status === 'connected' ? 'connected' as const : 'error' as const,
          count: result.count,
          error: result.error,
          lastTested: now,
        };
      }));
      const connected = Object.values(data.connections ?? {}).filter((r: unknown) => (r as Record<string, unknown>).status === 'connected').length;
      toast.success(`${connected} de 4 conexões ativas!`);
    } catch (e: unknown) {
      toast.error(`Erro ao testar conexões: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTestingConnections(false);
    }
  }, []);

  const loadEntityCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('datahub-query', {
        body: { action: 'list_entities' },
      });
      if (error) throw error;
      setEntityCounts(data.entities ?? {});
    } catch (e: unknown) {
      toast.error(`Erro ao carregar contagens: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    testConnections();
    loadEntityCounts();
  }, [testConnections, loadEntityCounts]);

  const filteredEntities = useMemo(() => {
    if (!search.trim()) return ENTITY_LIST;
    const q = search.toLowerCase();
    return ENTITY_LIST.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      e.primary.connection.toLowerCase().includes(q) ||
      e.primary.table.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedMapping = selectedEntity ? ENTITY_MAPPINGS[selectedEntity] : null;
  const activeConnections = connections.filter(c => c.status !== "hibernated");
  const connectedCount = activeConnections.filter(c => c.status === "connected").length;
  const totalRecords = Object.values(entityCounts).reduce((sum, v) => sum + (v >= 0 ? v : 0), 0);
  const joinCount = ENTITY_LIST.reduce((acc, e) => acc + (e.secondary?.length ?? 0), 0);
  const crossDbCount = ENTITY_LIST.reduce((acc, e) => acc + (e.cross_db?.length ?? 0), 0);

  if (browsingEntity) {
    return (
      <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
        <PageHeader title="DataHub" description="Explorando dados reais" />
        <DataBrowser entityId={browsingEntity} onClose={() => setBrowsingEntity(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="DataHub"
        description="Central de dados: explore entidades, conexões e mapeamentos cross-database"
      />

      {/* Stats Bar */}
      <DataHubStats
        entityCount={ENTITY_LIST.length}
        connectionCount={activeConnections.length}
        connectedCount={connectedCount}
        totalRecords={totalRecords}
        joinCount={joinCount}
        crossDbCount={crossDbCount}
      />

      <InfoHint title="Como funciona o DataHub?">
        O DataHub mapeia entidades de negócio (Clientes, Produtos, etc.) para tabelas em múltiplos bancos de dados externos.
        Cada entidade tem uma tabela primária e pode ter joins secundários e <strong>cross-database</strong> — cruzando dados entre bancos diferentes via e-mail, CNPJ ou telefone.
      </InfoHint>

      <Tabs defaultValue="entities" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="entities" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Entidades</TabsTrigger>
          <TabsTrigger value="connections" className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Conexões</TabsTrigger>
          <TabsTrigger value="schema" className="gap-1.5"><Table2 className="h-3.5 w-3.5" /> Schema</TabsTrigger>
        </TabsList>

        {/* ── Entities Tab ── */}
        <TabsContent value="entities" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar entidade, tabela ou conexão..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-secondary/30"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-3" onClick={loadEntityCounts} disabled={loadingCounts}>
              {loadingCounts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Atualizar Contagens
            </Button>
          </div>

          {/* Quick-browse cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {ENTITY_LIST.map(entity => {
              const Icon = ENTITY_ICONS[entity.id] ?? Database;
              const count = entityCounts[entity.id];
              return (
                <button
                  key={entity.id}
                  onClick={() => setBrowsingEntity(entity.id)}
                  className="nexus-card p-3 text-center hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">{entity.name}</p>
                  {count !== undefined && count >= 0 && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{count.toLocaleString()}</p>
                  )}
                  {count === -1 && (
                    <p className="text-[11px] text-destructive mt-0.5">erro</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
            <div className="space-y-2">
              {filteredEntities.map(entity => {
                const Icon = ENTITY_ICONS[entity.id] ?? Database;
                const isSelected = selectedEntity === entity.id;
                const secondaryCount = entity.secondary?.length ?? 0;
                const crossCount = entity.cross_db?.length ?? 0;
                const count = entityCounts[entity.id];
                const hasGroupBy = !!entity.group_by;

                return (
                  <button
                    key={entity.id}
                    onClick={() => setSelectedEntity(isSelected ? null : entity.id)}
                    className={`w-full text-left nexus-card p-4 transition-all hover:border-primary/30 ${
                      isSelected ? "border-primary/50 ring-1 ring-primary/20 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                          isSelected ? "bg-primary/20" : "bg-primary/10"
                        }`}>
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{entity.name}</h3>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {entity.primary.table} → {getConnectionLabel(entity.primary.connection)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {count !== undefined && count >= 0 && (
                          <Badge variant="secondary" className="text-[11px] font-mono">
                            {count.toLocaleString()}
                          </Badge>
                        )}
                        {count === -1 && (
                          <Badge variant="destructive" className="text-[11px]">erro</Badge>
                        )}
                        {secondaryCount > 0 && (
                          <Badge variant="secondary" className="text-[11px]">+{secondaryCount} joins</Badge>
                        )}
                        {crossCount > 0 && (
                          <Badge variant="outline" className="text-[11px] border-nexus-emerald/30 text-nexus-emerald">
                            {crossCount} cross-db
                          </Badge>
                        )}
                        {hasGroupBy && (
                          <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                            🏢 grupo
                          </Badge>
                        )}
                        <ArrowRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredEntities.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhuma entidade encontrada para "{search}"
                </div>
              )}
            </div>

            <div>
              {selectedEntity && selectedMapping ? (
                <EntityDetailPanel entityId={selectedEntity} mapping={selectedMapping} onBrowse={setBrowsingEntity} />
              ) : (
                <div className="nexus-card flex flex-col items-center justify-center py-16 text-center">
                  <Eye className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma entidade para ver o mapeamento completo</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Tabelas, joins, cross-database e campos sensíveis</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Connections Tab ── */}
        <TabsContent value="connections" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{connectedCount}</span> de {activeConnections.length} conexões ativas
              <span className="text-muted-foreground/60 ml-2">· 1 hibernada</span>
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={testConnections} disabled={testingConnections}>
              {testingConnections ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Testar Conexões
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {connections.map(conn => (
              <ConnectionCard key={conn.id} conn={conn} />
            ))}
          </div>

          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4 text-nexus-emerald" /> Mapeamentos Cross-Database
            </h3>
            <p className="text-xs text-muted-foreground">
              Relações que cruzam dados entre bancos diferentes para enriquecer entidades.
            </p>
            <div className="space-y-2">
              {ENTITY_LIST.filter(e => e.cross_db && e.cross_db.length > 0).map(entity => (
                <div key={entity.id} className="rounded-lg bg-secondary/20 border border-border/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span>{entity.icon}</span>
                    <span className="text-sm font-semibold text-foreground">{entity.name}</span>
                  </div>
                  {entity.cross_db?.map((cross, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground ml-6">
                      <span className="font-mono text-foreground">{getConnectionLabel(entity.primary.connection)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-mono text-nexus-emerald">{getConnectionLabel(cross.connection)}</span>
                      <span className="text-muted-foreground/60">via {cross.match_by}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Schema Tab ── */}
        <TabsContent value="schema" className="space-y-4">
          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Tabelas Blacklisted ({DATAHUB_TABLE_BLACKLIST.size})</h3>
            <p className="text-xs text-muted-foreground">
              Tabelas excluídas da sincronização: staging, logs internos, dados fake, pipelines.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(DATAHUB_TABLE_BLACKLIST).sort().map(t => (
                <Badge key={t} variant="outline" className="text-[11px] font-mono text-destructive/70 border-destructive/20">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Resumo do Schema</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{ENTITY_LIST.length}</p>
                <p className="text-[11px] text-muted-foreground">Entidades</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{connections.length}</p>
                <p className="text-[11px] text-muted-foreground">Conexões</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{joinCount}</p>
                <p className="text-[11px] text-muted-foreground">Joins Secundários</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{crossDbCount}</p>
                <p className="text-[11px] text-muted-foreground">Cross-DB Links</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">
                  {ENTITY_LIST.filter(e => !!e.group_by).length}
                </p>
                <p className="text-[11px] text-muted-foreground">Com Grupo Econ.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {connections.map(conn => {
              const entities = ENTITY_LIST.filter(e => e.primary.connection === conn.id);
              const allTables = new Set<string>();
              entities.forEach(e => {
                allTables.add(e.primary.table);
                e.secondary?.forEach(s => allTables.add(s.table));
              });

              return (
                <div key={conn.id} className={`nexus-card space-y-2 ${conn.status === 'hibernated' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span>{conn.icon}</span>
                    <h4 className="text-sm font-semibold text-foreground">{conn.label}</h4>
                    <Badge variant="secondary" className="text-[11px]">{allTables.size} tabelas</Badge>
                    {conn.status === "connected" && <CheckCircle2 className="h-3.5 w-3.5 text-nexus-emerald" />}
                    {conn.status === "hibernated" && <Snowflake className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  {allTables.size > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Array.from(allTables).sort().map(t => (
                        <Badge key={t} variant="outline" className="text-[11px] font-mono">{t}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Nenhuma tabela mapeada</p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
