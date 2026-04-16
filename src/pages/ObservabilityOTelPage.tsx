import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, AlertCircle, Clock, Zap } from "lucide-react";
import { toast } from "sonner";

const spans = [
  { id: "s1", name: "POST /agent/chat", duration: 1247, status: "ok", spans: 14 },
  { id: "s2", name: "supabase.rpc(search)", duration: 87, status: "ok", spans: 1 },
  { id: "s3", name: "openai.completion", duration: 892, status: "ok", spans: 1 },
  { id: "s4", name: "tool.web_search", duration: 2341, status: "warn", spans: 3 },
];

export default function ObservabilityOTelPage() {
  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Observability — OpenTelemetry
          </h1>
        </div>
        <p className="text-muted-foreground">
          GenAI Semantic Conventions completas. Export para Jaeger, Honeycomb, Datadog, Grafana Tempo.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Spans/min</p><p className="text-2xl font-bold">2.4K</p></div><Zap className="h-6 w-6 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">p95 latency</p><p className="text-2xl font-bold">847ms</p></div><Clock className="h-6 w-6 text-primary opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Error rate</p><p className="text-2xl font-bold">0.42%</p></div><AlertCircle className="h-6 w-6 text-warning opacity-50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Throughput</p><p className="text-2xl font-bold">+18%</p></div><TrendingUp className="h-6 w-6 text-success opacity-50" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Exporters Configurados</CardTitle><CardDescription>OTLP/gRPC para múltiplos backends</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {[
            { name: "Jaeger", endpoint: "jaeger.nexus.local:14250", status: "active" },
            { name: "Honeycomb", endpoint: "api.honeycomb.io:443", status: "active" },
            { name: "Grafana Tempo", endpoint: "tempo-prod-04.grafana.net:443", status: "paused" },
            { name: "Datadog", endpoint: "trace.agent.datadoghq.com", status: "inactive" },
          ].map(e => (
            <div key={e.name} className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <p className="font-semibold">{e.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{e.endpoint}</p>
              </div>
              <Badge variant={e.status === "active" ? "default" : e.status === "paused" ? "secondary" : "outline"}>{e.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Trace Recente — agent.execute</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {spans.map(s => (
            <div key={s.id} className="p-3 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm">{s.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "ok" ? "default" : "secondary"}>{s.duration}ms</Badge>
                  <Badge variant="outline">{s.spans} spans</Badge>
                </div>
              </div>
              <div className="h-1 bg-muted rounded overflow-hidden">
                <div className={`h-full ${s.status === "ok" ? "bg-primary" : "bg-warning"}`} style={{ width: `${Math.min(100, s.duration / 30)}%` }} />
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => toast.info("Abrindo no Jaeger UI")}>Ver no Jaeger →</Button>
        </CardContent>
      </Card>
    </div>
  );
}
