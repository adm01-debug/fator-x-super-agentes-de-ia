import { useState } from "react";
import { MapPin, Lock, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

const REGIONS = [
  { code: "br-sa-east-1", name: "Brasil — São Paulo", flag: "🇧🇷", lgpd: true, gdpr: false, sovereign: true, latency: "12ms" },
  { code: "us-east-1", name: "EUA — Virginia", flag: "🇺🇸", lgpd: false, gdpr: false, sovereign: false, latency: "120ms" },
  { code: "eu-west-1", name: "Irlanda — Dublin", flag: "🇮🇪", lgpd: false, gdpr: true, sovereign: false, latency: "190ms" },
  { code: "eu-central-1", name: "Alemanha — Frankfurt", flag: "🇩🇪", lgpd: false, gdpr: true, sovereign: true, latency: "210ms" },
  { code: "ap-southeast-1", name: "Singapura", flag: "🇸🇬", lgpd: false, gdpr: false, sovereign: false, latency: "320ms" },
];

const TENANTS = [
  { id: "ws_001", name: "Workspace Principal", region: "br-sa-east-1", users: 28, dataGB: 142, isolation: "schema" },
  { id: "ws_002", name: "Cliente Premium A", region: "br-sa-east-1", users: 12, dataGB: 47, isolation: "database" },
  { id: "ws_003", name: "Cliente EU GDPR", region: "eu-central-1", users: 5, dataGB: 18, isolation: "database" },
];

export default function DataResidencyPage() {
  const [primaryRegion, setPrimaryRegion] = useState("br-sa-east-1");
  const [encryptionAtRest, setEncryptionAtRest] = useState(true);
  const [byok, setByok] = useState(false);
  const [dataExportBlock, setDataExportBlock] = useState(true);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Data Residency & Multi-Tenant"
        description="Soberania de dados, isolamento por tenant e compliance regional (LGPD, GDPR, residency requirements)."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Região primária</div><div className="text-lg font-bold mt-1">🇧🇷 BR São Paulo</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tenants ativos</div><div className="text-2xl font-bold">{TENANTS.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Dados armazenados</div><div className="text-2xl font-bold">{TENANTS.reduce((s, t) => s + t.dataGB, 0)} GB</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Compliance</div><div className="flex gap-1 mt-1"><Badge className="text-[10px] bg-nexus-green/15 text-nexus-green border-nexus-green/30">LGPD</Badge><Badge className="text-[10px] bg-nexus-blue/15 text-nexus-blue border-nexus-blue/30">GDPR</Badge></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Regiões disponíveis</CardTitle>
            <CardDescription>Escolha onde seus dados são armazenados e processados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {REGIONS.map((r) => (
              <button
                key={r.code}
                onClick={() => { setPrimaryRegion(r.code); toast.success(`Região primária: ${r.name}`); }}
                className={`w-full text-left p-3 rounded-md border transition-all ${primaryRegion === r.code ? "border-primary bg-primary/8" : "border-border/50 hover:border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{r.flag}</span>
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.code}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.lgpd && <Badge variant="outline" className="text-[10px] h-5 bg-nexus-green/10 text-nexus-green border-nexus-green/30">LGPD</Badge>}
                    {r.gdpr && <Badge variant="outline" className="text-[10px] h-5 bg-nexus-blue/10 text-nexus-blue border-nexus-blue/30">GDPR</Badge>}
                    {r.sovereign && <Badge variant="outline" className="text-[10px] h-5 bg-nexus-purple/10 text-nexus-purple border-nexus-purple/30">Sovereign</Badge>}
                    <span className="text-[11px] text-muted-foreground ml-2">{r.latency}</span>
                    {primaryRegion === r.code && <CheckCircle2 className="h-4 w-4 text-primary ml-1" />}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Criptografia & Controles</CardTitle>
            <CardDescription>Proteção em repouso, em trânsito e BYOK</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Encryption at Rest (AES-256)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Todos os dados em disco são cifrados</p>
              </div>
              <Switch checked={encryptionAtRest} onCheckedChange={setEncryptionAtRest} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">BYOK (Bring Your Own Key)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Use sua própria CMK no AWS KMS / Azure Key Vault</p>
              </div>
              <Switch checked={byok} onCheckedChange={setByok} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Bloquear export entre regiões</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Dados não saem da região primária</p>
              </div>
              <Switch checked={dataExportBlock} onCheckedChange={setDataExportBlock} />
            </div>
            <div className="pt-3 border-t border-border/40">
              <Label className="text-xs">Modelo de isolamento padrão para novos tenants</Label>
              <Select defaultValue="schema">
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="row">Row-Level Security (RLS)</SelectItem>
                  <SelectItem value="schema">Schema-per-tenant</SelectItem>
                  <SelectItem value="database">Database-per-tenant (premium)</SelectItem>
                  <SelectItem value="cluster">Cluster dedicado (enterprise)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Tenants</CardTitle>
          <CardDescription>Workspaces ativos e seus modelos de isolamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Tenant</th>
                  <th className="pb-2 pr-4">Região</th>
                  <th className="pb-2 pr-4">Usuários</th>
                  <th className="pb-2 pr-4">Dados</th>
                  <th className="pb-2 pr-4">Isolamento</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {TENANTS.map((t) => {
                  const region = REGIONS.find(r => r.code === t.region)!;
                  return (
                    <tr key={t.id} className="border-b border-border/20">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{t.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs">{region.flag} {region.name.split(" — ")[1]}</td>
                      <td className="py-3 pr-4">{t.users}</td>
                      <td className="py-3 pr-4">{t.dataGB} GB</td>
                      <td className="py-3 pr-4"><Badge variant="outline" className="text-[10px]">{t.isolation}</Badge></td>
                      <td className="py-3"><Badge className="text-[10px] bg-nexus-green/15 text-nexus-green border-nexus-green/30"><CheckCircle2 className="h-3 w-3 mr-0.5" />Ativo</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-nexus-amber/30 bg-nexus-amber/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-nexus-amber shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium">Migração entre regiões requer aprovação</div>
            <div className="text-xs text-muted-foreground mt-1">
              Mover dados entre regiões pode levar até 24h e exige autorização do Workspace Owner. Compliance officers serão notificados.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
