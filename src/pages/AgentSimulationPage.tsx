import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FlaskRound, Play, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface SimResult { persona: string; satisfaction: number; conversionScore: number; messages: number }

export default function AgentSimulationPage() {
  const [scenarios, setScenarios] = useState(50);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SimResult[]>([]);

  const runSim = () => {
    setRunning(true);
    toast.info(`Simulando ${scenarios} cenários...`);
    setTimeout(() => {
      setResults([
        { persona: "Cliente Frio (Cético)", satisfaction: 62, conversionScore: 41, messages: 8 },
        { persona: "Cliente Quente (Decidido)", satisfaction: 91, conversionScore: 87, messages: 4 },
        { persona: "Reclamante (Bravo)", satisfaction: 78, conversionScore: 0, messages: 12 },
        { persona: "Curioso (Pesquisando)", satisfaction: 84, conversionScore: 28, messages: 7 },
        { persona: "Empresa B2B", satisfaction: 89, conversionScore: 72, messages: 11 },
      ]);
      setRunning(false);
      toast.success("Simulação completa");
    }, 1800);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <FlaskRound className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Agent Simulation Lab
          </h1>
        </div>
        <p className="text-muted-foreground">
          Teste agentes contra usuários sintéticos antes de deploy. Personas geradas por LLM simulam conversas reais.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Configurar Simulação</CardTitle><CardDescription>Defina quantos cenários e personas serão gerados</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Agente alvo</Label><Input defaultValue="SDR Bot v2.3" /></div>
          <div>
            <Label>Cenários: {scenarios}</Label>
            <Slider value={[scenarios]} onValueChange={v => setScenarios(v[0])} min={10} max={500} step={10} />
          </div>
          <div><Label>Objetivo</Label><Textarea defaultValue="Avaliar taxa de conversão em vendas inbound" rows={2} /></div>
          <Button onClick={runSim} disabled={running} className="w-full">
            <Play className="h-4 w-4 mr-2" />{running ? "Simulando..." : "Iniciar Simulação"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Resultados por Persona</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="p-4 border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="font-semibold">{r.persona}</span></div>
                  <Badge variant={r.conversionScore > 60 ? "default" : r.conversionScore > 30 ? "secondary" : "destructive"}>
                    Conv: {r.conversionScore}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Satisfação:</span> <span className="font-bold">{r.satisfaction}%</span></div>
                  <div><span className="text-muted-foreground">Conversão:</span> <span className="font-bold">{r.conversionScore}%</span></div>
                  <div className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /><span>{r.messages} msgs</span></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
