/**
 * Permissions Page — catálogo completo das 37 permissões agrupadas por módulo,
 * com filtro de busca e badges por categoria (read/write/admin/destructive).
 */
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listPermissions, type Permission } from "@/services/rbacService";
import { Search, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  read: "bg-nexus-cyan/15 text-nexus-cyan border-nexus-cyan/30",
  write: "bg-primary/15 text-primary border-primary/30",
  execute: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30",
  admin: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PermissionsPage() {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setPerms(await listPermissions());
      } catch (e) {
        toast.error("Falha ao carregar permissões", { description: e instanceof Error ? e.message : String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? perms.filter(
          (p) => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.module.toLowerCase().includes(q)
        )
      : perms;
    const map: Record<string, Permission[]> = {};
    filtered.forEach((p) => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [perms, query]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Permissões" description="Catálogo completo de permissões disponíveis no sistema" />

      <InfoHint title="Como ler esta página">
        Cada permissão tem um identificador (`módulo.ação`). Categorias indicam o nível de risco:
        <strong> read</strong> (leitura), <strong>write</strong> (escrita), <strong>execute</strong> (execução),
        <strong> admin</strong> (administrativo), <strong>destructive</strong> (irreversível).
      </InfoHint>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por chave, nome ou módulo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : grouped.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhuma permissão encontrada.</Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([module, modulePerms]) => (
            <Card key={module} className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground capitalize">{module}</h3>
                <Badge variant="outline" className="text-[10px]">{modulePerms.length}</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {modulePerms.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-primary truncate">{p.key}</code>
                      </div>
                      <p className="text-xs text-foreground mt-0.5">{p.name}</p>
                      {p.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                      )}
                    </div>
                    {p.category && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${CATEGORY_COLORS[p.category] ?? ""}`}
                      >
                        {p.category}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
