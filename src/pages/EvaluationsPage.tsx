import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreateEvaluationDialog } from "@/components/dialogs/CreateEvaluationDialog";
import { EvaluationDatasetsPanel } from "@/components/evaluations/EvaluationDatasetsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EvaluationsPage() {
  const { data: evaluations = [], isLoading, refetch } = useQuery({
    queryKey: ['evaluation_runs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('evaluation_runs').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Evaluations Lab"
        description="Avalie agentes com métricas de factualidade, groundedness, sucesso e segurança"
        actions={<CreateEvaluationDialog onCreated={() => refetch()} />}
      />

      <InfoHint title="Por que avaliar agentes?">
        Avaliações sistemáticas detectam regressões, alucinações e falhas antes que cheguem aos usuários. Compare versões de prompts, modelos e configurações para garantir qualidade contínua.
      </InfoHint>

      <Tabs defaultValue="runs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runs">Execuções</TabsTrigger>
          <TabsTrigger value="datasets">Datasets & Test Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : evaluations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-nexus-purple/10 flex items-center justify-center mb-4">
                <FlaskConical className="h-8 w-8 text-nexus-purple" />
              </div>
              <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Nenhuma avaliação executada</h2>
              <p className="text-sm text-muted-foreground max-w-sm">Crie avaliações para testar seus agentes sistematicamente e detectar regressões.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((ev) => (
                <EvalCard key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="datasets">
          <EvaluationDatasetsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EvalCard({ ev }: { ev: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const results = ev.results as Record<string, any> | null;
  const cases = results?.cases as Array<{ input: string; expected: string; actual: string; passed: boolean; score?: number }> | undefined;
  const passRate = Number(ev.pass_rate ?? 0);
  const evName = String(ev.name ?? '');
  const testCases = Number(ev.test_cases ?? 0);
  const createdAt = String(ev.created_at ?? '');
  const completedAt = ev.completed_at ? String(ev.completed_at) : null;
  const evStatus = String(ev.status ?? 'queued');

  return (
    <div className="nexus-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{evName}</h3>
            <p className="text-[11px] text-muted-foreground">{testCases} test cases • {createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : ''}</p>
          </div>
        </div>
        <StatusBadge status={evStatus} />
      </div>

      {evStatus === 'completed' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="text-center rounded-lg bg-secondary/30 p-3">
              <p className={`text-lg font-heading font-bold ${passRate >= 80 ? 'text-nexus-emerald' : passRate >= 50 ? 'text-nexus-amber' : 'text-destructive'}`}>{passRate}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pass rate</p>
            </div>
            <div className="text-center rounded-lg bg-secondary/30 p-3">
              <p className="text-lg font-heading font-bold text-foreground">{testCases}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Test cases</p>
            </div>
            <div className="text-center rounded-lg bg-secondary/30 p-3">
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${passRate >= 80 ? 'bg-nexus-emerald' : passRate >= 50 ? 'bg-nexus-amber' : 'bg-destructive'}`}
                  style={{ width: `${passRate}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Score visual</p>
            </div>
            <div className="text-center rounded-lg bg-secondary/30 p-3">
              <p className="text-lg font-heading font-bold text-foreground">
                {completedAt && createdAt ? `${Math.round((new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 1000)}s` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Duração</p>
            </div>
          </div>

          {cases && cases.length > 0 && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 w-full justify-center"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? 'Ocultar detalhes' : `Ver ${cases.length} test cases`}
              </Button>
              {expanded && (
                <div className="mt-2 rounded-lg border border-border max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium text-muted-foreground w-8"></th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Input</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Esperado</th>
                        <th className="text-left p-2 font-medium text-muted-foreground">Obtido</th>
                        <th className="text-left p-2 font-medium text-muted-foreground w-16">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cases.map((c, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="p-2">
                            {c.passed
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-nexus-emerald" />
                              : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                          </td>
                          <td className="p-2 text-foreground truncate max-w-[180px]">{c.input}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[150px]">{c.expected}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[150px]">{c.actual}</td>
                          <td className="p-2">
                            <Badge variant={c.passed ? 'default' : 'destructive'} className="text-[10px]">
                              {c.score != null ? `${(c.score * 100).toFixed(0)}%` : c.passed ? 'Pass' : 'Fail'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {evStatus === 'running' && (
        <div className="flex items-center gap-2 mt-3">
          <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
            <div className="h-full w-2/5 rounded-full nexus-gradient-bg animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
