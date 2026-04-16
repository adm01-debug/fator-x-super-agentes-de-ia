/**
 * Agent Templates Gallery — fork-in-one-click marketplace.
 * Lista todos os templates de `agentTemplates.ts`, agrupados por categoria,
 * com busca, filtro e ação direta de criar agente a partir do template.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Search, Sparkles, Wand2, Tag, Cpu, Wrench } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AGENT_TEMPLATES, type AgentTemplate } from "@/data/agentTemplates";
import { saveAgent } from "@/lib/agentService";
import type { AgentConfig } from "@/types/agentTypes";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

const ALL = "all";

function buildAgentFromTemplate(t: AgentTemplate): AgentConfig {
  return {
    name: t.name,
    mission: t.description,
    persona: t.config.persona,
    model: t.config.model,
    avatar_emoji: t.emoji,
    reasoning: null,
    status: "draft",
    version: 1,
    tags: t.tags ?? [],
    config: {
      temperature: t.config.temperature,
      system_prompt: t.config.system_prompt,
      tools: t.config.tools,
      guardrails: t.config.guardrails,
      memory_types: t.config.memory_types,
      template_id: t.id,
    },
  } as unknown as AgentConfig;
}

export default function AgentTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: AGENT_TEMPLATES.length };
    for (const t of AGENT_TEMPLATES) {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([a], [b]) =>
      a === ALL ? -1 : b === ALL ? 1 : a.localeCompare(b),
    );
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENT_TEMPLATES.filter((t) => {
      if (category !== ALL && t.category !== category) return false;
      if (!q) return true;
      const hay = `${t.name} ${t.description} ${t.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, category]);

  const forkMutation = useMutation({
    mutationFn: async (t: AgentTemplate) => {
      if (!user) throw new Error("Faça login para criar agentes");
      const agent = buildAgentFromTemplate(t);
      return saveAgent(agent);
    },
    onSuccess: (agent, t) => {
      toast.success(`Agente "${t.name}" criado!`, { description: "Abrindo no builder…" });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (agent.id) navigate(`/builder/${agent.id}`);
    },
    onError: (err) => {
      logger.error("fork template failed", err);
      toast.error(err instanceof Error ? err.message : "Falha ao criar agente");
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Galeria de Templates"
        description="Comece em segundos — escolha um template pronto e personalize"
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/agents")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar templates por nome, tag ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="h-3 w-3" />
          {filtered.length} {filtered.length === 1 ? "template" : "templates"}
        </Badge>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-3">
          {categories.map(([cat, count]) => (
            <Button
              key={cat}
              size="sm"
              variant={cat === category ? "default" : "outline"}
              onClick={() => setCategory(cat)}
              className="gap-1.5 shrink-0"
            >
              {cat === ALL ? "Todos" : cat}
              <Badge
                variant="secondary"
                className="ml-0.5 h-5 px-1.5 text-[10px] font-semibold tabular-nums"
              >
                {count}
              </Badge>
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Wand2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum template encontrado para "{search}"
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          {filtered.map((t, i) => (
            <Card
              key={t.id}
              className="nexus-card p-5 space-y-4 group cursor-pointer hover:border-primary/40 transition-all"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-2xl shrink-0 ring-1 ring-border/40">
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.category}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                {t.description}
              </p>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono">{t.config.model}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wrench className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {t.config.tools.length > 0
                      ? `${t.config.tools.length} ferramenta${t.config.tools.length > 1 ? "s" : ""}`
                      : "Sem ferramentas"}
                  </span>
                </div>
              </div>

              {t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-5 gap-0.5 font-normal"
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </Badge>
                  ))}
                  {t.tags.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                      +{t.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <Button
                onClick={() => forkMutation.mutate(t)}
                disabled={forkMutation.isPending}
                className="w-full nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90"
                size="sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {forkMutation.isPending && forkMutation.variables?.id === t.id
                  ? "Criando…"
                  : "Usar este template"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
