import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save, GitBranch, CheckCircle, AlertTriangle,
  RotateCcw, Trash2, Loader2, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";
import {
  getAgentBasic,
  listPromptVersions,
  createPromptVersion,
  updatePromptVersion,
  deletePromptVersion,
  restorePromptVersion,
} from "@/services/promptVersionService";

export default function PromptEditorPage() {
  const { id: agentId } = useParams();
  const queryClient = useQueryClient();

  const { data: agent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgentBasic(agentId!),
    enabled: !!agentId,
  });

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["prompt_versions", agentId],
    queryFn: () => listPromptVersions(agentId!),
    enabled: !!agentId,
  });

  const activeVersion = versions.find((v: any) => v.is_active) || versions[0];

  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [activeTab, setActiveTab] = useState("editor");
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (activeVersion) {
      setContent(activeVersion.content);
      setSummary("");
      setDirty(false);
    }
  }, [activeVersion?.id]);

  const handleContentChange = (val: string) => {
    setContent(val);
    setDirty(true);
  };

  const createVersionMut = useMutation({
    mutationFn: () => createPromptVersion({
      agentId: agentId!,
      content: content.trim(),
      changeSummary: summary.trim(),
      nextVersion: (versions[0]?.version || 0) + 1,
    }),
    onSuccess: () => {
      toast.success("Nova versão salva!");
      setDirty(false);
      setSummary("");
      queryClient.invalidateQueries({ queryKey: ["prompt_versions", agentId] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar"),
  });

  const updateVersionMut = useMutation({
    mutationFn: (versionId: string) => updatePromptVersion(versionId, content.trim()),
    onSuccess: () => {
      toast.success("Versão atualizada!");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["prompt_versions", agentId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const deleteVersionMut = useMutation({
    mutationFn: deletePromptVersion,
    onSuccess: () => {
      toast.success("Versão removida");
      queryClient.invalidateQueries({ queryKey: ["prompt_versions", agentId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const restoreVersionMut = useMutation({
    mutationFn: (version: typeof versions[0]) => restorePromptVersion(agentId!, version.id),
    onSuccess: () => {
      toast.success("Versão restaurada!");
      setDiffVersionId(null);
      queryClient.invalidateQueries({ queryKey: ["prompt_versions", agentId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const computeScore = useCallback((text: string) => {
    const lower = text.toLowerCase();
    return {
      clarity: text.length > 50,
      scope: lower.includes("pode") || lower.includes("não pode") || lower.includes("escopo"),
      tools: lower.includes("tool") || lower.includes("ferramenta") || lower.includes("search") || lower.includes("api"),
      format: lower.includes("formato") || lower.includes("markdown") || lower.includes("json"),
      safety: lower.includes("segurança") || lower.includes("não revele") || lower.includes("regra"),
      examples: lower.includes("exemplo") || lower.includes("user:") || lower.includes("assistant:"),
      fallback: lower.includes("fallback") || lower.includes("escalar") || lower.includes("não souber"),
    };
  }, []);

  const score = computeScore(content);
  const scoreItems = Object.entries(score);
  const scorePercent = Math.round((scoreItems.filter(([, v]) => v).length / scoreItems.length) * 100);
  const diffVersion = versions.find((v: any) => v.id === diffVersionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title={`${agent?.avatar_emoji || '📝'} ${agent?.name || "Prompt Editor"}`}
        description={`${versions.length} versão(ões) • Editor com versionamento completo`}
        backTo="/prompts"
        actions={
          <div className="flex items-center gap-2">
            {activeVersion && dirty && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                onClick={() => updateVersionMut.mutate(activeVersion.id)}
                disabled={updateVersionMut.isPending}
              >
                {updateVersionMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Atualizar v{activeVersion.version}
              </Button>
            )}
            <Button size="sm" className="gap-1.5 text-xs nexus-gradient-bg text-primary-foreground hover:opacity-90"
              onClick={() => createVersionMut.mutate()}
              disabled={createVersionMut.isPending || !content.trim()}
            >
              {createVersionMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Nova versão
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="editor" className="text-xs data-[state=active]:bg-background">Editor</TabsTrigger>
          <TabsTrigger value="versions" className="text-xs data-[state=active]:bg-background">
            Versões ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="score" className="text-xs data-[state=active]:bg-background">Score</TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="mt-4 space-y-4">
          {versions.length === 0 && (
            <div className="nexus-card flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Nenhuma versão ainda</h3>
              <p className="text-xs text-muted-foreground mb-4">Escreva o primeiro prompt para este agente.</p>
            </div>
          )}
          <div className="nexus-card">
            <Label className="text-sm font-semibold text-foreground mb-2 block">Conteúdo do prompt</Label>
            <Textarea
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Você é um assistente especializado em..."
              rows={Math.max(12, content.split("\n").length + 2)}
              className="bg-nexus-surface-1 border-border/50 font-mono text-xs leading-relaxed resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">{content.length} caracteres • {content.split(/\s+/).filter(Boolean).length} palavras</span>
              {dirty && <Badge variant="outline" className="text-[11px] text-nexus-amber border-nexus-amber/30">não salvo</Badge>}
            </div>
          </div>
          <div className="nexus-card">
            <Label className="text-sm font-semibold text-foreground mb-2 block">Resumo da alteração (opcional)</Label>
            <Input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Ex: Refinei persona e adicionei regras de segurança"
              className="bg-secondary/50 border-border/50 text-xs"
            />
          </div>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">Histórico de versões</h3>
              {versions.map((v: any) => (
                <div key={v.id}
                  className={`nexus-card flex items-center justify-between cursor-pointer transition-all ${
                    diffVersionId === v.id ? "ring-2 ring-primary bg-primary/5" : ""
                  } ${v.is_active ? "border-primary/30" : ""}`}
                  onClick={() => setDiffVersionId(diffVersionId === v.id ? null : v.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${v.is_active ? "bg-primary/15" : "bg-secondary"}`}>
                      <GitBranch className={`h-4 w-4 ${v.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">v{v.version}</span>
                        {v.is_active && <Badge className="bg-primary/10 text-primary text-[11px]">ativa</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{v.change_summary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString("pt-BR")}
                    </span>
                    <AccessControl permission="workflows.delete">
                      <DangerousActionDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        }
                        title="Excluir versão do prompt"
                        description="Esta versão será apagada permanentemente. O histórico de execuções vinculado a ela ficará órfão."
                        action="delete"
                        resourceType="prompt_version"
                        resourceId={v.id}
                        resourceName={`v${v.version ?? v.id.slice(0, 8)}`}
                        minReasonLength={8}
                        confirmLabel="Excluir Versão"
                        onConfirm={async () => {
                          await deleteVersionMut.mutateAsync(v.id);
                        }}
                      />
                    </AccessControl>
                  </div>
                </div>
              ))}
            </div>
            <div className="nexus-card">
              {diffVersion ? (
                <>
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    v{diffVersion.version} — {diffVersion.change_summary}
                  </h3>
                  <div className="rounded-lg bg-nexus-surface-1 p-4 font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                    {diffVersion.content}
                  </div>
                  <div className="flex gap-2 mt-3">
                    {!diffVersion.is_active && (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
                        onClick={() => restoreVersionMut.mutate(diffVersion)}
                        disabled={restoreVersionMut.isPending}
                      >
                        <RotateCcw className="h-3 w-3" /> Restaurar esta versão
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => { setContent(diffVersion.content); setActiveTab("editor"); setDirty(true); toast.info("Conteúdo copiado para o editor"); }}
                    >
                      Copiar para editor
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <GitBranch className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Clique em uma versão para visualizar.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="score" className="mt-4">
          <div className="nexus-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                    strokeDasharray={`${scorePercent * 0.975} 97.5`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-heading font-bold text-foreground">
                  {scorePercent}%
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Score de qualidade</h3>
                <p className="text-xs text-muted-foreground">Análise automática baseada no conteúdo atual</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { key: "clarity", label: "Clareza (>50 chars)" },
                { key: "scope", label: "Escopo definido" },
                { key: "tools", label: "Ferramentas mencionadas" },
                { key: "format", label: "Formato de saída" },
                { key: "safety", label: "Regras de segurança" },
                { key: "examples", label: "Exemplos few-shot" },
                { key: "fallback", label: "Política de fallback" },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2 text-xs">
                  {score[item.key as keyof typeof score] ? (
                    <CheckCircle className="h-4 w-4 text-nexus-emerald" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-nexus-amber" />
                  )}
                  <span className={score[item.key as keyof typeof score] ? "text-foreground" : "text-muted-foreground"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
