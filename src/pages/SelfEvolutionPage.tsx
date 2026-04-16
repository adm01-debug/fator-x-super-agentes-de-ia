import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";

const skills = [
  { id: "s1", name: "Detectar pedidos B2B vs B2C", confidence: 0.94, success: 187, failure: 12, agent: "SDR Bot" },
  { id: "s2", name: "Negociar desconto 5-10%", confidence: 0.81, success: 64, failure: 15, agent: "Vendas Bot" },
  { id: "s3", name: "Identificar reclamação séria", confidence: 0.97, success: 412, failure: 8, agent: "SAC Bot" },
  { id: "s4", name: "Sugerir produto alternativo", confidence: 0.72, success: 89, failure: 34, agent: "SDR Bot" },
];

export default function SelfEvolutionPage() {
  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Agent Self-Evolution (ACE)
          </h1>
        </div>
        <p className="text-muted-foreground">
          Agentes que aprendem com experiência. Loop: Trace → Reflector → Skill Manager → Skillbook → injeção no prompt.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Skills aprendidas</p><p className="text-2xl font-bold">{skills.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Reflexões hoje</p><p className="text-2xl font-bold">47</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Confiança média</p><p className="text-2xl font-bold">86%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Δ performance (7d)</p><p className="text-2xl font-bold text-success">+12%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Loop ACE Ativo</CardTitle>
          <CardDescription>Agent → Environment → Trace → Reflector → SkillManager → Skillbook → Agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {["Agent", "Trace", "Reflector", "SkillManager", "Skillbook"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{s}</Badge>
                {i < 4 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Skillbook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {skills.map(s => (
            <div key={s.id} className="p-4 border border-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{s.name}</h4>
                  <p className="text-xs text-muted-foreground">{s.agent}</p>
                </div>
                <Badge variant={s.confidence > 0.9 ? "default" : s.confidence > 0.75 ? "secondary" : "outline"}>
                  conf {(s.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
              <Progress value={s.confidence * 100} className="h-1.5" />
              <div className="flex justify-between text-xs">
                <span className="text-success">✓ {s.success} sucessos</span>
                <span className="text-destructive">✗ {s.failure} falhas</span>
              </div>
            </div>
          ))}
          <Button className="w-full" onClick={() => toast.success("Reflector executado em 47 traces — 2 novas skills extraídas")}>
            <TrendingUp className="h-4 w-4 mr-2" />Executar Reflector Agora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
