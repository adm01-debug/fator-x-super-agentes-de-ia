/**
 * Role Permissions Page — mostra exatamente quais permissões uma função possui,
 * agrupadas por módulo. Acessada via /rbac/roles/:roleKey
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fromTable } from "@/lib/supabaseExtended";
import { listPermissions, type Permission, type Role } from "@/services/rbacService";
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  read: "bg-nexus-cyan/15 text-nexus-cyan border-nexus-cyan/30",
  write: "bg-primary/15 text-primary border-primary/30",
  execute: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30",
  admin: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function RolePermissionsPage() {
  const { roleKey } = useParams<{ roleKey: string }>();
  const [role, setRole] = useState<Role | null>(null);
  const [allPerms, setAllPerms] = useState<Permission[]>([]);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleKey) return;
    (async () => {
      try {
        const [{ data: roleData }, perms] = await Promise.all([
          fromTable("roles").select("*").eq("key", roleKey).maybeSingle(),
          listPermissions(),
        ]);
        setRole(roleData as unknown as Role);
        setAllPerms(perms);

        if (roleData) {
          const roleId = (roleData as Record<string, unknown>).id as string;
          const { data: rps } = await fromTable("role_permissions")
            .select("permission_id")
            .eq("role_id", roleId);
          const permIds = new Set(((rps ?? []) as Array<Record<string, unknown>>).map((rp) => String(rp.permission_id)));
          setGranted(permIds);
        }
      } catch (e) {
        toast.error("Falha ao carregar dados", { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [roleKey]);

  const grouped = allPerms.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Função não encontrada.</p>
        <Link to="/rbac/roles">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="w-3 h-3" /> Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const grantedCount = allPerms.filter((p) => granted.has(p.id)).length;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <Link to="/rbac/roles" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> Voltar para funções
      </Link>

      <PageHeader
        title={role.name}
        description={role.description ?? "Permissões desta função"}
      />

      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total de permissões concedidas</p>
          <p className="text-2xl font-bold text-foreground">
            {grantedCount} <span className="text-sm text-muted-foreground font-normal">/ {allPerms.length}</span>
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]" style={{ color: role.color, borderColor: `${role.color}50` }}>
          Nível {role.level}
        </Badge>
      </Card>

      <div className="space-y-4">
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([module, perms]) => (
          <Card key={module} className="p-5">
            <h3 className="text-sm font-bold text-foreground capitalize mb-3">{module}</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {perms.map((p) => {
                const has = granted.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-start gap-2 p-2.5 rounded-lg ${has ? "bg-secondary/40" : "bg-secondary/10 opacity-50"}`}
                  >
                    {has ? (
                      <CheckCircle2 className="w-4 h-4 text-nexus-emerald shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <code className="text-[11px] font-mono text-foreground truncate block">{p.key}</code>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{p.name}</p>
                    </div>
                    {p.category && (
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${CATEGORY_COLORS[p.category] ?? ""}`}>
                        {p.category}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
