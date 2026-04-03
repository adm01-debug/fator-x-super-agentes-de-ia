import { useState, useMemo } from "react";
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
  Link2, Eye, RefreshCcw, Table2, GitBranch,
} from "lucide-react";
import { ENTITY_MAPPINGS, ENTITY_LIST } from "@/config/datahub-entities";
import type { EntityMapping, SecondaryMapping, CrossDbMapping } from "@/config/datahub-entities";
import { DATAHUB_TABLE_BLACKLIST } from "@/config/datahub-blacklist";

/* ── Connection definitions ──────────────────────────── */
interface ConnectionDef {
  id: string;
  label: string;
  desc: string;
  status: "connected" | "disconnected" | "planned";
  tables: number;
  icon: string;
}

const CONNECTIONS: ConnectionDef[] = [
  { id: "bancodadosclientes", label: "CRM Clientes", desc: "Companies, customers, contacts, interactions", status: "disconnected", tables: 14, icon: "👤" },
  { id: "supabase-fuchsia-kite", label: "Catálogo Produtos", desc: "Products, variants, suppliers, pricing", status: "disconnected", tables: 12, icon: "📦" },
  { id: "gestao_time_promo", label: "Gestão RH", desc: "Colaboradores, ponto, departamentos, cargos", status: "disconnected", tables: 6, icon: "👨‍💼" },
  { id: "backupgiftstore", label: "WhatsApp Backup", desc: "Contacts, messages, media", status: "disconnected", tables: 3, icon: "💬" },
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
  return CONNECTIONS.find(c => c.id === connId)?.label ?? connId;
}

