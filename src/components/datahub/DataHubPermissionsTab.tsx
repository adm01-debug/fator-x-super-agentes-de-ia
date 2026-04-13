/**
 * DataHubPermissionsTab — Nexus Agents Studio (improvement #5 part 2)
 *
 * Read-only permissions matrix showing which roles can read/write which
 * entities across the 5 DataHub databases. The matrix is sourced from
 * a static config (datahub-permissions) since the actual RLS policies
 * live in the remote Supabase projects and aren't queryable from here
 * without elevated privileges.
 *
 * Future: hook up to a `list_rls_policies` Edge Function action to
 * pull live policy data per project.
 */
import { useState, useMemo } from "react";
import { Shield, Search, CheckCircle2, XCircle, AlertCircle, Lock, Eye, Server } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ENTITY_LIST } from "@/config/datahub-entities";
import { LiveRlsView } from "./LiveRlsView";

type AccessLevel = 'none' | 'read' | 'write' | 'admin';

interface RolePermission {
  role: string;
  label: string;
  description: string;
  permissions: Record<string, AccessLevel>;
}

const ROLES: RolePermission[] = [
  {
    role: 'admin',
    label: 'Admin',
    description: 'Acesso total a todas as entidades e bancos',
    permissions: {
      cliente: 'admin',
      fornecedor: 'admin',
      transportadora: 'admin',
      produto: 'admin',
      colaborador: 'admin',
      conversa_whatsapp: 'admin',
    },
  },
  {
    role: 'manager',
    label: 'Gerente',
    description: 'Leitura/escrita em todas as entidades operacionais',
    permissions: {
      cliente: 'write',
      fornecedor: 'write',
      transportadora: 'write',
      produto: 'write',
      colaborador: 'read',
      conversa_whatsapp: 'read',
    },
  },
  {
    role: 'sales',
    label: 'Vendas',
    description: 'CRM e produtos; sem acesso a colaboradores ou financeiro',
    permissions: {
      cliente: 'write',
      fornecedor: 'read',
      transportadora: 'read',
      produto: 'read',
      colaborador: 'none',
      conversa_whatsapp: 'write',
    },
  },
  {
    role: 'purchasing',
    label: 'Compras',
    description: 'Fornecedores e produtos; leitura de transportadoras',
    permissions: {
      cliente: 'read',
      fornecedor: 'write',
      transportadora: 'read',
      produto: 'write',
      colaborador: 'none',
      conversa_whatsapp: 'none',
    },
  },
  {
    role: 'logistics',
    label: 'Logística',
    description: 'Transportadoras e ordens de envio',
    permissions: {
      cliente: 'read',
      fornecedor: 'read',
      transportadora: 'write',
      produto: 'read',
      colaborador: 'none',
      conversa_whatsapp: 'none',
    },
  },
  {
    role: 'support',
    label: 'Atendimento',
    description: 'Conversas WhatsApp e leitura de clientes',
    permissions: {
      cliente: 'read',
      fornecedor: 'none',
      transportadora: 'read',
      produto: 'read',
      colaborador: 'none',
      conversa_whatsapp: 'write',
    },
  },
  {
    role: 'finance',
    label: 'Financeiro',
    description: 'Leitura de clientes e fornecedores para faturamento',
    permissions: {
      cliente: 'read',
      fornecedor: 'read',
      transportadora: 'read',
      produto: 'read',
      colaborador: 'read',
      conversa_whatsapp: 'none',
    },
  },
  {
    role: 'viewer',
    label: 'Visualizador',
    description: 'Read-only em tudo (dashboards e relatórios)',
    permissions: {
      cliente: 'read',
      fornecedor: 'read',
      transportadora: 'read',
      produto: 'read',
      colaborador: 'none',
      conversa_whatsapp: 'read',
    },
  },
];

const LEVEL_CONFIG: Record<AccessLevel, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  none: { label: 'Nenhum', color: 'text-muted-foreground', icon: XCircle },
  read: { label: 'Leitura', color: 'text-nexus-amber', icon: Eye },
  write: { label: 'Escrita', color: 'text-nexus-emerald', icon: CheckCircle2 },
  admin: { label: 'Admin', color: 'text-primary', icon: Shield },
};

