import { useState } from "react";
import { Building2, KeyRound, UserPlus, Link2, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

const PROVIDERS = [
  { key: "okta", name: "Okta", color: "bg-nexus-blue" },
  { key: "azuread", name: "Azure AD / Entra ID", color: "bg-nexus-cyan" },
  { key: "google", name: "Google Workspace", color: "bg-nexus-green" },
  { key: "onelogin", name: "OneLogin", color: "bg-nexus-amber" },
  { key: "jumpcloud", name: "JumpCloud", color: "bg-nexus-purple" },
  { key: "custom", name: "Custom SAML 2.0", color: "bg-muted" },
];

export default function EnterpriseSSOPage() {
  const [provider, setProvider] = useState("okta");
  const [enforced, setEnforced] = useState(false);
  const [scimEnabled, setScimEnabled] = useState(false);
  const [scimToken] = useState("scim_" + Math.random().toString(36).slice(2, 18));
  const [metadataUrl, setMetadataUrl] = useState("");
  const [entityId, setEntityId] = useState("");
  const [acsUrl] = useState("https://nexus.fatorx.app/auth/saml/callback");
  const [scimEndpoint] = useState("https://nexus.fatorx.app/scim/v2");

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="SSO Enterprise"
        description="SAML 2.0 + SCIM 2.0 — provisione e desprovisione usuários automaticamente via Okta, Azure AD, Google Workspace e mais."
      />

      <Tabs defaultValue="saml">
        <TabsList>
          <TabsTrigger value="saml"><KeyRound className="h-4 w-4 mr-1" />SAML 2.0</TabsTrigger>
          <TabsTrigger value="scim"><UserPlus className="h-4 w-4 mr-1" />SCIM Provisioning</TabsTrigger>
          <TabsTrigger value="domain"><Building2 className="h-4 w-4 mr-1" />Domínios verificados</TabsTrigger>
        </TabsList>

        <TabsContent value="saml" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">Provider de Identidade</CardTitle>
              <CardDescription>Selecione seu IdP e configure o SAML SSO</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setProvider(p.key)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${provider === p.key ? "border-primary bg-primary/8 shadow-md" : "border-border/50 hover:border-border"}`}
                  >
                    <div className={`w-8 h-8 rounded-md ${p.color} mb-2`} />
                    <div className="text-sm font-medium">{p.name}</div>
                    {provider === p.key && <CheckCircle2 className="h-4 w-4 text-primary mt-1" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">1. Configure no seu IdP</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ACS URL (Assertion Consumer Service)</Label>
                  <div className="flex gap-2">
                    <Input value={acsUrl} readOnly className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copy(acsUrl, "ACS URL")}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Entity ID / Audience</Label>
                  <div className="flex gap-2">
                    <Input value="urn:nexus:fatorx:saml" readOnly className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => copy("urn:nexus:fatorx:saml", "Entity ID")}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Name ID Format</Label>
                  <Input value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" readOnly className="font-mono text-[10px]" />
                </div>
                <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
                  Atributos requeridos: <code>email</code>, <code>firstName</code>, <code>lastName</code>, <code>groups</code> (opcional)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">2. Cole metadata do IdP</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Metadata URL</Label>
                  <Input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://your-idp.com/metadata.xml" className="text-xs" />
                </div>
                <div className="text-center text-xs text-muted-foreground py-1">— ou —</div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SAML Entity ID do IdP</Label>
                  <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="http://www.okta.com/exk..." className="text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Certificate (X.509 PEM)</Label>
                  <Textarea placeholder="-----BEGIN CERTIFICATE-----&#10;..." className="text-[10px] font-mono h-24" />
                </div>
                <Button className="w-full" onClick={() => toast.success("Configuração SAML salva — conexão pronta para teste")}>Salvar configuração</Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Forçar SSO para todo o workspace</div>
                <div className="text-xs text-muted-foreground">Usuários só conseguem entrar via SAML — desabilita login por senha</div>
              </div>
              <Switch checked={enforced} onCheckedChange={setEnforced} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scim" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SCIM 2.0 Provisioning</CardTitle>
              <CardDescription>Sincronize usuários e grupos automaticamente do seu IdP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border border-border/50 rounded-md">
                <div>
                  <div className="text-sm font-medium">Habilitar SCIM</div>
                  <div className="text-xs text-muted-foreground">Cria/atualiza/desativa usuários automaticamente</div>
                </div>
                <Switch checked={scimEnabled} onCheckedChange={setScimEnabled} />
              </div>

              {scimEnabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SCIM Base URL</Label>
                    <div className="flex gap-2">
                      <Input value={scimEndpoint} readOnly className="font-mono text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copy(scimEndpoint, "SCIM URL")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bearer Token</Label>
                    <div className="flex gap-2">
                      <Input value={scimToken} readOnly className="font-mono text-xs" type="password" />
                      <Button size="icon" variant="outline" onClick={() => copy(scimToken, "Token")}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">⚠️ Salve este token agora — ele não será mostrado novamente.</div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Usuários sincronizados</div><div className="text-2xl font-bold">0</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Grupos</div><div className="text-2xl font-bold">0</div></CardContent></Card>
                    <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Última sync</div><div className="text-sm font-medium pt-1">—</div></CardContent></Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Domínios verificados</CardTitle>
              <CardDescription>Apenas emails destes domínios podem usar SSO</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="empresa.com.br" />
                <Button>Adicionar</Button>
              </div>
              <div className="flex items-center justify-between p-3 border border-border/50 rounded-md">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono">fatorx.app</span>
                </div>
                <Badge variant="outline" className="text-nexus-green border-nexus-green/30 bg-nexus-green/10"><CheckCircle2 className="h-3 w-3 mr-1" />Verificado</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border border-border/50 rounded-md">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono">cliente-exemplo.com.br</span>
                </div>
                <Badge variant="outline" className="text-nexus-amber border-nexus-amber/30 bg-nexus-amber/10"><AlertCircle className="h-3 w-3 mr-1" />Pendente DNS</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
