import { useState } from "react";
import { Mail, Calendar, Webhook, Plus, Trash2, Power, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Trigger = { id: string; type: "email" | "calendar"; name: string; provider: string; filter: string; agent: string; enabled: boolean; runs: number };

export default function EmailCalendarTriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([
    { id: "t1", type: "email", name: "Suporte → Triagem", provider: "Gmail", filter: "to:suporte@fatorx.app", agent: "Triage Bot v2", enabled: true, runs: 1247 },
    { id: "t2", type: "email", name: "Faturas recebidas", provider: "Outlook", filter: "subject:'fatura' OR 'NF-e'", agent: "Invoice Parser", enabled: true, runs: 384 },
    { id: "t3", type: "calendar", name: "Pré-reunião briefing", provider: "Google Cal", filter: "antes de cada evento (15min)", agent: "Meeting Prep", enabled: true, runs: 92 },
    { id: "t4", type: "calendar", name: "Pós-reunião resumo", provider: "Outlook Cal", filter: "após eventos com gravação", agent: "Summary Bot", enabled: false, runs: 47 },
  ]);

  const toggle = (id: string) => setTriggers((ts) => ts.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t));
  const remove = (id: string) => { setTriggers((ts) => ts.filter((t) => t.id !== id)); toast.success("Trigger removido"); };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Email & Calendar Triggers"
        description="Dispare agentes automaticamente a partir de emails recebidos ou eventos de calendário. Suporte Gmail, Outlook, Google Calendar."
      />

      <Tabs defaultValue="triggers">
        <TabsList>
          <TabsTrigger value="triggers"><Webhook className="h-3.5 w-3.5 mr-1.5" />Triggers ativos</TabsTrigger>
          <TabsTrigger value="new"><Plus className="h-3.5 w-3.5 mr-1.5" />Novo trigger</TabsTrigger>
        </TabsList>

        <TabsContent value="triggers" className="space-y-3">
          {triggers.map((t) => (
            <Card key={t.id} className={!t.enabled ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-10 w-10 rounded-md flex items-center justify-center ${t.type === "email" ? "bg-nexus-blue/15" : "bg-nexus-purple/15"}`}>
                  {t.type === "email" ? <Mail className="h-5 w-5 text-nexus-blue" /> : <Calendar className="h-5 w-5 text-nexus-purple" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.provider}</Badge>
                    <Badge variant="outline" className="text-[10px]"><Filter className="h-2.5 w-2.5 mr-0.5" />{t.filter}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">→ {t.agent} · {t.runs.toLocaleString("pt-BR")} execuções</div>
                </div>
                <Switch checked={t.enabled} onCheckedChange={() => toggle(t.id)} />
                <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader><CardTitle className="text-sm">Configurar novo trigger</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button className="p-4 rounded-lg border-2 border-primary bg-primary/5 text-left">
                  <Mail className="h-6 w-6 text-nexus-blue mb-2" />
                  <div className="text-sm font-semibold">Email recebido</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">IMAP/Gmail/Outlook polling</div>
                </button>
                <button className="p-4 rounded-lg border-2 border-border/40 hover:border-primary/40 text-left">
                  <Calendar className="h-6 w-6 text-nexus-purple mb-2" />
                  <div className="text-sm font-semibold">Evento de calendário</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Google/Outlook calendar webhooks</div>
                </button>
              </div>
              <div><Label className="text-xs">Nome do trigger</Label><Input placeholder="Ex: Triagem de tickets" className="mt-1" /></div>
              <div><Label className="text-xs">Filtro (Gmail query syntax)</Label><Input placeholder="from:cliente@empresa.com is:unread" className="mt-1 font-mono" /></div>
              <div><Label className="text-xs">Agente que processa</Label><Input placeholder="Selecione um agente" className="mt-1" /></div>
              <Button className="w-full" onClick={() => toast.success("Trigger criado")}><Plus className="h-4 w-4 mr-2" />Criar trigger</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
