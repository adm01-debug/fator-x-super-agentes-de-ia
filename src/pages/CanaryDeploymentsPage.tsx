import { useState } from "react";
import { GitMerge, TrendingUp, AlertCircle, RotateCcw, ChevronUp, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

type Deployment = { version: string; traffic: number; status: "stable" | "canary" | "rolling-back"; errorRate: number; p95Latency: number; satisfaction: number };

export default function CanaryDeploymentsPage() {
  const [canaryTraffic, setCanaryTraffic] = useState([10]);
  const [autoPromote, setAutoPromote] = useState(true);

  const deployments: Deployment[] = [
    { version: "v3.2.1", traffic: 100 - canaryTraffic[0], status: "stable", errorRate: 0.2, p95Latency: 820, satisfaction: 87 },
    { version: "v3.3.0-rc1", traffic: canaryTraffic[0], status: "canary", errorRate: 0.1, p95Latency: 740, satisfaction: 91 },
  ];

  const canary = deployments[1];
  const stable = deployments[0];
  const isCanaryHealthy = canary.errorRate <= stable.errorRate * 1.5 && canary.p95Latency <= stable.p95Latency * 1.2;

  const promote = () => {
    setCanaryTraffic([100]);
    toast.success("v3.3.0-rc1 promovido a 100%", { description: "Rollout completo. Versão anterior arquivada." });
  };

  const rollback = () => {
    setCanaryTraffic([0]);
    toast.error("Rollback executado", { description: "Tráfego retornou para v3.2.1" });
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Canary Deployments"
        description="Deploy gradual com rollback automático. Compare métricas entre versão estável e canary em tempo real."
      />

      <Card className={isCanaryHealthy ? "border-nexus-green/30 bg-nexus-green/5" : "border-nexus-red/30 bg-nexus-red/5"}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isCanaryHealthy ? <CheckCircle2 className="h-8 w-8 text-nexus-green" /> : <AlertCircle className="h-8 w-8 text-nexus-red" />}
            <div>
              <div className="text-sm font-semibold">
                {isCanaryHealthy ? "Canary saudável — pronto para promover" : "Canary degradado — recomenda rollback"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Error rate: {canary.errorRate}% (vs {stable.errorRate}%) · Latência p95: {canary.p95Latency}ms (vs {stable.p95Latency}ms)
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={rollback}><RotateCcw className="h-4 w-4 mr-2" />Rollback</Button>
            <Button onClick={promote} disabled={!isCanaryHealthy}><ChevronUp className="h-4 w-4 mr-2" />Promover</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><GitMerge className="h-4 w-4" />Distribuição de tráfego</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span>Stable v3.2.1: <span className="font-bold">{100 - canaryTraffic[0]}%</span></span>
              <span>Canary v3.3.0-rc1: <span className="font-bold text-primary">{canaryTraffic[0]}%</span></span>
            </div>
            <Slider value={canaryTraffic} onValueChange={setCanaryTraffic} min={0} max={100} step={5} />
            <div className="flex gap-1 mt-3">
              {[1, 5, 10, 25, 50, 100].map((p) => (
                <Button key={p} size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setCanaryTraffic([p])}>
                  {p}%
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded text-xs">
            <span>Auto-promote se canary saudável por &gt; 30 min</span>
            <Button size="sm" variant={autoPromote ? "default" : "outline"} onClick={() => setAutoPromote(!autoPromote)}>
              {autoPromote ? "Ativado" : "Desativado"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deployments.map((d) => (
          <Card key={d.version} className={d.status === "canary" ? "border-primary/40" : ""}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />{d.version}
                <Badge variant={d.status === "stable" ? "default" : "outline"} className="text-[10px] capitalize">{d.status}</Badge>
              </CardTitle>
              <div className="text-2xl font-bold">{d.traffic}%</div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">Error rate</div>
                  <div className={`text-lg font-bold mt-0.5 ${d.errorRate > 1 ? "text-nexus-red" : "text-nexus-green"}`}>{d.errorRate}%</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">p95</div>
                  <div className="text-lg font-bold mt-0.5">{d.p95Latency}ms</div>
                </div>
                <div className="p-2.5 bg-muted/30 rounded">
                  <div className="text-muted-foreground">CSAT</div>
                  <div className="text-lg font-bold mt-0.5">{d.satisfaction}%</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span>Saúde geral</span><span className="font-semibold">{d.satisfaction}%</span></div>
                <Progress value={d.satisfaction} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Critérios de rollback automático</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          {[
            "Error rate > 2× versão estável por 5 min consecutivos",
            "p95 latency > 1.5× versão estável por 10 min",
            "CSAT cai mais de 10 pontos vs estável",
            "Tool call failure rate > 5%",
            "Custo médio por request aumenta > 30%",
          ].map((c) => (
            <div key={c} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <CheckCircle2 className="h-3.5 w-3.5 text-nexus-green shrink-0" />
              <span>{c}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
