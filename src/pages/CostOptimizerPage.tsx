import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingDown, DollarSign, Zap, Lightbulb, ArrowDown } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  savings: number;
  impact: "high" | "medium" | "low";
  applied: boolean;
}

const recs: Recommendation[] = [
  { id: "r1", title: "Trocar GPT-5 por GPT-5-mini em SDR Bot", description: "Tarefa simples, mini atinge 96% da qualidade", savings: 412.50, impact: "high", applied: false },
  { id: "r2", title: "Habilitar prompt caching no Oráculo", description: "85% das queries têm contexto repetido", savings: 287.20, impact: "high", applied: false },
  { id: "r3", title: "Reduzir max_tokens de 4k → 1k em classificação", description: "Outputs raramente passam de 200 tokens", savings: 124.80, impact: "medium", applied: true },
  { id: "r4", title: "Usar Gemini Flash Lite em pre-filter", description: "10x mais barato, suficiente para gates iniciais", savings: 198.40, impact: "high", applied: false },
  { id: "r5", title: "Batch embeddings em vez de single calls", description: "Reduz overhead de 40% no ingest", savings: 67.30, impact: "low", applied: false },
];

export default function CostOptimizerPage() {
  const totalSavings = recs.filter(r => !r.applied).reduce((s, r) => s + r.savings, 0);
  const monthlySpend = 3247.80;

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <TrendingDown className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Cost Optimizer AI
          </h1>
        </div>
        <p className="text-muted-foreground">
          Recomendações automáticas para reduzir custos de LLM sem perder qualidade. Análise contínua de padrões.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">Gasto mensal atual</span><DollarSign className="h-5 w-5 text-muted-foreground" /></div>
            <p className="text-3xl font-bold">${monthlySpend.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/40">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">Economia potencial</span><ArrowDown className="h-5 w-5 text-success" /></div>
            <p className="text-3xl font-bold text-success">${totalSavings.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{((totalSavings / monthlySpend) * 100).toFixed(1)}% redução</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2"><span className="text-sm text-muted-foreground">Score eficiência</span><Zap className="h-5 w-5 text-primary" /></div>
            <p className="text-3xl font-bold">7.2/10</p>
            <Progress value={72} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Recomendações Ativas</CardTitle>
          <CardDescription>Aplicar todas economiza ${totalSavings.toFixed(2)}/mês</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recs.map(r => (
            <div key={r.id} className={`p-4 border rounded-lg ${r.applied ? "border-success/30 bg-success/5" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{r.title}</h4>
                    <Badge variant={r.impact === "high" ? "default" : r.impact === "medium" ? "secondary" : "outline"}>{r.impact}</Badge>
                    {r.applied && <Badge className="bg-success">Aplicado</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </div>
                <div className="text-right space-y-2">
                  <p className="text-lg font-bold text-success">-${r.savings.toFixed(2)}/mês</p>
                  {!r.applied && (
                    <Button size="sm" onClick={() => toast.success(`"${r.title}" aplicado`)}>Aplicar</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
