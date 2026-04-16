import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Database, Settings, Plus, Globe } from "lucide-react";
import { toast } from "sonner";

const tenants = [
  { id: "t1", name: "Promo Brindes", slug: "promobrindes", users: 47, agents: 23, plan: "Enterprise", region: "BR-SP", isolation: "schema" },
  { id: "t2", name: "Acme Corp", slug: "acme", users: 12, agents: 8, plan: "Pro", region: "US-EAST", isolation: "schema" },
  { id: "t3", name: "Beta Industries", slug: "beta", users: 5, agents: 3, plan: "Starter", region: "EU-WEST", isolation: "row" },
];

export default function MultiTenancyPage() {
  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Multi-Tenancy Avançado
          </h1>
        </div>
        <p className="text-muted-foreground">
          Isolamento por schema/database, regions multi-zone, white-label, billing por tenant.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Tenants ativos</p><p className="text-2xl font-bold">{tenants.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Usuários totais</p><p className="text-2xl font-bold">64</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">MRR combinado</p><p className="text-2xl font-bold">$ 8.4K</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Regiões</p><p className="text-2xl font-bold">3</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Provisionar Novo Tenant</CardTitle><CardDescription>Cria schema isolado + admin user + workspace</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Nome</Label><Input placeholder="Acme Corporation" /></div>
            <div><Label>Slug (subdomínio)</Label><Input placeholder="acme" /></div>
            <div><Label>Email Admin</Label><Input type="email" placeholder="admin@acme.com" /></div>
            <div><Label>Região</Label><Input defaultValue="BR-SP" /></div>
          </div>
          <Button onClick={() => toast.success("Tenant provisionado em ~30s")}><Plus className="h-4 w-4 mr-2" />Provisionar Tenant</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tenants Ativos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {tenants.map(t => (
            <div key={t.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2"><h4 className="font-semibold">{t.name}</h4><Badge>{t.plan}</Badge></div>
                  <p className="text-xs text-muted-foreground font-mono">{t.slug}.nexus.app</p>
                </div>
                <Button size="sm" variant="outline"><Settings className="h-4 w-4" /></Button>
              </div>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Users:</span> <span className="font-bold">{t.users}</span></div>
                <div><span className="text-muted-foreground">Agents:</span> <span className="font-bold">{t.agents}</span></div>
                <div className="flex items-center gap-1"><Globe className="h-3 w-3" /><span>{t.region}</span></div>
                <div className="flex items-center gap-1"><Database className="h-3 w-3" /><span>{t.isolation}</span></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
