import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot, Loader2, GitCompare, GitBranch, Activity, Bell, Play, Undo2, AlertTriangle, MessageSquare, Wrench, Cpu } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getAgentById, getAgentVersions, getAgentDetailTraces, restoreAgentVersion, type AgentTrace, type AgentVersion } from "@/services/agentsService";
import { VersionDiffDialog } from "@/components/agents/VersionDiffDialog";
import { AgentCardViewer } from "@/components/agents/AgentCardViewer";
import { AgentRichMetrics } from "@/components/agents/detail/AgentRichMetrics";
import { SimulationResultDialog } from "@/components/agents/detail/SimulationResultDialog";
import { SavedTestRunsPanel } from "@/components/agents/detail/SavedTestRunsPanel";
import { RestoreDiffPreview } from "@/components/agents/detail/RestoreDiffPreview";
import { BehaviorImpactPanel } from "@/components/agents/detail/BehaviorImpactPanel";
import { RestoreChangelogEditor, buildAutoSummary } from "@/components/agents/detail/RestoreChangelogEditor";
import { RestoreSummaryShare } from "@/components/agents/detail/RestoreSummaryShare";
import { computeRestoreDiff } from "@/components/agents/detail/restoreDiffHelpers";
import { validateRestore } from "@/components/agents/detail/restoreValidation";
import { RestoreValidationPanel } from "@/components/agents/detail/RestoreValidationPanel";
import { RestoreHistorySection } from "@/components/agents/detail/RestoreHistorySection";
import { RestorePresetMenu } from "@/components/agents/detail/RestorePresetMenu";
import { simulateAgentRun, type SimulationSummary } from "@/services/agentTestSimulationService";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const [simOpen, setSimOpen] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simSummary, setSimSummary] = useState<SimulationSummary | null>(null);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => getAgentById(id!),
    enabled: !!id,
  });

  // Abre o diálogo sem rodar — o usuário decide o prompt e dispara dentro do modal.
  const handleOpenSimulator = () => {
    if (!agent || !id) return;
    setSimSummary(null);
    setSimOpen(true);
  };

  const handleRunSimulation = async (customInput: string, count: number) => {
    if (!agent || !id) return;
    setSimRunning(true);
    setSimSummary(null);
    try {
      let traces = queryClient.getQueryData<AgentTrace[]>(['agent_traces_rich', id]) ?? [];
      if (traces.length === 0) {
        traces = await queryClient.fetchQuery({
          queryKey: ['agent_traces_rich', id],
          queryFn: () => getAgentDetailTraces(id, 200),
        });
      }
      // Escala o "tempo de simulação" levemente com a contagem para dar feedback visual.
      const delay = Math.min(2000, 600 + count * 30);
      setTimeout(() => {
        const summary = simulateAgentRun(
          { id: agent.id, name: agent.name, model: agent.model },
          traces,
          count,
          { customInput },
        );
        setSimSummary(summary);
        setSimRunning(false);
        toast.success(`Simulação concluída: ${summary.passed}/${summary.total} aprovadas`);
      }, delay);
    } catch (e) {
      setSimRunning(false);
      toast.error(e instanceof Error ? e.message : 'Erro ao simular');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!agent || error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Agente não encontrado</h2>
        <p className="text-sm text-muted-foreground mb-4">O agente pode ter sido removido.</p>
        <Button onClick={() => navigate('/agents')}>Voltar para agentes</Button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title={agent.name}
        description={agent.mission || 'Sem descrição'}
        backTo="/agents"
        actions={
          <div className="flex items-center gap-2">
            <AgentCardViewer agentId={agent.id} agentName={agent.name} />
            <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}/traces`)}>
              <Activity className="h-3.5 w-3.5 mr-1.5" /> Ver traces
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}/alerts`)}>
              <Bell className="h-3.5 w-3.5 mr-1.5" /> Alertas
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenSimulator} disabled={simRunning}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Simular run
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/builder/${agent.id}`)}>
              Editar no Builder
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
          {agent.avatar_emoji || '🤖'}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <StatusBadge status={agent.status || 'draft'} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{String(agent.model ?? '')}</span>
            <span>•</span>
            <span>{String(agent.persona ?? '')}</span>
            <span>•</span>
            <span>v{String(agent.version ?? '')}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Configuração</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="text-foreground">{String(agent.model ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Persona</span><span className="text-foreground">{String(agent.persona ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Raciocínio</span><span className="text-foreground">{String(agent.reasoning ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Versão</span><span className="text-foreground">v{String(agent.version ?? '')}</span></div>
          </div>
        </div>
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {(agent.tags ?? []).map(tag => (
              <span key={tag} className="nexus-badge-primary">{tag}</span>
            ))}
            {(agent.tags ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag</p>}
          </div>
        </div>
      </div>

      {/* Agent Metrics — rich panel with charts, SLO and daily history */}
      <AgentRichMetrics agentId={id!} agentName={agent.name} days={14} />
      <SavedTestRunsPanel agentId={id!} agentName={agent.name} />
      <VersionHistory agentId={id!} />

      <SimulationResultDialog
        open={simOpen}
        onOpenChange={setSimOpen}
        summary={simSummary}
        running={simRunning}
        onRun={handleRunSimulation}
        agentName={agent.name}
        agentId={id}
      />
    </div>
  );
}

function VersionHistory({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [diffOpen, setDiffOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  // Granular: usuário escolhe quais grupos copiar do snapshot anterior.
  const [copyPrompt, setCopyPrompt] = useState(true);
  const [copyTools, setCopyTools] = useState(true);
  const [copyModel, setCopyModel] = useState(true);
  // Garante que o preset padrão é aplicado apenas uma vez por abertura — evita
  // sobrescrever ajustes manuais que o usuário fez depois.
  const [presetAutoApplied, setPresetAutoApplied] = useState(false);
  // Changelog editável: texto controlado + flag indicando se foi customizado.
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryEdited, setSummaryEdited] = useState(false);

  // Reset das opções a cada abertura do diálogo. O default volta para "tudo
  // marcado" — se o usuário tiver um preset padrão, o `RestorePresetMenu` o
  // aplica automaticamente via `onPresetsLoaded` assim que a query resolver.
  useEffect(() => {
    if (rollbackOpen) {
      setCopyPrompt(true);
      setCopyTools(true);
      setCopyModel(true);
      setSummaryEdited(false);
      setSummaryDraft("");
      setPresetAutoApplied(false);
    }
  }, [rollbackOpen]);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['agent_versions', agentId],
    queryFn: () => getAgentVersions(agentId, 20),
  });

  const current: AgentVersion | undefined = versions[0];
  const previous: AgentVersion | undefined = versions[1];
  const nextVersionNumber = (current?.version ?? 0) + 1;

  const restoreOptions = { copyPrompt, copyTools, copyModel };
  const hasAnyOptionSelected = copyPrompt || copyTools || copyModel;

  // Diff calculado uma vez para alimentar tanto o preview quanto o changelog.
  const restoreDiff = previous && current && hasAnyOptionSelected
    ? computeRestoreDiff(current, previous, restoreOptions)
    : null;

  // Validação pré-restore — corre sempre que houver origem; bloqueia confirmação
  // se algum erro estrutural/incompatibilidade for detectado no estado pós-merge.
  const validation = previous
    ? validateRestore(current, previous, restoreOptions)
    : null;
  const restoreBlocked = !!validation?.blocked;

  const rollbackMut = useMutation({
    mutationFn: () => restoreAgentVersion(agentId, previous!, current, {
      ...restoreOptions,
      // Só envia override se o usuário realmente customizou e o texto difere do auto.
      customSummary: summaryEdited && summaryDraft.trim() && summaryDraft.trim() !== buildAutoSummary(previous!.version, restoreOptions)
        ? summaryDraft.trim()
        : undefined,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent_versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      setRollbackOpen(false);
      // Toast com ação para abrir a timeline já destacando a nova versão.
      toast.success(`Rollback concluído — v${data.version} criada a partir de v${previous!.version}`, {
        action: {
          label: 'Ver na timeline',
          onClick: () => navigate(`/agents/${agentId}/versions?focus=${data.id}`),
        },
        duration: 6000,
      });
    },
    onError: (e: Error) => toast.error(e.message || 'Falha no rollback'),
  });

  if (isLoading || versions.length === 0) return null;

  const canRollback = !!previous && !!current;

  return (
    <>
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Histórico de Versões</h3>
        <div className="flex items-center gap-1.5">
          {canRollback && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-nexus-amber/40 text-nexus-amber hover:bg-nexus-amber/10 hover:text-nexus-amber"
              onClick={() => setRollbackOpen(true)}
              disabled={rollbackMut.isPending}
              title={`Restaurar v${previous.version} criando v${nextVersionNumber}`}
            >
              {rollbackMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
              Rollback v{previous.version}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => navigate(`/agents/${agentId}/versions`)}>
            <GitBranch className="h-3 w-3" /> Gerenciar versões
          </Button>
          {versions.length >= 2 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setDiffOpen(true)}>
              <GitCompare className="h-3 w-3" /> Comparar
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {versions.map((v, i) => (
          <div key={v.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'}`}>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-foreground">v{v.version}</span>
              <span className="text-muted-foreground">{String(v.model ?? '')}</span>
              {v.change_summary && <span className="text-muted-foreground truncate max-w-[200px]">{String(v.change_summary)}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">{new Date(v.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))}
      </div>
      <VersionDiffDialog open={diffOpen} onOpenChange={setDiffOpen} agentId={agentId} versions={versions as unknown as Array<{ id: string; version: number; model: string | null; persona: string | null; mission: string | null; config: Record<string, unknown>; change_summary: string | null; created_at: string }>} />

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-nexus-amber" aria-hidden />
              Rollback rápido para v{previous?.version}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Será criada uma nova versão <span className="font-mono font-semibold text-foreground">v{nextVersionNumber}</span>{' '}
                  copiando os campos selecionados de{' '}
                  <span className="font-mono font-semibold text-foreground">v{previous?.version}</span>.
                </p>
                <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Atual</span>
                    <span className="font-mono text-foreground">v{current?.version} · {String(current?.model ?? '—')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem do rollback</span>
                    <span className="font-mono text-foreground">v{previous?.version} · {String(previous?.model ?? '—')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nova versão</span>
                    <span className="font-mono text-nexus-emerald">v{nextVersionNumber}</span>
                  </div>
                </div>

                {/* Seleção granular de campos a copiar — desmarcar tudo bloqueia o rollback */}
                <fieldset className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <legend className="text-[11px] font-semibold uppercase tracking-wider text-foreground p-0">
                      Campos a copiar
                    </legend>
                    {/* Presets: aplica/salva combinações em 1 clique. O onPresetsLoaded
                        roda só uma vez por abertura para auto-aplicar o default. */}
                    <RestorePresetMenu
                      current={restoreOptions}
                      onApply={(p) => {
                        setCopyPrompt(p.copyPrompt);
                        setCopyTools(p.copyTools);
                        setCopyModel(p.copyModel);
                      }}
                      onPresetsLoaded={(list) => {
                        if (presetAutoApplied) return;
                        setPresetAutoApplied(true);
                        const def = list.find((p) => p.is_default);
                        if (def) {
                          setCopyPrompt(def.copy_prompt);
                          setCopyTools(def.copy_tools);
                          setCopyModel(def.copy_model);
                        }
                      }}
                      disabled={rollbackMut.isPending}
                    />
                  </div>
                  <RestoreOptionRow
                    id="opt-prompt"
                    icon={MessageSquare}
                    label="Prompt"
                    description="System prompt, prompt legado e missão"
                    checked={copyPrompt}
                    onChange={setCopyPrompt}
                    disabled={rollbackMut.isPending}
                  />
                  <RestoreOptionRow
                    id="opt-tools"
                    icon={Wrench}
                    label="Ferramentas"
                    description="Lista de tools/functions ativas"
                    checked={copyTools}
                    onChange={setCopyTools}
                    disabled={rollbackMut.isPending}
                  />
                  <RestoreOptionRow
                    id="opt-model"
                    icon={Cpu}
                    label="Modelo & parâmetros"
                    description="Modelo, persona, temperature, max_tokens, reasoning"
                    checked={copyModel}
                    onChange={setCopyModel}
                    disabled={rollbackMut.isPending}
                  />
                  {!hasAnyOptionSelected && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
                    >
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
                      <span>Selecione ao menos um campo para restaurar — sem nada marcado o rollback não tem efeito.</span>
                    </div>
                  )}
                </fieldset>

                {/* Validação pré-restore — sempre visível quando há origem e ao menos
                    um campo marcado, para que o usuário veja erros antes de tudo. */}
                {previous && hasAnyOptionSelected && validation && (
                  <RestoreValidationPanel validation={validation} />
                )}

                {previous && hasAnyOptionSelected && restoreDiff && (
                  <>
                    <RestoreDiffPreview
                      current={current}
                      source={previous}
                      options={restoreOptions}
                    />
                    {/* Impacto operacional — traduz a diff de configuração em
                        consequências reais (sessões afetadas, tools em uso,
                        métricas de modelo) puxando traces dos últimos 7d. */}
                    <BehaviorImpactPanel
                      agentId={agentId}
                      diff={restoreDiff}
                      options={restoreOptions}
                    />
                    <RestoreChangelogEditor
                      sourceVersion={previous.version}
                      nextVersion={nextVersionNumber}
                      diff={restoreDiff}
                      options={restoreOptions}
                      value={summaryDraft}
                      onChange={setSummaryDraft}
                      edited={summaryEdited}
                      onEditedChange={setSummaryEdited}
                      disabled={rollbackMut.isPending}
                    />
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Nenhum histórico será apagado — o rollback é não destrutivo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); rollbackMut.mutate(); }}
              disabled={rollbackMut.isPending || !hasAnyOptionSelected || restoreBlocked}
              className="gap-1.5"
              title={
                !hasAnyOptionSelected ? 'Selecione ao menos um campo'
                : restoreBlocked ? `Resolva ${validation?.errors.length ?? 0} erro(s) de validação para continuar`
                : undefined
              }
            >
              {rollbackMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
              {restoreBlocked ? 'Bloqueado por validação' : 'Confirmar rollback'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    <RestoreHistorySection agentId={agentId} versions={versions as AgentVersion[]} />
    </>
  );
}

interface RestoreOptionRowProps {
  id: string;
  icon: typeof MessageSquare;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

function RestoreOptionRow({ id, icon: Icon, label, description, checked, onChange, disabled }: RestoreOptionRowProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-xs cursor-pointer transition-colors ${
        checked
          ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
          : 'border-border bg-background/40 hover:bg-secondary/40'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${checked ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
      </div>
    </label>
  );
}
