/**
 * Agent Templates Gallery — fork-in-one-click marketplace.
 * Lista todos os templates de `agentTemplates.ts`, agrupados por categoria,
 * com busca, filtro e ação direta de criar agente a partir do template.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Search, Sparkles, Wand2, Tag, Cpu, Wrench } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ImportTemplateDialog } from '@/components/agents/ImportTemplateDialog';
import { AGENT_TEMPLATES, type AgentTemplate } from '@/data/agentTemplates';
import { toAgentTools } from '@/data/toolCatalog';
import { buildRagSourcesForAgent } from '@/data/knowledgeBaseSeeds';
import { DEFAULT_AGENT } from '@/data/agentBuilderData';
import { saveAgent } from '@/lib/agentService';
import type {
  AgentConfig,
  AgentPersona,
  DeployChannelConfig,
  FewShotExample,
  GuardrailConfig,
  LLMModel,
  TestCase,
} from '@/types/agentTypes';
import { useAuth } from '@/contexts/useAuth';
import { logger } from '@/lib/logger';

const ALL = 'all';

/** UUID v4-ish usando crypto.randomUUID com fallback para ambientes sem crypto. */
function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildAgentFromTemplate(t: AgentTemplate): AgentConfig {
  const cfg = t.config;

  // 1. Resolve tools (strings → AgentTool[]) via TOOL_CATALOG.
  //    Para templates enriquecidos injetamos:
  //      - guard_input           → defesa contra prompt injection (llmGuardrail.ts)
  //      - request_human_approval → quando há triggers de HITL (hitlQueue.ts)
  const requestedTools = cfg.tools ?? [];
  const autoTools: string[] = [];
  if (t.enriched) autoTools.push('guard_input');
  if ((cfg.human_in_loop_triggers ?? []).length > 0) autoTools.push('request_human_approval');
  const toolsWithGuard = Array.from(new Set([...autoTools, ...requestedTools]));
  const { tools: resolvedTools, unknown: unknownTools } = toAgentTools(toolsWithGuard);
  if (unknownTools.length) {
    logger.warn(`Template ${t.id} referencia tools não catalogadas`, unknownTools);
  }

  // 2. Guardrails detalhados → GuardrailConfig[].
  const guardrails: GuardrailConfig[] = (cfg.detailed_guardrails ?? []).map((g) => ({
    id: g.id ?? makeId(),
    category: g.category,
    name: g.name,
    description: g.description ?? '',
    enabled: true,
    severity: g.severity,
    config: g.config,
  }));

  // 2b. Defesa contra prompt injection — padrão para templates enriquecidos.
  if (t.enriched && !guardrails.some((g) => g.name === 'LLM Injection Defense')) {
    guardrails.unshift({
      id: makeId(),
      category: 'input_validation',
      name: 'LLM Injection Defense',
      description:
        'Passa toda entrada pelo guardrails-engine (local + remoto) e bloqueia tentativas de ignorar instruções, revelar prompt ou exfiltrar dados.',
      enabled: true,
      severity: 'block',
      config: { rail: 'llm_injection_defense' },
    });
  }

  // 3. Few-shot examples.
  const fewShots: FewShotExample[] = (cfg.few_shot_examples ?? []).map((ex) => ({
    id: makeId(),
    input: ex.input,
    expected_output: ex.expected_output,
    tags: ex.tags ?? [],
  }));

  // 4. Test cases.
  const testCases: TestCase[] = (cfg.test_cases ?? []).map((tc) => ({
    id: makeId(),
    name: tc.name,
    input: tc.input,
    expected_behavior: tc.expected_behavior,
    category: tc.category,
    tags: tc.tags ?? [],
    status: 'pending',
  }));

  // 5a. Output validation: quando o template pede validação, elevamos cada tool
  //     para output_validation='schema' (rejeita output fora do formato do input_schema).
  const resolvedToolsWithValidation = cfg.output_validation_schema
    ? resolvedTools.map((tool) => ({ ...tool, output_validation: 'schema' as const }))
    : resolvedTools;

  // 5. Deploy channels.
  const deployChannels: DeployChannelConfig[] = (cfg.deploy_channels ?? []).map((dc) => ({
    id: makeId(),
    channel: dc.channel,
    enabled: true,
    config: dc.config ?? {},
    status: 'inactive',
  }));

  // 6. Overrides de memória sobre DEFAULT_AGENT.
  const memOverrides = cfg.memory_overrides ?? {};

  // 7. Se o template é enriquecido, começa em "configured" para pular direto para testes.
  const startStatus: AgentConfig['status'] = t.enriched ? 'configured' : 'draft';

  return {
    ...DEFAULT_AGENT,
    name: t.name,
    mission: t.description,
    persona: cfg.persona as AgentPersona,
    model: cfg.model as LLMModel,
    avatar_emoji: t.emoji,
    temperature: Math.round((cfg.temperature ?? 0.3) * 100), // DEFAULT_AGENT usa escala 0-100
    status: startStatus,
    version: 1,
    tags: [...(t.tags ?? []), `template:${t.id}`],

    system_prompt: cfg.system_prompt,
    system_prompt_version: 1,
    few_shot_examples: fewShots,

    reasoning: (cfg.reasoning ?? DEFAULT_AGENT.reasoning) as AgentConfig['reasoning'],
    output_format: (cfg.output_format ??
      DEFAULT_AGENT.output_format) as AgentConfig['output_format'],

    tools: resolvedToolsWithValidation,
    guardrails,
    test_cases: testCases,
    deploy_channels: deployChannels,

    // 8. Knowledge Bases: injeta automaticamente as KBs canônicas
    //    (definidas em `knowledgeBaseSeeds`) que mapeiam para este agente
    //    via `intended_agents`. Admin ingere docs manualmente na UI de KB.
    rag_sources: buildRagSourcesForAgent(t.id),

    human_in_loop: Boolean(cfg.human_in_loop_triggers?.length),
    human_in_loop_triggers: cfg.human_in_loop_triggers ?? [],

    memory_short_term: memOverrides.short_term ?? DEFAULT_AGENT.memory_short_term,
    memory_episodic: memOverrides.episodic ?? DEFAULT_AGENT.memory_episodic,
    memory_semantic: memOverrides.semantic ?? DEFAULT_AGENT.memory_semantic,
    memory_procedural: memOverrides.procedural ?? DEFAULT_AGENT.memory_procedural,
    memory_profile: memOverrides.profile ?? DEFAULT_AGENT.memory_profile,
    memory_shared: memOverrides.shared ?? DEFAULT_AGENT.memory_shared,

    monthly_budget: cfg.monthly_budget ?? DEFAULT_AGENT.monthly_budget,
    budget_alert_threshold: cfg.budget_alert_threshold ?? DEFAULT_AGENT.budget_alert_threshold,
  };
}