/* ── Connection Card ─────────────────────────────────── */
function ConnectionCard({ conn }: { conn: ConnectionDef }) {
  const entitiesUsing = ENTITY_LIST.filter(e => e.primary.connection === conn.id);
  const crossRefs = ENTITY_LIST.filter(e =>
    e.cross_db?.some(c => c.connection === conn.id)
  );

  return (
    <div className="nexus-card group hover:border-primary/30 transition-colors">
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
        <StatusBadge status={conn.status === "connected" ? "active" : conn.status === "planned" ? "planned" : "error"} />
      </div>

      <p className="text-xs text-muted-foreground mb-3">{conn.desc}</p>

      <div className="space-y-2 border-t border-border/50 pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Tabelas mapeadas</span>
          <span className="text-foreground font-mono">{conn.tables}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Blacklisted</span>
          <span className="text-foreground font-mono">{DATAHUB_TABLE_BLACKLIST.size}</span>
        </div>

        {entitiesUsing.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entitiesUsing.map(e => (
              <Badge key={e.id} variant="secondary" className="text-[10px] gap-1">
                {e.icon} {e.name}
              </Badge>
            ))}
          </div>
        )}

        {crossRefs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {crossRefs.map(e => (
              <Badge key={e.id} variant="outline" className="text-[10px] gap-1 border-nexus-cyan/30 text-nexus-cyan">
                <Link2 className="h-2.5 w-2.5" /> {e.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {conn.status === "disconnected" && (
        <div className="mt-3 p-2 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 flex items-center gap-2 text-[11px] text-nexus-amber">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Conector não linkado — configure nas integrações
        </div>
      )}
    </div>
  );
}

/* ── Entity Detail Panel ─────────────────────────────── */
function EntityDetailPanel({ entityId, mapping }: { entityId: string; mapping: EntityMapping }) {
  const Icon = ENTITY_ICONS[entityId] ?? Database;

  return (
    <div className="nexus-card space-y-4">
      {/* Header */}
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

      {/* Note */}
      {mapping.note && (
        <div className="p-2.5 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 text-[11px] text-nexus-amber">
          ⚠️ {mapping.note}
        </div>
      )}

      {/* Primary table */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5 text-primary" /> Tabela Primária
        </h4>
        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">tabela</span>
            <span className="text-foreground">{mapping.primary.table}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">id</span>
            <span className="text-foreground">{mapping.primary.id_column ?? "id"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">display</span>
            <span className="text-foreground">{mapping.primary.display_column ?? "—"}</span>
          </div>
          {mapping.primary.filter && (
            <div className="pt-1.5 border-t border-border/30">
              <span className="text-muted-foreground">filtro: </span>
              <span className="text-nexus-cyan text-[10px] break-all">{mapping.primary.filter}</span>
            </div>
          )}
        </div>
      </div>

      {/* Secondary tables */}
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
                    {sec.aggregate && (
                      <Badge variant="outline" className="text-[9px] h-4">{sec.aggregate}</Badge>
                    )}
                    {sec.limit && (
                      <Badge variant="outline" className="text-[9px] h-4">limit {sec.limit}</Badge>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground text-[10px] mt-0.5">JOIN: {sec.join}</p>
                {sec.fields && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sec.fields.map(f => (
                      <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f}</span>
                    ))}
                  </div>
                )}
                {sec.note && <p className="text-[9px] text-nexus-amber mt-1">⚠️ {sec.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-database joins */}
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
              <p className="text-muted-foreground font-mono text-[10px]">
                match: {cross.match_with} → {cross.match_by}
              </p>
              {cross.fallback && (
                <p className="text-[10px] text-nexus-amber">fallback: {cross.fallback}</p>
              )}
              {cross.enrich && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {cross.enrich.map(f => (
                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-nexus-emerald/10 text-nexus-emerald">{f}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sensitive fields */}
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

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="DataHub"
        description="Central de dados: explore entidades, conexões e mapeamentos cross-database"
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
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar entidade, tabela ou conexão..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-secondary/30"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
            {/* Entity list */}
            <div className="space-y-2">
              {filteredEntities.map(entity => {
                const Icon = ENTITY_ICONS[entity.id] ?? Database;
                const isSelected = selectedEntity === entity.id;
                const secondaryCount = entity.secondary?.length ?? 0;
                const crossCount = entity.cross_db?.length ?? 0;

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
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {entity.primary.table} → {getConnectionLabel(entity.primary.connection)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {secondaryCount > 0 && (
                          <Badge variant="secondary" className="text-[9px]">+{secondaryCount} joins</Badge>
                        )}
                        {crossCount > 0 && (
                          <Badge variant="outline" className="text-[9px] border-nexus-emerald/30 text-nexus-emerald">
                            {crossCount} cross-db
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

            {/* Detail panel */}
            <div>
              {selectedEntity && selectedMapping ? (
                <EntityDetailPanel entityId={selectedEntity} mapping={selectedMapping} />
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
              {CONNECTIONS.filter(c => c.status === "connected").length} de {CONNECTIONS.length} conexões ativas
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
              <RefreshCcw className="h-3.5 w-3.5" /> Testar Conexões
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {CONNECTIONS.map(conn => (
              <ConnectionCard key={conn.id} conn={conn} />
            ))}
          </div>

          {/* Cross-database overview */}
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
                <Badge key={t} variant="outline" className="text-[10px] font-mono text-destructive/70 border-destructive/20">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div className="nexus-card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Resumo do Schema</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{ENTITY_LIST.length}</p>
                <p className="text-[10px] text-muted-foreground">Entidades</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">{CONNECTIONS.length}</p>
                <p className="text-[10px] text-muted-foreground">Conexões</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">
                  {ENTITY_LIST.reduce((acc, e) => acc + (e.secondary?.length ?? 0), 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Joins Secundários</p>
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-heading font-bold text-foreground">
                  {ENTITY_LIST.reduce((acc, e) => acc + (e.cross_db?.length ?? 0), 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">Cross-DB Links</p>
              </div>
            </div>
          </div>

          {/* All tables per connection */}
          <div className="grid gap-4 md:grid-cols-2">
            {CONNECTIONS.map(conn => {
              const entities = ENTITY_LIST.filter(e => e.primary.connection === conn.id);
              const allTables = new Set<string>();
              entities.forEach(e => {
                allTables.add(e.primary.table);
                e.secondary?.forEach(s => allTables.add(s.table));
              });

              return (
                <div key={conn.id} className="nexus-card space-y-2">
                  <div className="flex items-center gap-2">
                    <span>{conn.icon}</span>
                    <h4 className="text-sm font-semibold text-foreground">{conn.label}</h4>
                    <Badge variant="secondary" className="text-[9px]">{allTables.size} tabelas</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(allTables).sort().map(t => (
                      <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
