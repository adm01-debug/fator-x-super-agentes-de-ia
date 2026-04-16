import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Volume2, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Call {
  id: string;
  direction: "inbound" | "outbound";
  number: string;
  duration: number;
  status: "completed" | "failed" | "ongoing";
  cost: number;
  agent: string;
  date: string;
}

const mockCalls: Call[] = [
  { id: "c1", direction: "inbound", number: "+55 11 98765-4321", duration: 245, status: "completed", cost: 0.32, agent: "SDR Voice", date: "há 5 min" },
  { id: "c2", direction: "outbound", number: "+55 21 99887-7665", duration: 180, status: "completed", cost: 0.24, agent: "Cobrança Voice", date: "há 18 min" },
  { id: "c3", direction: "inbound", number: "+55 31 97766-5544", duration: 0, status: "failed", cost: 0, agent: "SDR Voice", date: "há 1h" },
  { id: "c4", direction: "outbound", number: "+55 11 91122-3344", duration: 412, status: "completed", cost: 0.55, agent: "Suporte Voice", date: "há 2h" },
];

export default function VoiceTelephonyPage() {
  const [voice, setVoice] = useState("nova");
  const [provider, setProvider] = useState("twilio");

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <PhoneCall className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Voice Agents & Telefonia
          </h1>
        </div>
        <p className="text-muted-foreground">
          Agentes que falam — atendimento por voz, SDR outbound, cobrança automática via Twilio/Vonage.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Chamadas hoje</p><p className="text-2xl font-bold">128</p></div><Phone className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Duração média</p><p className="text-2xl font-bold">3:42</p></div><Clock className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Custo do mês</p><p className="text-2xl font-bold">$ 47.20</p></div><DollarSign className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Taxa sucesso</p><p className="text-2xl font-bold">94%</p></div><Volume2 className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
      </div>

      <Tabs defaultValue="calls">
        <TabsList>
          <TabsTrigger value="calls">Chamadas</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="numbers">Números</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="space-y-4">
          {mockCalls.map(c => (
            <Card key={c.id}>
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {c.direction === "inbound" ? <PhoneIncoming className="h-6 w-6 text-success" /> : <PhoneOutgoing className="h-6 w-6 text-primary" />}
                  <div>
                    <p className="font-semibold">{c.number}</p>
                    <p className="text-xs text-muted-foreground">{c.agent} • {c.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={c.status === "completed" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>{c.status}</Badge>
                  <span className="text-sm font-mono">{Math.floor(c.duration / 60)}:{String(c.duration % 60).padStart(2, "0")}</span>
                  <span className="text-sm font-bold">${c.cost.toFixed(2)}</span>
                  <Button size="sm" variant="outline" onClick={() => toast.info("Reproduzindo gravação...")}><Volume2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardHeader><CardTitle>Configuração de Voz</CardTitle><CardDescription>Provedor TTS/STT e voz padrão</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Provedor de Telefonia</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="twilio">Twilio</SelectItem><SelectItem value="vonage">Vonage</SelectItem><SelectItem value="plivo">Plivo</SelectItem></SelectContent></Select></div>
              <div><Label>Voz (TTS)</Label><Select value={voice} onValueChange={setVoice}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nova">Nova (PT-BR feminina)</SelectItem><SelectItem value="echo">Echo (PT-BR masculina)</SelectItem><SelectItem value="onyx">Onyx (EN-US masculina)</SelectItem></SelectContent></Select></div>
              <div><Label>Modelo STT</Label><Select defaultValue="whisper-large-v3"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="whisper-large-v3">Whisper Large v3</SelectItem><SelectItem value="deepgram-nova-2">Deepgram Nova 2</SelectItem></SelectContent></Select></div>
              <Button onClick={() => toast.success("Configuração salva")}>Salvar</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers">
          <Card>
            <CardHeader><CardTitle>Números Conectados</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {["+55 11 4002-8922", "+55 21 4042-8800", "+1 415 555-0199"].map(n => (
                <div key={n} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" /><span className="font-mono">{n}</span></div>
                  <Badge>Ativo</Badge>
                </div>
              ))}
              <div className="flex gap-2"><Input placeholder="+55 11 99999-9999" /><Button onClick={() => toast.success("Número adicionado")}>Adicionar</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
