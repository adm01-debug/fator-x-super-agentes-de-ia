import { useState } from "react";
import { Store, DollarSign, TrendingUp, Star, Download, Upload, BarChart3, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Listing = { id: string; name: string; author: string; price: number; rating: number; installs: number; revenue: number; category: string; pricingModel: "free" | "one-time" | "subscription" | "usage" };

const LISTINGS: Listing[] = [
  { id: "1", name: "SQL Master Agent", author: "@dataco", price: 29, rating: 4.8, installs: 1240, revenue: 35960, category: "Database", pricingModel: "one-time" },
  { id: "2", name: "Customer Success Bot", author: "@helpflow", price: 49, rating: 4.9, installs: 890, revenue: 43610, category: "Support", pricingModel: "subscription" },
  { id: "3", name: "Legal Contract Analyzer", author: "@lexbr", price: 0.05, rating: 4.7, installs: 5400, revenue: 27000, category: "Legal", pricingModel: "usage" },
  { id: "4", name: "Bitrix24 CRM Sync", author: "@nexus-team", price: 0, rating: 4.6, installs: 12800, revenue: 0, category: "CRM", pricingModel: "free" },
];

export default function MarketplaceMonetizedPage() {
  const [tab, setTab] = useState("browse");
  const totalRevenue = LISTINGS.reduce((s, l) => s + l.revenue, 0);
  const myEarnings = 8420.50;

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Marketplace Monetizado"
        description="Publique skills e agentes — receba 70% de revenue share. Modelos: grátis, one-time, assinatura ou pay-per-use."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" />Receita total marketplace</div><div className="text-2xl font-bold mt-1">${totalRevenue.toLocaleString("en-US")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" />Seus ganhos (mês)</div><div className="text-2xl font-bold mt-1 text-nexus-green">${myEarnings.toLocaleString("en-US")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Download className="h-3.5 w-3.5" />Total instalações</div><div className="text-2xl font-bold mt-1">{LISTINGS.reduce((s, l) => s + l.installs, 0).toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Revenue share</div><div className="text-2xl font-bold mt-1">70/30</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse"><Store className="h-3.5 w-3.5 mr-1.5" />Marketplace</TabsTrigger>
          <TabsTrigger value="my-listings"><Upload className="h-3.5 w-3.5 mr-1.5" />Minhas publicações</TabsTrigger>
          <TabsTrigger value="earnings"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Ganhos</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {LISTINGS.map((l) => (
              <Card key={l.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm">{l.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{l.author}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{l.category}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-nexus-amber text-nexus-amber" />{l.rating}</span>
                    <span className="text-muted-foreground">{l.installs.toLocaleString("pt-BR")} installs</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <div className="text-lg font-bold">
                        {l.pricingModel === "free" ? "Grátis" : l.pricingModel === "usage" ? `$${l.price}/req` : `$${l.price}`}
                      </div>
                      <div className="text-[10px] text-muted-foreground capitalize">{l.pricingModel}</div>
                    </div>
                    <Button size="sm" onClick={() => toast.success(`${l.name} instalado`)}>Instalar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-listings">
          <Card>
            <CardHeader><CardTitle className="text-sm">Publicar nova skill</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Nome da skill" />
              <Input placeholder="Categoria" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Preço (USD)" type="number" />
                <select className="h-10 rounded-md border border-input px-3 text-sm bg-background">
                  <option>Free</option>
                  <option>One-time</option>
                  <option>Subscription mensal</option>
                  <option>Pay-per-use</option>
                </select>
              </div>
              <Button className="w-full" onClick={() => toast.success("Skill enviada para revisão")}><Upload className="h-4 w-4 mr-2" />Publicar</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de payouts</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { date: "01/04/2026", amount: 8420.50, status: "Pago", method: "PIX" },
                { date: "01/03/2026", amount: 6180.20, status: "Pago", method: "PIX" },
                { date: "01/02/2026", amount: 4920.00, status: "Pago", method: "Wire" },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div>
                    <div className="font-medium">${p.amount.toLocaleString("en-US")}</div>
                    <div className="text-xs text-muted-foreground">{p.date} · {p.method}</div>
                  </div>
                  <Badge className="bg-nexus-green/15 text-nexus-green">{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
