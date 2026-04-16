import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Database, Cloud, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const backups = [
  { id: "b1", date: "2026-04-16 03:00 UTC", size: "2.4 GB", type: "incremental", status: "success", region: "us-east-1" },
  { id: "b2", date: "2026-04-15 03:00 UTC", size: "2.3 GB", type: "incremental", status: "success", region: "us-east-1" },
  { id: "b3", date: "2026-04-14 03:00 UTC", size: "12.1 GB", type: "full", status: "success", region: "us-east-1" },
  { id: "b4", date: "2026-04-13 03:00 UTC", size: "2.2 GB", type: "incremental", status: "success", region: "us-east-1" },
];

export default function DisasterRecoveryPage() {
  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Disaster Recovery & Backups
          </h1>
        </div>
        <p className="text-muted-foreground">
          RPO 5min, RTO 15min. Multi-region replication, point-in-time recovery, automatic failover.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-success" /><p className="text-sm text-muted-foreground">RPO atual</p></div>
            <p className="text-2xl font-bold">3min</p>
            <p className="text-xs text-muted-foreground">Meta: 5min ✓</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-success" /><p className="text-sm text-muted-foreground">RTO atual</p></div>
            <p className="text-2xl font-bold">12min</p>
            <p className="text-xs text-muted-foreground">Meta: 15min ✓</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><Database className="h-4 w-4 text-primary" /><p className="text-sm text-muted-foreground">Backups (30d)</p></div>
            <p className="text-2xl font-bold">30</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><Cloud className="h-4 w-4 text-primary" /><p className="text-sm text-muted-foreground">Regiões</p></div>
            <p className="text-2xl font-bold">3</p>
            <p className="text-xs text-muted-foreground">us-east, eu-west, sa-east</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />Failover Drill</CardTitle>
          <CardDescription>Último teste: há 12 dias — Próximo agendado: em 3 dias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm mb-1"><span>Saúde da replicação</span><span className="font-bold">98%</span></div>
            <Progress value={98} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => toast.info("Iniciando drill — não afeta produção")}>Run Failover Drill</Button>
            <Button variant="destructive" onClick={() => toast.error("Confirmação dupla necessária")}>Failover Real (Emergência)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Backups Recentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {backups.map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <p className="font-mono text-sm">{b.date}</p>
                <p className="text-xs text-muted-foreground">{b.size} • {b.region}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.type === "full" ? "default" : "secondary"}>{b.type}</Badge>
                <CheckCircle2 className="h-5 w-5 text-success" />
                <Button size="sm" variant="outline" onClick={() => toast.info(`Restaurando snapshot de ${b.date}`)}>Restore</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
