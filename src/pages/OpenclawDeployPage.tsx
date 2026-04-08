import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Server,
  Activity,
  Bot,
  Package,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  getOpenclawHealth,
  listOpenclawAgents,
  listOpenclawSkills,
  deploySkillToOpenclaw,
} from "@/services/openclawDeployService";

export default function OpenclawDeployPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [skillName, setSkillName] = useState("");
  const [skillVersion, setSkillVersion] = useState("1.0.0");
  const [skillDescription, setSkillDescription] = useState("");
  const [skillContent, setSkillContent] = useState(
    "# SKILL: example\n\nDescribe what this skill does here.\n\n## Usage\n\nInstructions for the runtime..."
  );
  const [deploying, setDeploying] = useState(false);

  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
    error: healthError,
  } = useQuery({
    queryKey: ["openclaw-health"],
    queryFn: getOpenclawHealth,
    retry: false,
    refetchInterval: 30_000,
  });

  const {
    data: agents = [],
    isLoading: agentsLoading,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["openclaw-agents"],
    queryFn: listOpenclawAgents,
    retry: false,
  });

  const {
    data: skills = [],
    isLoading: skillsLoading,
    refetch: refetchSkills,
  } = useQuery({
    queryKey: ["openclaw-skills"],
    queryFn: listOpenclawSkills,
    retry: false,
  });

  const handleDeploy = async () => {
    if (!skillName.trim() || !skillContent.trim()) {
      toast.error("Nome e conteúdo do SKILL.md são obrigatórios");
      return;
    }
    setDeploying(true);
    try {
      await deploySkillToOpenclaw({
        name: skillName.trim(),
        version: skillVersion.trim() || "1.0.0",
        description: skillDescription.trim() || undefined,
        content: skillContent,
      });
      toast.success(`Skill "${skillName}" deployada`);
      setSkillName("");
      setSkillDescription("");
      await queryClient.invalidateQueries({ queryKey: ["openclaw-skills"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no deploy");
    } finally {
      setDeploying(false);
    }
  };

  const healthOk = !!health && !healthError && (health.status === "ok" || health.status === "healthy");

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="OpenClaw Deploy"
        description="Runtime SKILL.md — deploy e monitoramento"
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`gap-1.5 ${healthOk ? "border-green-500/50 text-green-400" : "border-red-500/50 text-red-400"}`}
            >
              {healthLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : healthOk ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {healthLoading ? "Checando" : healthOk ? "Online" : "Offline"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchHealth();
                refetchAgents();
                refetchSkills();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Skills ({skills.length})
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Deploy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-primary" /> Status do Runtime
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verificando saúde do OpenClaw...
                </div>
              ) : healthError ? (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                  Falha ao contatar OpenClaw: {healthError instanceof Error ? healthError.message : "erro desconhecido"}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                    <p className="text-sm font-mono mt-1">{health?.status ?? "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Versão</p>
                    <p className="text-sm font-mono mt-1">{health?.version ?? "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-border">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Uptime</p>
                    <p className="text-sm font-mono mt-1">
                      {typeof health?.uptime === "number" ? `${Math.round(health.uptime)}s` : "—"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          {agentsLoading ? (
            <div className="text-center py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando agents...
            </div>
          ) : agents.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-gray-400">
                <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum agent encontrado no runtime OpenClaw.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <Card key={a.id} className="bg-card border-border">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Bot className="h-4 w-4 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.description && <p className="text-xs text-gray-400 truncate">{a.description}</p>}
                    </div>
                    {a.status && (
                      <Badge variant="outline" className="text-[10px] border-border">
                        {a.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-6">
          {skillsLoading ? (
            <div className="text-center py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando skills...
            </div>
          ) : skills.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum SKILL.md instalado.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {skills.map((s) => (
                <Card key={s.id} className="bg-card border-border">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Package className="h-4 w-4 text-nexus-purple" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.name}</p>
                      {s.description && <p className="text-xs text-gray-400 truncate">{s.description}</p>}
                    </div>
                    {s.version && (
                      <Badge variant="outline" className="text-[10px] border-border font-mono">
                        v{s.version}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="deploy" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4 text-nexus-emerald" /> Deploy de SKILL.md
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="skill-name">Nome</Label>
                  <Input
                    id="skill-name"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="product-search"
                    className="bg-background border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="skill-version">Versão</Label>
                  <Input
                    id="skill-version"
                    value={skillVersion}
                    onChange={(e) => setSkillVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="bg-background border-border font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-desc">Descrição</Label>
                <Input
                  id="skill-desc"
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  placeholder="O que este skill faz?"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-content">Conteúdo SKILL.md</Label>
                <Textarea
                  id="skill-content"
                  value={skillContent}
                  onChange={(e) => setSkillContent(e.target.value)}
                  rows={12}
                  className="bg-background border-border font-mono text-xs resize-none"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleDeploy}
                  disabled={deploying || !healthOk}
                  className="bg-nexus-emerald hover:bg-nexus-emerald/90 text-white gap-1.5"
                >
                  {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Deploy no OpenClaw
                </Button>
              </div>
              {!healthOk && (
                <p className="text-xs text-red-400 text-right">
                  ⚠ OpenClaw offline — verifique o VPS antes de tentar deploy.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
