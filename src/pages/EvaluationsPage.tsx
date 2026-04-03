import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { FlaskConical, Loader2 } from "lucide-react";
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
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
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
              <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma avaliação executada</h2>
              <p className="text-sm text-muted-foreground">Crie avaliações para testar seus agentes sistematicamente.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {evaluations.map((ev) => (
                <div key={ev.id} className="nexus-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FlaskConical className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{ev.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{ev.test_cases ?? 0} test cases • {new Date(ev.created_at!).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <StatusBadge status={ev.status || 'queued'} />
                  </div>
                  {ev.status === 'completed' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                      <div className="text-center rounded-lg bg-secondary/30 p-3">
                        <p className="text-lg font-heading font-bold text-nexus-emerald">{ev.pass_rate ?? 0}%</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Pass rate</p>
                      </div>
                      <div className="text-center rounded-lg bg-secondary/30 p-3">
                        <p className="text-lg font-heading font-bold text-foreground">{ev.test_cases ?? 0}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Test cases</p>
                      </div>
                    </div>
                  )}
                  {ev.status === 'running' && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full w-2/5 rounded-full nexus-gradient-bg animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>
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
