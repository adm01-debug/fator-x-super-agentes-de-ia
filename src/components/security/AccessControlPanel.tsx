import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Plus, Trash2, Globe, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useWorkspaceId } from "@/hooks/use-data";
import {
  listIpWhitelist,
  addIpWhitelist,
  toggleIpWhitelist,
  deleteIpWhitelist,
  listAllowedCountries,
  addAllowedCountry,
  deleteAllowedCountry,
  listAccessBlockedLog,
  validateAccess,
} from "@/services/accessControlService";

const COMMON_COUNTRIES: Array<{ code: string; name: string }> = [
  { code: "BR", name: "Brasil" },
  { code: "US", name: "Estados Unidos" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Reino Unido" },
  { code: "DE", name: "Alemanha" },
  { code: "FR", name: "França" },
  { code: "ES", name: "Espanha" },
  { code: "IT", name: "Itália" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CA", name: "Canadá" },
  { code: "JP", name: "Japão" },
];

const IPV4_OR_CIDR =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\/(?:[0-9]|[12]\d|3[0-2]))?$/;

export function AccessControlPanel() {
  const { data: workspaceId, isLoading: loadingWs } = useWorkspaceId();

  if (loadingWs) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando workspace…
        </CardContent>
      </Card>
    );
  }

  if (!workspaceId) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          Nenhum workspace encontrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Controle de Acesso (IP & Geo)
          </CardTitle>
          <DiagnoseButton workspaceId={workspaceId} />
        </div>
        <p className="text-sm text-muted-foreground">
          Restrinja o acesso ao workspace por IP/CIDR ou país de origem.
          Tentativas bloqueadas são auditadas.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ip" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ip">IPs Permitidos</TabsTrigger>
            <TabsTrigger value="geo">Países Permitidos</TabsTrigger>
            <TabsTrigger value="log">Bloqueios Recentes</TabsTrigger>
          </TabsList>
          <TabsContent value="ip" className="mt-4">
            <IpWhitelistManager workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="geo" className="mt-4">
            <GeoBlockingManager workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value="log" className="mt-4">
            <BlockedLogPanel workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DiagnoseButton({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await validateAccess(workspaceId);
          toast[r.allowed ? "success" : "warning"](
            r.allowed ? "Acesso permitido" : `Bloqueado: ${r.reason}`,
            { description: `IP: ${r.ip ?? "?"} • País: ${r.country ?? "?"}` },
          );
        } catch (e) {
          toast.error("Falha no diagnóstico", {
            description: e instanceof Error ? e.message : "Erro",
          });
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Diagnosticar meu acesso"}
    </Button>
  );
}

function IpWhitelistManager({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [ip, setIp] = useState("");
  const [label, setLabel] = useState("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["ip_whitelist", workspaceId],
    queryFn: () => listIpWhitelist(workspaceId),
  });

  const handleAdd = async () => {
    if (!IPV4_OR_CIDR.test(ip.trim())) {
      toast.error("Formato inválido", {
        description: "Use IPv4 (1.2.3.4) ou CIDR (10.0.0.0/24)",
      });
      return;
    }
    try {
      await addIpWhitelist(workspaceId, ip.trim(), label.trim() || undefined);
      setIp("");
      setLabel("");
      toast.success("IP adicionado");
      qc.invalidateQueries({ queryKey: ["ip_whitelist", workspaceId] });
    } catch (e) {
      toast.error("Falha ao adicionar", {
        description: e instanceof Error ? e.message : "",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="IP ou CIDR (ex: 192.168.1.0/24)"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="font-mono text-sm"
        />
        <Input
          placeholder="Rótulo (ex: Escritório)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button onClick={handleAdd} disabled={!ip.trim()}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      {rules.length === 0 && !isLoading && (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma regra. Quando vazia, todos os IPs são permitidos.
        </div>
      )}

      <div className="space-y-2">
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <code className="font-mono text-sm">{r.ip_address}</code>
              {r.label && (
                <span className="ml-2 text-xs text-muted-foreground">
                  · {r.label}
                </span>
              )}
            </div>
            <Switch
              checked={r.is_active}
              onCheckedChange={async (v) => {
                try {
                  await toggleIpWhitelist(r.id, v);
                  qc.invalidateQueries({ queryKey: ["ip_whitelist", workspaceId] });
                } catch {
                  toast.error("Falha ao atualizar");
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                try {
                  await deleteIpWhitelist(r.id);
                  toast.success("Removido");
                  qc.invalidateQueries({ queryKey: ["ip_whitelist", workspaceId] });
                } catch {
                  toast.error("Falha ao remover");
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GeoBlockingManager({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const { data: countries = [] } = useQuery({
    queryKey: ["geo_countries", workspaceId],
    queryFn: () => listAllowedCountries(workspaceId),
  });

  const existing = useMemo(() => new Set(countries.map((c) => c.country_code)), [countries]);

  const handleAdd = async (cc: string, name?: string) => {
    if (!/^[A-Za-z]{2}$/.test(cc)) {
      toast.error("Código ISO inválido", { description: "Use 2 letras (BR, US…)" });
      return;
    }
    try {
      await addAllowedCountry(workspaceId, cc, name);
      setCode("");
      qc.invalidateQueries({ queryKey: ["geo_countries", workspaceId] });
      toast.success(`${cc.toUpperCase()} adicionado`);
    } catch (e) {
      toast.error("Falha", { description: e instanceof Error ? e.message : "" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Código ISO 2 letras (BR, US, PT…)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={2}
          className="max-w-[200px] uppercase"
        />
        <Button onClick={() => handleAdd(code)} disabled={code.length !== 2}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Sugestões rápidas:
        </p>
        <div className="flex flex-wrap gap-2">
          {COMMON_COUNTRIES.map((c) => (
            <Button
              key={c.code}
              variant="outline"
              size="sm"
              disabled={existing.has(c.code)}
              onClick={() => handleAdd(c.code, c.name)}
            >
              {c.code} · {c.name}
            </Button>
          ))}
        </div>
      </div>

      {countries.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Globe className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Nenhum país listado. Quando vazio, todos os países são permitidos.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="gap-1 px-3 py-1.5 text-sm"
            >
              {c.country_code}
              {c.country_name && (
                <span className="text-xs text-muted-foreground">· {c.country_name}</span>
              )}
              <button
                aria-label="remover"
                onClick={async () => {
                  try {
                    await deleteAllowedCountry(c.id);
                    qc.invalidateQueries({ queryKey: ["geo_countries", workspaceId] });
                  } catch {
                    toast.error("Falha ao remover");
                  }
                }}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockedLogPanel({ workspaceId }: { workspaceId: string }) {
  const { data: log = [], isLoading } = useQuery({
    queryKey: ["access_blocked_log", workspaceId],
    queryFn: () => listAccessBlockedLog(workspaceId, 50),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  if (log.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Shield className="mx-auto mb-2 h-6 w-6 opacity-40" />
        Nenhum bloqueio registrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {log.map((e) => (
        <div
          key={e.id}
          className="flex items-start gap-3 rounded-md border bg-card p-3 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="text-[10px]">
                {e.reason}
              </Badge>
              {e.ip_address && (
                <code className="font-mono text-xs">{e.ip_address}</code>
              )}
              {e.country_code && (
                <Badge variant="outline" className="text-[10px]">
                  {e.country_code}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(e.created_at).toLocaleString("pt-BR")}
              {e.user_agent && (
                <span className="ml-2 truncate">· {e.user_agent.slice(0, 60)}</span>
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