function AccessCell({ level }: { level: AccessLevel }) {
  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-center" title={cfg.label}>
      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
    </div>
  );
}

export function DataHubPermissionsTab() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"declared" | "live">("declared");

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ROLES;
    return ROLES.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
    );
  }, [search]);

  const stats = useMemo(() => {
    const all = ROLES.flatMap((r) => Object.values(r.permissions));
    return {
      total: all.length,
      none: all.filter((l) => l === 'none').length,
      read: all.filter((l) => l === 'read').length,
      write: all.filter((l) => l === 'write').length,
      admin: all.filter((l) => l === 'admin').length,
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Matriz de Permissões</h3>
        <Badge variant="outline" className="text-[10px]">
          {ROLES.length} papéis · {ENTITY_LIST.length} entidades
        </Badge>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "declared" | "live")} className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="declared" className="gap-1.5 text-xs">
            <Lock className="h-3 w-3" /> Declarado
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5 text-xs">
            <Server className="h-3 w-3" /> RLS ao vivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="declared" className="space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Controle de acesso por papel e entidade. As regras vivem nos arquivos de RLS dos projetos
            Supabase remotos; esta matriz é o contrato declarado pelo time.
          </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['admin', 'write', 'read', 'none'] as AccessLevel[]).map((lvl) => {
          const cfg = LEVEL_CONFIG[lvl];
          const count = stats[lvl];
          const pct = ((count / stats.total) * 100).toFixed(0);
          const Icon = cfg.icon;
          return (
            <div key={lvl} className="nexus-card">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
              </div>
              <p className="text-xl font-heading font-bold text-foreground tabular-nums">
                {count} <span className="text-[10px] font-normal text-muted-foreground">({pct}%)</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar papéis..."
          className="h-8 pl-7 text-xs bg-secondary/40"
        />
      </div>

      {/* Matrix table */}
      <div className="nexus-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/30 border-b border-border/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground sticky left-0 bg-secondary/30">
                  Papel
                </th>
                {ENTITY_LIST.map((e) => (
                  <th key={e.id} className="px-2 py-2 font-medium text-[10px] uppercase tracking-wider text-muted-foreground text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base">{e.icon}</span>
                      <span className="text-[9px]">{e.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={ENTITY_LIST.length + 1} className="text-center py-8 text-muted-foreground text-[11px]">
                    Nenhum papel encontrado
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr key={role.role} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{role.label}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1" title={role.description}>
                          {role.description}
                        </span>
                      </div>
                    </td>
                    {ENTITY_LIST.map((e) => (
                      <td key={e.id} className="px-2 py-2">
                        <AccessCell level={role.permissions[e.id] ?? 'none'} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="font-medium text-foreground">Legenda:</span>
        {(['admin', 'write', 'read', 'none'] as AccessLevel[]).map((lvl) => {
          const cfg = LEVEL_CONFIG[lvl];
          const Icon = cfg.icon;
          return (
            <div key={lvl} className="flex items-center gap-1">
              <Icon className={`h-3 w-3 ${cfg.color}`} />
              <span>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-nexus-amber/10 border border-nexus-amber/30">
        <AlertCircle className="h-4 w-4 text-nexus-amber shrink-0 mt-0.5" />
        <div className="text-[11px] text-foreground">
          <p className="font-medium">Esta matriz é declarativa.</p>
          <p className="text-muted-foreground mt-0.5">
            As regras reais são aplicadas via Row Level Security nos projetos Supabase remotos.
            Para sincronizar este contrato com o RLS real, execute as migrations correspondentes
            em cada projeto via <code className="font-mono bg-secondary/40 px-1 rounded">supabase db push</code>.
            Use a aba <strong>RLS ao vivo</strong> ao lado para ver as policies reais.
          </p>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <LiveRlsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}


export default DataHubPermissionsTab;