export default function AgentTemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  // Templates importados nesta sessão (não persistidos no DB).
  const [importedTemplates, setImportedTemplates] = useState<AgentTemplate[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const allTemplates = useMemo(
    () => [...importedTemplates, ...AGENT_TEMPLATES],
    [importedTemplates],
  );

  const categories = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: allTemplates.length };
    for (const t of allTemplates) {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    return Object.entries(counts).sort(([a], [b]) =>
      a === ALL ? -1 : b === ALL ? 1 : a.localeCompare(b),
    );
  }, [allTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTemplates.filter((t) => {
      if (category !== ALL && t.category !== category) return false;
      if (!q) return true;
      const hay = `${t.name} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allTemplates, search, category]);

  const forkMutation = useMutation({
    mutationFn: async (t: AgentTemplate) => {
      if (!user) throw new Error('Faça login para criar agentes');
      const agent = buildAgentFromTemplate(t);
      return saveAgent(agent);
    },
    onSuccess: (agent, t) => {
      toast.success(`Agente "${t.name}" criado!`, { description: 'Abrindo no builder…' });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      if (agent.id) navigate(`/builder/${agent.id}`);
    },
    onError: (err) => {
      logger.error('fork template failed', err);
      toast.error(err instanceof Error ? err.message : 'Falha ao criar agente');
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Galeria de Templates"
        description="Comece em segundos — escolha um template pronto e personalize"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setImportOpen(true)}
            >
              <Download className="h-3.5 w-3.5" /> Importar Template
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/agents')}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          </div>
        }
      />

      <ImportTemplateDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onAddToGallery={(t) => {
          setImportedTemplates((prev) => [t, ...prev]);
          toast.success(`Template "${t.name}" adicionado à galeria (sessão atual)`);
        }}
        onForkNow={(t) => forkMutation.mutate(t)}
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
          {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
        </Badge>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-3">
          {categories.map(([cat, count]) => (
            <Button
              key={cat}
              size="sm"
              variant={cat === category ? 'default' : 'outline'}
              onClick={() => setCategory(cat)}
              className="gap-1.5 shrink-0"
            >
              {cat === ALL ? 'Todos' : cat}
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
                      ? `${t.config.tools.length} ferramenta${t.config.tools.length > 1 ? 's' : ''}`
                      : 'Sem ferramentas'}
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
                  ? 'Criando…'
                  : 'Usar este template'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
