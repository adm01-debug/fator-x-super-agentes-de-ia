import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Network, Shield, Users, Activity } from "lucide-react";
import { toast } from "sonner";

const nodes = [
  { id: "n1", name: "Cliente A — São Paulo", samples: 4521, accuracy: 0.89, status: "training" },
  { id: "n2", name: "Cliente B — Rio de Janeiro", samples: 3210, accuracy: 0.91, status: "completed" },
  { id: "n3", name: "Cliente C — Belo Horizonte", samples: 2105, accuracy: 0.87, status: "completed" },
  { id: "n4", name: "Cliente D — Curitiba", samples: 1890, accuracy: 0.85, status: "pending" },
];

export default function FederatedLearningPage() {
  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Network className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Federated Learning
          </h1>
        </div>
        <p className="text-muted-foreground">
          Treinamento distribuído sem mover dados sensíveis. LGPD-compliant para clientes enterprise.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Nós ativos</p><p className="text-2xl font-bold">4</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Samples totais</p><p className="text-2xl font-bold">11.7K</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Acurácia global</p><p className="text-2xl font-bold">88.5%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Round atual</p><p className="text-2xl font-bold">7/20</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-success" />Privacidade Diferencial</CardTitle>
          <CardDescription>ε = 1.5 — Garantia formal de privacidade. Dados nunca saem do cliente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={75} />
          <p className="text-xs text-muted-foreground mt-2">Budget de privacidade: 75% restante</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Nós Federados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {nodes.map(n => (
            <div key={n.id} className="p-4 border border-border rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold">{n.name}</p>
                <p className="text-xs text-muted-foreground">{n.samples.toLocaleString()} samples • acurácia local {(n.accuracy * 100).toFixed(0)}%</p>
              </div>
              <Badge variant={n.status === "completed" ? "default" : n.status === "training" ? "secondary" : "outline"}>
                <Activity className="h-3 w-3 mr-1" />{n.status}
              </Badge>
            </div>
          ))}
          <Button className="w-full" onClick={() => toast.success("Iniciando próximo round de agregação")}>Iniciar Round #8</Button>
        </CardContent>
      </Card>
    </div>
  );
}
