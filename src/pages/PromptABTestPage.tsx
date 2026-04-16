import { useState } from "react";
import { TestTube2, TrendingUp, Trophy, Play, Pause, BarChart3, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Variant = { id: string; name: string; prompt: string; traffic: number; runs: number; avgLatency: number; avgCost: number; satisfaction: number; conversion: number };

const INITIAL: Variant[] = [
  { id: "A", name: "Variante A (controle)", prompt: "Você é um assistente útil. Responda de forma clara.", traffic: 50, runs: 1247, avgLatency: 820, avgCost: 0.0042, satisfaction: 78, conversion: 12.4 },
  { id: "B", name: "Variante B (challenger)", prompt: "Você é um especialista premium. Responda com clareza, exemplos práticos e sempre ofereça próximos passos.", traffic: 50, runs: 1183, avgLatency: 940, avgCost: 0.0058, satisfaction: 87, conversion: 18.7 },
];

export default function PromptABTestPage() {
  const [variants, setVariants] = useState<Variant[]>(INITIAL);
  const [running, setRunning] = useState(true);
  const [confidence, setConfidence] = useState(94.2);

  const winner = variants.reduce((a, b) => (b.conversion > a.conversion ? b : a));
  const lift = ((winner.conversion - variants.find(v => v.id !== winner.id)!.conversion) / variants.find(v => v.id !== winner.id)!.conversion * 100);

  const updateTraffic = (id: string, value: number[]) => {
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, traffic: value[0] } : { ...v, traffic: 100 - value[0] }));
  };

  const promote = (id: string) => {
    toast.success(`Variante ${id} promovida a 100%`, { description: "Rollout gradual será aplicado nas próximas 24h" });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="A/B Testing de Prompts"
        description="Experimente variações de prompts em produção com split traffic, métricas de qualidade e promoção automática do vencedor."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Status</div><div className="text-lg font-bold mt-1 flex items-center gap-2">{running ? <><div className="h-2 w-2 rounded-full bg-nexus-green animate-pulse" />Rodando</> : "Pausado"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total runs</div><div className="text-2xl font-bold">{variants.reduce((s, v) => s + v.runs, 0).toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Confiança estatística</div><div className="text-2xl font-bold text-nexus-green">{confidence}%</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Lift do vencedor</div><div className="text-2xl font-bold">+{lift.toFixed(1)}%</div></CardContent></Card>
      </div>

      <Card className="border-nexus-green/30 bg-nexus-green/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-nexus-green" />
            <div>
              <div className="text-sm font-semibold">Vencedor estatístico: Variante {winner.id}</div>
              <div className="text-xs text-muted-foreground mt-0.5">+{lift.toFixed(1)}% conversão · {confidence}% confiança · p-value &lt; 0.05</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRunning(!running)}>{running ? <><Pause className="h-4 w-4 mr-2" />Pausar</> : <><Play className="h-4 w-4 mr-2" />Retomar</>}</Button>
            <Button onClick={() => promote(winner.id)}><Zap className="h-4 w-4 mr-2" />Promover {winner.id}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {variants.map((v) => (
          <Card key={v.id} className={v.id === winner.id ? "border-nexus-green/50 shadow-[0_0_20px_hsl(var(--nexus-green)/0.15)]" : ""}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge className="text-[10px]">{v.id}</Badge>
                {v.name}
                {v.id === winner.id && <Trophy className="h-4 w-4 text-nexus-green" />}
              </CardTitle>
              <Badge variant="outline">{v.traffic}% tráfego</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea value={v.prompt} readOnly className="mt-1 text-xs h-20" />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5"><Label>Split traffic</Label><span className="text-muted-foreground">{v.traffic}%</span></div>
                <Slider value={[v.traffic]} onValueChange={(val) => updateTraffic(v.id, val)} min={0} max={100} step={5} disabled={!running} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Runs</div>
                  <div className="text-lg font-bold mt-0.5">{v.runs.toLocaleString("pt-BR")}</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Latência média</div>
                  <div className="text-lg font-bold mt-0.5">{v.avgLatency}ms</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Custo médio</div>
                  <div className="text-lg font-bold mt-0.5">${v.avgCost.toFixed(4)}</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Conversão</div>
                  <div className="text-lg font-bold mt-0.5 text-nexus-green">{v.conversion}%</div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1"><Label>Satisfação (CSAT)</Label><span className="font-semibold">{v.satisfaction}%</span></div>
                <Progress value={v.satisfaction} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Critérios de promoção automática</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-muted/30 rounded">
            <Label className="text-xs">Confiança mínima</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input type="number" defaultValue={95} className="h-7 w-20" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded">
            <Label className="text-xs">Mínimo de samples</Label>
            <Input type="number" defaultValue={1000} className="h-7 mt-1.5" />
          </div>
          <div className="p-3 bg-muted/30 rounded">
            <Label className="text-xs">Lift mínimo</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input type="number" defaultValue={5} className="h-7 w-20" />
              <span className="text-muted-foreground">%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
