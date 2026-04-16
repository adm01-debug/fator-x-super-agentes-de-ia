/**
 * Roles Page — visualiza as 5 funções padrão do sistema com badges,
 * cores, hierarquia e contagem de permissões por função.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listRoles, listPermissions, type Role, type Permission } from "@/services/rbacService";
import { fromTable } from "@/lib/supabaseExtended";
import { Crown, Edit, PlayCircle, FileSearch, Eye, Shield, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown, Edit, PlayCircle, FileSearch, Eye, Shield,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permsByRole, setPermsByRole] = useState<Record<string, number>>({});
  const [totalPerms, setTotalPerms] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rolesData, permsData] = await Promise.all([listRoles(), listPermissions()]);
        setRoles(rolesData);
        setTotalPerms(permsData.length);

        // Count permissions per role
        const { data: rpData } = await fromTable("role_permissions").select("role_id");
        const counts: Record<string, number> = {};
        ((rpData ?? []) as Array<Record<string, unknown>>).forEach((rp) => {
          const id = String(rp.role_id);
          counts[id] = (counts[id] || 0) + 1;
        });
        setPermsByRole(counts);
      } catch (e) {
        toast.error("Falha ao carregar funções", { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Funções (Roles)"
        description="Defina o que cada tipo de usuário pode fazer no workspace"
      />

      <InfoHint title="Como funciona o RBAC">
        Cada função (role) agrupa um conjunto de permissões. Atribua funções a usuários no painel de Equipe.
        Funções com nível mais alto têm precedência hierárquica em verificações de acesso.
      </InfoHint>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const Icon = ICONS[role.icon] ?? Shield;
            const permCount = permsByRole[role.id] ?? 0;
            const pct = totalPerms ? Math.round((permCount / totalPerms) * 100) : 0;
            return (
              <Card key={role.id} className="p-5 space-y-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${role.color}20`, color: role.color }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">Nível {role.level}</Badge>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground">{role.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Permissões</span>
                    <span className="font-mono">{permCount}/{totalPerms} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: role.color }}
                    />
                  </div>
                </div>

                <Link to={`/rbac/roles/${role.key}`}>
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                    Ver permissões <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
