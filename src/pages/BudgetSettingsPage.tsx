/**
 * BudgetSettingsPage — configure workspace budget limits and view event history.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, AlertTriangle, RotateCcw, ShieldOff, Info } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceId } from "@/hooks/use-data";
import { budgetService, type BudgetEvent } from "@/services/budgetService";

const EVENT_LABEL: Record<BudgetEvent["event_type"], { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  soft_warning: { text: "Aviso", variant: "secondary" },
  hard_block: { text: "Bloqueio", variant: "destructive" },
  agent_paused: { text: "Agentes pausados", variant: "destructive" },
  reset: { text: "Reset", variant: "outline" },
};

export default function BudgetSettingsPage() {
  const qc = useQueryClient();
  const { data: workspaceId } = useWorkspaceId();

  const [monthly, setMonthly] = useState("");
  const [daily, setDaily] = useState("");
  const [hardStop, setHardStop] = useState(false);
  const [threshold, setThreshold] = useState(80);
  const [emails, setEmails] = useState("");

  const { data: budget } = useQuery({
    queryKey: ["budget", workspaceId],
    queryFn: () => budgetService.getBudget(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: status } = useQuery({
    queryKey: ["budget-status", workspaceId],
    queryFn: () => budgetService.checkBudget(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["budget-events", workspaceId],
    queryFn: () => budgetService.listEvents(workspaceId!),
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (budget) {
      setMonthly(budget.monthly_limit_usd?.toString() ?? "");
      setDaily(budget.daily_limit_usd?.toString() ?? "");
      setHardStop(budget.hard_stop);
      setThreshold(budget.soft_threshold_pct);
      setEmails(budget.notify_emails.join(", "));
    }
  }, [budget]);

  const saveMutation = useMutation({
    mutationFn: () =>
      budgetService.upsertBudget(workspaceId!, {
        monthly_limit_usd: monthly ? Number(monthly) : null,
        daily_limit_usd: daily ? Number(daily) : null,
        hard_stop: hardStop,
        soft_threshold_pct: threshold,
        notify_emails: emails.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Orçamento salvo");
      qc.invalidateQueries({ queryKey: ["budget", workspaceId] });
      qc.invalidateQueries({ queryKey: ["budget-status", workspaceId] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => budgetService.resetBudget(workspaceId!),
    onSuccess: () => {
      toast.success("Orçamento reiniciado — agentes reativados");
      qc.invalidateQueries({ queryKey: ["budget-events", workspaceId] });
      qc.invalidateQueries({ queryKey: ["budget-status", workspaceId] });
    },
  });

  const monthlyPct = Number(status?.monthly_pct ?? 0);
  const dailyPct = Number(status?.daily_pct ?? 0);
  const monthlyColor = monthlyPct >= 100 ? "text-destructive" : monthlyPct >= threshold ? "text-warning" : "text-success";
  const dailyColor = dailyPct >= 100 ? "text-destructive" : dailyPct >= threshold ? "text-warning" : "text-success";

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center gap-3">
        <Wallet className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold gradient-text">Orçamento</h1>
          <p className="text-muted-foreground">Configure limites de gasto e bloqueio automático</p>
        </div>
      </div>

      {status?.configured && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gasto mensal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-bold ${monthlyColor}`}>
                  ${Number(status.monthly_spend ?? 0).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / ${Number(status.monthly_limit ?? 0).toFixed(2)}
                </span>
              </div>
              <Progress value={Math.min(monthlyPct, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">{monthlyPct.toFixed(1)}% utilizado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gasto diário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-bold ${dailyColor}`}>
                  ${Number(status.daily_spend ?? 0).toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / ${Number(status.daily_limit ?? 0).toFixed(2)}
                </span>
              </div>
              <Progress value={Math.min(dailyPct, 100)} className="h-2" />
              <p className="text-xs text-muted-foreground">{dailyPct.toFixed(1)}% utilizado</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Limites</CardTitle>
          <CardDescription>Defina limites mensal e diário em USD. Deixe em branco para desativar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monthly">Limite mensal (USD)</Label>
              <Input id="monthly" type="number" step="0.01" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="ex: 100.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily">Limite diário (USD)</Label>
              <Input id="daily" type="number" step="0.01" min="0" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="ex: 10.00" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Limiar de aviso suave</Label>
              <Badge variant="outline">{threshold}%</Badge>
            </div>
            <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={50} max={99} step={5} />
            <p className="text-xs text-muted-foreground">Ao atingir esta porcentagem, um aviso é emitido.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <ShieldOff className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <Label className="text-base">Bloqueio rígido (hard stop)</Label>
                <p className="text-sm text-muted-foreground">Ao atingir 100%, bloqueia chamadas e pausa agentes ativos.</p>
              </div>
            </div>
            <Switch checked={hardStop} onCheckedChange={setHardStop} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emails">E-mails para notificação (separados por vírgula)</Label>
            <Input id="emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="finance@company.com, ops@company.com" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar orçamento"}
            </Button>
            {status?.configured && (
              <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Resetar e reativar agentes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Histórico de eventos
          </CardTitle>
          <CardDescription>Avisos, bloqueios e resets recentes.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Info className="h-4 w-4" />
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((e) => {
                const meta = EVENT_LABEL[e.event_type];
                return (
                  <div key={e.id} className="flex items-center justify-between border-b last:border-b-0 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={meta.variant}>{meta.text}</Badge>
                      <span className="text-sm">
                        ${Number(e.period_spend_usd).toFixed(2)} / ${Number(e.period_limit_usd).toFixed(2)} ({e.pct_used}%)
                      </span>
                      <span className="text-xs text-muted-foreground">{e.period === "daily" ? "diário" : "mensal"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(e.triggered_at).toLocaleString("pt-BR")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
